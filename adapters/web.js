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
 * UA 轮换表 — 部分站点 WAF 对显式 Chrome UA 反而返回 403,
 * 而默认(无 UA)或 Firefox UA 可通过; 故优先默认 UA, 遇 401/403 轮换重试。
 */
const UAS = [
  '',  // 默认(不发送 UA) — 多个 DataDome/Cloudflare 站点允许
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0'
];

/**
 * fetchWithRetry — 对齐云端 ops.py 重试时间表: 5s / 10s / 30s / 之后每 10s × (maxRetries-3)
 * 重试: 网络异常 / 429 / 5xx / 401·403(轮换 UA, 最多 3 次) / 空体(反爬空响应)
 * 不重试: 其他 4xx(视为客户端错误)
 */
async function fetchWithRetry(url, { timeout = 15000, maxRetries = 4, method = 'GET' } = {}) {
  const waits = [3, 5, 8];
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const ua = UAS[(attempt - 1) % UAS.length];
    const headers = { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' };
    if (ua) headers['User-Agent'] = ua;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeout);
      const resp = await fetch(url, { method, headers, signal: ctrl.signal });
      clearTimeout(t);
      if (resp.status === 429 || resp.status >= 500) {
        lastErr = new Error(`HTTP ${resp.status}`);
      } else if (resp.status >= 400 && resp.status < 500) {
        // 401/403 多为 UA 触发, 轮换 UA 重试(最多 3 次); 其余 4xx 视为客户端错误不重试
        if ((resp.status === 401 || resp.status === 403) && attempt < 4) {
          lastErr = new Error(`HTTP ${resp.status}`);
        } else {
          return { ok: false, status: resp.status, body: '' };
        }
      } else {
        const body = await resp.text();
        // 空体(反爬空响应, 如 renewableenergymagazine 的 200 空体)触发 UA 轮换重试,
        // 但最多 3 次后放弃, 避免每日运行对空体源长时挂起
        if (body.length < 50) {
          if (attempt < 4) { lastErr = new Error(`empty body HTTP ${resp.status}`); }
          else { return { ok: false, status: resp.status, body: '', error: 'empty body' }; }
        } else {
          return { ok: true, status: resp.status, body };
        }
      }
    } catch (e) {
      lastErr = e;
    }
    const w = attempt <= 3 ? waits[attempt - 1] : 10;
    await sleep(w * 1000);
  }
  return { ok: false, error: String((lastErr && lastErr.message) || 'max retries') };
}

function curlFetch(url, timeoutMs = 15000) {
  try {
    const body = execFileSync('curl', ['-sL', url], {
      timeout: timeoutMs, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024
    });
    return { ok: true, body };
  } catch (e) {
    return { ok: false, error: e.message.substring(0, 200) };
  }
}

/** 检测系统/环境代理（沙箱直连 DNS 线程会崩溃, 浏览器需走代理解析）*/
function detectProxy() {
  const env = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || process.env.GIT_PROXY;
  if (env) return env;
  if (process.platform === 'win32') {
    try {
      const en = execFileSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings', '/v', 'ProxyEnable'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      if (/ProxyEnable[\s\S]*0x1\b/.test(en)) {
        const out = execFileSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings', '/v', 'ProxyServer'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        const m = out.match(/ProxyServer\s+REG_SZ\s+(.+)/);
        if (m) {
          let s = m[1].trim();
          const https = s.match(/https=([^\s;]+)/);
          const http = s.match(/http=([^\s;]+)/);
          let host = (https || http || [, s])[1].trim();
          if (host && !/^https?:\/\//.test(host)) host = 'http://' + host;
          return host || null;
        }
      }
    } catch (_) { /* 无代理或 reg 不可用 */ }
  }
  return null;
}

// 浏览器兜底(过 Cloudflare 等 JS 挑战) — 懒加载 playwright, 失败静默降级
let _browser = null;
async function getBrowser() {
  if (_browser) return _browser;
  const chromium = require('playwright').chromium;
  const proxy = detectProxy();
  const args = proxy ? [`--proxy-server=${proxy}`] : [];
  _browser = await chromium.launch({ headless: true, args });
  return _browser;
}

async function browserGet(url, { timeout = 30000 } = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    const body = await page.content();
    return { ok: true, status: resp ? resp.status() : 200, body };
  } finally {
    await page.close().catch(() => {});
  }
}

/** 三级兜底: fetchWithRetry → curl → (可选)浏览器渲染(应对 Cloudflare 等反爬)
 *  浏览器兜底默认关闭(每日运行追求速度); 仅对显式 opts.browser=true 的来源开启
 *  (如 RSS 反爬源), 避免对每个失败信源都拉起 Playwright 导致严重超时。 */
async function httpGet(url, opts = {}) {
  const r = await fetchWithRetry(url, opts);
  if (r.ok) return r;
  const c = curlFetch(url, (opts && opts.timeout) || 15000);
  if (c.ok && c.body.length > 100) return { ok: true, body: c.body, via: 'curl' };
  if (opts.browser) {
    try {
      const b = await browserGet(url, { timeout: (opts && opts.timeout) || 30000 });
      if (b.ok && b.body.length > 100) return { ok: true, body: b.body, via: 'browser' };
    } catch (_) { /* 浏览器不可用(未装/代理异常)时静默降级 */ }
  }
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
// 列表/栏目/落地页标题黑名单（扩展：覆盖 Learn more / News / Press & Media / 纯数字 等 CMS 通用标签）
const NAV_TITLE_RE = /^(media contacts|press resources|event calendar|event search|competitions?|about us|contact us|careers?|sign in|log ?in|search|sitemap|privacy policy|terms of (use|service)|newsletter|subscribe|home|menu|learn more|news|press|press releases?|press & media|media center|media|read more|view all|see all|more|详情|阅读更多|查看|首页|新闻|媒体)$/i;

function isNavCandidate(url, title) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (NAV_PATH_RE.test(path)) return true;
  } catch (_) { /* ignore */ }
  if (title && NAV_TITLE_RE.test(title.trim().toLowerCase())) return true;
  return false;
}

/**
 * 语义正文提取：优先 <article> / <main> 块，其次去 nav/header/footer/aside/脚本/样式后的正文。
 * 避免把整站菜单("Skip to main content" / "M Login Independent coverage")当正文收进来。
 * @returns {{text:string, isListPage:boolean}}
 */
function extractMainText(html, url) {
  if (!html) return { text: '', isListPage: true };
  let block = '';
  // 1) 语义块优先
  const semRe = /<(article|main)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m, best = '';
  while ((m = semRe.exec(html)) !== null) {
    if (m[2].length > best.length) best = m[2];
  }
  // 2) 退而求其次：剥离导航/页脚/脚本/样式后取 body
  if (!best) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const body = bodyMatch ? bodyMatch[1] : html;
    const stripped = body
      .replace(/<(script|style|nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
    best = stripped;
  } else {
    best = best.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  }
  const text = best.replace(/\s+/g, ' ').trim();
  const low = text.toLowerCase();
  // 列表页/导航残留判定：含 CMS 菜单关键字（多站点实测：M Login Independent coverage /
  // Menu About ASME / Independent coverage of power generation since 1981 等重复站点页脚）
  const cmsBoiler = /(skip to main content|skip to content|m login independent coverage|login\s+independent coverage|about\s+asme|menu\s+about|all rights reserved|cookie policy|accept cookies|independent coverage of (power|energy)|subscribe\s*-->|sections\s+home\s+news|sign in\/create account)/i;
  const looksNav = cmsBoiler.test(low) || text.length < 80;
  return { text: text.slice(0, 3000), isListPage: looksNav };
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
      // 剔除导航/栏目/非文章页噪音（标题级）
      if (isNavCandidate(abs, inner)) continue;
      // 抓取该链接正文，若仍是整站菜单/列表页则跳过（避免把栏目页当文章收进来）
      let detailText = '';
      const dRes = await httpGet(abs, { timeout: 15000 });
      if (dRes.ok && dRes.body) {
        const main = extractMainText(dRes.body, abs);
        if (main.isListPage) continue;
        detailText = main.text;
      }
      candidates.push({ url: abs, title: inner.slice(0, 140), text: detailText });
    } catch (e) { /* skip */ }
  }

  // 优先取"像文章"的链接（带日期/含 news·article 等），让 12 条上限落在真文章上
  candidates.sort((a, b) => articleScore(b) - articleScore(a));

  // 逐篇取日期 + 语义正文（上限 12，避免过多请求）
  let fetched = 0;
  for (const c of candidates) {
    if (fetched >= 12) break;
    fetched++;
    let pubDate = parseUrlDate(c.url);
    let text = c.text || '';
    if (!pubDate || !text) {
      const ar = await httpGet(c.url, { timeout: 15000 });
      if (ar.ok && ar.body) {
        pubDate = pubDate || extractDateFromHtml(ar.body, c.url);
        const main = extractMainText(ar.body, c.url);
        // 若正文仍是整站菜单/列表页 → 丢弃该候选（不污染日报）
        if (main.isListPage) continue;
        text = main.text;
      }
    }
    if (!text) continue; // 无可读正文，跳过（避免空壳条目）
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
    const r = await httpGet(source.feed_url, { browser: true });
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

module.exports = { collect, parseRss, fetchWithRetry, httpGet, extractDateFromHtml, isNavCandidate, articleScore, extractMainText };
