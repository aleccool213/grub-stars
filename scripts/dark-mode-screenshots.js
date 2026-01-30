const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function takeDarkModeScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  
  const baseUrl = 'http://localhost:9292';
  const pages = [
    { name: 'homepage', path: '/' },
    { name: 'search', path: '/?location=Barrie%2C%20Ontario%2C%20Canada&category=bakery' },
    { name: 'categories', path: '/categories.html' },
    { name: 'index-location', path: '/index-location.html' },
    { name: 'details', path: '/details.html?id=1' }
  ];
  
  const screenshotDir = path.join(__dirname, '..', 'screenshots', 'dark-mode-review');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  
  for (const { name, path: pagePath } of pages) {
    try {
      // Navigate to page
      await page.goto(`${baseUrl}${pagePath}`, { waitUntil: 'networkidle' });
      
      // Wait a bit for any dynamic content
      await page.waitForTimeout(1000);
      
      // Enable dark mode via localStorage and reload
      await page.evaluate(() => {
        localStorage.setItem('grub_stars_theme', 'dark');
      });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      
      // Take screenshot
      const screenshotPath = path.join(screenshotDir, `${name}-dark.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`✓ Screenshot saved: ${screenshotPath}`);
      
    } catch (error) {
      console.error(`✗ Failed to screenshot ${name}: ${error.message}`);
    }
  }
  
  await browser.close();
  console.log(`\nScreenshots saved to: ${screenshotDir}`);
}

takeDarkModeScreenshots().catch(console.error);
