/**
 * daily_collector.js — 每日刷新采集器
 *
 * 功能：
 *  1. 读取 sources.json（真实信源注册表）
 *  2. 对每个 LinkedIn 信源：复用已登录的 Edge profile（headless）抓取主页动态
 *  3. 对每个微信公众号 RSS 信源：抓取 RSS 并解析（feed_url 为真实地址时才跑）
 *  4. 以内容 ID 做跨天去重（LinkedIn=urn activity id，微信=文章链接）
 *  5. 仅把"今日新增"写入 daily_report/YYYY-MM-DD.md
 *  6. 同步维护 state/seen.json（已见过的 ID 库）
 *
 * 依赖：playwright（项目本地 node_modules）
 * 运行：node daily_collector.js
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const PROFILE = path.join(ROOT, 'edge-profile');
const SOURCES_FILE = path.join(ROOT, 'sources.json');
const STATE_DIR = path.join(ROOT, 'state');
const STATE_FILE = path.join(STATE_DIR, 'seen.json');
const REPORT_DIR = path.join(ROOT, 'daily_report');
const STATUS_FILE = path.join(ROOT, 'daily_status.json');

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------- 状态（去重库） ----------
function loadSeen() {
  ensureDir(STATE_DIR);
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveSeen(seen) {
  ensureDir(STATE_DIR);
  fs.writeFileSync(STATE_FILE, JSON.stringify(seen, null, 2), 'utf8');
}

// 从已见库里筛出新条目；并把新 ID 写回库
function filterNew(seen, sourceKey, items) {
  const fresh = [];
  for (const it of items) {
    const id = it.id || it.link || it.url;
    if (!id) continue;
    const key = `${sourceKey}::${id}`;
    if (!seen[key]) {
      seen[key] = todayStr();
      fresh.push(it);
    }
  }
  return fresh;
}

// ---------- LinkedIn 采集（headless，复用 Edge profile） ----------
async function collectLinkedIn(url, tz) {
  const out = { items: [], sessionExpired: false, error: null };
  let context;
  try {
    context = await chromium.launchPersistentContext(PROFILE, {
      channel: 'msedge',
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      viewport: { width: 1280, height: 900 }
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);

    const cur = page.url();
    if (cur.includes('/login') || cur.includes('/checkpoint')) {
      out.sessionExpired = true;
      await context.close().catch(() => {});
      return out;
    }

    // 关闭"访问记录"提示
    try {
      const btn = await page.$('button:has-text("继续前往公司主页"), button[aria-label*="继续"], .artdeco-modal__confirm-dialog-btn');
      if (btn) {
        await btn.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) { /* ignore */ }

    // 滚动加载
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, 1400));
      await page.waitForTimeout(1800);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);

    const posts = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll('div[role="article"], .feed-shared-update-v2, .update-components-actor');
      const seen = new Set();
      cards.forEach(card => {
        try {
          let root = card.closest && card.closest('div[role="article"]');
          if (!root) root = card.closest && card.closest('.feed-shared-update-v2');
          if (!root) root = card;
          const id = root.getAttribute('data-id') || root.getAttribute('data-urn') || '';
          if (!id || seen.has(id)) return;
          seen.add(id);

          const authorSelectors = [
            '.update-components-actor__name span', '.update-components-actor__name',
            '.feed-shared-actor__name span', '.feed-shared-actor__name'
          ];
          let author = '';
          for (const sel of authorSelectors) {
            const el = root.querySelector(sel);
            if (el && el.textContent.trim()) { author = el.textContent.trim(); break; }
          }
          const timeEl = root.querySelector('time');
          let timeText = '';
          let datetime = '';
          if (timeEl) { timeText = timeEl.textContent.trim(); datetime = timeEl.getAttribute('datetime') || ''; }
          if (!timeText) {
            const sub = root.querySelector('.feed-shared-actor__sub-description, .update-components-actor__sub-description');
            if (sub) timeText = sub.textContent.trim();
          }
          const textSelectors = [
            '.feed-shared-inline-show-more-text span', '.feed-shared-inline-show-more-text',
            '.update-components-text span', '.update-components-text', '.break-words'
          ];
          let text = '';
          for (const sel of textSelectors) {
            const el = root.querySelector(sel);
            if (el && el.innerText.trim()) { text = el.innerText.trim(); break; }
          }
          const imgs = Array.from(root.querySelectorAll('img'))
            .map(img => img.src)
            .filter(src => src && !src.includes('company-logo') && src.includes('media.licdn.com'));
          if (text || imgs.length) {
            results.push({ id, author, timeText, datetime, text, images: imgs.slice(0, 10) });
          }
        } catch (e) { /* skip */ }
      });
      return results;
    });

    out.items = posts.map(p => ({
      id: p.id,
      author: p.author,
      timeText: p.timeText,
      datetime: p.datetime,
      text: p.text,
      images: p.images,
      url: url
    }));

    await context.close().catch(() => {});
  } catch (e) {
    out.error = e.message;
    if (context) await context.close().catch(() => {});
  }
  return out;
}

// ---------- 微信公众号 RSS 采集（纯 fetch，无需登录） ----------
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

function pick(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const mm = block.match(re);
  if (!mm) return '';
  return decodeEntities(mm[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim());
}

function pickLink(block) {
  // RSS: <link>url</link> 或 Atom: <link href="url"/>
  const tagRe = /<link[^>]*>([\s\S]*?)<\/link>/i;
  const tag = block.match(tagRe);
  if (tag && tag[1].trim()) return decodeEntities(tag[1].trim());
  const attrRe = /<link[^>]*href="([^"]+)"[^>]*\/?>/i;
  const attr = block.match(attrRe);
  if (attr) return decodeEntities(attr[1]);
  return '';
}

async function collectWeChatRSS(feedUrl, tz) {
  const out = { items: [], error: null };
  try {
    const resp = await fetch(feedUrl, { timeout: 20000 });
    if (!resp.ok) { out.error = `HTTP ${resp.status}`; return out; }
    const xml = await resp.text();
    const itemRe = /<(item|entry)[\s\S]*?<\/\1>/gi;
    let m;
    while ((m = itemRe.exec(xml)) !== null) {
      const block = m[0];
      const title = pick(block, 'title');
      const link = pickLink(block);
      const pubDate = pick(block, 'pubDate') || pick(block, 'published') || pick(block, 'updated');
      const desc = pick(block, 'description') || pick(block, 'summary') || '';
      if (!link && !title) continue;
      out.items.push({
        id: link || title,
        title,
        link,
        pubDate,
        desc: desc.slice(0, 500),
        url: link
      });
    }
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

// ---------- 主流程 ----------
(async () => {
  const date = todayStr();
  const seen = loadSeen();
  const status = { date, runAt: new Date().toISOString(), sources: {}, newTotal: 0, errors: [] };

  let sources = { sources: [] };
  try {
    sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
  } catch (e) {
    console.error('无法读取 sources.json:', e.message);
    process.exit(1);
  }

  const reportParts = [];

  for (const src of sources.sources || []) {
    const key = `${src.platform}:${src.name}`;
    if (src.type === 'linkedin_feed') {
      console.log(`[LinkedIn] 采集 ${src.name} ...`);
      const r = await collectLinkedIn(src.base_url, src.default_tz);
      if (r.sessionExpired) {
        status.sources[key] = { ok: false, sessionExpired: true, newCount: 0 };
        status.errors.push(`${src.name}: LinkedIn 登录态失效，需重新登录`);
        reportParts.push(`## ⚠️ LinkedIn · ${src.name}\n\n登录态已失效，被重定向到登录页。请在已关闭其他 Edge 的前提下，用本项目 edge-profile 重新登录 LinkedIn 后重试。\n`);
        continue;
      }
      if (r.error) {
        status.sources[key] = { ok: false, error: r.error, newCount: 0 };
        status.errors.push(`${src.name}: ${r.error}`);
        continue;
      }
      const fresh = filterNew(seen, key, r.items);
      status.sources[key] = { ok: true, collected: r.items.length, newCount: fresh.length };
      status.newTotal += fresh.length;
      reportParts.push(renderLinkedIn(src.name, fresh));

    } else if (src.type === 'rss') {
      // 仅当 feed_url 是真实地址时才采集（跳过占位符）
      if (!src.feed_url || src.feed_url.includes('<')) {
        console.log(`[RSS] 跳过 ${src.name}（feed_url 未配置为真实地址）`);
        status.sources[key] = { ok: true, skipped: true, reason: 'feed_url 占位符' };
        continue;
      }
      console.log(`[RSS] 采集 ${src.name} ...`);
      const r = await collectWeChatRSS(src.feed_url, src.default_tz);
      if (r.error) {
        status.sources[key] = { ok: false, error: r.error, newCount: 0 };
        status.errors.push(`${src.name}: ${r.error}`);
        continue;
      }
      const fresh = filterNew(seen, key, r.items);
      status.sources[key] = { ok: true, collected: r.items.length, newCount: fresh.length };
      status.newTotal += fresh.length;
      reportParts.push(renderWeChat(src.name, fresh));
    }
  }

  saveSeen(seen);

  // 写日报
  ensureDir(REPORT_DIR);
  const header = `# 每日资讯日报 · ${date}\n\n生成时间: ${new Date().toLocaleString('zh-CN')}\n新增内容总数: ${status.newTotal}\n\n---\n\n`;
  const body = reportParts.length ? reportParts.join('\n---\n\n') : '_今日无新增内容。_';
  const md = header + body + '\n';
  const reportPath = path.join(REPORT_DIR, `${date}.md`);
  fs.writeFileSync(reportPath, md, 'utf8');
  status.reportPath = reportPath;

  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');

  console.log(`\n完成。新增 ${status.newTotal} 条。日报: ${reportPath}`);
  if (status.errors.length) console.log('注意:', status.errors.join(' | '));
})();

// ---------- 渲染 ----------
function renderLinkedIn(name, posts) {
  if (!posts.length) return `## LinkedIn · ${name}\n\n_无新增动态。_\n`;
  let md = `## LinkedIn · ${name}\n\n`;
  posts.forEach((p, i) => {
    md += `### ${i + 1}. ${p.author || name}\n`;
    if (p.timeText) md += `**时间**: ${p.timeText}${p.datetime ? ` (${p.datetime})` : ''}\n\n`;
    if (p.text) md += `${p.text}\n\n`;
    if (p.images && p.images.length) md += `**图片** (${p.images.length}):\n` + p.images.map(u => `- ${u}`).join('\n') + '\n\n';
    md += `[原文](${p.url})\n\n`;
  });
  return md;
}

function renderWeChat(name, items) {
  if (!items.length) return `## 微信 · ${name}\n\n_无新增文章。_\n`;
  let md = `## 微信 · ${name}\n\n`;
  items.forEach((it, i) => {
    md += `### ${i + 1}. ${it.title || '(无标题)'}\n`;
    if (it.pubDate) md += `**发布**: ${it.pubDate}\n\n`;
    if (it.desc) md += `${it.desc}...\n\n`;
    if (it.link) md += `[原文](${it.link})\n\n`;
  });
  return md;
}
