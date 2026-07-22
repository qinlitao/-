/**
 * adapters/web.js — RSS 订阅源 + 固定网页监听
 * 纯 fetch，无需登录。返回原始条目数组。
 */
const { URL } = require('url');

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
  const tagRe = /<link[^>]*>([\s\S]*?)<\/link>/i;
  const tag = block.match(tagRe);
  if (tag && tag[1].trim()) return decodeEntities(tag[1].trim());
  const attrRe = /<link[^>]*href="([^"]+)"[^>]*\/?>/i;
  const attr = block.match(attrRe);
  if (attr) return decodeEntities(attr[1]);
  return '';
}

// ---------- RSS ----------
function parseRss(xml) {
  const items = [];
  const itemRe = /<(item|entry)[\s\S]*?<\/\1>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[0];
    const title = pick(block, 'title');
    const link = pickLink(block);
    const pubDate = pick(block, 'pubDate') || pick(block, 'published') || pick(block, 'updated');
    const desc = pick(block, 'description') || pick(block, 'summary') || '';
    if (!link && !title) continue;
    items.push({
      id: link || title,
      title: title || '(无标题)',
      url: link,
      text: desc.slice(0, 800),
      images: [],
      publishedText: pubDate
    });
  }
  return items;
}

// ---------- 固定网页：抽取文章链接 + 标题 ----------
async function collectWebpage(source) {
  const items = [];
  const base = source.url;
  const resp = await fetch(base, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 20000
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();

  // 抽取 <a> 链接及其文本
  const linkRe = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set();
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    let href = m[1];
    const inner = m[2].replace(/<[^>]+>/g, '').trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
    if (inner.length < 8) continue; // 过滤导航碎片
    try {
      const abs = new URL(href, base).href;
      if (seen.has(abs)) continue;
      seen.add(abs);
      items.push({
        id: abs,
        title: inner.slice(0, 120),
        url: abs,
        text: '',
        images: [],
        publishedText: ''
      });
    } catch (e) { /* skip bad url */ }
  }
  return items;
}

// ---------- 分发 ----------
async function collect(source) {
  if (source.type === 'rss') {
    if (!source.feed_url || source.feed_url.includes('<')) {
      return { items: [], skipped: true, reason: 'feed_url 未配置真实地址' };
    }
    const resp = await fetch(source.feed_url, { timeout: 20000 });
    if (!resp.ok) throw new Error(`RSS HTTP ${resp.status}`);
    const xml = await resp.text();
    return { items: parseRss(xml) };
  }
  if (source.type === 'webpage') {
    const items = await collectWebpage(source);
    return { items };
  }
  return { items: [], error: `web adapter 不支持类型 ${source.type}` };
}

module.exports = { collect, parseRss };
