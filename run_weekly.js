/**
 * run_weekly.js — 周报：从归档生成近 7 天报告 → 发邮件 → git 备份
 */
const path = require('path');
const { renderReport } = require('./reports');
const { sendReport } = require('./email');
const { backup } = require('./backup');
const { todayStr } = require('./core');

(async () => {
  const date = todayStr();
  const report = renderReport('weekly');
  const mail = await sendReport(report, 'weekly');
  if (mail.skipped) console.log('[邮件] 跳过:', mail.reason);
  else if (mail.ok) console.log('[邮件] 已发送');
  else console.log('[邮件] 失败:', mail.error);
  const bk = backup(date);
  console.log('[备份]', bk.steps.join(' | '));
  console.log(`\n周报完成：${report.path}（${report.count} 条）`);
})();
