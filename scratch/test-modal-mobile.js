import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));

  // Click floating quick add button
  const fab = await page.$('.mobile-quick-add-btn');
  if (fab) {
    await fab.click();
    await new Promise(r => setTimeout(r, 600));

    const modalAudit = await page.evaluate(() => {
      const modal = document.querySelector('.modal-content, .quick-add-card');
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const rect = modal ? modal.getBoundingClientRect() : null;
      return {
        modalExists: !!modal,
        modalWidth: rect ? Math.round(rect.width) : 0,
        modalHeight: rect ? Math.round(rect.height) : 0,
        docW,
        scrollW,
        hasBlowout: scrollW > docW
      };
    });

    console.log('Mobile Modal Audit (390px):', modalAudit);
    await page.screenshot({ path: 'scratch/mobile-modal-open.png' });
  }

  await browser.close();
}

run().catch(console.error);
