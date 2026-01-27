/**
 * Tests for API client
 * Run by opening test.html in browser
 */

import { test, assert, assertEqual, assertTruthy } from './test-framework.js';
import {
  searchRestaurants,
  getRestaurant,
  getCategories,
  indexLocation,
  getAdapters,
  searchExternal,
  indexSingleRestaurant,
  autocompleteRestaurants
} from './api.js';

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

// Adapters API Tests

test('getAdapters returns list of adapters', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/adapters', {
    data: [
      { name: 'yelp', configured: true },
      { name: 'google', configured: false },
      { name: 'tripadvisor', configured: true }
    ],
    meta: { count: 3, timestamp: '2024-01-15T00:00:00Z' }
  });

  const result = await getAdapters();

  assertTruthy(result.data, 'Should have data property');
  assertEqual(result.data.length, 3, 'Should have 3 adapters');
  assertEqual(result.data[0].name, 'yelp', 'First adapter should be yelp');
  assert(result.data[0].configured, 'Yelp should be configured');
  assert(!result.data[1].configured, 'Google should not be configured');
  assertEqual(result.meta.count, 3, 'Count should be 3');

  teardownMockFetch();
});

test('getAdapters handles empty adapters list', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/adapters', {
    data: [],
    meta: { count: 0 }
  });

  const result = await getAdapters();

  assertEqual(result.data.length, 0, 'Should return empty array');
  assertEqual(result.meta.count, 0, 'Count should be 0');

  teardownMockFetch();
});

// External Search API Tests

test('searchExternal returns external results', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/search-external?name=pizza&adapter=yelp', {
    data: [
      {
        external_id: 'yelp:pizza-123',
        source: 'yelp',
        name: 'Pizza Palace',
        address: '123 Main St',
        latitude: 44.389,
        longitude: -79.690,
        rating: 4.5,
        review_count: 100,
        categories: ['pizza', 'italian'],
        photos: ['https://example.com/photo.jpg'],
        url: 'https://yelp.com/biz/pizza-palace'
      }
    ],
    meta: { count: 1, adapter: 'yelp', query: 'pizza' }
  });

  const result = await searchExternal({ name: 'pizza', adapter: 'yelp' });

  assertTruthy(result.data, 'Should have data property');
  assertEqual(result.data.length, 1, 'Should have 1 result');
  assertEqual(result.data[0].name, 'Pizza Palace', 'Should have correct name');
  assertEqual(result.data[0].source, 'yelp', 'Should have correct source');
  assertEqual(result.data[0].rating, 4.5, 'Should have correct rating');
  assertTruthy(result.data[0].categories.includes('pizza'), 'Should have pizza category');
  assertEqual(result.meta.adapter, 'yelp', 'Meta should have adapter');
  assertEqual(result.meta.query, 'pizza', 'Meta should have query');

  teardownMockFetch();
});

test('searchExternal with location parameter', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/search-external?name=burger&adapter=google&location=barrie', {
    data: [{ name: 'Burger Joint', source: 'google' }],
    meta: { count: 1, adapter: 'google' }
  });

  const result = await searchExternal({ name: 'burger', adapter: 'google', location: 'barrie' });

  assertEqual(result.data.length, 1);
  assertEqual(result.data[0].name, 'Burger Joint');

  teardownMockFetch();
});

test('searchExternal handles empty results', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/search-external?name=nonexistent&adapter=yelp', {
    data: [],
    meta: { count: 0, adapter: 'yelp', query: 'nonexistent' }
  });

  const result = await searchExternal({ name: 'nonexistent', adapter: 'yelp' });

  assertEqual(result.data.length, 0, 'Should return empty array');
  assertEqual(result.meta.count, 0, 'Count should be 0');

  teardownMockFetch();
});

test('searchExternal throws on unconfigured adapter error', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/search-external?name=pizza&adapter=google', {
    error: { code: 'ADAPTER_NOT_CONFIGURED', message: 'Google adapter is not configured' }
  }, false, 503);

  let errorThrown = false;
  try {
    await searchExternal({ name: 'pizza', adapter: 'google' });
  } catch (e) {
    errorThrown = true;
    assertTruthy(e.message.includes('not configured'), 'Error should mention unconfigured');
    assertEqual(e.code, 'ADAPTER_NOT_CONFIGURED', 'Error code should match');
  }

  assert(errorThrown, 'Should throw error for unconfigured adapter');

  teardownMockFetch();
});

test('searchExternal throws on invalid adapter error', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/search-external?name=pizza&adapter=unknown', {
    error: { code: 'INVALID_ADAPTER', message: 'Unknown adapter: unknown' }
  }, false, 400);

  let errorThrown = false;
  try {
    await searchExternal({ name: 'pizza', adapter: 'unknown' });
  } catch (e) {
    errorThrown = true;
    assertEqual(e.code, 'INVALID_ADAPTER', 'Error code should be INVALID_ADAPTER');
  }

  assert(errorThrown, 'Should throw error for invalid adapter');

  teardownMockFetch();
});

// Index Single Restaurant API Tests

test('indexSingleRestaurant indexes restaurant successfully', async () => {
  setupMockFetch();
  mockResponse('POST', 'http://localhost:9292/restaurants/index-single', {
    data: {
      result: 'created',
      restaurant_id: 42,
      sources_indexed: ['yelp'],
      message: 'Restaurant indexed from 1 source(s)'
    },
    meta: { timestamp: '2024-01-15T00:00:00Z' }
  });

  const businessData = {
    external_id: 'yelp:test-123',
    name: 'Test Restaurant',
    address: '123 Test St',
    latitude: 44.389,
    longitude: -79.690,
    rating: 4.0,
    review_count: 50
  };

  const result = await indexSingleRestaurant(businessData, 'yelp');

  assertTruthy(result.data, 'Should have data property');
  assertEqual(result.data.restaurant_id, 42, 'Should return restaurant ID');
  assertTruthy(result.data.sources_indexed.includes('yelp'), 'Should include yelp in sources');
  assertTruthy(result.data.message.includes('1 source'), 'Message should mention source count');

  teardownMockFetch();
});

test('indexSingleRestaurant with location parameter', async () => {
  setupMockFetch();
  mockResponse('POST', 'http://localhost:9292/restaurants/index-single', {
    data: {
      result: 'created',
      restaurant_id: 43,
      sources_indexed: ['google', 'yelp'],
      message: 'Restaurant indexed from 2 source(s)'
    },
    meta: { timestamp: '2024-01-15T00:00:00Z' }
  });

  const businessData = {
    external_id: 'google:test-456',
    name: 'Another Restaurant',
    address: '456 Test St'
  };

  const result = await indexSingleRestaurant(businessData, 'google', 'barrie, ontario');

  assertEqual(result.data.restaurant_id, 43, 'Should return restaurant ID');
  assertEqual(result.data.sources_indexed.length, 2, 'Should have indexed from 2 sources');
  assertTruthy(result.data.sources_indexed.includes('google'), 'Should include google');
  assertTruthy(result.data.sources_indexed.includes('yelp'), 'Should include yelp');

  teardownMockFetch();
});

test('indexSingleRestaurant handles merge result', async () => {
  setupMockFetch();
  mockResponse('POST', 'http://localhost:9292/restaurants/index-single', {
    data: {
      result: 'merged',
      restaurant_id: 10,
      sources_indexed: ['tripadvisor'],
      message: 'Restaurant indexed from 1 source(s)'
    },
    meta: {}
  });

  const businessData = {
    external_id: 'tripadvisor:existing-789',
    name: 'Existing Restaurant'
  };

  const result = await indexSingleRestaurant(businessData, 'tripadvisor');

  assertEqual(result.data.result, 'merged', 'Result should be merged');
  assertEqual(result.data.restaurant_id, 10, 'Should return existing restaurant ID');

  teardownMockFetch();
});

test('indexSingleRestaurant throws on validation error', async () => {
  setupMockFetch();
  mockResponse('POST', 'http://localhost:9292/restaurants/index-single', {
    error: { code: 'INVALID_REQUEST', message: 'business_data is required' }
  }, false, 400);

  let errorThrown = false;
  try {
    await indexSingleRestaurant(null, 'yelp');
  } catch (e) {
    errorThrown = true;
    assertTruthy(e.message.includes('business_data'), 'Error should mention business_data');
    assertEqual(e.code, 'INVALID_REQUEST', 'Error code should be INVALID_REQUEST');
  }

  assert(errorThrown, 'Should throw error for missing business_data');

  teardownMockFetch();
});

test('indexSingleRestaurant throws on missing source', async () => {
  setupMockFetch();
  mockResponse('POST', 'http://localhost:9292/restaurants/index-single', {
    error: { code: 'INVALID_REQUEST', message: 'source is required' }
  }, false, 400);

  let errorThrown = false;
  try {
    await indexSingleRestaurant({ name: 'Test' }, null);
  } catch (e) {
    errorThrown = true;
    assertTruthy(e.message.includes('source'), 'Error should mention source');
  }

  assert(errorThrown, 'Should throw error for missing source');

  teardownMockFetch();
});

// Autocomplete API Tests

test('autocompleteRestaurants returns suggestions', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/autocomplete?q=piz&limit=10', {
    data: [
      { id: 1, name: 'Pizza Palace', address: '123 Main St', location: 'barrie', primary_category: 'pizza' },
      { id: 2, name: 'Pizza Hut', address: '456 Oak St', location: 'barrie', primary_category: 'pizza' }
    ],
    meta: { count: 2 }
  });

  const result = await autocompleteRestaurants('piz');

  assertTruthy(result.data, 'Should have data property');
  assertEqual(result.data.length, 2, 'Should have 2 suggestions');
  assertEqual(result.data[0].name, 'Pizza Palace', 'First suggestion should be Pizza Palace');
  assertEqual(result.meta.count, 2, 'Count should be 2');

  teardownMockFetch();
});

test('autocompleteRestaurants respects limit parameter', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/autocomplete?q=rest&limit=5', {
    data: [
      { id: 1, name: 'Restaurant A' },
      { id: 2, name: 'Restaurant B' },
      { id: 3, name: 'Restaurant C' }
    ],
    meta: { count: 3 }
  });

  const result = await autocompleteRestaurants('rest', 5);

  assertEqual(result.data.length, 3, 'Should return limited results');

  teardownMockFetch();
});

test('autocompleteRestaurants handles empty results', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/autocomplete?q=xyz&limit=10', {
    data: [],
    meta: { count: 0 }
  });

  const result = await autocompleteRestaurants('xyz');

  assertEqual(result.data.length, 0, 'Should return empty array');
  assertEqual(result.meta.count, 0, 'Count should be 0');

  teardownMockFetch();
});

test('autocompleteRestaurants throws on short query', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/restaurants/autocomplete?q=a&limit=10', {
    error: { code: 'INVALID_REQUEST', message: 'Query must be at least 2 characters' }
  }, false, 400);

  let errorThrown = false;
  try {
    await autocompleteRestaurants('a');
  } catch (e) {
    errorThrown = true;
    assertTruthy(e.message.includes('2 characters'), 'Error should mention minimum length');
  }

  assert(errorThrown, 'Should throw error for short query');

  teardownMockFetch();
});
