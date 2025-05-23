import puppeteer from 'puppeteer';
import fs from 'fs';

const outputPath = 'scrap/0523/output/exclusive_project_detail.jsonl';
const url = 'https://www.rootdata.com/EcosystemMap/list/91?n=Sui';
const email = 'laiyunghwei@gmail.com';
const password = 'Exotao001130';

export async function scrapeSuiProject(): Promise<string[]> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const allTwitterLinks: string[] = [];

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 5000));

    const unlockButton = await page.$('.btn.v-btn.v-btn--has-bg.theme--light.v-size--default');
    if (unlockButton) {
      await unlockButton.evaluate((btn) => btn.scrollIntoView());
      await new Promise(resolve => setTimeout(resolve, 1000));
      await unlockButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    const signInButton = await page.$('button[type="submit"]');
    if (signInButton) {
      await signInButton.click();
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const exclusiveButtons = await page.$$('.btn.v-btn.v-btn--text.theme--light.v-size--default');
    if (exclusiveButtons.length > 1) {
      await exclusiveButtons[1].evaluate((btn) => btn.scrollIntoView({ block: 'center' }));
      await exclusiveButtons[1].click();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Collect project links skipping inactive
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
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // For each project, get twitter link and team members' twitter links
    for (const projectLink of projectLinks) {
      await page.goto(projectLink, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 3000));

      const twitterElement = await page.$('a.chips.d-flex.align-center.justify-center');
      const projectTwitterLink = twitterElement ? await (await twitterElement.getProperty('href')).jsonValue() as string : '';
      
      if (projectTwitterLink) {
        allTwitterLinks.push(projectTwitterLink.trim());
      }

      const cards = await page.$$('a.card');
      for (const card of cards) {
        try {
          const profileUrl = await (await card.getProperty('href')).jsonValue() as string;
          const profilePage = await browser.newPage();
          await profilePage.goto(profileUrl, { waitUntil: 'networkidle2' });
          await new Promise(resolve => setTimeout(resolve, 1000));

          const twitterAnchor = await profilePage.$('a[href*="x.com"]');
          const twitterUrl = twitterAnchor ? await (await twitterAnchor.getProperty('href')).jsonValue() as string : null;

          if (twitterUrl) {
            allTwitterLinks.push(twitterUrl.trim());
          }
          await profilePage.close();
        } catch (error) {
          console.error('Error processing team member:', error);
        }
      }

      // Still save to file for backup
      const output = {
        twitter_link: projectTwitterLink.trim(),
        team_twitters: allTwitterLinks.filter(link => link !== projectTwitterLink.trim())
      };
      fs.appendFileSync(outputPath, JSON.stringify(output) + '\n', 'utf-8');
    }

    // Remove duplicates and return
    console.log(allTwitterLinks)
    return Array.from(new Set(allTwitterLinks));
  } catch (e) {
    console.error(e);
    return [];
  } finally {
    await browser.close();
  }
}
