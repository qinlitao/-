/**
 * run_daily.js — 每日流水线：采集 → 生成日报 → 发邮件 → git 备份
 */
const fs = require('fs');
const path = require('path');
const { runCollection } = require('./core');
const { renderReport } = require('./reports');
const { sendReport } = require('./email');
const { backup } = require('./backup');

(async () => {
  // 1. 采集
  const { date, newItems, status } = await runCollection();
  fs.writeFileSync(path.join(__dirname, 'daily_status.json'), JSON.stringify(status, null, 2), 'utf8');

  // 2. 生成日报
  const report = renderReport('daily');

  // 3. 发邮件
  const mail = await sendReport(report, 'daily');
  if (mail.skipped) console.log('[邮件] 跳过:', mail.reason);
  else if (mail.ok) console.log('[邮件] 已发送:', report.path);
  else console.log('[邮件] 失败:', mail.error);

  // 4. 备份
  const bk = backup(date);
  console.log('[备份]', bk.steps.join(' | '), bk.pushError || '');

  // 5. 汇总
  console.log(`\n完成。日期 ${date}，新增 ${status.newTotal} 条。日报: ${report.path}`);
  if (status.errors.length) console.log('注意:', status.errors.join(' | '));
})();
