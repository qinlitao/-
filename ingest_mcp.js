/**
 * ingest_mcp.js — 把 MCP 采集的原始数据（westock / yingmi）映射为归一化条目
 * 写入 state/mcp_stock.json 与 state/mcp_fund.json，供 core.js 在日报流程中摄入。
 * 这些原始文件由「agent 调 MCP」阶段产出（state/raw_*.json）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const STATE = path.join(ROOT, 'state');

function load(p) {
  const fp = path.join(STATE, p);
  return fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : null;
}
function save(p, data) {
  fs.writeFileSync(path.join(STATE, p), JSON.stringify(data, null, 2), 'utf8');
}

// ---- 腾讯自选股：westock-mcp data_news ----
function mapStock() {
  const raw = load('raw_westock.json');
  const items = [];
  if (!raw || !Array.isArray(raw.results)) return items;
  for (const r of raw.results) {
    const arr = r && r.data && r.data.data;
    if (!Array.isArray(arr)) continue;
    for (const d of arr) {
      items.push({
        id: `wx:${d.symbol}:${d.id}`,
        title: `[${d.symbol}] ${d.title}`,
        url: d.url || '',
        text: '',
        images: [],
        publishedText: d.time || ''
      });
    }
  }
  return items;
}

// ---- 基金：yingmi-mcp BatchGetFundsDetail + SearchFinancialNews ----
function mapFund() {
  const items = [];
  // 净值条目
  const detail = load('raw_yingmi_detail.json');
  if (Array.isArray(detail)) {
    for (const f of detail) {
      const s = f && f.data && f.data.summary;
      if (!s) continue;
      const mgrs = (f.data.managers || []).map(m => m.fundManagerName).join('/');
      items.push({
        id: `ym:nav:${s.fundCode}:${s.navDate}`,
        title: `${s.fundName}(${s.fundCode}) 最新净值 ${s.nav}（${s.navDate}）日涨跌${s.dailyReturn}`,
        url: '',
        text: `类型${s.fundInvestType}；规模${s.netAsset}；经理${mgrs}；近一年${s.oneYearReturn}；风险等级R${s.risk5Level}`,
        images: [],
        publishedText: s.navDate
      });
    }
  }
  // 基金资讯条目
  const news = load('raw_yingmi_news.json');
  const arr = news && news.data && news.data.items;
  if (Array.isArray(arr)) {
    for (const n of arr) {
      items.push({
        id: `ym:news:${n.id}`,
        title: n.title,
        url: n.url || '',
        text: (n.sources ? `来源：${n.sources}\n` : '') + (n.summary || ''),
        images: [],
        publishedText: n.publishDate || ''
      });
    }
  }
  return items;
}

const stockItems = mapStock();
const fundItems = mapFund();
save('mcp_stock.json', stockItems);
save('mcp_fund.json', fundItems);
console.log(`[ingest] 股票 ${stockItems.length} 条，基金 ${fundItems.length} 条 → state/mcp_stock.json / state/mcp_fund.json`);
