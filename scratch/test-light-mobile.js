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

  // Click theme toggle button
  const toggleBtn = await page.$('[data-testid="theme-toggle-btn"]');
  if (toggleBtn) {
    await toggleBtn.click();
    await new Promise(r => setTimeout(r, 600));
  }

  // Check overflow in light mode
  const overflow = await page.evaluate(() => {
    return {
      docW: document.documentElement.clientWidth,
      scrollW: document.documentElement.scrollWidth,
      theme: document.documentElement.getAttribute('data-theme'),
      hasBlowout: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });
  console.log('Light Mode Mobile Audit:', overflow);

  await page.screenshot({ path: 'scratch/mobile-light-dashboard.png' });
  await browser.close();
}

run().catch(console.error);
