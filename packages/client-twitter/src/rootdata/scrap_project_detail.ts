import puppeteer from 'puppeteer';
import fs from 'fs';

const outputPath = 'scrap/0523/output/exclusive_project_detail.jsonl';
const url = 'https://www.rootdata.com/EcosystemMap/list/91?n=Sui';
const email = 'kellylimhooiyen@gmail.com';
const password = 'Exotao001130';

interface TeamMember {
  name: string;
  title: string;
  profile_url: string;
  twitter_url: string | null;
  img_url: string;
}

interface ProjectDetail {
  project_name: string;
  project_link: string;
  twitter_link: string;
  team_data: TeamMember[];
}

export async function scrapeProjectUpdates(): Promise<string[]> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const data: ProjectDetail[] = [];

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click the unlock button
    const unlockButton = await page.$('.btn.v-btn.v-btn--has-bg.theme--light.v-size--default');
    if (unlockButton) {
      await unlockButton.evaluate((btn) => btn.scrollIntoView());
      await new Promise(resolve => setTimeout(resolve, 1000));
      await unlockButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Fill in email and password
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    const signInButton = await page.$('button[type="submit"]');
    if (signInButton) {
      await signInButton.click();
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Click the exclusive button
    const exclusiveButtons = await page.$$('.btn.v-btn.v-btn--text.theme--light.v-size--default');
    if (exclusiveButtons.length > 1) {
      await exclusiveButtons[1].evaluate((btn) => btn.scrollIntoView({ block: 'center' }));
      await exclusiveButtons[1].click();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Iterate through pages
    for (let i = 0; i < 4; i++) {
      const projects = await page.$$('div.project_list > div.project');

      for (const project of projects) {
        try {
          const statusIcons = await project.$$('img.status_icon');
          let skip = false;
          for (const icon of statusIcons) {
            const src = await icon.getProperty('src');
            const srcValue = await src.jsonValue();
            if (typeof srcValue === 'string' && srcValue.includes('inactive')) {
              skip = true;
              break;
            }
          }
          if (skip) continue;

          const linkElement = await project.$('a');
          const projectLink = linkElement ? await (await linkElement.getProperty('href')).jsonValue() : '';
          const nameElement = await project.$('h2.ml-2');
          const projectName = nameElement ? await (await nameElement.getProperty('textContent')).jsonValue() : '';

          if (typeof projectLink === 'string' && typeof projectName === 'string') {
            data.push({
              project_name: projectName.trim(),
              project_link: projectLink.trim(),
              twitter_link: '',
              team_data: [],
            });
          }
        } catch (e) {
          console.error('Error parsing project:', e);
        }
      }

      const nextButton = await page.$('.btn-next');
      if (nextButton) {
        const className = await (await nextButton.getProperty('className')).jsonValue();
        if (typeof className === 'string' && className.includes('disabled')) break;
        await nextButton.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        break;
      }
    }

    // Extract details for each project
    for (const detailData of data) {
      try {
        await page.goto(detailData.project_link, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 3000));

        const twitterElement = await page.$('a.chips.d-flex.align-center.justify-center');
        const twitterLink = twitterElement ? await (await twitterElement.getProperty('href')).jsonValue() : '';

        const cards = await page.$$('a.card');
        const teamData: TeamMember[] = [];

        for (const card of cards) {
          try {
            const nameElement = await card.$('h2');
            const titleElement = await card.$('p.intro');
            const imgElement = await card.$('img[alt]');
            const profileUrl = await (await card.getProperty('href')).jsonValue();

            const name = nameElement ? await (await nameElement.getProperty('textContent')).jsonValue() : '';
            const title = titleElement ? await (await titleElement.getProperty('textContent')).jsonValue() : '';
            const imgUrl = imgElement ? await (await imgElement.getProperty('src')).jsonValue() : '';

            let twitterUrl: string | null = null;

            if (typeof profileUrl === 'string') {
              const profilePage = await browser.newPage();
              await profilePage.goto(profileUrl, { waitUntil: 'networkidle2' });
              await new Promise(resolve => setTimeout(resolve, 1000));

              const twitterAnchor = await profilePage.$('a[href*="x.com"]');
              if (twitterAnchor) {
                twitterUrl = await (await twitterAnchor.getProperty('href')).jsonValue();
              }

              await profilePage.close();
            }

            if (typeof name === 'string' && typeof title === 'string' && typeof profileUrl === 'string' && typeof imgUrl === 'string') {
              teamData.push({
                name: name.trim(),
                title: title.trim(),
                profile_url: profileUrl.trim(),
                twitter_url: twitterUrl,
                img_url: imgUrl.trim(),
              });
            }
          } catch (e) {
            console.error('Error extracting team member:', e);
            continue;
          }
        }

        detailData.twitter_link = typeof twitterLink === 'string' ? twitterLink.trim() : '';
        detailData.team_data = teamData;

        fs.appendFileSync(outputPath, JSON.stringify(detailData, null, 2) + '\n', 'utf-8');
      } catch (e) {
        console.error('Error extracting project details:', e);
        continue;
      }
    }
  } catch (e) {
    console.error('An error occurred:', e);
  } finally {
    await browser.close();
  }
};
