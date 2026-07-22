/**
 * core.js — 通用信源采集引擎
 * 读 sources.json → 按 type 分发到适配器 → 归一化+分类 → 去重 → 追加归档 state/archive.jsonl
 */
const fs = require('fs');
const path = require('path');
const { classify } = require('./classify');

const ROOT = __dirname;
const SOURCES_FILE = path.join(ROOT, 'sources.json');
const STATE_DIR = path.join(ROOT, 'state');
const SEEN_FILE = path.join(STATE_DIR, 'seen.json');
const ARCHIVE_FILE = path.join(STATE_DIR, 'archive.jsonl');

const ADAPTERS = {
  linkedin_feed: require('./adapters/linkedin'),
  rss: require('./adapters/web'),
  webpage: require('./adapters/web'),
  tencent_stock_news: require('./adapters/finance'),
  fund: require('./adapters/finance'),
};

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function loadJson(p, def) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : def; }

function loadSeen() { return loadJson(SEEN_FILE, {}); }
function saveSeen(s) { ensureDir(STATE_DIR); fs.writeFileSync(SEEN_FILE, JSON.stringify(s, null, 2), 'utf8'); }

function appendArchive(items) {
  ensureDir(STATE_DIR);
  const line = items.map(it => JSON.stringify(it)).join('\n');
  fs.appendFileSync(ARCHIVE_FILE, line + (line ? '\n' : ''), 'utf8');
}

function normalize(raw, source) {
  const sourceKey = `${source.platform || source.type}:${source.name}`;
  const { category, tags } = classify(raw, source.category);
  return {
    id: raw.id,
    sourceKey,
    platform: source.platform || source.type,
    name: source.name,
    title: raw.title || '',
    url: raw.url || '',
    text: raw.text || '',
    images: raw.images || [],
    publishedText: raw.publishedText || '',
    collectedDate: todayStr(),
    category,
    tags
  };
}

async function runCollection() {
  const date = todayStr();
  const sources = loadJson(SOURCES_FILE, { sources: [] }).sources || [];
  const seen = loadSeen();
  const newItems = [];
  const status = { date, runAt: new Date().toISOString(), sources: {}, newTotal: 0, errors: [] };

  for (const src of sources) {
    const key = `${src.platform || src.type}:${src.name}`;
    const adapter = ADAPTERS[src.type];
    if (!adapter) {
      status.sources[key] = { ok: false, error: `未知类型 ${src.type}` };
      status.errors.push(`${src.name}: 未知类型 ${src.type}`);
      continue;
    }
    try {
      const res = await adapter.collect(src);
      if (res.skipped) {
        status.sources[key] = { ok: true, skipped: true, reason: res.reason };
        continue;
      }
      if (res.sessionExpired) {
        status.sources[key] = { ok: false, sessionExpired: true, newCount: 0 };
        status.errors.push(`${src.name}: LinkedIn 登录态失效，需重新登录`);
        continue;
      }
      if (res.error) {
        status.sources[key] = { ok: false, error: res.error, newCount: 0 };
        status.errors.push(`${src.name}: ${res.error}`);
        continue;
      }
      const fresh = [];
      for (const raw of res.items) {
        const id = raw.id;
        if (!id) continue;
        const dedupKey = `${key}::${id}`;
        if (seen[dedupKey]) continue;
        seen[dedupKey] = date;
        fresh.push(normalize(raw, src));
      }
      status.sources[key] = { ok: true, collected: res.items.length, newCount: fresh.length };
      status.newTotal += fresh.length;
      newItems.push(...fresh);
    } catch (e) {
      status.sources[key] = { ok: false, error: e.message, newCount: 0 };
      status.errors.push(`${src.name}: ${e.message}`);
    }
  }

  saveSeen(seen);
  if (newItems.length) appendArchive(newItems);
  return { date, newItems, status };
}

module.exports = { runCollection, todayStr, ARCHIVE_FILE };
