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

export async function scrapeSuiTwitterUsernames(): Promise<string[]> {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const usernames = new Set<string>();

  try {
    // 设置页面超时时间
    await page.setDefaultNavigationTimeout(30000);
    await page.setDefaultTimeout(30000);

    // 访问页面并等待加载
    console.log('Navigating to page...');
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(5000);

    // 等待并点击解锁按钮
    console.log('Looking for unlock button...');
    const unlockButton = await page.waitForSelector('.btn.v-btn.v-btn--has-bg.theme--light.v-size--default', { timeout: 10000 });
    if (unlockButton) {
      await unlockButton.evaluate((btn) => btn.scrollIntoView());
      await page.waitForTimeout(1000);
      await unlockButton.click();
      await page.waitForTimeout(2000);
    }

    // 等待登录表单加载
    console.log('Waiting for login form...');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });

    // 输入登录信息
    console.log('Entering login credentials...');
    await page.type('input[type="email"]', email, { delay: 100 });
    await page.type('input[type="password"]', password, { delay: 100 });

    // 点击登录按钮
    console.log('Clicking login button...');
    const signInButton = await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
    if (signInButton) {
      await signInButton.click();
      await page.waitForTimeout(5000);
    }

    // 等待并点击 Exclusive 按钮
    console.log('Looking for exclusive button...');
    const exclusiveButtons = await page.$$('.btn.v-btn.v-btn--text.theme--light.v-size--default');
    if (exclusiveButtons.length > 1) {
      await exclusiveButtons[1].evaluate((btn) => btn.scrollIntoView({ block: 'center' }));
      await exclusiveButtons[1].click();
      await page.waitForTimeout(2000);
    }

    // 收集项目链接
    console.log('Collecting project links...');
    const projectLinks: string[] = [];
    for (let i = 0; i < 4; i++) {
      const projects = await page.$$('div.project_list > div.project');
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
      await page.waitForTimeout(3000);
    }

    // 处理每个项目
    console.log('Processing projects...');
    for (const projectLink of projectLinks) {
      console.log(`Processing project: ${projectLink}`);
      await page.goto(projectLink, { waitUntil: 'networkidle0' });
      await page.waitForTimeout(3000);

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
          await profilePage.goto(profileUrl, { waitUntil: 'networkidle0' });
          await profilePage.waitForTimeout(1000);

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
