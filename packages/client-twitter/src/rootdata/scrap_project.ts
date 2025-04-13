// rootdataFundraisingScraper.ts
import puppeteer from 'puppeteer';

export async function scrapeFundraisingProjects(): Promise<string[]> {
  const url = 'https://www.rootdata.com/rankings/fundraisingdata';
  const titles = ['Recent Fundraisings', 'Single Fundraising Amount Rankings'];
  const tableXpaths = [
    '/html/body/div/div/div/div[1]/main/div/div/div/div[3]/div[1]/div[2]/div/table/tbody',
    '/html/body/div/div/div/div[1]/main/div/div/div/div[3]/div[2]/div[2]/div/table/tbody'
  ];

  const result: string[] = [];
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    for (let i = 0; i < 2; i++) {
      const projects = await page.evaluate((xpath, index) => {
        const results: string[] = [];
        const tbody = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue as HTMLTableSectionElement | null;

        if (!tbody) return results;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          let target: HTMLElement | null = null;

          if (index === 0 && cells.length > 0) {
            target = cells[0];
          } else if (index === 1 && cells.length > 1) {
            target = cells[1];
          }

          if (target) {
            const anchors = target.querySelectorAll('a');
            if (anchors.length > 1) {
              const name = anchors[1].textContent?.trim();
              if (name) results.push(name);
            }
          }
        }

        return results;
      }, tableXpaths[i], i);

      result.push(...projects.map(p => `${p} lang:zh-cn`));
    }
  } catch (error) {
    console.error('failed to scrape fundraising data:', error);
  } finally {
    await browser.close();
  }

  console.log(result);
  return result;
}
