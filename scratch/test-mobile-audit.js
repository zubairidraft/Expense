import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Check horizontal overflow
  const overflow = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const overflowingElements = [];

    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 1 || rect.width > docWidth + 1) {
        overflowingElements.push({
          tag: el.tagName,
          className: (typeof el.className === 'string') ? el.className : '',
          id: el.id,
          width: Math.round(rect.width),
          right: Math.round(rect.right),
          docWidth
        });
      }
    });

    return {
      docWidth,
      scrollWidth,
      hasOverflow: scrollWidth > docWidth,
      overflowingElements: overflowingElements.slice(0, 15)
    };
  });

  console.log('Mobile Viewport Audit Result (390px):', JSON.stringify(overflow, null, 2));

  await page.screenshot({ path: 'scratch/mobile-initial.png' });
  console.log('Screenshot saved to scratch/mobile-initial.png');

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
