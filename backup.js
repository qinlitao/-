/**
 * backup.js — 本地 git 提交（+ 可选 push 到 GitHub）
 * 本地提交：git init（若不存在）→ add -A → commit。
 * 若 github_config.json 含 repo 字段，则 add remote + push。
 * 所有 git 操作失败均不阻断主流程，仅返回错误。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'github_config.json');

function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function backup(date) {
  const result = { ok: true, steps: [] };
  try {
    // 1. 初始化（若不存在）
    try { sh('git rev-parse --is-inside-work-tree'); }
    catch (e) { sh('git init'); sh('git config user.email "collector@local"'); sh('git config user.name "daily-collector"'); }

    // 2. 提交
    sh('git add -A');
    try {
      sh(`git commit -m "backup ${date}"`);
      result.steps.push('committed');
    } catch (e) {
      result.steps.push('nothing to commit');
    }

    // 3. 可选 push
    const cfg = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : null;
    if (cfg && cfg.repo) {
      try {
        sh(`git remote get-url origin 2>/dev/null || git remote add origin ${cfg.repo}`);
        sh('git push origin HEAD');
        result.steps.push('pushed');
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
