const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // Log console messages from page
  page.on('console', msg => console.log('PAGE:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  // Track network requests to Photon
  page.on('request', req => {
    if (req.url().includes('photon')) {
      console.log('PHOTON REQUEST:', req.url());
    }
  });

  page.on('response', res => {
    if (res.url().includes('photon')) {
      console.log('PHOTON RESPONSE:', res.status());
    }
  });

  // Mock Photon API response
  const mockPhotonResponse = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          osm_id: 324211,
          name: "Toronto",
          city: "Toronto",
          state: "Ontario",
          country: "Canada",
          osm_value: "city"
        },
        geometry: { type: "Point", coordinates: [-79.3839347, 43.6534817] }
      },
      {
        type: "Feature",
        properties: {
          osm_id: 12345,
          name: "Toronto Pearson International Airport",
          city: "Mississauga",
          state: "Ontario",
          country: "Canada",
          osm_value: "aerodrome"
        },
        geometry: { type: "Point", coordinates: [-79.6306, 43.6777] }
      },
      {
        type: "Feature",
        properties: {
          osm_id: 67890,
          name: "Toronto Islands",
          city: "Toronto",
          state: "Ontario",
          country: "Canada",
          osm_value: "island"
        },
        geometry: { type: "Point", coordinates: [-79.3733, 43.6205] }
      }
    ]
  };

  // Route handling - mock Photon API, allow localhost
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('photon.komoot.io')) {
      // Return mock response
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPhotonResponse)
      });
    } else if (url.includes('localhost') || url.includes('127.0.0.1')) {
      route.continue();
    } else {
      route.abort('blockedbyclient');
    }
  });

  await page.goto('http://localhost:9292/index-location.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Check if wrapper exists (autocomplete initialized)
  const wrapper = await page.$('.autocomplete-wrapper');
  console.log('Wrapper found:', wrapper !== null);

  // Click and type using keyboard
  await page.click('#location');
  await page.keyboard.type('Toronto', { delay: 50 });
  console.log('Typed "Toronto"');

  // Wait for debounce (300ms) + API response
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
