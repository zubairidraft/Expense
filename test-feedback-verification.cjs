const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function verifyAllFeedback() {
  console.log('🚀 Starting E2E Verification for All 10 Feedback Items...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const results = {};

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 15000 });
    console.log('✓ App loaded at http://localhost:5173');

    // Dismiss onboarding if present
    try {
      const dismissBtn = await page.$('.modal-close, .modal-close-btn');
      if (dismissBtn) {
        await dismissBtn.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch (e) {}

    // Switch to Light Theme first to test light theme feedbacks (Items 1, 4, 6)
    const themeBtn = await page.$('button[title*="theme" i], .theme-toggle-btn');
    if (themeBtn) {
      await themeBtn.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // 1. Sidebar Footer in Light Theme
    const footerStyle = await page.evaluate(() => {
      const el = document.querySelector('.sidebar-footer');
      const wsName = document.querySelector('.sidebar-ws-name');
      const wsRole = document.querySelector('.sidebar-ws-role');
      if (!el) return null;
      const s = window.getComputedStyle(el);
      const nameS = wsName ? window.getComputedStyle(wsName) : null;
      const roleS = wsRole ? window.getComputedStyle(wsRole) : null;
      return {
        background: s.backgroundColor,
        nameColor: nameS?.color,
        roleColor: roleS?.color,
      };
    });
    console.log('Item 1 (Sidebar Footer Light Theme):', footerStyle);
    results.sidebarFooter = footerStyle && footerStyle.nameColor !== 'rgb(255, 255, 255)';

    // 2. Header Badges Layout
    const headerLayout = await page.evaluate(() => {
      const nav = document.querySelector('.app-header');
      const primaryGroup = document.querySelector('.navbar-primary-group');
      const utilGroup = document.querySelector('.navbar-utilities');
      return {
        hasHeader: !!nav,
        hasPrimaryGroup: !!primaryGroup,
        hasUtilGroup: !!utilGroup,
      };
    });
    console.log('Item 2 (Header Badges Layout):', headerLayout);
    results.headerLayout = headerLayout.hasHeader;

    // 4. App Container Light Theme Styling
    const containerStyle = await page.evaluate(() => {
      const app = document.querySelector('.app-main-content');
      const body = document.body;
      const s = window.getComputedStyle(app || body);
      return {
        color: s.color,
        background: s.backgroundColor,
      };
    });
    console.log('Item 4 (App Container Light Theme):', containerStyle);
    results.lightTheme = containerStyle.color !== 'rgb(255, 255, 255)';

    // 10. Dashboard Customizable Widgets
    const customizeBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find((el) => el.innerText.includes('Customize Widgets'));
      if (b) {
        b.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 500));
    const customizeModalVisible = await page.$('.modal-title');
    const hasModal = await page.evaluate(() => {
      return document.body.innerText.includes('Customize Dashboard Widgets');
    });
    console.log('Item 10 (Dashboard Widgets Customization Modal):', { customizeBtn, hasModal });
    results.dashboardWidgets = hasModal;

    // Close customize modal
    const closeBtn = await page.$('.modal-close-btn');
    if (closeBtn) await closeBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    // 7. Loans & Payables (formerly Shared & Debts)
    const loansNav = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const found = btns.find((b) => b.innerText.includes('Loans & Payables'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 600));
    console.log('Item 7 (Loans & Payables Nav Renamed):', loansNav);
    results.loansNav = loansNav;

    // Test Create Debt Modal Account Selector
    const debtModalOpened = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const debtBtn = btns.find((b) => b.className.includes('btn-primary') && b.innerText.includes('Udhaar'));
      if (debtBtn) {
        debtBtn.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 600));
    const debtAccountSelector = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('.modal-content select'));
      const labels = Array.from(document.querySelectorAll('.modal-content label'));
      const hasAccountLabel = labels.some((l) => l.innerText.includes('Account'));
      return { hasAccountLabel, count: selects.length };
    });
    console.log('Item 7 (Debt Modal Account Selector):', debtAccountSelector);
    results.debtAccountSelector = debtAccountSelector.hasAccountLabel;

    // Also verify Record Repayment Modal Account Selector
    const modalClose = await page.$('.modal-close-btn');
    if (modalClose) await modalClose.click();
    await new Promise((r) => setTimeout(r, 400));

    const repayModalOpened = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const repayBtn = btns.find((b) => b.innerText.includes('Record Payment'));
      if (repayBtn) {
        repayBtn.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 600));

    const repayAccountSelector = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('.modal-content select'));
      const labels = Array.from(document.querySelectorAll('.modal-content label'));
      const hasAccountLabel = labels.some((l) => l.innerText.includes('Account'));
      return { hasAccountLabel, count: selects.length };
    });
    console.log('Item 7 (Repayment Modal Account Selector):', repayAccountSelector);
    results.repayAccountSelector = repayAccountSelector.hasAccountLabel;

    const modalClose2 = await page.$('.modal-close-btn');
    if (modalClose2) await modalClose2.click();
    await new Promise((r) => setTimeout(r, 400));

    // 3. Recurring "✓ Mark Paid" Account Selector Confirmation Modal
    const recurringNav = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const found = btns.find((b) => b.innerText.includes('Bills & Subscriptions'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 600));

    // Click "✓ Mark Paid"
    const markPaidClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const markBtn = btns.find((b) => b.innerText.includes('Mark Paid'));
      if (markBtn) {
        markBtn.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 600));

    const markPaidModal = await page.evaluate(() => {
      const title = document.querySelector('.modal-title');
      const select = document.querySelector('.modal-content select');
      return {
        title: title ? title.innerText : null,
        hasAccountSelect: !!select,
      };
    });
    console.log('Item 3 (Recurring Mark Paid Modal & Account Deduction):', markPaidModal);
    results.markPaidModal = markPaidModal.hasAccountSelect && markPaidModal.title?.includes('Confirm');

    // Close mark paid modal
    const closeMarkPaid = await page.$('.modal-close, .btn-secondary');
    if (closeMarkPaid) await closeMarkPaid.click();
    await new Promise((r) => setTimeout(r, 400));

    // 5. Visual Analytics Smart Charts
    const analyticsNav = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const found = btns.find((b) => b.innerText.includes('Visual Analytics'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 600));

    const smartChartsDetected = await page.evaluate(() => {
      const svgs = Array.from(document.querySelectorAll('svg'));
      return {
        svgCount: svgs.length,
        hasChartContainers: document.querySelectorAll('.smart-chart-container, .card svg').length > 0,
      };
    });
    console.log('Item 5 (Visual Analytics Smart Charts):', smartChartsDetected);
    results.smartCharts = smartChartsDetected.svgCount >= 2;

    // 6 & 9. Reports & Tax Views, Filters, and Light Theme Sheet
    const reportsNav = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const found = btns.find((b) => b.innerText.includes('Reports & Tax'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 600));

    const reportsSheet = await page.evaluate(() => {
      const sheet = document.querySelector('.report-sheet');
      const s = sheet ? window.getComputedStyle(sheet) : null;
      const selects = Array.from(document.querySelectorAll('.reports-view-container select'));
      const hasCategoryFilter = selects.some((sel) => sel.innerHTML.includes('Categories'));
      const hasTagFilter = selects.some((sel) => sel.innerHTML.includes('Tags'));
      const hasAccountFilter = selects.some((sel) => sel.innerHTML.includes('Accounts'));
      const hasExportCSV = Array.from(document.querySelectorAll('button')).some((b) => b.innerText.includes('Export CSV'));

      return {
        sheetBg: s?.backgroundColor,
        sheetColor: s?.color,
        hasCategoryFilter,
        hasTagFilter,
        hasAccountFilter,
        hasExportCSV,
      };
    });
    console.log('Items 6 & 9 (Reports Sheet & Filters):', reportsSheet);
    results.reportsFilters = reportsSheet.hasCategoryFilter && reportsSheet.hasExportCSV;
    results.reportsLightSheet = reportsSheet.sheetColor !== 'rgb(255, 255, 255)';

    // 8. Preferences Full-Page View
    const preferencesNav = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const found = btns.find((b) => b.innerText.includes('Preferences'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 600));

    const preferencesView = await page.evaluate(() => {
      const pageTitle = document.querySelector('.preferences-view h1');
      const tabs = Array.from(document.querySelectorAll('.preferences-view button')).map((b) => b.innerText);
      const isModal = !!document.querySelector('.preferences-view .modal-backdrop');
      return {
        title: pageTitle ? pageTitle.innerText : null,
        tabs,
        isFullPage: !isModal && !!document.querySelector('.preferences-view'),
      };
    });
    console.log('Item 8 (Preferences Full-Page View):', preferencesView);
    results.preferencesPage = preferencesView.isFullPage && preferencesView.title?.includes('Preferences');

    // Take screenshot of preferences view
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'preferences_view.png'), fullPage: true });

    // Switch to Overview and take screenshot
    const overviewNav = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const found = btns.find((b) => b.innerText.includes('Dashboard'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dashboard_light.png'), fullPage: true });

    console.log('====================================');
    console.log('🎯 Final Verification Summary:');
    console.log(JSON.stringify(results, null, 2));
    console.log('====================================');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
}

verifyAllFeedback();
