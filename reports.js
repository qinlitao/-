/**
 * reports.js — 日/周/月报渲染（同内核，不同时间窗）
 * 从 state/archive.jsonl 按 collectedDate 窗口筛选，按「分类 → 信源」分组渲染 Markdown。
 */
const fs = require('fs');
const path = require('path');
const { ARCHIVE_FILE, todayStr } = require('./core');

const ROOT = __dirname;
const OUT_DIR = {
  daily: path.join(ROOT, 'daily_report'),
  weekly: path.join(ROOT, 'weekly_report'),
  monthly: path.join(ROOT, 'monthly_report'),
};
const LABEL = { daily: '每日', weekly: '每周', monthly: '每月' };
const WINDOW = { daily: 0, weekly: 6, monthly: 29 };

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadArchive() {
  if (!fs.existsSync(ARCHIVE_FILE)) return [];
  const lines = fs.readFileSync(ARCHIVE_FILE, 'utf8').split('\n').filter(Boolean);
  return lines.map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}

function renderReport(period) {
  const date = todayStr();
  const cutoff = daysAgoStr(WINDOW[period]);
  const items = loadArchive().filter(it => it.collectedDate >= cutoff);
  items.sort((a, b) => (a.collectedDate < b.collectedDate ? 1 : -1));

  // 分组：分类 → 信源 → items
  const byCat = {};
  for (const it of items) {
    (byCat[it.category] = byCat[it.category] || {});
    (byCat[it.category][it.name] = byCat[it.category][it.name] || []).push(it);
  }

  let md = `# ${LABEL[period]}资讯报告 · ${date}\n\n`;
  md += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
  md += `统计窗口: ${period === 'daily' ? '当日' : `近 ${WINDOW[period] + 1} 天（${cutoff} ~ ${date}）`}\n`;
  md += `新增内容总数: ${items.length}\n\n---\n\n`;

  const catNames = Object.keys(byCat);
  if (!catNames.length) {
    md += '_本窗口内无新增内容。_\n';
  } else {
    for (const cat of catNames) {
      md += `## 分类：${cat}（${Object.values(byCat[cat]).reduce((s, a) => s + a.length, 0)}）\n\n`;
      for (const [srcName, list] of Object.entries(byCat[cat])) {
        md += `### 信源：${srcName}（${list.length}）\n\n`;
        list.forEach((it, i) => {
          md += `#### ${i + 1}. ${it.title || '(无标题)'}\n`;
          if (it.publishedText) md += `**时间**: ${it.publishedText}\n\n`;
          if (it.tags && it.tags.length) md += `**标签**: ${it.tags.join(' / ')}\n\n`;
          if (it.text) md += `${it.text.slice(0, 1500)}\n\n`;
          if (it.images && it.images.length) md += `**图片** (${it.images.length}):\n` + it.images.map(u => `- ${u}`).join('\n') + '\n\n';
          if (it.url) md += `[原文](${it.url})\n\n`;
        });
      }
    }
  }

  const dir = OUT_DIR[period];
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `${date}.md`);
  fs.writeFileSync(outPath, md, 'utf8');
  return { path: outPath, count: items.length, period };
}

module.exports = { renderReport };
