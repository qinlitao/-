/**
 * quality.js — 日报质量滤网 v2.0
 * 2026-07-30: P1 JS拦截页门禁 / P2 Rolls-Royce 航空分流 / P3 非英语招聘词扩充
 * 落实 daily-report-standards.md §3(领域相关性) 与 §5(标题清洗)
 *
 * 设计原则：每条进日报的资讯必须能回答"这和燃气轮机/两机/央企组织创新有何关系"。
 * 回答不出 → 丢弃。纯规则、零 token 消耗，可在采集后 + 渲染前双重应用。
 */

// ---------- 1. 燃气轮机正例词表（命中即视为相关）----------
const TURBINE_POSITIVE = [
  'gas turbine', '燃气轮机', '燃机', 'turbine', 'turbomachinery', 'combined cycle', '联合循环',
  'aero-derivative', '航改', '重型燃机', '航发', 'aero engine', '航空发动机',
  '高温合金', 'superalloy', '涡轮叶片', 'turbine blade', '涡轮盘', 'turbine disc', '叶片', 'blade',
  '压气机', 'compressor', '燃烧室', 'combustion', '转子', 'rotor', '机匣', '叶轮',
  'siemens energy', 'ge vernova', '西门子能源', '索拉', 'solar turbines', '三菱动力', 'mitsubishi',
  'rolls-royce power', 'mtu', '罗罗动力', 'baker hughes', '安萨尔多', 'ansaldo', '斗山', 'doosan',
  '东方电气', '上海电气', '航发动力', '杰瑞', '中国动力', '哈电', '中国航发', '中国航发燃机',
  '图南股份', '航亚科技', '应流', '钢研高纳', '中航重机', '三角防务', '航发科技', '航宇科技',
  '发电机组', '发电', '供电', '数据中心供电', '掺氢', '氢能燃机', 'hydrogen', '检修', '大修', '燃机服务',
  '型号合格证', '批产', '量产',
];

// 1b. 燃机"产品/技术"硬词（不含公司名）——用于股市源门禁，避免"上海电气脱硫中标"误判相关
const TURBINE_CORE = [
  'gas turbine', '燃气轮机', '燃机', 'turbine', 'turbomachinery', 'combined cycle', '联合循环',
  'aero-derivative', '航改', '重型燃机', '航发', 'aero engine', '航空发动机',
  '高温合金', 'superalloy', '涡轮叶片', 'turbine blade', '涡轮盘', 'turbine disc', '叶片', 'blade',
  '压气机', 'compressor', '燃烧室', 'combustion', '转子', 'rotor', '机匣', '叶轮',
  '发电机组', '发电', '供电', '数据中心供电', '掺氢', '氢能燃机', 'hydrogen', '检修', '大修', '燃机服务',
  '型号合格证', '批产', '量产',
];

// ---------- 2. 股市日常交易噪音（命中即丢弃）----------
const STOCK_NOISE = [
  '主力资金净流入', '主力资金净流出', '主力资金', '资金净流入', '资金净流出', '资金流向', '资金面',
  '净流入', '净流出', '换手率', '盘后综述', '盘后', '盘中', '早盘', '尾盘',
  '站上', '跌破', '均线', '龙虎榜', '游资', '北向资金', '融资余额', '融券', '大宗交易',
  '震荡上行', '震荡', '逆势走强', '板块异动', '放量', '缩量', '支撑位', '压力位', 'MACD', 'KDJ',
];

// 股市财务点评/ Commentary（非重大事件，丢弃）
const FINANCIAL_COMMENTARY = [
  '凑出个', '利润？', '利润点评', '业绩点评', '盈利质量', '增收不增利', '盈利承压',
  '才凑出', '利润虚', '扣非', '非经常性损益',
];

// ---------- 3. 海上石油/海洋能源（上游勘探开发，非燃机发电）----------
const OFFSHORE_OIL = [
  'drilling', 'drill ship', 'drillship', 'jack-up', 'rig', 'fps', 'fso',
  'oil well', 'oil field', 'oil train', '海上石油', '钻井', '油气田', '海上油气',
  'offshore drilling', 'subsea', '海上能源', 'marine energy', 'offshore energy',
  'ocean current', '洋流', 'tidal', '潮汐', 'wave energy', 'lng 上游', 'liquefaction',
  'eniproject', 'chevron', 'bp ', 'shell', 'eni ', 'saipem', 'velesto',
];

// ---------- 4. OEM 文化类噪音（招聘/团建/节日/CSR）----------
const OEM_CULTURE = [
  'we are hiring', 'hiring', 'job opening', 'career opportunity', 'join our team', '招聘', '诚聘', '热招',
  'team building', '团建', 'annual party', '年会', 'year-end', '中秋快乐', '春节快乐', '圣诞',
  'merry christmas', 'happy new year', 'csr', 'esg report', 'sustainability report',
  'employee spotlight', 'our people', '员工风采', '员工故事',
  // 多语言招聘/文化信号（覆盖欧洲 OEM 非英语帖，如 Ansaldo 意大利语招聘）
  'randstad', 'tirocinio', 'montatore', 'stellenangebot', 'bewerbung', 'praktikum',
  'oferta de empleo', 'empleo', 'open to work', 'apply now', 'hiring now', 'job fair',
];

// ---------- 4b. 风电/光伏负例（扩展词命中但实为风电光伏时丢弃，对齐云端）----------
const WIND_SOLAR = [
  'wind turbine', 'wind power', '风力发电', '风电', 'wind farm', 'wind park',
  '光伏', 'solar power', 'photovoltaic', '太阳能板', 'solar panel', '光伏电站',
];

// ---------- 4c. 航空发动机负例（与燃机发电无关的航空推进内容，对齐主题）----------
const AVIATION_ENGINE = [
  'trent 7000', 'trent xwb', 'trent 1000', 'trent 900', 'trent 700',
  'farnborough', 'airshow', 'paris air show', 'gcap', 'combat aircraft',
  'business aviation', 'commercial aviation', 'business jet', 'narrowbody', 'widebody',
];

// ---------- 5. 产业链"重大事件"正例（股市源必须有其一才保留）----------
const MAJOR_EVENT = [
  '订单', '签约', '合同', '中标', '大单', '拿下', '中标候选', '入围',
  '技术突破', '型号合格证', '批产', '量产', '首台', '交付',
  '融资', '并购', '收购', '增资', 'ipo', '产能', '扩产', '基地',
  '认证', '合格供应商', '战略合作', '框架协议', '点火', '并网',
];

function haystack(item) {
  return `${item.title || ''} ${item.text || ''} ${item.originalTitle || ''}`.toLowerCase();
}

function hasAny(hay, list) {
  return list.some(k => hay.includes(k));
}

function hasTurbine(hay) {
  return hasAny(hay, TURBINE_POSITIVE);
}

// 1c. 燃机精确词（不含过宽的 turbine/发电，避免风电/光伏误判）— 用于风电/光伏/海上油气/泛能源排除
const GAS_KEYWORDS = [
  'gas turbine', '燃气轮机', '燃机', '燃气透平', 'gt engine', 'hrsg',
  '重型燃机', '航改', 'aero-derivative', '联合循环', 'combined cycle',
  '汽轮机', '燃气发电', '天然气发电', 'ccgt', 'scct', '掺氢燃机', '氢能燃机',
  'hydrogen turbine', 'gas power', 'h-class', 'f-class', '航发', 'aero engine',
  '高温合金', '涡轮叶片', 'turbine blade', '压气机', '燃烧室', '燃机服务', '燃机检修',
];

function hasGasTurbine(hay) {
  return hasAny(hay, GAS_KEYWORDS);
}

/**
 * 判定单条是否保留
 * @returns {{keep:boolean, reason?:string, tag?:string}}
 */
// P1: JS 拦截页 / 导航页判定正则
const JS_WALL_RE = /(enable javascript|just a moment|verify you are human|checking your browser|enable cookies)/i;
// 导航类标题（整站菜单页常用，与具体新闻标题不同）
const NAV_TITLE_RE = /^(media contacts?|press resources?|event calendar|event search|competitions?|newsroom|contact us|about us|privacy policy|terms of (use|service)|news(?: & | and )?events?|latest news|all news|press releases?|media|events)\s*$/i;
// 抓取到的整站菜单正文特征（CMS 模板残留，如 "Skip to main content"）
const NAV_BOILERPLATE_RE = /skip to main content|skip to content/i;

function filterItem(item) {
  const hay = haystack(item);
  const isStock = item.platform === 'tencent_stock' || item.platform === 'stock';

  // P1: JS 拦截页（如 "Enable JavaScript and cookies to continue"）→ 直接丢弃
  if (JS_WALL_RE.test(item.text || '')) return { keep: false, reason: 'js_wall', tag: 'JS拦截页' };
  // P1: 导航页（press 源 + 导航类标题，如 Event Calendar / Media Contacts / News & Events）→ 丢弃
  // 注意：导航页正文往往是整站菜单（数百字符），不能用正文长度判断，必须以标题为准
  if (item.press && NAV_TITLE_RE.test((item.title || '').trim())) {
    return { keep: false, reason: 'nav_page', tag: '导航页' };
  }
  // P1: 正文含 CMS 菜单残留（"Skip to main content"）→ 整站菜单页，丢弃
  if (NAV_BOILERPLATE_RE.test(item.text || '')) {
    return { keep: false, reason: 'nav_page', tag: '导航页' };
  }

  // P2: 航空发动机负例（Trent/Farnborough/GCAP 等，与燃机发电无关）
  if (hasAny(hay, AVIATION_ENGINE) && !hasGasTurbine(hay)) {
    return { keep: false, reason: 'aviation_engine', tag: '航空发动机' };
  }

  if (hasAny(hay, OEM_CULTURE)) return { keep: false, reason: 'oem_culture', tag: 'OEM文化' };
  if (hasAny(hay, STOCK_NOISE)) return { keep: false, reason: 'stock_noise', tag: '股市日常噪音' };
  if (hasAny(hay, FINANCIAL_COMMENTARY)) return { keep: false, reason: 'financial_commentary', tag: '财务点评' };

  // 风电/光伏负例：命中风电/光伏词且非燃机精确词 → 丢弃（对齐云端，避免 turbine/发电误判）
  if (hasAny(hay, WIND_SOLAR) && !hasGasTurbine(hay)) {
    return { keep: false, reason: 'wind_solar', tag: '风电/光伏' };
  }

  // 权威源豁免：press:true 的条目已人工精选，跳过领域相关性/海上油气/产业链门禁
  // （但 OEM 团建噪音已在上方拦截，仍遵守"OEM活动不统计"）
  if (item.press) return { keep: true, tag: 'press豁免' };

  // 海上石油/海洋能源：无燃机精确词则丢弃
  if (hasAny(hay, OFFSHORE_OIL) && !hasGasTurbine(hay)) {
    return { keep: false, reason: 'offshore_oil', tag: '海上油气/海洋能源' };
  }

  // 泛能源类：必须围绕燃机（用精确词，避免风电/光伏/普通发电误判）
  if ((item.category === '能源') && !hasGasTurbine(hay)) {
    return { keep: false, reason: 'energy_offtopic', tag: '泛能源无关' };
  }

  // 产业链股市源：必须明确围绕燃机产品/技术（"产业链新闻要围绕燃机领域"）
  // 用 TURBINE_CORE（不含公司名），避免"上海电气脱硫中标"等无关中标误判相关
  if (isStock && !hasAny(hay, TURBINE_CORE)) {
    return { keep: false, reason: 'chain_offtopic', tag: '产业链无关燃机' };
  }

  return { keep: true };
}

// ---------- 标题清洗 ----------
const TITLE_PREFIX_RE = /^\[\s*(sh|sz|bj)\d{6}\s*\]\s*/i;        // [sh600893]
const TITLE_PREFIX_PAREN_RE = /^\(\s*(sh|sz|bj)\d{6}\s*\)\s*/i;  // (sh600893)
const SOURCE_WATERMARK_RE = /[_\-—|]\s*(腾讯网|东方财富网|新浪财经|同花顺|证券时报|财联社|公众号|来源[：:]?\s*\S+)\s*$/i;
const SEO_SUFFIX_RE = /[_\-—|]\s*(详解|最新消息|股吧|快讯|原创)\s*$/i;

function cleanTitle(title) {
  if (!title) return '';
  let t = title.trim();
  t = t.replace(TITLE_PREFIX_RE, '').replace(TITLE_PREFIX_PAREN_RE, '');
  t = t.replace(SOURCE_WATERMARK_RE, '').replace(SEO_SUFFIX_RE, '');
  t = t.replace(/\s{2,}/g, ' ').replace(/^[·|]\s*/, '').replace(/\s+[·|]\s*$/, '');
  t = t.trim();
  // 清洗后过短 → 回退原文
  if (t.length < 4) return title.trim();
  if (t.length > 60) t = t.slice(0, 60) + '…';
  return t;
}

module.exports = {
  filterItem, cleanTitle, hasTurbine, hasGasTurbine,
  TURBINE_POSITIVE, TURBINE_CORE, GAS_KEYWORDS, STOCK_NOISE, FINANCIAL_COMMENTARY, OFFSHORE_OIL, OEM_CULTURE, WIND_SOLAR, MAJOR_EVENT, AVIATION_ENGINE,
};
