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
  'sources.json', 'core.js', 'classify.js', 'reports.js', 'email.js', 'backup.js',
  'run_daily.js', 'run_weekly.js', 'run_monthly.js', 'ingest_mcp.js', 'adapters',
  'email_config.json.example', 'github_config.json.example', '.gitignore',
  'linkedin_gasturbinehub.json', 'linkedin_gasturbinehub.md'
];

function sh(cmd, timeout = 60000, env = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
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
        sh(`git -c credential.helper= -c http.sslVerify=true push origin HEAD:refs/heads/${branch}`, 120000, pushEnv);
        result.steps.push(`pushed -> ${branch}`);
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
