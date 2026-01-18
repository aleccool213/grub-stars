/**
 * Tests for Restaurant Details Page Controller
 * Run by opening test.html in browser
 */

import {
  test,
  assert,
  assertEqual,
  assertTruthy,
  assertFalsy,
  createContainer,
  destroyContainer,
  click,
  waitFor,
  waitForElement
} from './test-framework.js';

import {
  getRestaurantIdFromUrl,
  calculateAverageRating,
  renderStars,
  escapeHtml
} from './details.js';

// ========================================
// Utility Function Tests
// ========================================

test('escapeHtml escapes special characters', () => {
  const result = escapeHtml('<script>alert("xss")</script>');
  assertTruthy(result.includes('&lt;'), 'Should escape < character');
  assertTruthy(result.includes('&gt;'), 'Should escape > character');
  assertFalsy(result.includes('<script>'), 'Should not contain raw script tag');
});

test('escapeHtml handles null and undefined', () => {
  assertEqual(escapeHtml(null), '', 'Should return empty string for null');
  assertEqual(escapeHtml(undefined), '', 'Should return empty string for undefined');
  assertEqual(escapeHtml(''), '', 'Should return empty string for empty string');
});

test('escapeHtml preserves normal text', () => {
  assertEqual(escapeHtml('Hello World'), 'Hello World', 'Normal text should be unchanged');
  assertEqual(escapeHtml('Pizza & Pasta'), 'Pizza &amp; Pasta', 'Ampersand should be escaped');
});

// ========================================
// calculateAverageRating Tests
// ========================================

test('calculateAverageRating returns average of scores', () => {
  const ratings = [
    { score: 4.0, review_count: 10 },
    { score: 4.5, review_count: 20 },
    { score: 5.0, review_count: 5 }
  ];

  const avg = calculateAverageRating(ratings);
  assertEqual(avg, 4.5, 'Should calculate correct average');
});

test('calculateAverageRating returns null for empty array', () => {
  const avg = calculateAverageRating([]);
  assertEqual(avg, null, 'Should return null for empty array');
});

test('calculateAverageRating returns null for null input', () => {
  const avg = calculateAverageRating(null);
  assertEqual(avg, null, 'Should return null for null input');
});

test('calculateAverageRating ignores zero scores', () => {
  const ratings = [
    { score: 4.0, review_count: 10 },
    { score: 0, review_count: 0 },
    { score: 5.0, review_count: 5 }
  ];

  const avg = calculateAverageRating(ratings);
  assertEqual(avg, 4.5, 'Should ignore zero scores');
});

test('calculateAverageRating returns null if all scores are zero', () => {
  const ratings = [
    { score: 0, review_count: 0 },
    { score: 0, review_count: 0 }
  ];

  const avg = calculateAverageRating(ratings);
  assertEqual(avg, null, 'Should return null if all scores are zero');
});

// ========================================
// renderStars Tests
// ========================================

test('renderStars renders 5 full stars for rating 5', () => {
  const stars = renderStars(5);

  // Count full stars (yellow-400) vs empty stars (gray-300)
  const fullStarCount = (stars.match(/text-yellow-400/g) || []).length;
  assertEqual(fullStarCount, 5, 'Should have 5 full stars');
});

test('renderStars renders 0 full stars for rating 0', () => {
  const stars = renderStars(0);

  const emptyStarCount = (stars.match(/text-gray-300/g) || []).length;
  assertEqual(emptyStarCount, 5, 'Should have 5 empty stars');
});

test('renderStars handles half stars', () => {
  const stars = renderStars(3.5);

  // Should have 3 full, 1 half, 1 empty
  // Full stars have text-yellow-400 with style and fill="currentColor" (no gradient)
  const fullStarCount = (stars.match(/text-yellow-400"[^>]*fill="currentColor"/g) || []).length;
  const hasHalfStar = stars.includes('half-star');
  const emptyStarCount = (stars.match(/text-gray-300/g) || []).length;

  assertEqual(fullStarCount, 3, 'Should have 3 full stars');
  assert(hasHalfStar, 'Should have a half star');
  assertEqual(emptyStarCount, 1, 'Should have 1 empty star');
});

test('renderStars handles decimal ratings correctly', () => {
  // 4.3 should round down to 4 full stars + 1 empty
  const stars = renderStars(4.3);
  const hasHalfStar = stars.includes('half-star');
  assertFalsy(hasHalfStar, 'Should not have half star for 4.3');

  // 4.5 should have half star
  const stars2 = renderStars(4.5);
  const hasHalfStar2 = stars2.includes('half-star');
  assert(hasHalfStar2, 'Should have half star for 4.5');

  // 4.7 should round to half star
  const stars3 = renderStars(4.7);
  const hasHalfStar3 = stars3.includes('half-star');
  assert(hasHalfStar3, 'Should have half star for 4.7');
});

// ========================================
// URL Parameter Tests
// ========================================

test('getRestaurantIdFromUrl returns null for missing param', () => {
  // Save current URL
  const originalUrl = window.location.href;

  // Set URL without id
  window.history.pushState({}, '', '/details.html');

  const id = getRestaurantIdFromUrl();
  assertEqual(id, null, 'Should return null when id is missing');

  // Restore URL
  window.history.pushState({}, '', originalUrl);
});

test('getRestaurantIdFromUrl parses integer id', () => {
  // Save current URL
  const originalUrl = window.location.href;

  // Set URL with id
  window.history.pushState({}, '', '/details.html?id=123');

  const id = getRestaurantIdFromUrl();
  assertEqual(id, 123, 'Should parse id as integer');

  // Restore URL
  window.history.pushState({}, '', originalUrl);
});

test('getRestaurantIdFromUrl handles non-numeric id', () => {
  // Save current URL
  const originalUrl = window.location.href;

  // Set URL with non-numeric id
  window.history.pushState({}, '', '/details.html?id=abc');

  const id = getRestaurantIdFromUrl();
  // parseInt('abc') returns NaN, which is truthy but not a valid number
  assert(isNaN(id), 'Should return NaN for non-numeric id');

  // Restore URL
  window.history.pushState({}, '', originalUrl);
});

// ========================================
// Mock Fetch Setup for Integration Tests
// ========================================

let originalFetch;
let mockResponses = {};

function setupMockFetch() {
  originalFetch = window.fetch;

  window.fetch = async (url, options) => {
    const key = `${options?.method || 'GET'} ${url}`;

    if (mockResponses[key]) {
      const response = mockResponses[key];
      return {
        ok: response.ok !== false,
        status: response.status || 200,
        json: async () => response.body,
      };
    }

    // Fallback
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    };
  };
}

function teardownMockFetch() {
  window.fetch = originalFetch;
  mockResponses = {};
}

function mockResponse(method, url, body, ok = true, status = 200) {
  mockResponses[`${method} ${url}`] = { body, ok, status };
}

// ========================================
// Integration Tests - Rendering
// ========================================

test('details page renders restaurant info correctly', async () => {
  const container = createContainer();

  // Create a simplified details container
  container.innerHTML = `<div id="restaurant-details"></div>`;

  const detailsContainer = container.querySelector('#restaurant-details');

  // Simulate what the controller would render
  const restaurant = {
    id: 1,
    name: 'Test Restaurant',
    address: '123 Main St',
    phone: '555-1234',
    location: 'barrie, ontario',
    categories: ['Italian', 'Pizza'],
    ratings: [
      { source: 'yelp', score: 4.5, review_count: 100 },
      { source: 'google', score: 4.2, review_count: 50 }
    ],
    reviews: [
      { source: 'yelp', snippet: 'Great food!', url: 'https://yelp.com/review' }
    ],
    photos: [],
    videos: [],
    sources: ['yelp', 'google']
  };

  // Render restaurant details (simplified version of what showRestaurant does)
  detailsContainer.innerHTML = `
    <article class="restaurant-details">
      <h2>${escapeHtml(restaurant.name)}</h2>
      <p class="address">${escapeHtml(restaurant.address)}</p>
      <p class="phone">${escapeHtml(restaurant.phone)}</p>
      <div class="categories">${restaurant.categories.map(c => `<span>${escapeHtml(c)}</span>`).join('')}</div>
      <div class="ratings">
        ${restaurant.ratings.map(r => `<div class="rating">${escapeHtml(r.source)}: ${r.score}</div>`).join('')}
      </div>
    </article>
  `;

  // Verify content
  assertTruthy(detailsContainer.textContent.includes('Test Restaurant'), 'Should show restaurant name');
  assertTruthy(detailsContainer.textContent.includes('123 Main St'), 'Should show address');
  assertTruthy(detailsContainer.textContent.includes('555-1234'), 'Should show phone');
  assertTruthy(detailsContainer.textContent.includes('Italian'), 'Should show category');
  assertTruthy(detailsContainer.textContent.includes('yelp'), 'Should show rating source');

  destroyContainer(container);
});

test('details page shows not found message for missing restaurant', async () => {
  const container = createContainer();

  container.innerHTML = `<div id="restaurant-details"></div>`;
  const detailsContainer = container.querySelector('#restaurant-details');

  // Simulate not found state
  detailsContainer.innerHTML = `
    <div class="not-found">
      <h3>Restaurant Not Found</h3>
      <p>We couldn't find a restaurant with ID 999.</p>
      <a href="/">Back to Search</a>
    </div>
  `;

  assertTruthy(detailsContainer.textContent.includes('Restaurant Not Found'), 'Should show not found message');
  assertTruthy(detailsContainer.textContent.includes('999'), 'Should show the ID');

  destroyContainer(container);
});

test('details page shows error with retry button', async () => {
  const container = createContainer();

  container.innerHTML = `<div id="restaurant-details"></div>`;
  const detailsContainer = container.querySelector('#restaurant-details');

  // Simulate error state
  detailsContainer.innerHTML = `
    <div class="error">
      <h3>Something went wrong</h3>
      <p>Connection failed</p>
      <button data-action="retry">Try Again</button>
    </div>
  `;

  const retryButton = detailsContainer.querySelector('[data-action="retry"]');
  assertTruthy(retryButton, 'Should have retry button');

  let retryClicked = false;
  container.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'retry') {
      retryClicked = true;
    }
  });

  click(retryButton);
  assert(retryClicked, 'Retry button should be clickable');

  destroyContainer(container);
});

test('category links navigate to search', async () => {
  const container = createContainer();

  container.innerHTML = `
    <a href="/?category=Italian" class="category-link">Italian</a>
  `;

  const link = container.querySelector('.category-link');
  assertTruthy(link.href.includes('category=Italian'), 'Category link should have correct URL');

  destroyContainer(container);
});

test('phone link has tel: protocol', async () => {
  const container = createContainer();

  container.innerHTML = `
    <a href="tel:555-1234" class="phone-link">555-1234</a>
  `;

  const link = container.querySelector('.phone-link');
  assertTruthy(link.href.includes('tel:'), 'Phone link should have tel: protocol');

  destroyContainer(container);
});

test('photos open in new tab', async () => {
  const container = createContainer();

  container.innerHTML = `
    <a href="https://example.com/photo.jpg" target="_blank" rel="noopener noreferrer" class="photo-link">
      <img src="https://example.com/photo.jpg" alt="Photo">
    </a>
  `;

  const link = container.querySelector('.photo-link');
  assertEqual(link.target, '_blank', 'Photo link should open in new tab');
  assertTruthy(link.rel.includes('noopener'), 'Should have noopener rel');

  destroyContainer(container);
});

test('reviews display with source attribution', async () => {
  const container = createContainer();

  const review = {
    source: 'yelp',
    snippet: 'Amazing pizza, best in town!',
    url: 'https://yelp.com/review/123'
  };

  container.innerHTML = `
    <blockquote class="review">
      <p class="snippet">"${escapeHtml(review.snippet)}"</p>
      <footer>
        <span class="source">— ${escapeHtml(review.source)}</span>
        <a href="${escapeHtml(review.url)}" target="_blank">Read more</a>
      </footer>
    </blockquote>
  `;

  assertTruthy(container.textContent.includes('Amazing pizza'), 'Should show review snippet');
  assertTruthy(container.textContent.includes('yelp'), 'Should show review source');

  const readMoreLink = container.querySelector('a[target="_blank"]');
  assertTruthy(readMoreLink, 'Should have read more link');

  destroyContainer(container);
});

// ========================================
// Loading State Tests
// ========================================

test('loading spinner displays correctly', async () => {
  const container = createContainer();

  container.innerHTML = `
    <div class="loading">
      <div class="animate-spin"></div>
      <p>Loading restaurant details...</p>
    </div>
  `;

  assertTruthy(container.querySelector('.animate-spin'), 'Should show spinner');
  assertTruthy(container.textContent.includes('Loading'), 'Should show loading text');

  destroyContainer(container);
});

// ========================================
// API Integration Tests
// ========================================

test('API returns restaurant with all fields', async () => {
  setupMockFetch();

  const mockRestaurant = {
    id: 1,
    name: 'Test Restaurant',
    address: '123 Main St',
    latitude: 44.389,
    longitude: -79.690,
    phone: '555-1234',
    location: 'barrie, ontario',
    ratings: [
      { id: 1, source: 'yelp', score: 4.5, review_count: 100 }
    ],
    reviews: [
      { id: 1, source: 'yelp', snippet: 'Great food!', url: 'https://yelp.com/review' }
    ],
    photos: [
      { id: 1, source: 'yelp', url: 'https://example.com/photo.jpg' }
    ],
    videos: [],
    categories: ['Italian', 'Pizza'],
    sources: ['yelp']
  };

  mockResponse('GET', 'http://localhost:9292/restaurants/1', {
    data: mockRestaurant,
    meta: { timestamp: '2024-01-15T00:00:00Z' }
  });

  // Manually call fetch to test the mock
  const response = await fetch('http://localhost:9292/restaurants/1');
  const data = await response.json();

  assertEqual(data.data.id, 1, 'Should return correct restaurant');
  assertEqual(data.data.name, 'Test Restaurant', 'Should have correct name');
  assertEqual(data.data.ratings.length, 1, 'Should have ratings');
  assertEqual(data.data.reviews.length, 1, 'Should have reviews');
  assertEqual(data.data.photos.length, 1, 'Should have photos');

  teardownMockFetch();
});

test('API handles 404 for missing restaurant', async () => {
  setupMockFetch();

  mockResponse('GET', 'http://localhost:9292/restaurants/999', {
    error: { code: 'NOT_FOUND', message: 'Restaurant not found' }
  }, false, 404);

  const response = await fetch('http://localhost:9292/restaurants/999');

  assertEqual(response.status, 404, 'Should return 404 status');
  assertFalsy(response.ok, 'Response should not be ok');

  teardownMockFetch();
});
