const { chromium } = require('playwright');

(async () => {
  try {
    console.log('正在启动浏览器...');
    const browser = await chromium.launch({ 
      headless: false,  // 显示浏览器窗口
      slowMo: 100       // 慢速模式，便于观察
    });
    
    console.log('浏览器已启动');
    const page = await browser.newPage();
    
    console.log('正在打开LinkedIn...');
    await page.goto('https://www.linkedin.com');
    
    console.log('页面标题:', await page.title());
    console.log('页面URL:', page.url());
    
    // 截图
    await page.screenshot({ path: 'linkedin_test.png', fullPage: true });
    console.log('截图已保存: linkedin_test.png');
    
    // 等待用户查看
    console.log('\n浏览器窗口已打开，你可以查看LinkedIn页面。');
    console.log('按 Ctrl+C 关闭浏览器和脚本。');
    
    // 保持浏览器打开
    await new Promise(() => {});
    
  } catch (error) {
    console.error('错误:', error.message);
  }
})();