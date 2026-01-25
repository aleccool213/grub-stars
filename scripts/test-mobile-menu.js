#!/usr/bin/env node

/**
 * Playwright test for mobile navbar menu
 * Tests that the hamburger menu shows navigation options when clicked
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const WEB_DIR = path.join(__dirname, '..', 'web');
const PORT = 8766;

/**
 * Simple HTTP server to serve static files
 */
function createServer(webDir, port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
  };

  const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    // Remove query strings
    filePath = filePath.split('?')[0];
    filePath = path.join(webDir, filePath);

    if (!filePath.startsWith(webDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found: ' + filePath);
        return;
      }

      const ext = path.extname(filePath);
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function testMobileMenu() {
  console.log('🧪 Testing mobile navbar menu...\n');

  const server = await createServer(WEB_DIR, PORT);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
    ],
  });

  try {
    // Create page with mobile viewport (iPhone SE size)
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    });
    const page = await context.newPage();

    // Log console messages
    page.on('console', msg => console.log('  [console]', msg.text()));
    page.on('pageerror', error => console.log('  [error]', error.message));

    // Block external requests (fonts, etc.)
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(`http://localhost:${PORT}`)) {
        route.continue();
      } else {
        route.abort('blockedbyclient');
      }
    });

    console.log('1. Loading page at mobile viewport (375x667)...');
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for navbar to be inserted
    await page.waitForSelector('#mobile-menu-btn', { timeout: 5000 });
    console.log('   ✓ Page loaded, navbar found');

    // Take screenshot before clicking
    await page.screenshot({ path: 'screenshots/mobile-menu-1-before.png' });
    console.log('   ✓ Screenshot saved: mobile-menu-1-before.png');

    // Check initial state
    const menuBtn = await page.$('#mobile-menu-btn');
    const mobileMenu = await page.$('#mobile-menu');

    if (!menuBtn) {
      throw new Error('Mobile menu button not found');
    }
    if (!mobileMenu) {
      throw new Error('Mobile menu element not found');
    }

    const initialAriaExpanded = await menuBtn.getAttribute('aria-expanded');
    const initialMenuHidden = await mobileMenu.evaluate(el => el.classList.contains('hidden'));

    console.log(`\n2. Initial state check:`);
    console.log(`   - aria-expanded: ${initialAriaExpanded}`);
    console.log(`   - menu hidden: ${initialMenuHidden}`);

    if (initialAriaExpanded !== 'false' || !initialMenuHidden) {
      console.log('   ⚠ Warning: Initial state unexpected');
    } else {
      console.log('   ✓ Initial state correct (menu hidden)');
    }

    // Click the hamburger menu button
    console.log('\n3. Clicking hamburger menu button...');
    await menuBtn.click();

    // Wait a moment for any JS to execute
    await page.waitForTimeout(300);

    // Take screenshot after clicking
    await page.screenshot({ path: 'screenshots/mobile-menu-2-after-click.png' });
    console.log('   ✓ Screenshot saved: mobile-menu-2-after-click.png');

    // Check state after clicking
    const afterAriaExpanded = await menuBtn.getAttribute('aria-expanded');
    const afterMenuHidden = await mobileMenu.evaluate(el => el.classList.contains('hidden'));
    const menuIsVisible = await mobileMenu.isVisible();

    console.log(`\n4. State after clicking:`);
    console.log(`   - aria-expanded: ${afterAriaExpanded}`);
    console.log(`   - menu hidden class: ${afterMenuHidden}`);
    console.log(`   - menu isVisible(): ${menuIsVisible}`);

    // Check if navigation links are visible
    const navLinks = await mobileMenu.$$('a');
    console.log(`   - Number of nav links in mobile menu: ${navLinks.length}`);

    if (navLinks.length > 0) {
      console.log('   - Nav link texts:');
      for (const link of navLinks) {
        const text = await link.textContent();
        const isVisible = await link.isVisible();
        console.log(`     * "${text.trim()}" - visible: ${isVisible}`);
      }
    }

    // Determine test result
    const testPassed = afterAriaExpanded === 'true' && !afterMenuHidden && menuIsVisible;

    if (testPassed) {
      console.log('\n✅ TEST PASSED: Mobile menu opens correctly');
    } else {
      console.log('\n❌ TEST FAILED: Mobile menu did not open correctly');

      // Debug: check if the click handler is attached
      console.log('\n5. Debug: Checking click handler...');
      const hasClickListener = await page.evaluate(() => {
        const btn = document.getElementById('mobile-menu-btn');
        // We can't directly check event listeners, but we can check if the element exists
        return {
          buttonExists: !!btn,
          buttonType: btn?.type,
          buttonInDOM: btn?.parentElement != null
        };
      });
      console.log(`   - Button debug:`, hasClickListener);

      // Try clicking with JavaScript
      console.log('\n6. Trying direct JavaScript click...');
      await page.evaluate(() => {
        const btn = document.getElementById('mobile-menu-btn');
        const menu = document.getElementById('mobile-menu');
        console.log('Before JS click - menu hidden:', menu?.classList.contains('hidden'));
        if (btn) {
          btn.click();
        }
        console.log('After JS click - menu hidden:', menu?.classList.contains('hidden'));
      });

      await page.waitForTimeout(300);
      await page.screenshot({ path: 'screenshots/mobile-menu-3-after-js-click.png' });
      console.log('   ✓ Screenshot saved: mobile-menu-3-after-js-click.png');

      const finalMenuHidden = await mobileMenu.evaluate(el => el.classList.contains('hidden'));
      console.log(`   - menu hidden after JS click: ${finalMenuHidden}`);
    }

    await browser.close();
    server.close();

    process.exit(testPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    await browser.close();
    server.close();
    process.exit(1);
  }
}

// Ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

testMobileMenu();
