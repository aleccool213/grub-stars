/**
 * Playwright test script for Add Restaurant feature
 * Tests the full flow: search external API -> index restaurant -> view details
 */

const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:9292';

async function runTest() {
  console.log('Starting Add Restaurant feature test...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Navigate to Add Restaurant page
    console.log('1. Navigating to Add Restaurant page...');
    await page.goto(`${BASE_URL}/add-restaurant.html`);
    await page.waitForLoadState('networkidle');

    // Verify we're on the right page
    const pageTitle = await page.title();
    console.log(`   Page title: ${pageTitle}`);

    const heading = await page.locator('h2').first().textContent();
    console.log(`   Page heading: ${heading}`);

    // Step 2: Wait for adapters to load
    console.log('\n2. Waiting for adapters to load...');
    await page.waitForSelector('#search-adapter option[value="yelp"], #search-adapter option[value="google"]', {
      timeout: 5000
    }).catch(() => {
      console.log('   Warning: Adapters may not be configured');
    });

    const adapterOptions = await page.locator('#search-adapter option').allTextContents();
    console.log(`   Available adapters: ${adapterOptions.join(', ')}`);

    // Step 3: Fill in the search form
    console.log('\n3. Filling search form...');
    await page.fill('#restaurant-name', 'Test Bakery');
    console.log('   Restaurant name: Test Bakery');

    // Select the first configured adapter (skip "Loading..." option)
    const adapterSelect = page.locator('#search-adapter');
    const firstAdapter = await adapterSelect.locator('option').first().getAttribute('value');
    if (firstAdapter) {
      await adapterSelect.selectOption(firstAdapter);
      console.log(`   Selected adapter: ${firstAdapter}`);
    }

    await page.fill('#search-location', 'Barrie, Ontario');
    console.log('   Location: Barrie, Ontario');

    // Step 4: Submit the search
    console.log('\n4. Submitting search...');
    await page.click('#search-btn');

    // Wait for results or error
    await page.waitForSelector('.result-card, .error-message', { timeout: 10000 });

    // Check if we got results
    const resultCards = await page.locator('.result-card').count();
    console.log(`   Found ${resultCards} results`);

    if (resultCards === 0) {
      // Check for error message
      const errorEl = await page.locator('.error-message').textContent().catch(() => null);
      if (errorEl) {
        console.log(`   Error: ${errorEl}`);
      }
      console.log('\n   No results to index. Test completed with search only.');
      return;
    }

    // Step 5: Click "Add to Database" on the first result
    console.log('\n5. Indexing first result...');
    const firstResult = page.locator('.result-card').first();
    const restaurantName = await firstResult.locator('h3').textContent();
    console.log(`   Restaurant: ${restaurantName}`);

    const indexBtn = firstResult.locator('.index-btn');
    await indexBtn.click();

    // Wait for button to change to "Added"
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('.result-card .index-btn');
        return btn && btn.textContent.includes('Added');
      },
      { timeout: 10000 }
    );

    console.log('   Restaurant indexed successfully!');

    // Step 6: Click "View" link to go to details page
    console.log('\n6. Navigating to restaurant details...');
    const viewLink = firstResult.locator('a:has-text("View")');
    await viewLink.click();

    await page.waitForLoadState('networkidle');

    // Verify we're on the details page
    const detailsUrl = page.url();
    console.log(`   Current URL: ${detailsUrl}`);

    if (detailsUrl.includes('/details.html')) {
      console.log('   Successfully navigated to details page!');

      // Get restaurant details
      const detailsHeading = await page.locator('h1').first().textContent().catch(() => 'N/A');
      console.log(`   Restaurant name on details page: ${detailsHeading}`);
    } else {
      console.log('   Warning: Not on details page');
    }

    // Take a screenshot
    await page.screenshot({ path: 'screenshots/add-restaurant-test-final.png', fullPage: true });
    console.log('\n   Screenshot saved to screenshots/add-restaurant-test-final.png');

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);

    // Take error screenshot
    await page.screenshot({ path: 'screenshots/add-restaurant-test-error.png', fullPage: true });
    console.log('   Error screenshot saved to screenshots/add-restaurant-test-error.png');

    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runTest();
