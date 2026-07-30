/**
 * core.js — 通用信源采集引擎 v2.1
 * 读 sources.json → 按 type 分发到适配器 → 归一化+分类 → 时间过滤 → 去重 → 追加归档
 * 2026-07-22: 加入日期解析、时间窗口过滤（前一天）、翻译预处理
 */
const fs = require('fs');
const path = require('path');
const { classify } = require('./classify');
const { filterItem } = require('./quality');

const ROOT = __dirname;
const SOURCES_FILE = path.join(ROOT, 'sources.json');
const STATE_DIR = path.join(ROOT, 'state');
const SEEN_FILE = path.join(STATE_DIR, 'seen.json');
const ARCHIVE_FILE = path.join(STATE_DIR, 'archive.jsonl');

// 懒加载：仅在源 enabled 时才 require 对应适配器
const ADAPTER_FACTORIES = {
  linkedin_feed: () => require('./adapters/linkedin'),
  rss: () => require('./adapters/web'),
  webpage: () => require('./adapters/web'),
  press: () => require('./adapters/web'),
  tencent_stock_news: () => require('./adapters/finance'),
  fund: () => require('./adapters/finance'),
};

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

/**
 * 获取 Asia/Shanghai 时区的「今天」和「昨天」日期字符串
 */
function getShanghaiDate() {
  const now = new Date();
  const shanghaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const y = shanghaiTime.getFullYear();
  const m = String(shanghaiTime.getMonth() + 1).padStart(2, '0');
  const d = String(shanghaiTime.getDate()).padStart(2, '0');
  return { today: `${y}-${m}-${d}`, year: y, month: shanghaiTime.getMonth(), day: shanghaiTime.getDate() };
}

function todayStr() {
  return getShanghaiDate().today;
}

function yesterdayStr() {
  const { year, month, day } = getShanghaiDate();
  const d = new Date(year, month, day - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 解析各种日期格式为 Date 对象
 * 支持：ISO 8601、RFC 2822、Unix 时间戳、中文日期等
 */
function parseDate(text) {
  if (!text) return null;
  const s = text.trim();

  // Unix 时间戳（秒或毫秒）
  if (/^\d{10}$/.test(s)) return new Date(parseInt(s) * 1000);
  if (/^\d{13}$/.test(s)) return new Date(parseInt(s));

  // ISO 8601 / RFC 2822 / 其他 Date.parse 能识别的
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  // 中文格式：2026年07月22日 或 2026-07-22
  const m = s.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));

  return null;
}

/**
 * 检查日期是否在指定窗口内（前一天 00:00 ~ 23:59:59，Asia/Shanghai）
 */
function isInWindow(dateStr, windowDays) {
  if (!dateStr) return true; // 无日期的保留（如 LinkedIn 信息流）
  const d = parseDate(dateStr);
  if (!d) return true; // 解析失败的保留

  const { year, month, day } = getShanghaiDate();
  // 滚动窗口：保留 [今天-windowDays, 今天) 共 windowDays 整天（不含今天）。
  // 兼容 windowDays=1 = 昨天；windowDays=14 = 最近 14 天。
  // 旧实现 windowEnd = day - windowDays + 1，把"最近 N 天"错成"只保留 N 天前那 1 天"，
  // 导致 press 源(windowDays=14)几乎全被 time-filtered 砍掉，日报燃机条目极少。
  const windowStart = new Date(year, month, day - windowDays, 0, 0, 0);
  const windowEnd = new Date(year, month, day, 0, 0, 0);

  return d >= windowStart && d < windowEnd;
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
  const pubDate = parseDate(raw.publishedText);
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
    publishDate: pubDate ? pubDate.toISOString() : '',
    collectedDate: todayStr(),
    category,
    tags,
    press: !!source.press,  // 权威信源标志：质量滤网豁免噪音检查
    windowDays: source.windowDays || 1,  // 滚动时间窗（press 14天，社交/新闻 1天）
    // 翻译相关字段（由 translate.js 填充）
    originalTitle: raw.originalTitle || '',
    originalText: raw.originalText || '',
    translated: raw.translated || false,
  };
}

async function runCollection() {
  const date = todayStr();
  const sources = loadJson(SOURCES_FILE, { sources: [] }).sources || [];
  const seen = loadSeen();
  const newItems = [];
  const dateFiltered = 0;
  const status = { date, runAt: new Date().toISOString(), sources: {}, newTotal: 0, errors: [], dateFiltered };

  for (const src of sources) {
    if (src.enabled === false || src._disabled) {
      status.sources[`${src.platform || src.type}:${src.name}`] = { ok: true, skipped: true, reason: '已禁用(enabled=false)' };
      continue;
    }
    const key = `${src.platform || src.type}:${src.name}`;

    // MCP 信源
    let res;
    if (src.collect_via === 'mcp') {
      const rawFile = src.raw_file;
      if (!rawFile || !fs.existsSync(path.join(STATE_DIR, rawFile))) {
        status.sources[key] = { ok: true, skipped: true, reason: 'MCP 原始文件缺失' };
        continue;
      }
      res = { items: loadJson(path.join(STATE_DIR, rawFile), []) };
    } else {
      const factory = ADAPTER_FACTORIES[src.type];
      if (!factory) {
        status.sources[key] = { ok: false, error: `未知类型 ${src.type}` };
        status.errors.push(`${src.name}: 未知类型 ${src.type}`);
        continue;
      }
      try {
        const adapter = factory();
        res = await adapter.collect(src);
      } catch (e) {
        status.sources[key] = { ok: false, error: e.message, newCount: 0 };
        status.errors.push(`${src.name}: ${e.message}`);
        continue;
      }
    }

    if (res.skipped) { status.sources[key] = { ok: true, skipped: true, reason: res.reason }; continue; }
    if (res.sessionExpired) { status.sources[key] = { ok: false, sessionExpired: true, newCount: 0 }; status.errors.push(`${src.name}: LinkedIn 登录态失效`); continue; }
    if (res.error) { status.sources[key] = { ok: false, error: res.error, newCount: 0 }; status.errors.push(`${src.name}: ${res.error}`); continue; }

    const fresh = [];
    let filteredByDate = 0;
    // 按源滚动时间窗：press 权威源默认 14 天（OEM/期刊不日报），社交/新闻 1 天
    const windowDays = src.windowDays || 1;
    for (const raw of res.items) {
      const id = raw.id;
      if (!id) continue;
      const dedupKey = `${key}::${id}`;
      if (seen[dedupKey]) continue;

      // 时间窗口过滤（按源 windowDays）
      if (!isInWindow(raw.publishedText, windowDays)) {
        filteredByDate++;
        continue;
      }

      seen[dedupKey] = date;
      const norm = normalize(raw, src);
      // 质量滤网：采集即过滤噪音（渲染前还会再过滤一次，双保险）
      const qr = filterItem(norm);
      if (!qr.keep) { status.dateFiltered++; continue; }
      fresh.push(norm);
    }
    status.sources[key] = { ok: true, collected: res.items.length, newCount: fresh.length, dateFiltered: filteredByDate };
    status.newTotal += fresh.length;
    status.dateFiltered += filteredByDate;
    newItems.push(...fresh);
  }

  saveSeen(seen);

  // 覆盖率告警：权威/媒体信源（press/rss 类型，已启用）若全部 0 产出，记警示
  const authoritativeEnabled = sources.filter(s => !s._disabled && s.enabled !== false && (s.type === 'press' || s.type === 'rss' || s.type === 'webpage') && s.platform !== 'wechat');
  const anyAuthoritativeHit = authoritativeEnabled.some(s => {
    const st = status.sources[`${s.platform || s.type}:${s.name}`];
    return st && st.ok && st.collected > 0;
  });
  if (authoritativeEnabled.length && !anyAuthoritativeHit) {
    status.errors.push('覆盖率告警: 全部权威/媒体信源 0 产出（可能网络受限或源失效）');
  }

  if (newItems.length) appendArchive(newItems);
  writeRunLog(status);
  return { date, newItems, status };
}

// 运行日志（对齐云端 §5 源健康运维）：每次运行写一行，供日报头部展示"本日N源异常"
const RUNLOG_FILE = path.join(STATE_DIR, 'run-log.jsonl');
function writeRunLog(status) {
  ensureDir(STATE_DIR);
  const errCount = (status.errors || []).length;
  const failedSources = Object.entries(status.sources || {})
    .filter(([, v]) => v && v.ok === false)
    .map(([k]) => k);
  const log = {
    date: status.date,
    runAt: status.runAt,
    newTotal: status.newTotal,
    errors: errCount,
    failedSources,
    sources: status.sources,
  };
  try {
    fs.appendFileSync(RUNLOG_FILE, JSON.stringify(log) + '\n', 'utf8');
    // 仅保留最近 60 行
    const lines = fs.readFileSync(RUNLOG_FILE, 'utf8').split('\n').filter(Boolean);
    if (lines.length > 60) fs.writeFileSync(RUNLOG_FILE, lines.slice(-60).join('\n') + '\n', 'utf8');
  } catch (e) { /* 日志非关键 */ }
}

module.exports = { runCollection, todayStr, yesterdayStr, parseDate, isInWindow, getShanghaiDate, ARCHIVE_FILE };
