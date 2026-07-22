const { chromium } = require('playwright');

const PROFILE = 'F:\\WorkBuddy\\2026-07-21-06-30-02\\edge-profile';
const TARGET_URL = 'https://www.linkedin.com/company/gasturbinehub/posts/?feedView=all';

(async () => {
  let context;
  try {
    console.log('启动Edge（复用已登录的Profile）...');
    context = await chromium.launchPersistentContext(PROFILE, {
      channel: 'msedge',
      headless: false,
      args: ['--no-sandbox'],
      viewport: { width: 1280, height: 900 }
    });
    console.log('浏览器已启动');

    const page = await context.newPage();
    page.on('console', msg => { /* 静默 */ });

    console.log('导航到目标页面:', TARGET_URL);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);

    const url = page.url();
    console.log('当前URL:', url);

    if (url.includes('/login') || url.includes('/checkpoint')) {
      console.log('警告: 被重定向到登录页，登录态可能失效');
      await page.screenshot({ path: 'li_state.png', fullPage: false });
      console.log('已保存状态截图: li_state.png');
      await context.close();
      return;
    }

    // 关闭可能弹出的"访问记录"提示
    try {
      const continueBtn = await page.$('button:has-text("继续前往公司主页"), button[aria-label*="继续"], .artdeco-modal__confirm-dialog-btn');
      if (continueBtn) {
        await continueBtn.click();
        console.log('已关闭访问记录提示');
        await page.waitForTimeout(2000);
      }
    } catch (e) { /* ignore */ }

    // 滚动加载更多动态
    console.log('滚动加载动态...');
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, 1400));
      await page.waitForTimeout(1800);
    }
    // 回到顶部确保首张卡片完整
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);

    console.log('提取动态内容...');
    const posts = await page.evaluate(() => {
      const results = [];
      // 候选卡片容器
      const cards = document.querySelectorAll('div[role="article"], .feed-shared-update-v2, .update-components-actor');
      const seen = new Set();

      cards.forEach(card => {
        try {
          // 如果card本身是actor容器，找外层article
          let root = card.closest && card.closest('div[role="article"]');
          if (!root) root = card.closest && card.closest('.feed-shared-update-v2');
          if (!root) root = card;

          const id = root.getAttribute('data-id') || root.getAttribute('data-urn') || '';
          if (!id || seen.has(id)) return;
          seen.add(id);

          // 作者：优先从 actor 容器取
          const authorSelectors = [
            '.update-components-actor__name span',
            '.update-components-actor__name',
            '.feed-shared-actor__name span',
            '.feed-shared-actor__name',
            'a[href*="/company/gasturbinehub/"] span',
            'a[href*="/company/gasturbinehub/"]'
          ];
          let author = '';
          for (const sel of authorSelectors) {
            const el = root.querySelector(sel);
            if (el && el.textContent.trim()) {
              author = el.textContent.trim();
              break;
            }
          }

          // 时间：优先 <time datetime>
          const timeEl = root.querySelector('time');
          let timeText = '';
          let datetime = '';
          if (timeEl) {
            timeText = timeEl.textContent.trim();
            datetime = timeEl.getAttribute('datetime') || '';
          }
          if (!timeText) {
            const subDesc = root.querySelector('.feed-shared-actor__sub-description, .update-components-actor__sub-description');
            if (subDesc) timeText = subDesc.textContent.trim();
          }

          // 正文：多个候选
          const textSelectors = [
            '.feed-shared-inline-show-more-text span',
            '.feed-shared-inline-show-more-text',
            '.update-components-text span',
            '.update-components-text',
            '.break-words'
          ];
          let text = '';
          for (const sel of textSelectors) {
            const el = root.querySelector(sel);
            if (el && el.innerText.trim()) {
              text = el.innerText.trim();
              break;
            }
          }

          // 图片：过滤掉公司logo
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

    console.log(`提取到 ${posts.length} 条动态`);

    const fs = require('fs');
    const out = {
      source: 'linkedin',
      company: 'gasturbinehub',
      collectedAt: new Date().toISOString(),
      url: url,
      postCount: posts.length,
      posts: posts
    };
    fs.writeFileSync('linkedin_gasturbinehub.json', JSON.stringify(out, null, 2), 'utf8');
    console.log('已保存: linkedin_gasturbinehub.json');

    let md = `# LinkedIn - gasturbinehub 动态采集\n\n采集时间: ${new Date().toLocaleString('zh-CN')}\nURL: ${url}\n共 ${posts.length} 条\n\n---\n\n`;
    posts.forEach((p, i) => {
      md += `## ${i + 1}. ${p.author || 'GasTurbineHub'}\n`;
      if (p.timeText) md += `**时间**: ${p.timeText}${p.datetime ? ` (${p.datetime})` : ''}\n\n`;
      if (p.text) md += `${p.text}\n\n`;
      if (p.images.length) md += `**图片** (${p.images.length}):\n` + p.images.map(u => `- ${u}`).join('\n') + '\n\n';
      md += `---\n\n`;
    });
    fs.writeFileSync('linkedin_gasturbinehub.md', md, 'utf8');
    console.log('已保存: linkedin_gasturbinehub.md');

    await page.screenshot({ path: 'linkedin_gasturbinehub.png', fullPage: false });
    console.log('已保存截图: linkedin_gasturbinehub.png');

    console.log('\n完成，正在关闭浏览器...');
    await context.close();

  } catch (error) {
    console.error('错误:', error.message);
    if (context) await context.close().catch(() => {});
  }
})();