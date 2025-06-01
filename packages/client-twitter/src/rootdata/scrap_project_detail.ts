import puppeteer from 'puppeteer';
import fs from 'fs';

const url = 'https://www.rootdata.com/EcosystemMap/list/91?n=Sui';
const email = 'laiyunghweidgmail.com';
const password = 'C6s544***';

function extractUsername(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/x\.com\/([^\/\?]+)/);
  return match ? match[1] : null;
}

// Helper function to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to retry operations
async function retry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 2000
): Promise<T> {
  let lastError: Error;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${i + 1} failed: ${error.message}`);
      if (i < maxRetries - 1) {
        await wait(delay);
      }
    }
  }
  throw lastError!;
}

export async function scrapeSuiTwitterUsernames(): Promise<string[]> {
  const browser = await puppeteer.launch({ 
    headless: false, // 改为有头模式，方便调试
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080'
    ],
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });

  const page = await browser.newPage();
  
  // 设置更真实的用户代理
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  
  // 设置更多的浏览器行为
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  });

  const usernames = new Set<string>();

  try {
    // 设置页面超时时间
    await page.setDefaultNavigationTimeout(120000); // 增加到120秒
    await page.setDefaultTimeout(120000); // 增加到120秒

    // 访问页面并等待加载
    console.log('Navigating to page...');
    await retry(async () => {
      await page.goto(url, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 120000 
      });
    });
    
    // 等待页面完全加载
    await wait(10000);
    
    // 检查页面内容
    const pageContent = await page.content();
    console.log('Page loaded, checking content...');
    
    // 等待并点击解锁按钮
    console.log('Looking for unlock button...');
    const unlockButton = await retry(async () => {
      const button = await page.waitForSelector('.btn.v-btn.v-btn--has-bg.theme--light.v-size--default', { 
        timeout: 30000,
        visible: true 
      });
      if (!button) {
        throw new Error('Unlock button not found');
      }
      return button;
    });

    if (unlockButton) {
      await unlockButton.evaluate((btn) => btn.scrollIntoView());
      await wait(2000);
      await unlockButton.click();
      await wait(5000);
    }

    // 等待登录表单加载
    console.log('Waiting for login form...');
    await retry(async () => {
      // 尝试多种选择器
      const selectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="邮箱" i]'
      ];
      
      for (const selector of selectors) {
        try {
          console.log(`Trying selector: ${selector}`);
          const element = await page.waitForSelector(selector, {
            timeout: 30000,
            visible: true
          });
          if (element) {
            console.log(`Found element with selector: ${selector}`);
            return element;
          }
        } catch (e) {
          console.log(`Selector ${selector} failed: ${e.message}`);
        }
      }
      throw new Error('No email input found with any selector');
    });

    // 等待密码输入框
    await retry(async () => {
      const selectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[placeholder*="password" i]',
        'input[placeholder*="密码" i]'
      ];
      
      for (const selector of selectors) {
        try {
          console.log(`Trying password selector: ${selector}`);
          const element = await page.waitForSelector(selector, {
            timeout: 30000,
            visible: true
          });
          if (element) {
            console.log(`Found password element with selector: ${selector}`);
            return element;
          }
        } catch (e) {
          console.log(`Password selector ${selector} failed: ${e.message}`);
        }
      }
      throw new Error('No password input found with any selector');
    });

    // 输入登录信息
    console.log('Entering login credentials...');
    await page.type('input[type="email"]', email, { delay: 100 });
    await page.type('input[type="password"]', password, { delay: 100 });

    // 点击登录按钮
    console.log('Clicking login button...');
    const signInButton = await retry(async () => {
      const selectors = [
        'button[type="submit"]',
        'button:contains("登录")',
        'button:contains("Login")',
        'button.v-btn'
      ];
      
      for (const selector of selectors) {
        try {
          console.log(`Trying submit button selector: ${selector}`);
          const element = await page.waitForSelector(selector, {
            timeout: 30000,
            visible: true
          });
          if (element) {
            console.log(`Found submit button with selector: ${selector}`);
            return element;
          }
        } catch (e) {
          console.log(`Submit button selector ${selector} failed: ${e.message}`);
        }
      }
      throw new Error('No submit button found with any selector');
    });

    if (signInButton) {
      await signInButton.click();
      await wait(10000); // 增加登录后的等待时间
    }

    // 等待并点击 Exclusive 按钮
    console.log('Looking for exclusive button...');
    const exclusiveButtons = await retry(async () => {
      return await page.$$('.btn.v-btn.v-btn--text.theme--light.v-size--default');
    });

    if (exclusiveButtons.length > 1) {
      await exclusiveButtons[1].evaluate((btn) => btn.scrollIntoView({ block: 'center' }));
      await exclusiveButtons[1].click();
      await wait(5000);
    }

    // 收集项目链接
    console.log('Collecting project links...');
    const projectLinks: string[] = [];
    for (let i = 0; i < 4; i++) {
      const projects = await retry(async () => {
        return await page.$$('div.project_list > div.project');
      });

      for (const project of projects) {
        const statusIcons = await project.$$('img.status_icon');
        let skip = false;
        for (const icon of statusIcons) {
          const src = await icon.getProperty('src');
          const srcValue = await src.jsonValue() as string;
          if (srcValue.includes('inactive')) {
            skip = true;
            break;
          }
        }
        if (skip) continue;
        const linkElement = await project.$('a');
        if (!linkElement) continue;
        const projectLink = await (await linkElement.getProperty('href')).jsonValue() as string;
        projectLinks.push(projectLink);
      }

      const nextButton = await page.$('.btn-next');
      if (!nextButton) break;
      const className = await (await nextButton.getProperty('className')).jsonValue() as string;
      if (className.includes('disabled')) break;
      await nextButton.click();
      await wait(5000);
    }

    // 处理每个项目
    console.log('Processing projects...');
    for (const projectLink of projectLinks) {
      console.log(`Processing project: ${projectLink}`);
      await retry(async () => {
        await page.goto(projectLink, { 
          waitUntil: ['networkidle0', 'domcontentloaded'],
          timeout: 120000 
        });
      });
      await wait(5000);

      const twitterElement = await page.$('a.chips.d-flex.align-center.justify-center');
      const projectTwitterUrl = twitterElement ? await (await twitterElement.getProperty('href')).jsonValue() as string : null;
      const projectTwitterUsername = extractUsername(projectTwitterUrl);
      if (projectTwitterUsername) {
        usernames.add(projectTwitterUsername);
      }

      const cards = await page.$$('a.card');
      for (const card of cards) {
        try {
          const profileUrl = await (await card.getProperty('href')).jsonValue() as string;
          const profilePage = await browser.newPage();
          await retry(async () => {
            await profilePage.goto(profileUrl, { 
              waitUntil: ['networkidle0', 'domcontentloaded'],
              timeout: 120000 
            });
          });
          await wait(2000);

          const twitterAnchor = await profilePage.$('a[href*="x.com"]');
          const twitterUrl = twitterAnchor ? await (await twitterAnchor.getProperty('href')).jsonValue() as string : null;
          const twitterUsername = extractUsername(twitterUrl);
          if (twitterUsername) {
            usernames.add(twitterUsername);
          }
          await profilePage.close();
        } catch (error) {
          console.error('Error processing team member:', error);
        }
      }
    }

    console.log('Found Twitter usernames:', Array.from(usernames));
    return Array.from(usernames);
  } catch (e) {
    console.error('Error during scraping:', e);
    return [];
  } finally {
    await browser.close();
  }
}
