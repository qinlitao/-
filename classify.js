/**
 * classify.js — 内容分类器
 * 规则：① 信源自带默认 category（sources.json 的 category 字段）；② 关键词命中打 tags 并归入匹配类别。
 * 输出：{ category, tags[] }
 */

// 关键词 → 类别映射（命中任一关键词即归入该类别；可多类别）
const KEYWORD_CATEGORY = {
  '能源': ['能源', 'electricity', 'power', '电网', '发电', '新能源', '光伏', '风电', '氢能', '储能', '电池'],
  '燃气轮机': ['gas turbine', '燃气轮机', 'turbine', 'turbomachinery', 'GE Vernova', 'Siemens Energy', '燃机', '汽轮机'],
  '财经': ['财报', '营收', '利润', '估值', '股价', '市值', '季度', '分红', '回购', '融资', 'IPO', '基金', '净值', 'ETF', 'revenue', 'earnings', 'profit', 'dividend'],
  '市场': ['市场', '大盘', '指数', 'A股', '港股', '美股', '行情', '涨跌', '资金流向', '板块', 'market', 'index'],
  '科技': ['AI', '人工智能', '芯片', '半导体', '大模型', '数据中心', 'datacenter', 'GPU', '算力', '机器人'],
  '政策': ['政策', '监管', '国资委', '改革', '法案', '关税', 'policy', 'regulation', '央企', '国企'],
  '公司动态': ['公司', '收购', '并购', '合作', '签约', '发布', '任命', '上市', 'company', 'acquisition', 'partnership', 'launch'],
  '航空': ['航空', ' aerospace', '发动机', '民航', 'aviation', 'aerospace', 'engine'],
};

function classify(item, defaultCategory) {
  const hay = `${item.title || ''} ${item.text || ''}`.toLowerCase();
  const tags = new Set();
  const cats = new Set();

  if (defaultCategory) cats.add(defaultCategory);

  for (const [cat, kws] of Object.entries(KEYWORD_CATEGORY)) {
    for (const kw of kws) {
      if (hay.includes(kw.toLowerCase())) {
        tags.add(kw);
        cats.add(cat);
      }
    }
  }

  // 若未命中任何关键词类别，归入信源默认；仍无则"其他"
  let category = defaultCategory || '其他';
  if (cats.size > 0) {
    // 多类别时优先：能源/燃气轮机/航空 > 财经/市场 > 科技 > 政策 > 公司动态
    const priority = ['燃气轮机', '航空', '能源', '财经', '市场', '科技', '政策', '公司动态'];
    category = priority.find(c => cats.has(c)) || Array.from(cats)[0];
  }

  return { category, tags: Array.from(tags) };
}

module.exports = { classify };
