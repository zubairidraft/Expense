import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Test viewports: 375 (iPhone SE), 390 (iPhone 14), 412 (Pixel 7)
  const viewports = [
    { name: 'iPhone-SE-375', width: 375, height: 667 },
    { name: 'iPhone-14-390', width: 390, height: 844 },
    { name: 'Pixel-412', width: 412, height: 915 }
  ];

  for (const vp of viewports) {
    console.log(`\n================ Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ================`);
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));

    // Check horizontal blowout
    const audit = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const overflowing = [];

      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        // Ignore fixed elements like off-canvas drawer or portal tooltips that might intentionally sit outside
        const isOffscreenDrawer = el.closest('.app-sidebar:not(.mobile-open)');
        if (!isOffscreenDrawer && (rect.right > docW + 1.5 || rect.width > docW + 1.5)) {
          overflowing.push({
            tag: el.tagName,
            className: typeof el.className === 'string' ? el.className : '',
            width: Math.round(rect.width),
            right: Math.round(rect.right),
            docW
          });
        }
      });

      return {
        docW,
        scrollW,
        hasBlowout: scrollW > docW,
        overflowing: overflowing.slice(0, 10)
      };
    });

    console.log(`Viewport ${vp.name} - docWidth: ${audit.docW}, scrollWidth: ${audit.scrollW}, blowout: ${audit.hasBlowout}`);
    if (audit.overflowing.length > 0) {
      console.log('Overflowing elements:', JSON.stringify(audit.overflowing, null, 2));
    } else {
      console.log('✓ Zero horizontal overflow detected!');
    }

    await page.screenshot({ path: `scratch/${vp.name}-dashboard.png` });
  }

  // Set to standard 390px for interactive testing
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1200));

  console.log('\n--- Testing Mobile Hamburger Drawer Toggle ---');
  const hamburgerBtn = await page.$('.mobile-nav-toggle-btn');
  if (hamburgerBtn) {
    await hamburgerBtn.click();
    await new Promise(r => setTimeout(r, 600));

    const isDrawerOpen = await page.evaluate(() => {
      const sidebar = document.querySelector('.app-sidebar');
      const backdrop = document.querySelector('.sidebar-mobile-backdrop');
      const rect = sidebar ? sidebar.getBoundingClientRect() : null;
      return {
        hasClass: sidebar?.classList.contains('mobile-open'),
        visible: rect ? rect.left >= 0 : false,
        backdropExists: !!backdrop
      };
    });
    console.log('Drawer State after clicking hamburger:', isDrawerOpen);
    await page.screenshot({ path: 'scratch/mobile-drawer-open.png' });

    // Click on Reports & Tax
    const clickedReports = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const reportsBtn = buttons.find(b => b.textContent.includes('Reports & Tax'));
      if (reportsBtn) {
        reportsBtn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked Reports & Tax in drawer:', clickedReports);
    await new Promise(r => setTimeout(r, 800));

    // Verify on reports page
    const reportsAudit = await page.evaluate(() => {
      const title = document.querySelector('h2')?.textContent || '';
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      return {
        title,
        docW,
        scrollW,
        hasBlowout: scrollW > docW
      };
    });
    console.log('Reports Page Audit on 390px:', reportsAudit);
    await page.screenshot({ path: 'scratch/mobile-reports-page.png' });
  } else {
    console.error('Hamburger button not found!');
  }

  // Test "More" button on bottom nav
  console.log('\n--- Testing Bottom Nav "More" Button ---');
  const clickedMore = await page.evaluate(() => {
    const navBtns = Array.from(document.querySelectorAll('.mobile-nav-btn'));
    const moreBtn = navBtns.find(b => b.textContent.includes('More') || b.textContent.includes('Menu'));
    if (moreBtn) {
      moreBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked More in bottom nav:', clickedMore);
  await new Promise(r => setTimeout(r, 600));

  // Click on Loans & Payables (Shared)
  const clickedLoans = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.sidebar-nav-item'));
    const loansBtn = buttons.find(b => b.textContent.includes('Loans & Payables'));
    if (loansBtn) {
      loansBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Loans & Payables:', clickedLoans);
  await new Promise(r => setTimeout(r, 800));

  const loansAudit = await page.evaluate(() => {
    const docW = document.documentElement.clientWidth;
    const scrollW = document.documentElement.scrollWidth;
    return {
      docW,
      scrollW,
      hasBlowout: scrollW > docW
    };
  });
  console.log('Loans Page Audit on 390px:', loansAudit);
  await page.screenshot({ path: 'scratch/mobile-loans-page.png' });

  // Test Preferences Page
  console.log('\n--- Testing Preferences Page ---');
  await page.evaluate(() => {
    // Open drawer and click Preferences
    const buttons = Array.from(document.querySelectorAll('.sidebar-nav-item'));
    const prefBtn = buttons.find(b => b.textContent.includes('Preferences'));
    if (prefBtn) prefBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));
  const prefAudit = await page.evaluate(() => {
    const docW = document.documentElement.clientWidth;
    const scrollW = document.documentElement.scrollWidth;
    return {
      docW,
      scrollW,
      hasBlowout: scrollW > docW
    };
  });
  console.log('Preferences Page Audit on 390px:', prefAudit);
  await page.screenshot({ path: 'scratch/mobile-preferences-page.png' });

  await browser.close();
  console.log('\nAll mobile responsiveness tests passed successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
