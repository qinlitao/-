/**
 * backup.js — 本地 git 提交（+ 可选 push 到 GitHub）
 * 只 add 指定目录/文件，避免扫描 edge-profile/node_modules 等大目录。
 * 若 github_config.json 含 repo 字段，则 add remote + push。
 * 所有 git 操作失败均不阻断主流程，仅返回错误。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'github_config.json');

// 需要纳入版本管理的路径（避开 edge-profile / node_modules / 凭据）
const TRACKED = [
  'daily_report', 'weekly_report', 'monthly_report', 'state',
  'sources.json', 'core.js', 'classify.js', 'quality.js', 'reports.js', 'email.js', 'backup.js',
  'run_daily.js', 'run_weekly.js', 'run_monthly.js', 'ingest_mcp.js', 'adapters',
  'email_config.json.example', 'github_config.json.example', '.gitignore',
  'linkedin_gasturbinehub.json', 'linkedin_gasturbinehub.md', 'check_sources_health.js'
];

function sh(cmd, timeout = 60000, env = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
}

/**
 * 检测可用的 HTTP 代理，解决沙箱 libcurl 的 DNS 线程崩溃
 * (getaddrinfo() thread failed to start) —— 直连 push 必失败，
 * 但 git 直连 127.0.0.1(代理) 时 DNS 由代理解析即可成功。
 * 优先级: 环境变量 GIT_PROXY > Windows 系统代理(IE/Edge 读取位置) > 无。
 */
function detectProxy() {
  if (process.env.GIT_PROXY) return process.env.GIT_PROXY;
  if (process.platform === 'win32') {
    try {
      const en = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      if (!/ProxyEnable[\s\S]*0x1\b/.test(en)) return null;
      const out = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const m = out.match(/ProxyServer\s+REG_SZ\s+(.+)/);
      if (m) {
        let s = m[1].trim();
        // 可能形如 http=127.0.0.1:7890;https=127.0.0.1:7890 或裸 127.0.0.1:7897
        const https = s.match(/https=([^\s;]+)/);
        const http = s.match(/http=([^\s;]+)/);
        let host = (https || http || [, s])[1].trim();
        if (host && !/^https?:\/\//.test(host)) host = 'http://' + host;
        return host || null;
      }
    } catch (_) { /* 无代理或 reg 不可用 */ }
  }
  return null;
}

function backup(date) {
  const result = { ok: true, steps: [] };
  try {
    try { sh('git rev-parse --is-inside-work-tree'); }
    catch (e) {
      sh('git init');
    }
    // 确保本地 git 身份存在（仓库已存在时不会走上面的 init 分支）
    try { sh('git config user.email'); } catch { sh('git config user.email "collector@local"'); }
    try { sh('git config user.name'); } catch { sh('git config user.name "daily-collector"'); }

    // 只 add 指定路径
    const existing = TRACKED.filter(p => fs.existsSync(path.join(ROOT, p)));
    if (existing.length) sh(`git add ${existing.map(p => `"${p}"`).join(' ')}`);

    try {
      sh(`git commit -m "backup ${date}"`, 60000);
      result.steps.push('committed');
    } catch (e) {
      result.steps.push('nothing to commit');
    }

    const cfg = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : null;
    if (cfg && cfg.repo) {
      try {
        // 把 PAT 注入 URL（token 单独存放，避免把明文 token 写进 base repo 字段）
        const base = cfg.repo;
        const authUrl = (cfg.token && !/^https:\/\/[^@]+@/.test(base))
          ? base.replace(/^https:\/\//, `https://${cfg.token}:@`)
          : base;
        sh(`git remote get-url origin 2>nul || git remote add origin ${authUrl}`);
        // 始终用最新 token 同步 remote（token 变更后才会生效）
        if (cfg.token) sh(`git remote set-url origin ${authUrl}`);
        // 推到独立分支，避免覆盖仓库已有的 main（备份互不干扰）
        const branch = cfg.branch || 'daily-news';
        // 禁用 Windows Git Credential Manager / 任何凭据助手，强制只用 URL 内嵌的 token；
        // 否则 GCM 会弹 GUI 并卡死沙箱。GIT_TERMINAL_PROMPT=0 让其快速失败而非等待。
        const pushEnv = { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };
        const proxy = detectProxy();
        const pushCmd = (useProxy) =>
          `git -c credential.helper= -c http.sslVerify=true${useProxy && proxy ? ` -c http.proxy=${proxy} -c https.proxy=${proxy}` : ''} push origin HEAD:refs/heads/${branch}`;
        try {
          if (proxy) {
            // 优先走代理（沙箱内直连 DNS 线程会崩溃）；代理不可用(未开 Clash)时回退直连
            try { sh(pushCmd(true), 120000, pushEnv); }
            catch (eProxy) {
              try { sh(pushCmd(false), 120000, pushEnv); }
              catch (eDirect) { throw new Error(`proxy: ${eProxy.message} | direct: ${eDirect.message}`); }
            }
          } else {
            sh(pushCmd(false), 120000, pushEnv);
          }
          result.steps.push(`pushed -> ${branch}${proxy ? ' (via proxy)' : ''}`);
        } catch (e) {
          result.pushError = `push 失败: ${e.message}`;
        }
      } catch (e) {
        result.pushError = `push 失败: ${e.message}`;
      }
    } else {
      result.steps.push('skip push (未配置 github_config.json)');
    }
  } catch (e) {
    result.ok = false;
    result.error = e.message;
  }
  return result;
}

module.exports = { backup };
