/**
 * adapters/linkedin.js — LinkedIn 公司/个人主页动态采集
 * 复用已登录的 Edge profile（headless），提取文字+图片，返回原始条目数组。
 */
const path = require('path');
const { chromium } = require('playwright');

const PROFILE = path.join(__dirname, '..', 'edge-profile');

/**
 * 将 LinkedIn 相对时间字符串换算为 ISO 8601 绝对时间。
 * 支持中英文混合格式："3 周前"/"2 weeks ago"/"1 个月前"/"5 days ago" 等。
 * 换算不精确（月按30天、周按7天），目的是让 core.js 的 windowDays 过滤能正常执行。
 * 无法解析时原样返回，core.js 遇到无法解析的字符串会 return true（保留），
 * 但这比"1 年前"的帖子被当成新条目混入要好得多。
 */
function relativeToIso(text) {
  if (!text) return '';
  const t = text.toLowerCase().trim();
  const now = Date.now();

  // 中英文数字单位映射
  const map = [
    { re: /(\d+)\s*(秒|second)/,          ms: n => n * 1000 },
    { re: /(\d+)\s*(分钟?|minute)/,        ms: n => n * 60 * 1000 },
    { re: /(\d+)\s*(小时|hour)/,           ms: n => n * 3600 * 1000 },
    { re: /(\d+)\s*(天|day)/,              ms: n => n * 86400 * 1000 },
    { re: /(\d+)\s*(周|week)/,             ms: n => n * 7 * 86400 * 1000 },
    { re: /(\d+)\s*(个?月|month)/,         ms: n => n * 30 * 86400 * 1000 },
    { re: /(\d+)\s*(年|year)/,             ms: n => n * 365 * 86400 * 1000 },
  ];
  for (const { re, ms } of map) {
    const m = t.match(re);
    if (m) return new Date(now - ms(parseInt(m[1]))).toISOString();
  }
  // 刚刚/just now
  if (/刚刚|just now/.test(t)) return new Date(now).toISOString();
  return text; // 无法解析，透传
}

async function collect(source) {
  const url = source.base_url;
  const items = [];
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
      await context.close().catch(() => {});
      return { items, sessionExpired: true };
    }
    try {
      const btn = await page.$('button:has-text("继续前往公司主页"), button[aria-label*="继续"], .artdeco-modal__confirm-dialog-btn');
      if (btn) { await btn.click(); await page.waitForTimeout(2000); }
    } catch (e) { /* ignore */ }

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

    for (const p of posts) {
      // 优先用 <time datetime="..."> 属性（ISO 格式），保证 core.js 时间窗口过滤生效。
      // timeText 是相对字符串（"3 周前"/"2 months ago"），只在 datetime 缺失时兜底换算。
      let publishedText = '';
      if (p.datetime) {
        publishedText = p.datetime; // e.g. "2026-07-28T10:00:00Z"
      } else if (p.timeText) {
        publishedText = relativeToIso(p.timeText); // 换算为绝对 ISO，失败则透传原字符串
      }
      items.push({
        id: p.id,
        title: p.author ? `${p.author} 的动态` : 'LinkedIn 动态',
        url: url,
        text: p.text,
        images: p.images,
        publishedText,
        displayTime: p.timeText || '',  // 保留原始相对时间，供日报展示用
      });
    }
    await context.close().catch(() => {});
  } catch (e) {
    if (context) await context.close().catch(() => {});
    return { items, error: e.message };
  }
  return { items };
}

module.exports = { collect };
