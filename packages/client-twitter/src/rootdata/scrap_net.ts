// rootdataScraper.ts
import puppeteer from 'puppeteer';

export async function scrapeProjectUpdates(): Promise<string[]> {
  const url = 'https://www.rootdata.com/rankings/projectupdates';
  const titles = ['New MainNet Launches', 'New TestNet Launches'];
  const result: string[] = [];

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

    await new Promise(resolve => setTimeout(resolve, 5000));

    const contentHandles = await page.$$('.v-responsive__content');
    const tables = contentHandles.slice(0, -1); 

    for (let i = 0; i < tables.length; i++) {
      const rows = await tables[i].$$('a');
      for (const row of rows) {
        const divs = await row.$$('div');
        if (divs.length < 1) continue;

        const innerDiv = await divs[0].$('div');
        if (!innerDiv) continue;

        const netName = await innerDiv.evaluate(el => el.textContent?.trim() || '');
        if (netName) {
          result.push(`${netName} lang:zh-cn`);
        }
      }
    }
  } catch (error) {
    console.error('failed to scrape project updates:', error);
  } finally {
    await browser.close();
  }
  console.log(result);
  return result;
}