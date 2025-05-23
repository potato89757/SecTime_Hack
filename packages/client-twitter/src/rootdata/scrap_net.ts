// rootdataScraper.ts
import puppeteer from 'puppeteer';

export async function scrapeProjectUpdates(): Promise<string[]> {
  // ------ no use -------- //
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
  // ------ no use -------- //

  result.length = 0;
  
  // make sure have result
  result.push("SGOLD_FUN", "jackson_app", "xocietyofficial", "ikadotxyz", "AmbrusStudio", "WalrusProtocol",
    "astros_ag", "DungeonMove", "hokko_io", "Project_Jcard", "nami_hq", "Magma_Finance",
    "SuiRWA", "MetaStables", "SeedCombinator", "WaveOnSui", "wansuifun", "springsui_",
    "arttoo_official", "6degrees_ai", "HopAggregator", "AlphaFiSUI", "7k_ag_", "doubleup_app",
    "suidepinai", "OG_Battlefront_", "OceansGallerie", "YouSUI_Global", "strater_sui", "suilette",
    "FanTV_official", "sudofinance", "isspio", "HaedalProtocol", "SuiGame_io", "blubsui",
    "get_nimbus", "mofalabs", "ChronosWorlds", "volo_sui", "Releap_IO", "cubicgamesxyz",
    "KriyaDEX", "flame_protocol", "Maxi_sui", "Turbos_finance", "TypusFinance", "BeLaunch_",
    "IPXLabs", "TrantorianVerse", "Cosmocadia", "GreenPower_N", "suia2023", "Origin_Byte",
    "ComingChatApp", "suiet_wallet", "Gallerysui", "KeepSakeMarket", "joinMovEX", "suiswap_app",
    "PortoLabs_", "SUI_agents", "PlayDarktimes", "RECRDapp", "splash_xyz", "hippo_cto",
    "LumiWave_Lab", "DeepBookonSui", "lofitheyeti", "DeLoreanlabs", "PawtatoFinance", "SoundnessLabs",
    "SuiPlay", "steammfi", "nemoprotocol", "SlushWallet", "bucket_protocol", "0xObeliskLabs",
    "AftermathFi", "FlowX_finance", "SuiPadxyz", "Scallop_io", "navi_protocol", "GiveRep",
    "suilendprotocol", "SuiNSdapp", "Suitzerland", "DubheEngine", "hiphopdotfun", "SuiDollar",
    "SuiNetwork", "Sui_ster", "staketab"
  )

  console.log(result);

  return result;
}