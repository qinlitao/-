/**
 * reports.js — 日/周/月报渲染 v2.1
 * 子模块拆分 + 模块总结 + 翻译标注 + 时间窗口过滤
 */
const fs = require('fs');
const path = require('path');
const { ARCHIVE_FILE, todayStr, parseDate, getShanghaiDate } = require('./core');
const { filterItem, cleanTitle } = require('./quality');

const ROOT = __dirname;
const OUT_DIR = {
  daily: path.join(ROOT, 'daily_report'),
  weekly: path.join(ROOT, 'weekly_report'),
  monthly: path.join(ROOT, 'monthly_report'),
};
const LABEL = { daily: '每日', weekly: '每周', monthly: '每月' };

// 子模块定义：按 tags 关键词细分
const SUB_MODULES = {
  '燃气轮机': {
    'OEM动态': ['gas turbine', '燃气轮机', 'siemens energy', 'ge vernova', 'mitsubishi', 'rolls-royce', 'solar turbines', 'baker hughes', 'ansaldo', 'doosan'],
    '技术进展': ['技术', 'technology', '创新', 'innovation', '效率', 'efficiency', '排放', 'emission', '氢', 'hydrogen', 'fuel'],
    '订单与市场': ['订单', 'order', '合同', 'contract', '市场', 'market', '收入', 'revenue', '项目', 'project', '签', '签约'],
    '政策与标准': ['政策', 'policy', '标准', 'standard', '法规', 'regulation', '补贴', 'subsidy', '碳', 'carbon'],
  },
  'AI企业管理': {
    '组织变革': ['组织', 'organization', '变革', 'transformation', '架构', 'architecture', '科层', 'hierarchy', '扁平', 'flat'],
    '激励机制': ['激励', 'incentive', '薪酬', 'compensation', '绩效', 'performance', '股权', 'equity', '奖励', 'reward'],
    '央企改革': ['央企', 'soe', '国企', 'state-owned', '改革', 'reform', '国资委', 'sasac'],
    '数字化转型': ['数字化', 'digital', '智能化', 'intelligent', '平台', 'platform', '数据', 'data'],
  },
  '战略管理': {
    'AI与战略': ['ai', '人工智能', 'artificial intelligence', '大模型', 'llm', '机器', 'machine'],
    '竞争战略': ['竞争', 'competitive', '战略', 'strategy', '优势', 'advantage', '壁垒', 'moat'],
    '组织设计': ['组织设计', 'org design', '治理', 'governance', '决策', 'decision', '授权', 'delegation'],
    '咨询观点': ['麦肯锡', 'mckinsey', 'bcg', 'bain', '贝恩', '咨询', 'consulting', 'hbr', 'harvard'],
  },
  '产业链': {
    '整机制造': ['东方电气', '上海电气', '哈电', '航发动力', '杰瑞', '中国动力', '整机'],
    '零部件': ['叶片', 'blade', '叶盘', 'disc', '锻件', 'forging', '铸件', 'casting', '精密', 'precision'],
    '材料': ['高温合金', 'superalloy', '钛合金', 'titanium', '陶瓷', 'ceramic', '涂层', 'coating', '特钢', 'steel'],
    '并购融资': ['并购', 'merger', 'acquisition', '融资', 'funding', 'IPO', '上市'],
  },
  '财经': {
    '基金动态': ['基金', 'fund', 'ETF', '净值', 'nav', '持仓', 'holding'],
    '财报业绩': ['财报', 'earnings', '营收', 'revenue', '利润', 'profit', '业绩', '业绩预告'],
    '重大事件': ['重大', 'significant', '突破', 'breakthrough', '签约', 'signed', '发布', 'launch'],
  },
  '能源': {
    '新能源': ['光伏', 'solar', '风电', 'wind', '氢能', 'hydrogen', '储能', 'storage', '电池', 'battery'],
    '传统能源': ['天然气', 'natural gas', '石油', 'oil', '煤炭', 'coal', '核电', 'nuclear'],
    '碳中和': ['碳中和', 'carbon neutral', '碳交易', 'carbon trading', '碳排放', 'emission'],
  },
};

// 子模块总结模板
const SUB_SUMMARY_TEMPLATES = {
  'OEM动态': '本日各主机厂动态',
  '技术进展': '技术突破与创新方向',
  '订单与市场': '市场拓展与合同签约',
  '政策与标准': '政策法规与行业标准变化',
  '组织变革': '组织架构与管理模式变革',
  '激励机制': '激励设计与人才策略',
  '央企改革': '国企改革与政策动向',
  '数字化转型': '数字化与智能化实践',
  'AI与战略': 'AI 技术对战略管理的影响',
  '竞争战略': '竞争格局与战略选择',
  '组织设计': '治理结构与决策机制',
  '咨询观点': '顶级咨询机构最新洞察',
  '整机制造': '整机厂商动态',
  '零部件': '零部件供应链动态',
  '材料': '材料技术与供应',
  '并购融资': '产业链投融资事件',
  '基金动态': '相关基金运作动态',
  '财报业绩': '上市公司财务表现',
  '重大事件': '行业重大事件',
  '新能源': '新能源领域动态',
  '传统能源': '传统能源市场动态',
  '碳中和': '碳中和相关政策与实践',
};

function loadArchive() {
  if (!fs.existsSync(ARCHIVE_FILE)) return [];
  const lines = fs.readFileSync(ARCHIVE_FILE, 'utf8').split('\n').filter(Boolean);
  return lines.map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}

/**
 * 根据 tags 匹配子模块
 */
function matchSubModule(item, category) {
  const subs = SUB_MODULES[category];
  if (!subs) return '其他';
  const hay = `${item.title} ${item.text} ${(item.tags || []).join(' ')}`.toLowerCase();
  for (const [subName, keywords] of Object.entries(subs)) {
    for (const kw of keywords) {
      if (hay.includes(kw.toLowerCase())) return subName;
    }
  }
  return '其他';
}

/**
 * 生成子模块总结（基于条目内容提取关键信息）
 */
function generateSubSummary(items, subName) {
  if (!items.length) return '';
  const template = SUB_SUMMARY_TEMPLATES[subName] || subName;
  // 提取关键实体和事件
  const entities = new Set();
  const events = [];
  for (const it of items) {
    const title = it.originalTitle || it.title;
    // 提取公司名
    const companyMatch = title.match(/(西门子|GE|索拉|三菱|罗罗|东方电气|上海电气|哈电|航发|杰瑞|图南|航亚|应流|钢研|McKinsey|BCG|Bain|HBR)/i);
    if (companyMatch) entities.add(companyMatch[1]);
    // 提取动作
    const actionMatch = title.match(/(签约|发布|突破|收购|合并|推出|宣布|报告|分析|预测|警示|呼吁)/);
    if (actionMatch) events.push(actionMatch[1]);
  }

  let summary = `${template}：`;
  if (entities.size > 0) summary += `涉及${Array.from(entities).slice(0, 4).join('、')}等。`;
  if (events.length > 0) {
    const eventCounts = {};
    events.forEach(e => eventCounts[e] = (eventCounts[e] || 0) + 1);
    const top = Object.entries(eventCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]);
    summary += `主要动作包括${top.join('、')}。`;
  }
  summary += `共${items.length}条信息。`;
  return summary;
}

/**
 * 生成大模块总结
 */
function generateCatSummary(cat, subGroups) {
  const totalItems = Object.values(subGroups).reduce((s, a) => s + a.length, 0);
  const subNames = Object.keys(subGroups).filter(k => k !== '其他' && subGroups[k].length > 0);

  let summary = `## ${cat}板块小结\n\n`;
  summary += `本日共收录 **${totalItems}** 条信息，涵盖 ${subNames.length} 个子领域。`;

  // 找出最活跃的子模块
  const sorted = subNames.sort((a, b) => subGroups[b].length - subGroups[a].length);
  if (sorted.length > 0) {
    summary += `其中「${sorted[0]}」最活跃（${subGroups[sorted[0]].length}条）`;
    if (sorted.length > 1) summary += `，「${sorted[1]}」次之（${subGroups[sorted[1]].length}条）`;
    summary += `。\n`;
  }

  // 提取关键实体
  const allTitles = Object.values(subGroups).flat().map(i => i.originalTitle || i.title).join(' ');
  const keyEntities = [];
  const entityPatterns = ['西门子', 'GE', 'Siemens', 'Vernova', '东方电气', '上海电气', '麦肯锡', 'McKinsey', 'BCG', 'HBR'];
  for (const ep of entityPatterns) {
    if (allTitles.includes(ep)) keyEntities.push(ep);
  }
  if (keyEntities.length > 0) {
    summary += `重点关注：${keyEntities.slice(0, 5).join('、')}。\n`;
  }

  return summary;
}

function renderReport(period) {
  const { today } = getShanghaiDate();
  const date = today;

  // 时间窗口过滤（按条目 windowDays：press 权威源 14 天，社交/新闻 1 天）
  let items = loadArchive();
  const { year, month, day } = getShanghaiDate();
  const winStart = (days) => new Date(year, month, day - days, 0, 0, 0);
  if (period === 'daily') {
    // 日报：按各条目自身 windowDays（press 14天，普通 1天）保留
    const ws = winStart(1), we = new Date(year, month, day, 0, 0, 0);
    items = items.filter(it => {
      if (!it.publishDate) return true;
      const wd = it.windowDays || 1;
      const d = new Date(it.publishDate);
      // press 用其滚动窗(>=1天)；非press 严格前一天
      if (it.press) return d >= winStart(wd) && d < we;
      return d >= ws && d < we;
    });
  } else if (period === 'weekly') {
    const ws = winStart(7);
    items = items.filter(it => {
      if (!it.publishDate) return true;
      const wd = Math.max(it.windowDays || 1, 7);
      return new Date(it.publishDate) >= winStart(wd);
    });
  } else if (period === 'monthly') {
    const ws = winStart(30);
    items = items.filter(it => {
      if (!it.publishDate) return true;
      const wd = Math.max(it.windowDays || 1, 30);
      return new Date(it.publishDate) >= winStart(wd);
    });
  }

  // 质量滤网：领域相关性 + 噪音过滤（落实 standards §3）
  const droppedLog = [];
  items = items.filter(it => {
    const r = filterItem(it);
    if (!r.keep) { droppedLog.push({ title: it.title, reason: r.reason, tag: r.tag }); return false; }
    return true;
  });

  items.sort((a, b) => {
    const da = a.publishDate ? new Date(a.publishDate) : new Date(0);
    const db = b.publishDate ? new Date(b.publishDate) : new Date(0);
    return db - da;
  });

  // 分组：分类 → 子模块 → items
  const structure = {};
  for (const it of items) {
    const cat = it.category || '其他';
    if (!structure[cat]) structure[cat] = {};
    const sub = matchSubModule(it, cat);
    if (!structure[cat][sub]) structure[cat][sub] = [];
    structure[cat][sub].push(it);
  }

  // 统计
  const translatedCount = items.filter(i => i.translated).length;
  const sourceSet = new Set(items.map(i => i.name));

  let md = `# ${LABEL[period]}资讯报告 · ${date}\n\n`;
  md += `> 生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} | 统计窗口: ${period === 'daily' ? '前一天' : `近 ${period === 'weekly' ? 7 : 30} 天`} | 共 **${items.length}** 条（质量滤网滤除 ${droppedLog.length} 条噪音）| 覆盖 ${sourceSet.size} 个信源`;
  if (translatedCount > 0) md += ` | 🌐 翻译 ${translatedCount} 条`;
  md += `\n\n---\n\n`;

  // 目录
  const catNames = Object.keys(structure).sort((a, b) => {
    const order = ['燃气轮机', '产业链', 'AI企业管理', '战略管理', '财经', '能源', '科技', '政策', '其他'];
    return order.indexOf(a) - order.indexOf(b);
  });

  if (!catNames.length || items.length === 0) {
    md += `_本窗口内无新增内容。_\n`;
    const outPath = path.join(OUT_DIR[period], `${date}.md`);
    if (!fs.existsSync(OUT_DIR[period])) fs.mkdirSync(OUT_DIR[period], { recursive: true });
    fs.writeFileSync(outPath, md, 'utf8');
    return { path: outPath, count: 0, period };
  }

  md += `## 📋 目录\n\n`;
  for (const cat of catNames) {
    const total = Object.values(structure[cat]).reduce((s, a) => s + a.length, 0);
    const subs = Object.keys(structure[cat]).filter(k => structure[cat][k].length > 0);
    md += `- **${cat}**（${total}条）: ${subs.join(' / ')}\n`;
  }
  md += `\n---\n\n`;

  // 各大模块
  for (const cat of catNames) {
    const subGroups = structure[cat];
    const total = Object.values(subGroups).reduce((s, a) => s + a.length, 0);

    md += `## ${cat}（${total}条）\n\n`;

    // 大模块总结
    md += generateCatSummary(cat, subGroups) + '\n\n';

    // 子模块
    const subNames = Object.keys(subGroups).sort((a, b) => subGroups[b].length - subGroups[a].length);
    for (const sub of subNames) {
      const list = subGroups[sub];
      if (!list.length) continue;

      md += `### ${sub}（${list.length}条）\n\n`;

      // 子模块总结
      md += `> ${generateSubSummary(list, sub)}\n\n`;

      // 条目列表
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        // 显示标题：优先 LLM 生成的干净中文标题，否则清洗后的原标题
        const rawTitle = it.headline_cn || cleanTitle(it.title) || it.title || '(无标题)';
        const title = it.originalTitle && it.originalTitle !== it.title
          ? `${rawTitle}（原: ${it.originalTitle}）`
          : rawTitle;
        const badge = it.importance ? `【${it.importance}】` : '';
        md += `**${badge}${i + 1}. ${title}**\n`;

        // 来源和时间
        const meta = [];
        if (it.name) meta.push(`来源: ${it.name}`);
        if (it.publishedText) meta.push(`时间: ${it.publishedText}`);
        if (it.symbol) meta.push(`代码: ${it.symbol}`);
        if (it.importance) meta.push(`重要性: ${it.importance}`);
        if (meta.length) md += `> ${meta.join(' | ')}\n`;

        // 正文：优先 LLM 摘要（5W1H），回退抽取式
        if (it.summary) {
          md += `${it.summary}\n`;
          if (it.why) md += `> 💡 ${it.why}\n`;
        } else if (it.text) {
          const text = it.text.slice(0, 600).replace(/\s+/g, ' ').trim();
          md += `${text}… _[未LLM精修]_  \n`;
        }

        // 翻译标注
        if (it.translated) md += `_[🌐 已翻译]_\n`;

        if (it.url) md += `[原文链接](${it.url})\n`;
        md += `\n`;
      }
    }

    md += `---\n\n`;
  }

  // 今日洞察（由 LLM/编辑在出报前写入 state/insight-<date>.md）
  const insightFile = path.join(ROOT, 'state', `insight-${date}.md`);
  if (fs.existsSync(insightFile)) {
    const insight = fs.readFileSync(insightFile, 'utf8').trim();
    if (insight) {
      md += `## 💡 今日洞察\n\n${insight}\n\n---\n\n`;
    }
  }

  // 底部统计
  md += `## 📊 数据统计\n\n`;
  md += `| 指标 | 数值 |\n|------|------|\n`;
  md += `| 总条数 | ${items.length} |\n`;
  md += `| 质量滤除 | ${droppedLog.length} |\n`;
  md += `| 信源数 | ${sourceSet.size} |\n`;
  md += `| 翻译条数 | ${translatedCount} |\n`;
  md += `| 分类数 | ${catNames.length} |\n`;
  for (const cat of catNames) {
    const total = Object.values(structure[cat]).reduce((s, a) => s + a.length, 0);
    md += `| ${cat} | ${total} |\n`;
  }

  const dir = OUT_DIR[period];
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `${date}.md`);
  fs.writeFileSync(outPath, md, 'utf8');
  return { path: outPath, count: items.length, period };
}

module.exports = { renderReport };
