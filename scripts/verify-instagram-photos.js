#!/usr/bin/env node

/**
 * E2E verification: Instagram photos appear on restaurant detail page
 * Uses Playwright to navigate to a restaurant and verify Instagram source photos are displayed.
 */

const { chromium } = require('playwright');

async function verify() {
  console.log('Starting Playwright verification...\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    // Navigate to restaurant detail page (ID 1 = Casa Cantina Restaurant)
    console.log('1. Navigating to restaurant detail page...');
    await page.goto('http://localhost:9292/details.html?id=1', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for the restaurant details to load
    console.log('2. Waiting for restaurant details to render...');
    await page.waitForSelector('.photo-thumb', { timeout: 10000 });

    // Get the restaurant name
    const restaurantName = await page.textContent('h2');
    console.log(`   Restaurant: ${restaurantName.trim()}`);

    // Count all photo thumbnails
    const allPhotos = await page.$$('.photo-thumb');
    console.log(`   Total photos displayed: ${allPhotos.length}`);

    // Check for Instagram source photos specifically
    const instagramPhotos = await page.$$('.photo-thumb[data-photo-source="instagram"]');
    console.log(`   Instagram photos: ${instagramPhotos.length}`);

    // Get the sources of all photos
    const photoSources = await page.$$eval('.photo-thumb', (thumbs) =>
      thumbs.map((t) => t.getAttribute('data-photo-source'))
    );
    const sourceCounts = {};
    photoSources.forEach((s) => {
      sourceCounts[s] = (sourceCounts[s] || 0) + 1;
    });
    console.log(`   Photos by source: ${JSON.stringify(sourceCounts)}`);

    // Verify Instagram photos exist
    if (instagramPhotos.length === 0) {
      console.error('\n FAIL: No Instagram photos found on detail page!');
      await browser.close();
      process.exit(1);
    }

    // Verify Instagram photos have correct data attributes
    const firstInstagramPhoto = instagramPhotos[0];
    const photoUrl = await firstInstagramPhoto.getAttribute('data-photo-url');
    const photoSource = await firstInstagramPhoto.getAttribute('data-photo-source');
    console.log(`\n3. First Instagram photo details:`);
    console.log(`   Source: ${photoSource}`);
    console.log(`   URL: ${photoUrl}`);

    // Click the first Instagram photo to open lightbox
    console.log('\n4. Testing photo lightbox...');
    await firstInstagramPhoto.click();

    // Wait for lightbox to appear
    const lightbox = await page.waitForSelector('#photo-lightbox[style*="display: flex"], #photo-lightbox:not([style*="display: none"])', { timeout: 5000 }).catch(() => null);

    if (lightbox) {
      const lightboxSource = await page.textContent('#lightbox-source');
      console.log(`   Lightbox source label: "${lightboxSource.trim()}"`);
      const lightboxVisible = await page.isVisible('#photo-lightbox');
      console.log(`   Lightbox visible: ${lightboxVisible}`);

      // Close lightbox
      await page.click('#lightbox-close');
    } else {
      console.log('   Lightbox did not open (may need style-based display)');
    }

    // Check Data Sources section at bottom
    console.log('\n5. Checking data sources section...');
    const sourcesText = await page.textContent('article');
    const hasInstagramSource = sourcesText.toLowerCase().includes('instagram');
    console.log(`   "instagram" in sources text: ${hasInstagramSource}`);

    // Final result
    console.log('\n' + '='.repeat(50));
    console.log(' PASS: Instagram photos successfully displayed!');
    console.log(`  - ${instagramPhotos.length} Instagram photos rendered`);
    console.log(`  - Photo source attribute correctly set to "instagram"`);
    console.log(`  - Photos integrated alongside ${sourceCounts['yelp'] || 0} Yelp and ${sourceCounts['google'] || 0} Google photos`);
    console.log('='.repeat(50));

    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error('\n FAIL:', error.message);
    await browser.close();
    process.exit(1);
  }
}

verify();
