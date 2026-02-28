/**
 * Tests for Admin Merge page
 * Run by opening test.html in browser
 */

import { test, assertEqual, assertTruthy, assertFalsy, createContainer, destroyContainer } from './test-framework.js';
import {
  getMergeCandidates,
  getMergePreview,
  mergeRestaurants
} from './api.js';

// Mock fetch for testing
let originalFetch;
let mockResponses = {};

function setupMockFetch() {
  originalFetch = window.fetch;

  window.fetch = async (url, options) => {
    const key = `${options?.method || 'GET'} ${url}`;

    // Check for partial URL matches (query params may vary)
    for (const [mockKey, response] of Object.entries(mockResponses)) {
      if (key === mockKey || url.includes(mockKey.split(' ')[1])) {
        return {
          ok: response.ok !== false,
          status: response.status || 200,
          json: async () => response.body,
        };
      }
    }

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

// API Client Tests for merge endpoints

test('getMergeCandidates returns candidates array', async () => {
  setupMockFetch();
  mockResponse('GET', '/admin/merge-candidates', {
    data: [
      {
        duplicate: { id: 1, name: 'Pizza Place', external_ids: [{ source: 'tripadvisor' }] },
        potential_targets: [{ restaurant: { id: 2, name: 'Pizza Place Restaurant' }, similarity: 0.9 }],
        source: 'auto_detected'
      }
    ],
    meta: { count: 1 }
  });

  const result = await getMergeCandidates();

  assertTruthy(result.data, 'Should have data property');
  assertEqual(result.data.length, 1, 'Should have 1 candidate');
  assertEqual(result.data[0].duplicate.name, 'Pizza Place', 'Should have correct duplicate name');
  assertEqual(result.data[0].potential_targets[0].similarity, 0.9, 'Should have similarity score');

  teardownMockFetch();
});

test('getMergeCandidates with location filter', async () => {
  setupMockFetch();
  mockResponse('GET', '/admin/merge-candidates?location=barrie', {
    data: [],
    meta: { count: 0 }
  });

  const result = await getMergeCandidates({ location: 'barrie' });

  assertTruthy(result.data, 'Should have data property');
  assertEqual(result.data.length, 0, 'Should have 0 candidates for filtered location');

  teardownMockFetch();
});

test('getMergePreview returns preview data', async () => {
  setupMockFetch();
  mockResponse('GET', '/admin/merge-preview', {
    data: {
      duplicate: { id: 1, name: 'Pizza Place' },
      target: { id: 2, name: 'Pizza Place Restaurant' },
      similarity: 0.85,
      preview: {
        name: 'Pizza Place Restaurant',
        address: '123 Main St',
        combined_sources: ['yelp', 'google', 'tripadvisor'],
        combined_ratings: [{ source: 'yelp', score: 4.5, review_count: 100 }],
        combined_categories: ['Pizza', 'Italian'],
        media_count: 5,
        review_count: 3
      }
    }
  });

  const result = await getMergePreview(1, 2);

  assertTruthy(result.data, 'Should have data property');
  assertEqual(result.data.similarity, 0.85, 'Should have similarity score');
  assertTruthy(result.data.preview, 'Should have preview object');
  assertEqual(result.data.preview.combined_sources.length, 3, 'Should combine sources');
  assertEqual(result.data.preview.name, 'Pizza Place Restaurant', 'Preview should use target name');

  teardownMockFetch();
});

test('mergeRestaurants sends POST request', async () => {
  setupMockFetch();
  mockResponse('POST', '/admin/merge', {
    data: {
      merged: true,
      deleted_id: 1,
      restaurant: { id: 2, name: 'Pizza Place Restaurant' }
    }
  });

  const result = await mergeRestaurants(1, 2);

  assertTruthy(result.data, 'Should have data property');
  assertEqual(result.data.merged, true, 'Should indicate merge success');
  assertEqual(result.data.deleted_id, 1, 'Should indicate which restaurant was deleted');
  assertEqual(result.data.restaurant.id, 2, 'Should return the merged restaurant');

  teardownMockFetch();
});

test('mergeRestaurants handles API errors', async () => {
  setupMockFetch();
  mockResponse('POST', '/admin/merge', {
    error: { code: 'NOT_FOUND', message: 'Restaurant 999 not found' }
  }, false, 404);

  let caught = false;
  try {
    await mergeRestaurants(999, 2);
  } catch (error) {
    caught = true;
    assertTruthy(error.message.includes('not found'), 'Should include error message');
  }

  assertTruthy(caught, 'Should throw on API error');

  teardownMockFetch();
});
