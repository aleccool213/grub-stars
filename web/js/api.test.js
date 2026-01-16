/**
 * Tests for API client
 * Run by opening test.html in browser
 */

import { test, assert, assertEqual, assertTruthy } from './test-framework.js';
import { searchRestaurants, getRestaurant, getCategories, indexLocation } from './api.js';

// Mock fetch for testing
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

    // Fallback to real fetch if no mock
    return originalFetch(url, options);
  };
}

function teardownMockFetch() {
  window.fetch = originalFetch;
  mockResponses = {};
}

function mockResponse(method, url, body, ok = true, status = 200) {
  mockResponses[`${method} ${url}`] = { body, ok, status };
}

// API Client Tests

test('searchRestaurants returns data structure', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/search?name=pizza', {
    data: [{ id: 1, name: 'Pizza Place' }],
    meta: { count: 1, timestamp: '2024-01-15T00:00:00Z' }
  });

  const result = await searchRestaurants({ name: 'pizza' });

  assertTruthy(result.data, 'Should have data property');
  assertTruthy(result.meta, 'Should have meta property');
  assertEqual(result.data.length, 1, 'Should have 1 result');
  assertEqual(result.data[0].name, 'Pizza Place', 'Should have correct restaurant name');

  teardownMockFetch();
});

test('searchRestaurants by category', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/search?category=bakeries', {
    data: [{ id: 1, name: 'Bakery' }],
    meta: { count: 1 }
  });

  const result = await searchRestaurants({ category: 'bakeries' });

  assertEqual(result.data.length, 1);
  assertEqual(result.data[0].name, 'Bakery');

  teardownMockFetch();
});

test('searchRestaurants handles empty results', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/search?name=nonexistent', {
    data: [],
    meta: { count: 0 }
  });

  const result = await searchRestaurants({ name: 'nonexistent' });

  assertEqual(result.data.length, 0, 'Should return empty array');
  assertEqual(result.meta.count, 0, 'Count should be 0');

  teardownMockFetch();
});

test('searchRestaurants throws on API error', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/search?name=test', {
    error: { code: 'ERROR', message: 'Something went wrong' }
  }, false, 500);

  let errorThrown = false;
  try {
    await searchRestaurants({ name: 'test' });
  } catch (e) {
    errorThrown = true;
    assertTruthy(e.message.includes('Something went wrong'), 'Error message should be included');
  }

  assert(errorThrown, 'Should throw error on API failure');

  teardownMockFetch();
});

test('getRestaurant returns restaurant details', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/1', {
    data: {
      id: 1,
      name: 'Test Restaurant',
      address: '123 Main St',
      ratings: [],
      reviews: [],
      media: [],
      categories: []
    },
    meta: {}
  });

  const result = await getRestaurant(1);

  assertTruthy(result.data, 'Should have data');
  assertEqual(result.data.id, 1, 'Should have correct ID');
  assertEqual(result.data.name, 'Test Restaurant', 'Should have correct name');

  teardownMockFetch();
});

test('getRestaurant handles 404', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/999', {
    error: { code: 'NOT_FOUND', message: 'Restaurant not found' }
  }, false, 404);

  let errorThrown = false;
  try {
    await getRestaurant(999);
  } catch (e) {
    errorThrown = true;
  }

  assert(errorThrown, 'Should throw error for 404');

  teardownMockFetch();
});

test('getCategories returns category list', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/categories', {
    data: ['bakeries', 'restaurants', 'cafes'],
    meta: { count: 3 }
  });

  const result = await getCategories();

  assertEqual(result.data.length, 3, 'Should have 3 categories');
  assertTruthy(result.data.includes('bakeries'), 'Should include bakeries');

  teardownMockFetch();
});

test('indexLocation sends POST request', async () => {
  setupMockFetch();
  mockResponse('POST', 'http://localhost:9292/index', {
    data: { total: 5, created: 5, merged: 0 },
    meta: { location: 'barrie, ontario' }
  });

  const result = await indexLocation('barrie, ontario');

  assertEqual(result.data.total, 5, 'Should have indexed 5 restaurants');
  assertEqual(result.meta.location, 'barrie, ontario', 'Should have correct location');

  teardownMockFetch();
});

test('indexLocation with category filter', async () => {
  setupMockFetch();
  mockResponse('POST', 'http://localhost:9292/index', {
    data: { total: 3, created: 3, merged: 0 },
    meta: { location: 'barrie, ontario', category: 'bakery' }
  });

  const result = await indexLocation('barrie, ontario', 'bakery');

  assertEqual(result.data.total, 3);
  assertEqual(result.meta.category, 'bakery');

  teardownMockFetch();
});
