/**
 * email.js — 通过 163 邮箱发送报告
 * 凭据读 email_config.json（不提交到仓库）。发送失败不影响主流程，仅记录错误。
 */
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'email_config.json');
const LABEL = { daily: '每日', weekly: '每周', monthly: '每月' };

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch (e) { return null; }
}

function mdToHtml(md) {
  // 极简 Markdown → HTML（标题/列表/链接/换行）
  return md
    .split('\n')
    .map(line => {
      if (/^#### /.test(line)) return `<h4>${line.slice(5)}</h4>`;
      if (/^### /.test(line)) return `<h3>${line.slice(4)}</h3>`;
      if (/^## /.test(line)) return `<h2>${line.slice(3)}</h2>`;
      if (/^# /.test(line)) return `<h1>${line.slice(2)}</h1>`;
      if (/^- /.test(line)) return `<li>${line.slice(2)}</li>`;
      if (/^\*\*/.test(line)) return `<p><strong>${line.replace(/\*\*/g, '')}</strong></p>`;
      if (line.trim() === '') return '<br/>';
      return `<p>${line}</p>`;
    })
    .join('\n');
}

async function sendReport(report, period) {
  const cfg = loadConfig();
  if (!cfg || !cfg.user || !cfg.authCode) {
    return { ok: false, skipped: true, reason: 'email_config.json 未配置（缺 user/authCode）' };
  }
  const { path: filePath, count } = report;
  if (!fs.existsSync(filePath)) return { ok: false, error: '报告文件不存在' };
  const md = fs.readFileSync(filePath, 'utf8');
  const date = path.basename(filePath, '.md');

  const transporter = nodemailer.createTransport({
    host: cfg.host || 'smtp.163.com',
    port: cfg.port || 465,
    secure: cfg.secure !== false,
    auth: { user: cfg.user, pass: cfg.authCode }
  });

  const mail = {
    from: cfg.user,
    to: cfg.to || cfg.user,
    subject: `${LABEL[period] || ''}资讯报告 ${date}（${count} 条）`,
    text: md,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.6">${mdToHtml(md)}</div>`,
    attachments: [{ filename: path.basename(filePath), path: filePath }]
  };

  try {
    const info = await transporter.sendMail(mail);
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { sendReport };
