/**
 * adapters/web.js — RSS 订阅源 + 固定网页 + 权威信源(press) 监听
 * 纯 fetch，无登录。返回原始条目数组。
 * 2026-07-23: 新增 collectPress(直连抓取新闻页/allow_path 链接+逐篇取日期)、
 *             fetchWithRetry(5+10+30+10×N 重试时间表, 对齐云端 ops.py)。
 */
const { URL } = require('url');
const { execFileSync } = require('child_process');

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
    const cleanDesc = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    items.push({
      id: link || title,
      title: title || '(无标题)',
      url: link,
      text: cleanDesc.slice(0, 3000),
      images: [],
      publishedText: pubDate
    });
  }
  return items;
}

// ---------- 通用 HTTP（fetch 重试 + curl 后备）----------
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * fetchWithRetry — 对齐云端 ops.py 重试时间表: 5s / 10s / 30s / 之后每 10s × (maxRetries-3)
 * 重试: 网络异常 / 429 / 5xx / 401·403(仅2次)
 * 不重试: 其他 4xx(视为客户端错误)
 */
async function fetchWithRetry(url, { timeout = 20000, maxRetries = 20, method = 'GET' } = {}) {
  const waits = [5, 10, 30];
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeout);
      const resp = await fetch(url, { method, headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }, signal: ctrl.signal });
      clearTimeout(t);
      if (resp.status === 429 || resp.status >= 500) {
        lastErr = new Error(`HTTP ${resp.status}`);
      } else if (resp.status >= 400 && resp.status < 500) {
        if ((resp.status === 401 || resp.status === 403) && attempt < 2) {
          lastErr = new Error(`HTTP ${resp.status}`);
        } else {
          return { ok: false, status: resp.status, body: '' };
        }
      } else {
        const body = await resp.text();
        return { ok: true, status: resp.status, body };
      }
    } catch (e) {
      lastErr = e;
    }
    let w;
    if (attempt <= 3) w = waits[attempt - 1];
    else w = 10;
    await sleep(w * 1000);
  }
  return { ok: false, error: String((lastErr && lastErr.message) || 'max retries') };
}

function curlFetch(url, timeoutMs = 15000) {
  try {
    const body = execFileSync('curl', ['-sL', '-A', UA, url], {
      timeout: timeoutMs, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024
    });
    return { ok: true, body };
  } catch (e) {
    return { ok: false, error: e.message.substring(0, 200) };
  }
}

/** 先 fetchWithRetry，失败再 curl 后备（应对 TLS 指纹/反爬）*/
async function httpGet(url, opts) {
  const r = await fetchWithRetry(url, opts);
  if (r.ok) return r;
  const c = curlFetch(url, (opts && opts.timeout) || 15000);
  if (c.ok && c.body.length > 100) return { ok: true, body: c.body, via: 'curl' };
  return r;
}

// ---------- 日期提取（对齐云端 _extract_article_date 的轻量版）----------
function extractDateFromHtml(html, url) {
  // 1) JSON-LD
  const ldRe = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const vals = [data.datePublished, data.dateCreated, data.dateModified].filter(Boolean);
      for (const v of vals) { const d = parseFlex(v); if (d) return d; }
    } catch (_) {}
  }
  // 2) meta 标签
  const metaRe = /<meta[^>]+(?:property|name|itemprop)=["']([^"']*(?:published|date|time)[^"']*)["'][^>]*content=["']([^"']+)["']/gi;
  while ((m = metaRe.exec(html)) !== null) {
    const d = parseFlex(m[2]); if (d) return d;
  }
  // 3) <time datetime>
  const timeRe = /<time[^>]*datetime=["']([^"']+)["']/gi;
  while ((m = timeRe.exec(html)) !== null) { const d = parseFlex(m[1]); if (d) return d; }
  // 4) URL 日期 (YYYYMMDD / YYMMDD / YYYY/MM/DD)
  const urlD = parseUrlDate(url); if (urlD) return urlD;
  // 5) 正文文本
  const txtRe = /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})|([A-Za-z]{3,9})\.?\s+\d{1,2},?\s+\d{4}/g;
  const tm = txtRe.exec(html || '');
  if (tm) { const d = parseFlex(tm[0]); if (d) return d; }
  return null;
}

function parseUrlDate(url) {
  if (!url) return null;
  let m = url.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = url.match(/(\d{4})(\d{2})(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = url.match(/\/(\d{2})(\d{2})(\d{2})\.html/);
  if (m) return new Date(2000 + +m[1], +m[2] - 1, +m[3]);
  return null;
}

function parseFlex(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ---------- 导航/栏目/非文章页黑名单（press 直连抓取时过滤噪音）----------
// 直连抓新闻页会把 "Media Contacts / Event Calendar / About" 等栏目页一并收进来，需剔除
const NAV_PATH_RE = /(\/(media-contacts|press-resources|press-room|events?|event-calendar|event-search|competitions?|careers?|about|contact|login|signin|sign-in|search|sitemap|privacy|terms|newsletter|subscribe|account|cookie|accessibility|help|faq|tags?|categories|authors?|topic|home)\b)|(\.(pdf|zip|xml|rss)$)/i;
const NAV_TITLE_RE = /^(media contacts|press resources|event calendar|event search|competitions?|about us|contact us|careers?|sign in|log ?in|search|sitemap|privacy policy|terms of (use|service)|newsletter|subscribe|home|menu)$/i;

function isNavCandidate(url, title) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (NAV_PATH_RE.test(path)) return true;
  } catch (_) { /* ignore */ }
  if (title && NAV_TITLE_RE.test(title.trim().toLowerCase())) return true;
  return false;
}

// 文章相似度打分：优先带日期/含 news·article·press-release 的链接，标题越长越像头条
function articleScore(c) {
  let s = 0;
  if (parseUrlDate(c.url)) s += 10;
  const p = c.url.toLowerCase();
  if (/(news|article|story|press-release|pressrelease|blog|post|detail|release|insight|report)/.test(p)) s += 3;
  s += Math.min(c.title.length, 40) / 10;
  return s;
}

// ---------- 固定网页：抽取文章链接 + 标题 ----------
async function collectWebpage(source) {
  const items = [];
  const base = source.url;
  const r = await httpGet(base);
  if (!r.ok || !r.body || r.body.length < 200) throw new Error(`网页采集失败: ${base}`);
  const html = r.body;
  const linkRe = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set();
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    let href = m[1];
    const inner = m[2].replace(/<[^>]+>/g, '').trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
    if (inner.length < 8) continue;
    try {
      const abs = new URL(href, base).href;
      if (seen.has(abs)) continue;
      seen.add(abs);
      items.push({ id: abs, title: inner.slice(0, 120), url: abs, text: '', images: [], publishedText: '' });
    } catch (e) { /* skip */ }
  }
  return items;
}

// ---------- 权威信源 press：直连新闻页 + allow_path 链接 + 逐篇取日期 ----------
async function collectPress(source) {
  const items = [];
  const base = source.url;
  const allow = source.url_allow_path || [];
  const r = await httpGet(base);
  if (!r.ok || !r.body || r.body.length < 100) {
    // 可能是 RSS 直链被当成 url 传入
    if (r.body && (r.body.includes('<rss') || r.body.includes('<feed'))) {
      return { items: parseRss(r.body) };
    }
    throw new Error(`press 采集失败: ${base} (${r.status || r.error})`);
  }
  const html = r.body;
  // RSS 兜底
  if (html.includes('<rss') || html.includes('<feed')) return { items: parseRss(html) };

  const linkRe = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set();
  const candidates = [];
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    let href = m[1];
    const inner = m[2].replace(/<[^>]+>/g, '').trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    try {
      const abs = new URL(href, base).href;
      if (seen.has(abs)) continue;
      seen.add(abs);
      // 域名限域
      if (source.domains && source.domains.length) {
        const host = new URL(abs).hostname.replace(/^www\./, '');
        if (!source.domains.some(d => host === d.replace(/^www\./, '') || host.endsWith('.' + d.replace(/^www\./, '')))) continue;
      }
      // allow_path 过滤（空=全收）
      if (allow.length && !allow.some(p => abs.includes(p))) continue;
      // 剔除导航/栏目/非文章页噪音
      if (isNavCandidate(abs, inner)) continue;
      candidates.push({ url: abs, title: inner.slice(0, 140) });
    } catch (e) { /* skip */ }
  }

  // 优先取"像文章"的链接（带日期/含 news·article 等），让 12 条上限落在真文章上
  candidates.sort((a, b) => articleScore(b) - articleScore(a));

  // 逐篇取日期（上限 12，避免过多请求）
  let fetched = 0;
  for (const c of candidates) {
    if (fetched >= 12) break;
    fetched++;
    let pubDate = parseUrlDate(c.url);
    let text = '';
    if (!pubDate) {
      const ar = await httpGet(c.url, { timeout: 15000 });
      if (ar.ok && ar.body) {
        pubDate = extractDateFromHtml(ar.body, c.url);
        // 取正文前 300 字做摘要
        const txt = ar.body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        text = txt.slice(0, 300);
      }
    }
    items.push({
      id: c.url,
      title: c.title || '(无标题)',
      url: c.url,
      text: text.slice(0, 3000),
      images: [],
      publishedText: pubDate ? pubDate.toISOString() : ''
    });
  }
  return { items };
}

// ---------- 分发 ----------
async function collect(source) {
  if (source.type === 'rss') {
    if (!source.feed_url || source.feed_url.includes('<')) {
      return { items: [], skipped: true, reason: 'feed_url 未配置真实地址' };
    }
    const r = await httpGet(source.feed_url);
    let xml = r.ok ? r.body : '';
    if (!xml || xml.length < 100) {
      const c = curlFetch(source.feed_url);
      if (c.ok && c.body.length > 100) xml = c.body;
    }
    if (!xml || xml.length < 100) throw new Error(`RSS 采集失败: ${source.feed_url}`);
    if (xml.includes('Cloudflare') && xml.includes('Attention Required')) {
      throw new Error('RSS 被 Cloudflare 拦截，需 Playwright');
    }
    return { items: parseRss(xml) };
  }
  if (source.type === 'webpage') {
    return { items: await collectWebpage(source) };
  }
  if (source.type === 'press') {
    return await collectPress(source);
  }
  return { items: [], error: `web adapter 不支持类型 ${source.type}` };
}

module.exports = { collect, parseRss, fetchWithRetry, extractDateFromHtml, isNavCandidate, articleScore };
