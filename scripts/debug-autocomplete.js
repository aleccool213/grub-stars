const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Log console messages from page
  page.on('console', msg => console.log('PAGE:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  // Allow Photon API
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('photon.komoot.io')) {
      route.continue();
    } else {
      console.log('Blocked:', url);
      route.abort('blockedbyclient');
    }
  });

  await page.goto('http://localhost:9292/index-location.html');
  await page.waitForTimeout(1000);

  // Check if wrapper exists (autocomplete initialized)
  const wrapper = await page.$('.autocomplete-wrapper');
  console.log('Wrapper found:', wrapper !== null);

  // Click and type character by character
  await page.click('#location');
  await page.type('#location', 'Toronto', { delay: 100 });
  console.log('Typed "Toronto"');

  // Wait for debounce + API response
  await page.waitForTimeout(2000);

  // Check if dropdown exists
  const dropdown = await page.$('.autocomplete-dropdown');
  console.log('Dropdown found:', dropdown !== null);

  if (dropdown) {
    const items = await page.$$('.autocomplete-item');
    console.log('Number of suggestions:', items.length);
  }

  // Get input value
  const value = await page.$eval('#location', el => el.value);
  console.log('Input value:', value);

  // Take a screenshot
  await page.screenshot({ path: 'screenshots/debug-autocomplete.png' });
  console.log('Screenshot saved');

  await browser.close();
})();
