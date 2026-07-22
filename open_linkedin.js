const { chromium } = require('playwright');

(async () => {
  try {
    console.log('正在启动Edge浏览器...');
    
    // 使用Edge浏览器
    const browser = await chromium.launch({
      channel: 'msedge', // 使用已安装的Edge
      headless: false,
      slowMo: 50
    });
    
    console.log('浏览器已启动');
    const page = await browser.newPage();
    
    console.log('正在打开LinkedIn...');
    await page.goto('https://www.linkedin.com', { waitUntil: 'networkidle' });
    
    console.log('页面标题:', await page.title());
    console.log('页面URL:', page.url());
    
    // 截图
    await page.screenshot({ path: 'linkedin_login.png', fullPage: true });
    console.log('截图已保存: linkedin_login.png');
    
    // 等待用户登录
    console.log('\n=== 操作说明 ===');
    console.log('1. 在打开的浏览器窗口中登录LinkedIn');
    console.log('2. 登录成功后，按 Enter 继续抓取动态');
    console.log('3. 如果需要关闭浏览器，输入 close');
    
    // 等待用户输入
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\n登录完成后按 Enter 继续，或输入 close 关闭浏览器: ', async (answer) => {
      if (answer.trim().toLowerCase() === 'close') {
        console.log('正在关闭浏览器...');
        await browser.close();
        console.log('浏览器已关闭');
      } else {
        console.log('继续抓取LinkedIn动态...');
        // 这里可以添加后续的抓取逻辑
      }
      rl.close();
    });
    
  } catch (error) {
    console.error('错误:', error.message);
    if (error.message.includes('executablePath')) {
      console.log('\n提示: 需要安装Edge浏览器或配置正确的路径');
    }
  }
})();