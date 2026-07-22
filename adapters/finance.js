/**
 * adapters/finance.js — 腾讯自选股资讯 + 基金净值
 *  - tencent_stock_news：对每个代码调用 `westock-data notice list <code>`（腾讯自选股公告/资讯流）
 *  - fund：对每个基金代码调用东方财富 lsjz 接口取最新单位净值+日涨跌
 */
const { execFileSync } = require('child_process');

const WESTOCK_CLI = process.env.WESTOCK_CLI ||
  'D:/Program/WorkBuddy/resources/app.asar.unpacked/resources/builtin-skills/westock-data/scripts/index.js';

function runWestock(args) {
  return execFileSync('node', [WESTOCK_CLI, ...args], {
    encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024
  });
}

// 解析 westock-data 输出的 markdown 表格
function parseMarkdownTable(stdout) {
  const lines = stdout.split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 3) return [];
  return lines.slice(2).map(line => {
    const cells = line.split('|').map(c => c.trim());
    return cells.slice(1, -1); // 去掉首尾空串
  }).filter(cells => cells.length > 0);
}

async function collectStockNews(source) {
  const symbols = source.symbols || [];
  const limit = source.limit || 10;
  const items = [];
  for (const sym of symbols) {
    try {
      const out = runWestock(['notice', 'list', sym, '--limit', String(limit)]);
      const rows = parseMarkdownTable(out);
      for (const c of rows) {
        // 列: id | symbol | title | time | type | url | newstype | update_time | Ftranslate
        const id = c[0], symbol = c[1], title = c[2], time = c[3];
        if (!title) continue;
        items.push({
          id: `notice:${id}`,
          title: `[${symbol}] ${title}`,
          url: '',
          text: '',
          images: [],
          publishedText: time || ''
        });
      }
    } catch (e) {
      // 单个代码失败不影响其他
      console.error(`  [stock] ${sym} 失败: ${e.message}`);
    }
  }
  return items;
}

async function fetchFundNav(code) {
  const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=1`;
  const resp = await fetch(url, { headers: { 'Referer': 'https://fundf10.eastmoney.com/' }, timeout: 15000 });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const list = json && json.Data && json.Data.LSJZList;
  if (!list || !list.length) throw new Error('无净值数据');
  const r = list[0];
  return { fsrq: r.FSRQ, dwjz: r.DWJZ, jzzzl: r.JZZZL };
}

async function collectFund(source) {
  const codes = source.fund_codes || [];
  const items = [];
  for (const code of codes) {
    try {
      const nav = await fetchFundNav(code);
      items.push({
        id: `fund:${code}:${nav.fsrq}`,
        title: `基金 ${code} 单位净值 ${nav.dwjz}（日涨跌 ${nav.jzzzl}%）`,
        url: `https://fundf10.eastmoney.com/...`,
        text: '',
        images: [],
        publishedText: nav.fsrq
      });
    } catch (e) {
      console.error(`  [fund] ${code} 失败: ${e.message}`);
    }
  }
  return items;
}

async function collect(source) {
  if (source.type === 'tencent_stock_news') {
    const items = await collectStockNews(source);
    return { items };
  }
  if (source.type === 'fund') {
    const items = await collectFund(source);
    return { items };
  }
  return { items: [], error: `finance adapter 不支持类型 ${source.type}` };
}

module.exports = { collect };
