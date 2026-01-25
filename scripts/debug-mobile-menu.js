#!/usr/bin/env node

/**
 * Debug script for mobile navbar menu issue
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const WEB_DIR = path.join(__dirname, '..', 'web');
const PORT = 8767;

function createServer(webDir, port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
  };

  const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
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

async function debugMobileMenu() {
  console.log('🔍 Debugging mobile navbar menu...\n');

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
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();

    // Block external requests
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(`http://localhost:${PORT}`)) {
        route.continue();
      } else {
        route.abort('blockedbyclient');
      }
    });

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#mobile-menu-btn', { timeout: 5000 });

    // Wait for scripts to initialize
    await page.waitForTimeout(500);

    console.log('=== INITIAL STATE ===\n');

    // Get detailed info about the mobile menu element
    const initialState = await page.evaluate(() => {
      const menu = document.getElementById('mobile-menu');
      const btn = document.getElementById('mobile-menu-btn');

      if (!menu || !btn) return { error: 'Elements not found' };

      const menuStyle = window.getComputedStyle(menu);

      return {
        menu: {
          classList: Array.from(menu.classList),
          display: menuStyle.display,
          visibility: menuStyle.visibility,
          opacity: menuStyle.opacity,
          height: menuStyle.height,
          overflow: menuStyle.overflow,
          position: menuStyle.position,
          outerHTML: menu.outerHTML.substring(0, 500),
        },
        btn: {
          ariaExpanded: btn.getAttribute('aria-expanded'),
        }
      };
    });

    console.log('Mobile Menu Element:');
    console.log('  classList:', initialState.menu?.classList);
    console.log('  display:', initialState.menu?.display);
    console.log('  visibility:', initialState.menu?.visibility);
    console.log('  opacity:', initialState.menu?.opacity);
    console.log('  height:', initialState.menu?.height);
    console.log('  aria-expanded:', initialState.btn?.ariaExpanded);
    console.log('\n  HTML (first 500 chars):');
    console.log('  ', initialState.menu?.outerHTML?.replace(/\n/g, '\n  '));

    // Now click the button
    console.log('\n=== AFTER CLICKING ===\n');
    await page.click('#mobile-menu-btn');
    await page.waitForTimeout(300);

    const afterClickState = await page.evaluate(() => {
      const menu = document.getElementById('mobile-menu');
      const btn = document.getElementById('mobile-menu-btn');

      if (!menu || !btn) return { error: 'Elements not found' };

      const menuStyle = window.getComputedStyle(menu);
      const links = menu.querySelectorAll('a');

      return {
        menu: {
          classList: Array.from(menu.classList),
          display: menuStyle.display,
          visibility: menuStyle.visibility,
          opacity: menuStyle.opacity,
          height: menuStyle.height,
          maxHeight: menuStyle.maxHeight,
          position: menuStyle.position,
          boundingRect: menu.getBoundingClientRect(),
        },
        btn: {
          ariaExpanded: btn.getAttribute('aria-expanded'),
        },
        links: Array.from(links).map(l => ({
          text: l.textContent.trim(),
          visible: l.offsetParent !== null,
          display: window.getComputedStyle(l).display,
        }))
      };
    });

    console.log('Mobile Menu Element:');
    console.log('  classList:', afterClickState.menu?.classList);
    console.log('  display:', afterClickState.menu?.display);
    console.log('  visibility:', afterClickState.menu?.visibility);
    console.log('  height:', afterClickState.menu?.height);
    console.log('  maxHeight:', afterClickState.menu?.maxHeight);
    console.log('  boundingRect:', afterClickState.menu?.boundingRect);
    console.log('  aria-expanded:', afterClickState.btn?.ariaExpanded);
    console.log('\nNav Links:');
    afterClickState.links?.forEach((link, i) => {
      console.log(`  ${i + 1}. "${link.text}" - visible: ${link.visible}, display: ${link.display}`);
    });

    // Check what Twind's 'hidden' class produces
    console.log('\n=== TWIND CLASS CHECK ===\n');
    const twindCheck = await page.evaluate(() => {
      // Create a test element to check what 'hidden' class does
      const testEl = document.createElement('div');
      testEl.className = 'hidden';
      document.body.appendChild(testEl);
      const hiddenStyle = window.getComputedStyle(testEl);
      const result = {
        hiddenDisplay: hiddenStyle.display,
      };
      document.body.removeChild(testEl);

      // Also check md:hidden
      const testEl2 = document.createElement('div');
      testEl2.className = 'md:hidden';
      document.body.appendChild(testEl2);
      const mdHiddenStyle = window.getComputedStyle(testEl2);
      result.mdHiddenDisplay = mdHiddenStyle.display;
      document.body.removeChild(testEl2);

      return result;
    });

    console.log('Twind "hidden" class produces display:', twindCheck.hiddenDisplay);
    console.log('Twind "md:hidden" class produces display:', twindCheck.mdHiddenDisplay);
    console.log('(on mobile viewport 375px)');

    await page.screenshot({ path: 'screenshots/debug-mobile-menu.png', fullPage: true });
    console.log('\n✓ Screenshot saved: screenshots/debug-mobile-menu.png');

    await browser.close();
    server.close();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await browser.close();
    server.close();
    process.exit(1);
  }
}

const screenshotsDir = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

debugMobileMenu();
