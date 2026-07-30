/**
 * check_sources_health.js — 信源 URL 健康巡检
 *
 * 定时(每周)跑一次，逐个探测 sources.json 里各信源的 feed_url / url / base_url，
 * 判断存活/死链/反爬/空体，产出健康报告。死链会在报告里标红，
 * 由维护流程(人或自动化)据此更新 sources.json 的 URL。
 *
 * 用法:
 *   node check_sources_health.js            # 巡检全部启用信源，写 state/source_health_YYYY-MM-DD.md
 *   node check_sources_health.js --fix       # 巡检后尝试用 WebSearch 找替代 URL 并就地更新(由 agent 调用)
 *
 * 说明:
 *   - LinkedIn / 微信 / MCP(tencent_stock/fund) 无公开可直连的 URL，跳过 HTTP 探测，仅做格式校验。
 *   - 反爬站点(403/999/空体)直连必失败，属"需浏览器/登录"而非"死链"，单独分类。
 */
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
// 复用 web.js 的 httpGet(fetch→curl→浏览器三级兜底), 使健康报告与生产采集一致
const { httpGet } = require('./adapters/web');

const ROOT = __dirname;
const SRC_FILE = path.join(ROOT, 'sources.json');
const OUT_DIR = path.join(ROOT, 'state');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function pickUrl(s) {
  if (s.feed_url) return { url: s.feed_url, kind: 'feed' };
  if (s.url) return { url: s.url, kind: 'page' };
  if (s.base_url) return { url: s.base_url, kind: 'linkedin' };
  return null;
}

function isSkippable(s) {
  if (s.enabled === false) return 'disabled';
  if (s.type === 'tencent_stock_mcp' || s.type === 'fund_mcp') return 'mcp';
  return null;
}

async function probe(u, kind) {
  try {
    const r = await httpGet(u, { timeout: 25000 });
    const body = r.body || '';
    return { status: r.ok ? (r.status || 200) : (r.status || 0), bodyLen: body.length, isFeed: /<rss|<feed|<rdf:RDF/.test(body), bodySample: body.slice(0, 200), via: r.via };
  } catch (e) {
    return { status: 0, error: e.message, bodyLen: 0, isFeed: false, bodySample: '' };
  }
}

function classify(s, kind, res) {
  // LinkedIn: 直连必被拦, 仅格式校验
  if (kind === 'linkedin') {
    if (res.status === 0) return { status: '需登录态', severity: 'info', note: 'LinkedIn 直连不可达属正常(需 edge-profile 浏览器采集)' };
    if (res.status === 404 || res.status === 410) return { status: '死链', severity: 'dead', note: `HTTP ${res.status}` };
    return { status: '需登录态', severity: 'info', note: `HTTP ${res.status} (直连探测, 真实可用性以采集为准)` };
  }
  if (res.status === 0) return { status: '探测失败', severity: 'error', note: res.error || '网络/DNS 错误' };
  if (res.status === 404 || res.status === 410) return { status: '死链', severity: 'dead', note: `HTTP ${res.status}` };
  if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 999)
    return { status: '反爬拦截', severity: 'blocked', note: `HTTP ${res.status} (需浏览器/UA轮换)` };
  if (res.status >= 200 && res.status < 300) {
    if (kind === 'feed' && !res.isFeed)
      return { status: '非 RSS', severity: 'blocked', note: `HTTP ${res.status} 但返回非 feed 内容(bodyLen=${res.bodyLen})` };
    if (res.bodyLen < 200)
      return { status: '空体', severity: 'blocked', note: `HTTP ${res.status} 但 body 过短(${res.bodyLen}),疑似反爬空响应` };
    return { status: '存活', severity: 'ok', note: `HTTP ${res.status}` + (kind === 'feed' ? ' RSS 有效' : '') };
  }
  if (res.status >= 300 && res.status < 400) return { status: '重定向', severity: 'info', note: `HTTP ${res.status}` };
  return { status: '异常', severity: 'blocked', note: `HTTP ${res.status}` };
}

function urlOf(s) { const p = pickUrl(s); return p ? p.url : '(无 URL)'; }

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const cfg = JSON.parse(fs.readFileSync(SRC_FILE, 'utf8'));
  const sources = cfg.sources || [];
  const rows = [];
  let dead = 0, blocked = 0, error = 0, ok = 0, skip = 0, info = 0;

  console.log(`巡检 ${sources.length} 个信源...\n`);
  for (const s of sources) {
    const skipReason = isSkippable(s);
    if (skipReason) { rows.push({ s, skip: skipReason }); skip++; continue; }
    const p = pickUrl(s);
    if (!p) { rows.push({ s, skip: 'nourl' }); skip++; continue; }
    const res = await probe(p.url, p.kind);
    const c = classify(s, p.kind, res);
    rows.push({ s, res, cls: c });
    const icon = { ok: '✅', dead: '💀', blocked: '🚫', error: '⚠️', info: '🔎' }[c.severity] || '·';
    console.log(`${icon} [${c.status}] ${s.name}  (${p.url})  ${c.note}`);
    if (c.severity === 'ok') ok++; else if (c.severity === 'dead') dead++;
    else if (c.severity === 'blocked') blocked++; else if (c.severity === 'error') error++; else info++;
  }

  // 写报告
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `source_health_${today}.md`);
  const deadRows = rows.filter(r => r.cls && r.cls.severity === 'dead');
  const blockedRows = rows.filter(r => r.cls && r.cls.severity === 'blocked');
  const errorRows = rows.filter(r => r.cls && r.cls.severity === 'error');

  const md = [
    `# 信源 URL 健康巡检 — ${today}`,
    '',
    `总计 ${sources.length} 个信源 | ✅存活 ${ok} | 💀死链 ${dead} | 🚫反爬/空体 ${blocked} | ⚠️探测失败 ${error} | 🔎需登录/跳过 ${info}`,
    '',
    '## 需处理（死链 / 反爬 / 探测失败）',
    '',
  ];
  const trouble = [...deadRows, ...errorRows, ...blockedRows];
  if (trouble.length === 0) md.push('_无死链或反爬拦截，全部信源可达。_');
  else {
    md.push('| 信源 | 类型 | 当前 URL | 状态 | 备注 |');
    md.push('|---|---|---|---|---|');
    for (const r of trouble) md.push(`| ${r.s.name} | ${r.s.type} | ${urlOf(r.s)} | ${r.cls.status} | ${r.cls.note} |`);
  }
  md.push('', '## 全部信源明细', '');
  md.push('| 信源 | 类型 | URL | 状态 | 备注 |');
  md.push('|---|---|---|---|---|');
  for (const r of rows) {
    if (r.skip) md.push(`| ${r.s.name} | ${r.s.type} | ${urlOf(r.s)} | 跳过 | ${r.skip} |`);
    else md.push(`| ${r.s.name} | ${r.s.type} | ${urlOf(r.s)} | ${r.cls.status} | ${r.cls.note} |`);
  }
  md.push('', '---', `_生成于 ${new Date().toISOString()}_`);
  fs.writeFileSync(outFile, md.join('\n'), 'utf8');

  console.log(`\n报告已写: ${outFile}`);
  console.log(`汇总: ✅${ok} 💀${dead} 🚫${blocked} ⚠️${error} 🔎${info}`);
  if (deadRows.length) { console.log('\n💀 死链需更新 URL:'); deadRows.forEach(r => console.log('  - ' + r.s.name + '  ' + urlOf(r.s))); }
  if (errorRows.length) { console.log('\n⚠️ 探测失败(可能代理未开):'); errorRows.forEach(r => console.log('  - ' + r.s.name + '  ' + urlOf(r.s))); }
  return { ok, dead, blocked, error, info, deadRows: deadRows.map(r => r.s.name), errorRows: errorRows.map(r => r.s.name) };
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { main, pickUrl, classify, probe };
