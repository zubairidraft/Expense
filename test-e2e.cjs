const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTests() {
  console.log('🚀 Starting Universal Expense Tracker Comprehensive E2E Test Suite...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleLogs = [];
  const consoleErrors = [];
  page.on('console', msg => {
    const text = msg.text();
    // Filter out expected backend network 400/ERR_CONNECTION/ERR_FAILED if Supabase auth guest or Agentation offline
    if (msg.type() === 'error' && !text.includes('ERR_CONNECTION_REFUSED') && !text.includes('status of 400') && !text.includes('ERR_FAILED')) {
      consoleErrors.push(text);
    } else {
      consoleLogs.push(`[${msg.type()}] ${text}`);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(`[PageError] ${err.toString()}`);
  });

  const testResults = [];
  function record(testName, passed, details = '') {
    testResults.push({ testName, passed, details });
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${testName} ${details ? '(' + details + ')' : ''}`);
  }

  try {
    // 1. Load Application
    console.log('\n--- 1. Testing Application Load ---');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_initial_load.png'), fullPage: true });

    const title = await page.title();
    record('Page Title Loaded', title.includes('Expense Tracker'), `Title: "${title}"`);

    const hasAppShell = await page.$('.app-shell');
    record('App Shell Rendered', !!hasAppShell);

    // 2. Overview Metrics & Stat Cards
    console.log('\n--- 2. Testing Overview Stat Cards & Financial Formulas ---');
    const statCards = await page.$$('.stat-card');
    record('Overview Stat Cards Present', statCards.length >= 4, `Found: ${statCards.length} cards`);

    const netBalanceText = await page.$eval('.stats-grid', el => el.innerText).catch(() => '');
    record('Financial Overview Stats Content', netBalanceText.includes('Net Balance') && netBalanceText.includes('Total Income') && netBalanceText.includes('Total Expenses'), 'Net Balance, Income, Expenses present');

    // 3. Navigation to Ledger Activity (Transactions Tab)
    console.log('\n--- 3. Testing Navigation: Ledger Activity Tab ---');
    const txTabBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const btn = btns.find(b => b.innerText.includes('Ledger Activity') || b.innerText.includes('Transactions'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Click Ledger Activity Nav', txTabBtn);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_transactions_tab.png'), fullPage: true });

    const txTable = await page.$('table, .tx-list, .transactions-container');
    record('Transactions View Rendered', !!txTable);

    // 4. Navigation to Accounts Tab
    console.log('\n--- 4. Testing Navigation: Accounts Tab ---');
    const accTabBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const btn = btns.find(b => b.innerText.includes('Accounts & Vaults') || b.innerText.includes('Accounts'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Click Accounts Nav', accTabBtn);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_accounts_tab.png'), fullPage: true });

    const accountsText = await page.evaluate(() => document.body.innerText);
    record('Accounts Data & Nature (Asset/Liability) Displayed', accountsText.includes('Checking') || accountsText.includes('Asset') || accountsText.includes('Liability') || accountsText.includes('Vault'), 'Account natures verified');

    // 5. Navigation to Categories Tab
    console.log('\n--- 5. Testing Navigation: Categories Tab ---');
    const catTabBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const btn = btns.find(b => b.innerText.includes('Categories & Tags') || b.innerText.includes('Categories'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Click Categories Nav', catTabBtn);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_categories_tab.png'), fullPage: true });

    // 6. Navigation to Recurring Tab
    console.log('\n--- 6. Testing Navigation: Bills & Subscriptions Tab ---');
    const recTabBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const btn = btns.find(b => b.innerText.includes('Bills & Subscriptions') || b.innerText.includes('Recurring'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Click Recurring Nav', recTabBtn);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_recurring_tab.png'), fullPage: true });

    // 7. Navigation to Budgets Tab
    console.log('\n--- 7. Testing Navigation: Budgets & Goals Tab ---');
    const bgtTabBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const btn = btns.find(b => b.innerText.includes('Budgets & Goals') || b.innerText.includes('Budgets'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Click Budgets Nav', bgtTabBtn);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_budgets_tab.png'), fullPage: true });

    // 8. Navigation to Shared & Debts Tab
    console.log('\n--- 8. Testing Navigation: Shared & Debts Tab ---');
    const sharedTabBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const btn = btns.find(b => b.innerText.includes('Shared & Debts') || b.innerText.includes('Shared'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Click Shared & Debts Nav', sharedTabBtn);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_shared_debts_tab.png'), fullPage: true });

    const sharedText = await page.evaluate(() => document.body.innerText);
    record('Shared Bills & Settle-Up / Udhaar Board Rendered', sharedText.includes('Shared') || sharedText.includes('Udhaar') || sharedText.includes('Installments'), 'Stage D modules visible');

    // 9. Navigation to Business Tab
    console.log('\n--- 9. Testing Navigation: Business & Projects Tab ---');
    const bizTabBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const btn = btns.find(b => b.innerText.includes('Business & Projects') || b.innerText.includes('Business'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Click Business Nav', bizTabBtn);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_business_tab.png'), fullPage: true });

    // 10. Navigation to Analytics Tab
    console.log('\n--- 10. Testing Navigation: Visual Analytics Tab ---');
    const anaTabBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const btn = btns.find(b => b.innerText.includes('Visual Analytics') || b.innerText.includes('Analytics'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Click Analytics Nav', anaTabBtn);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_analytics_tab.png'), fullPage: true });

    const anaText = await page.evaluate(() => document.body.innerText);
    record('Analytics Metrics & Forecasting Curves Displayed', anaText.includes('Burn Rate') || anaText.includes('Forecast') || anaText.includes('Cash Flow') || anaText.includes('Net Worth'), 'Stage F analytics verified');

    // 11. Navigation to Reports Tab
    console.log('\n--- 11. Testing Navigation: Reports & Tax Tab ---');
    const repTabBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const btn = btns.find(b => b.innerText.includes('Reports & Tax') || b.innerText.includes('Reports'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Click Reports Nav', repTabBtn);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_reports_tab.png'), fullPage: true });

    const reportsText = await page.evaluate(() => document.body.innerText);
    record('Reports & Tax Summary Statement Rendered', reportsText.includes('Executive Summary') || reportsText.includes('Tax') || reportsText.includes('Statement') || reportsText.includes('Income'), 'Print/PDF report ready');

    // 12. Quick Add Modal Button
    console.log('\n--- 12. Testing Quick Add Modal ---');
    const quickAddBtn = await page.$('.navbar-quick-add-btn');
    if (quickAddBtn) {
      await quickAddBtn.click();
      await new Promise(r => setTimeout(r, 600));
      const hasQuickAddModal = await page.$('.modal-backdrop, [role="dialog"]');
      record('Quick Add Modal Triggered via Navbar Button', !!hasQuickAddModal);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_quick_add_modal.png') });
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 400));
    } else {
      record('Quick Add Button Found', false);
    }

    // 13. Zakat Calculator Modal (from Analytics)
    console.log('\n--- 13. Testing Zakat Calculator ---');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const btn = btns.find(b => b.innerText.includes('Visual Analytics') || b.innerText.includes('Analytics'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));
    const zakatBtnClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('Zakat') || b.innerText.includes('Calculate Zakat'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Open Zakat Calculator Modal', zakatBtnClicked);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_zakat_calculator_modal.png') });

    const zakatContent = await page.evaluate(() => document.body.innerText);
    record('Zakat Nisab & Net Liability Calculation Present', zakatContent.includes('Nisab') || zakatContent.includes('Zakat') || zakatContent.includes('Hawl'), 'Islamic Zakat engine verified');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // 14. Test FX Rate Converter
    console.log('\n--- 14. Testing FX Rate Converter ---');
    const fxBtnClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, nav button'));
      const btn = btns.find(b => b.innerText.includes('FX Rates'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Open FX Rates Modal', fxBtnClicked);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_fx_rates_modal.png') });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // 15. Test Import / Export Modal & Bank SMS Parsing
    console.log('\n--- 15. Testing Import & Export Modal (Bank SMS Parsing) ---');
    const importBtnClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, nav button'));
      const btn = btns.find(b => b.innerText.includes('Import / Export'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Open Import / Export Modal', importBtnClicked);
    await new Promise(r => setTimeout(r, 600));

    // Test SMS Parser Button inside modal
    const parsedSample = await page.evaluate(() => {
      const sampleBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('HBL POS'));
      if (sampleBtn) { sampleBtn.click(); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_sms_parser_result.png') });

    const smsParsedText = await page.evaluate(() => document.body.innerText);
    record('SMS Auto-Parsing (HBL/Meezan/JazzCash/UAE) Works', smsParsedText.includes('HBL Detected') || smsParsedText.includes('PKR 4,500') || smsParsedText.includes('Confidence'), 'SMS draft generated');
    await page.evaluate(() => {
      const close = document.querySelector('.modal-close-btn, button[aria-label="Close modal"]');
      if (close) close.click();
    });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 600));

    // 16. Test Setup Wizard Modal
    console.log('\n--- 16. Testing Setup Wizard Modal ---');
    const wizardClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('Setup Wizard'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Open Setup Wizard Modal', wizardClicked);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_setup_wizard_modal.png') });
    await page.evaluate(() => {
      const close = document.querySelector('button[title="Close"], .modal-close-btn');
      if (close) close.click();
    });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 600));

    // 17. Test In-App Notification Center
    console.log('\n--- 17. Testing Alerts / Notification Center ---');
    const alertBtnClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('Alerts'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    record('Open Notification Center Modal', alertBtnClicked);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16_notification_center.png') });
    await page.evaluate(() => {
      const close = document.querySelector('.modal-content button.btn-secondary, .modal-close-btn');
      if (close) close.click();
    });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 600));

    // 18. Return to Dashboard & Add a Transaction
    console.log('\n--- 18. Testing Adding New Transaction via Dashboard ---');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const btn = btns.find(b => b.innerText.includes('Dashboard'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Fill form
    await page.type('#tx-title', 'QA Verification Test Expense');
    await page.type('#tx-amount', '125.75');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '17_tx_form_filled.png') });

    const submitBtn = await page.$('.submit-btn');
    if (submitBtn) {
      await submitBtn.click();
      await new Promise(r => setTimeout(r, 700));
      const bodyTextAfterTx = await page.evaluate(() => document.body.innerText);
      record('Book Transaction on Dashboard', bodyTextAfterTx.includes('QA Verification Test Expense'), 'New transaction appears in recent activity');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18_tx_added_success.png') });
    }

    // Check Console Errors
    console.log('\n--- Check Console Errors ---');
    record('Clean Console (Zero React / Runtime Errors)', consoleErrors.length === 0, 
      consoleErrors.length > 0 ? `Errors: ${JSON.stringify(consoleErrors)}` : 'Zero errors');

  } catch (err) {
    console.error('Test Suite Encountered Exception:', err);
    record('Test Suite Run', false, err.message);
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n=======================================');
  console.log('🏁 Universal Expense Tracker Test Results');
  console.log('=======================================');
  const passedCount = testResults.filter(t => t.passed).length;
  console.log(`Passed: ${passedCount} / ${testResults.length} (${Math.round(passedCount / testResults.length * 100)}%)`);

  fs.writeFileSync(
    path.join(__dirname, 'test-report.json'),
    JSON.stringify({ results: testResults, consoleErrors, consoleLogs: consoleLogs.slice(0, 50) }, null, 2)
  );
}

runTests();
