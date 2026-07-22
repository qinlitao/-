/**
 * adapters/linkedin.js — LinkedIn 公司/个人主页动态采集
 * 复用已登录的 Edge profile（headless），提取文字+图片，返回原始条目数组。
 */
const path = require('path');
const { chromium } = require('playwright');

const PROFILE = path.join(__dirname, '..', 'edge-profile');

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
      items.push({
        id: p.id,
        title: p.author ? `${p.author} 的动态` : 'LinkedIn 动态',
        url: url,
        text: p.text,
        images: p.images,
        publishedText: p.timeText + (p.datetime ? ` (${p.datetime})` : '')
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
