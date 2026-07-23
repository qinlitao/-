/**
 * classify.js — 日报内容分类器 v2.0
 * 四大主题：燃气轮机、AI企业管理、战略管理、产业链 + 通用分类
 * 参考 Glean「分类语义定义注入 prompt」思路，在关键词层做粗分
 */

const KEYWORD_CATEGORY = {
  // ===== 燃气轮机行业 =====
  '燃气轮机': [
    'gas turbine', '燃气轮机', 'turbine', 'turbomachinery',
    '燃机', '汽轮机', '涡轮', 'power generation',
    'combined cycle', '联合循环', 'aero-derivative', '重型燃机',
    'solar turbines', 'ge vernova', 'siemens energy',
    'mitsubishi power', 'mitsubishi heavy', 'rolls-royce',
    'baker hughes', 'ansaldo energia', 'doosan enerbility',
    '两机', '航发', 'aero engine',
  ],
  // ===== AI时代企业管理 =====
  'AI企业管理': [
    '量子组织', '量子管理', 'quantum organization',
    '央企改革', '国企改革', 'soe reform', 'soe innovation',
    'ai组织变革', 'ai enterprise', 'ai organization',
    '科层制', 'hierarchy', 'bureaucracy',
    '激励机制', 'incentive mechanism', '激励设计',
    '平台型组织', 'platform organization',
    '内部创业', 'intrapreneurship', 'internal venture',
    '新质生产力', 'new quality productive forces',
    '组织变革', 'organizational change', 'org redesign',
    '彭剑锋', '华夏基石', '陈春花', '吴晓波',
    '数字化转型', 'digital transformation',
    '敏捷组织', 'agile organization',
    '创新文化', 'innovation culture', 'innovation mindset',
    '员工赋能', 'employee empowerment', 'talent engagement',
    '央企创新', 'soe innovation',
  ],
  // ===== 战略管理 =====
  '战略管理': [
    '战略管理', 'strategic management', 'strategy',
    '信息密度', 'information density',
    '战略决策', 'strategic decision', 'decision making',
    'ai辅助决策', 'ai-assisted decision',
    '十五五', '十五五规划',
    '麦肯锡', 'mckinsey', '波士顿咨询', 'boston consulting', 'bcg',
    '贝恩', 'bain', '哈佛商业评论', 'harvard business review', 'hbr',
    '战略规划', 'strategic planning',
    '竞争战略', 'competitive strategy',
    '数字化战略', 'digital strategy',
    'ai时代战略', 'ai era strategy',
    '情报', 'intelligence', 'competitive intelligence',
    '快速决策', 'fast decision', 'agile decision',
  ],
  // ===== 产业链（材料/零部件/锻件）=====
  '产业链': [
    '高温合金', 'superalloy', '单晶叶片', 'single crystal blade',
    '精密铸造', 'investment casting', '精密锻件', 'precision forging',
    '涡轮盘', 'turbine disc', '叶片', 'blade', 'vane',
    '图南股份', '航亚科技', '应流股份', '钢研高纳',
    '抚顺特钢', '隆达股份', '航发动力', '航发控制', '航发科技',
    '东方电气', '上海电气', '哈电', '杰瑞股份',
    '中国动力', '中航重机', '三角防务',
    '产业链', 'supply chain', '零部件', 'component',
  ],
  // ===== 能源 =====
  '能源': [
    '能源', 'electricity', 'power plant', '电网', '发电', '新能源',
    '光伏', '风电', '氢能', '储能', '电池', 'carbon', '碳',
    'carbon neutral', '碳中和', 'renewable', 'hydrogen',
  ],
  // ===== 财经/股市/基金 =====
  '财经': [
    '财报', '营收', '利润', '估值', '市值', '季度', '分红', '回购',
    '融资', 'IPO', '基金', '净值', 'ETF',
    'revenue', 'earnings', 'profit', 'dividend',
    '重大合同', '重大订单', '技术突破', '并购', 'merger', 'acquisition',
    '产能扩张', '政策影响',
  ],
  // ===== 科技 =====
  '科技': [
    'AI', '人工智能', 'artificial intelligence', '芯片', '半导体',
    '大模型', '数据中心', 'datacenter', 'GPU', '算力', '机器人',
    'machine learning', '深度学习', 'deep learning',
  ],
  // ===== 政策 =====
  '政策': [
    '政策', '监管', '国资委', 'sasac', '改革', '法案', '关税',
    'policy', 'regulation', '央企', '国企',
    '碳交易', '碳排放', '碳税',
  ],
};

const CATEGORY_PRIORITY = [
  '燃气轮机', '产业链', 'AI企业管理', '战略管理', '财经',
  '能源', '科技', '政策',
];

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

  let category = defaultCategory || '其他';
  if (cats.size > 0) {
    category = CATEGORY_PRIORITY.find(c => cats.has(c)) || Array.from(cats)[0];
  }

  return { category, tags: Array.from(tags) };
}

module.exports = { classify, KEYWORD_CATEGORY };
