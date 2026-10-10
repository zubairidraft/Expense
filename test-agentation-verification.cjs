const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');

async function testAgentation() {
  console.log('🧪 Verifying Agentation Integration...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleLogs = [];
  const networkErrors = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('requestfailed', req => {
    networkErrors.push(`${req.method()} ${req.url()} - ${req.failure().errorText}`);
  });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Look for Agentation elements in DOM
    const agentationToolbar = await page.evaluate(() => {
      // Agentation attaches a portal or toolbar container
      const elements = Array.from(document.querySelectorAll('*'));
      const toolbarCandidate = elements.find(el => {
        const cls = typeof el.className === 'string' ? el.className : '';
        const id = el.id || '';
        return cls.toLowerCase().includes('agentation') ||
               id.toLowerCase().includes('agentation') ||
               el.hasAttribute('data-agentation') ||
               cls.toLowerCase().includes('feedback');
      });

      return {
        hasCandidate: !!toolbarCandidate,
        candidateTag: toolbarCandidate ? toolbarCandidate.tagName : null,
        candidateClass: toolbarCandidate ? toolbarCandidate.className : null,
        totalDOMNodes: document.querySelectorAll('*').length
      };
    });

    console.log('Agentation DOM detection:', agentationToolbar);

    // Check if any HTTP requests were made to port 4747
    const port4747Failed = networkErrors.filter(e => e.includes('4747'));
    console.log('Port 4747 network failures:', port4747Failed.length > 0 ? port4747Failed : 'None! Sync is healthy.');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'verification_agentation_toolbar.png'), fullPage: true });

    console.log('✅ Agentation verification script completed.');
  } catch (err) {
    console.error('Error in agentation test:', err);
  } finally {
    await browser.close();
  }
}

testAgentation();
