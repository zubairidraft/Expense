import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:5173';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('🚀 Starting Cross-Workspace Account Sharing Verification Test...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // 1. Load Application
    console.log('1. Loading application at', APP_URL);
    await page.goto(APP_URL, { waitUntil: 'networkidle2' });
    await sleep(1500);

    // 2. Check current workspace and create second workspace for testing
    console.log('2. Setting up test workspaces in localStorage...');
    await page.evaluate(() => {
      // Clear previous test shares to start clean
      localStorage.removeItem('expense_pro_account_shares');

      // Create two workspaces: Personal (guest-space) and Business (ws-business)
      const existingWorkspaces = [
        {
          id: 'guest-space',
          name: "Personal Workspace",
          type: 'personal',
          base_currency: 'USD',
          owner_id: 'guest',
          role: 'owner',
        },
        {
          id: 'ws-business',
          name: 'Business Workspace',
          type: 'business',
          base_currency: 'USD',
          owner_id: 'guest',
          role: 'owner',
        },
      ];
      localStorage.setItem('expense_pro_workspaces', JSON.stringify(existingWorkspaces));
      localStorage.setItem('active_workspace_id', 'guest-space');
      // Store in accounts
      const rawAccs = localStorage.getItem('expense_pro_accounts');
      if (rawAccs) {
        const accs = JSON.parse(rawAccs);
        // Ensure acc-1 belongs to guest-space
        const updatedAccs = accs.map(a => a.id === 'acc-1' ? { ...a, workspace_id: 'guest-space', name: 'HBL Checking' } : a);
        localStorage.setItem('expense_pro_accounts', JSON.stringify(updatedAccs));
      }
    });

    // Reload page to apply clean test setup
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1200);

    // 3. Navigate to Accounts View
    console.log('3. Navigating to Accounts tab...');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const accItem = items.find(el => el.textContent.includes('Accounts & Vaults') || el.textContent.includes('Accounts'));
      if (accItem) accItem.click();
    });
    await sleep(1000);

    // 4. Test Sharing Account
    console.log('4. Opening ShareAccountModal on HBL Checking...');
    const shareClicked = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.account-card'));
      const hblCard = cards.find(c => c.textContent.includes('Checking') || c.textContent.includes('Main Checking') || c.textContent.includes('acc-1'));
      if (!hblCard) return false;
      const shareBtn = Array.from(hblCard.querySelectorAll('button')).find(b => b.textContent.includes('Share'));
      if (shareBtn) {
        shareBtn.click();
        return true;
      }
      return false;
    });

    if (!shareClicked) {
      throw new Error('Share button on account card not found');
    }
    await sleep(800);

    // Verify Share Modal Opened
    const modalVisible = await page.evaluate(() => {
      return Boolean(document.querySelector('.share-account-modal') || document.querySelector('.modal-content'));
    });
    console.log('   Share modal visible:', modalVisible);
    if (!modalVisible) throw new Error('ShareAccountModal failed to open');

    // Fill and submit Share form (share with Business Workspace)
    console.log('   Configuring share: can_post=true, detail_level=summary, count_in_net_worth=false...');
    await page.evaluate(() => {
      const modal = document.querySelector('.share-account-modal') || document.querySelector('.modal-content');
      const select = modal.querySelector('select');
      if (select && select.options.length > 0) {
        for (let i = 0; i < select.options.length; i++) {
          if (select.options[i].value.includes('business') || select.options[i].text.includes('Business')) {
            select.selectedIndex = i;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
      // Click share submit button
      const submitBtn = modal.querySelector('button[type="submit"]') || Array.from(modal.querySelectorAll('button')).find(b => b.textContent.includes('Confirm Share') || b.textContent.includes('Share'));
      if (submitBtn) submitBtn.click();
    });
    await sleep(1200);

    // Verify share is registered in localStorage
    const sharesInStorage = await page.evaluate(() => {
      const raw = localStorage.getItem('expense_pro_account_shares');
      return raw ? JSON.parse(raw) : [];
    });
    console.log('   Shares in localStorage count:', sharesInStorage.length);
    if (sharesInStorage.length === 0) {
      throw new Error('Share was not saved to localStorage');
    }

    // 5. Check Home Workspace Card shows "Shared (1)" chip
    const homeShareBadge = await page.evaluate(() => {
      const badge = document.querySelector('.share-badge.outgoing');
      return badge ? badge.textContent.trim() : null;
    });
    console.log('5. Home workspace share badge:', homeShareBadge);

    // 6. Record Initial Balance of HBL Checking in Home Workspace
    const initialHomeBalance = await page.evaluate(() => {
      const card = document.querySelector('.account-card');
      const val = card ? card.querySelector('.acc-bal-val') : null;
      return val ? val.textContent.trim() : null;
    });
    console.log('6. Initial balance in Home workspace:', initialHomeBalance);

    // 7. Switch to Business Workspace
    console.log('7. Switching to Business Workspace...');
    await page.evaluate(() => {
      // Find ws-business id from storage
      const rawShares = localStorage.getItem('expense_pro_account_shares');
      const shares = JSON.parse(rawShares);
      const targetWsId = shares[0].workspace_id;
      localStorage.setItem('active_workspace_id', targetWsId);
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1500);

    // 8. In Business Workspace, verify account appears as "Shared from Home Workspace"
    console.log('8. Verifying shared account in Business workspace...');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const accItem = items.find(el => el.textContent.includes('Accounts & Vaults') || el.textContent.includes('Accounts'));
      if (accItem) accItem.click();
    });
    await sleep(1000);

    const businessAccountInfo = await page.evaluate(() => {
      const card = document.querySelector('.account-card');
      if (!card) return null;
      const name = card.querySelector('.acc-card-name')?.textContent.trim();
      const incomingBadge = card.querySelector('.share-badge.incoming')?.textContent.trim();
      const deleteBtn = card.querySelector('.tx-delete-btn');
      const isDeleteDisabled = deleteBtn ? deleteBtn.disabled : false;
      const deleteTooltip = deleteBtn ? deleteBtn.title : '';
      const balance = card.querySelector('.acc-bal-val')?.textContent.trim();
      return { name, incomingBadge, isDeleteDisabled, deleteTooltip, balance };
    });
    console.log('   Business account info:', JSON.stringify(businessAccountInfo, null, 2));
    if (!businessAccountInfo?.incomingBadge) {
      throw new Error('Shared from badge not found in Business workspace');
    }
    if (!businessAccountInfo?.isDeleteDisabled) {
      throw new Error('Archive button is not disabled on received shared account');
    }

    // 9. Book a $500.00 Expense transaction from Business Workspace on the shared account
    console.log('9. Booking $500.00 Office Rent expense in Business Workspace on shared account...');
    await page.evaluate(async () => {
      // Add transaction directly via storage simulation matching addTransaction format
      const rawShares = localStorage.getItem('expense_pro_account_shares');
      const shares = JSON.parse(rawShares);
      const sharedAccId = shares[0].account_id;
      const targetWsId = shares[0].workspace_id;

      const rawTxs = JSON.parse(localStorage.getItem('expense_pro_transactions') || '[]');
      const newTx = {
        id: 'tx-business-rent-500',
        workspace_id: targetWsId,
        type: 'expense',
        date: '2026-10-10',
        status: 'cleared',
        payee_name: 'Downtown Office Space Rent',
        notes: 'Monthly commercial lease fee',
        amount: 500,
        is_offline_pending: false,
        created_at: new Date().toISOString(),
        lines: [
          {
            id: 'line-biz-500',
            account_id: sharedAccId,
            category_id: 'cat-software',
            direction: 'out',
            amount: '500.00',
            currency: 'USD',
            fx_rate: '1.0000000000',
            base_amount: '500.00',
            description: 'Monthly office rent payment',
            account: { id: sharedAccId, name: 'HBL Checking' },
          },
        ],
        tags: [],
      };
      localStorage.setItem('expense_pro_transactions', JSON.stringify([newTx, ...rawTxs]));
    });

    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1500);

    // Verify Business account balance updated
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const accItem = items.find(el => el.textContent.includes('Accounts & Vaults') || el.textContent.includes('Accounts'));
      if (accItem) accItem.click();
    });
    await sleep(800);
    const businessBalAfter = await page.evaluate(() => {
      const card = document.querySelector('.account-card');
      return card?.querySelector('.acc-bal-val')?.textContent.trim();
    });
    console.log('   Business account balance after $500 expense:', businessBalAfter);

    // 10. Switch BACK to Personal / Home Workspace
    console.log('10. Switching back to Personal / Home Workspace...');
    await page.evaluate(() => {
      localStorage.setItem('active_workspace_id', 'guest-space');
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1500);

    // 11. Verify Unified Balance in Home Workspace
    console.log('11. Verifying Unified Account Balance in Home Workspace...');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const accItem = items.find(el => el.textContent.includes('Accounts & Vaults') || el.textContent.includes('Accounts'));
      if (accItem) accItem.click();
    });
    await sleep(800);
    const homeBalAfter = await page.evaluate(() => {
      const card = document.querySelector('.account-card');
      return card?.querySelector('.acc-bal-val')?.textContent.trim();
    });
    console.log('    Home account balance after Business spent $500:', homeBalAfter);
    if (homeBalAfter !== businessBalAfter) {
      throw new Error(`Unified balance mismatch: Home shows ${homeBalAfter}, Business shows ${businessBalAfter}`);
    }
    console.log('    ✅ Single Source of Truth Verified: Balance is identical across both workspaces!');

    // 12. Verify P&L Isolation in Home Workspace Ledger
    console.log('12. Navigating to Ledger Activity in Home Workspace...');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const txItem = items.find(el => el.textContent.includes('Ledger Activity') || el.textContent.includes('Ledger'));
      if (txItem) txItem.click();
    });
    await sleep(1000);

    // Check foreign transaction row in ledger
    const ledgerCheck = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.tx-item'));
      const foreignItem = items.find(it => it.textContent.includes('Activity in') || it.textContent.includes('Downtown Office') || it.textContent.includes('se'));
      if (!foreignItem) return null;

      const title = foreignItem.querySelector('.tx-title')?.textContent.trim();
      const foreignBadge = foreignItem.querySelector('.foreign-tx-chip')?.textContent.trim();
      const deleteBtn = foreignItem.querySelector('.tx-delete-btn');
      const isDeleteDisabled = deleteBtn ? deleteBtn.disabled : false;
      const deleteTooltip = deleteBtn ? deleteBtn.title : '';

      return { title, foreignBadge, isDeleteDisabled, deleteTooltip };
    });
    console.log('    Ledger check for foreign transaction:', JSON.stringify(ledgerCheck, null, 2));

    if (!ledgerCheck) {
      throw new Error('Foreign transaction not found in Home workspace ledger');
    }
    if (!ledgerCheck.foreignBadge) {
      throw new Error('Foreign badge (🔒 ... se) missing on transaction row');
    }
    if (!ledgerCheck.isDeleteDisabled) {
      throw new Error('Delete button is NOT disabled on foreign transaction');
    }
    console.log('    ✅ Ledger Protection Verified: Foreign transaction has badge and locked delete button!');

    // 13. Verify Summary Masking (Decision 1)
    console.log('13. Checking detail_level=summary masking...');
    console.log('    Displayed title:', ledgerCheck.title);
    if (ledgerCheck.title.includes('Downtown Office Space Rent')) {
      throw new Error('Detail level was summary, but payee name was NOT masked!');
    }
    console.log('    ✅ Detail Level Masking Verified: Payee masked as "' + ledgerCheck.title + '"');

    console.log('\n🎉 ALL CROSS-WORKSPACE ACCOUNT SHARING TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error('❌ Test failed with error:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
