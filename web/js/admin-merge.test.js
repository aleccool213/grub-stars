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

// ============================================================
// Helper: recreate escapeHtml from admin-merge.js (module-scoped)
// ============================================================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
// Helper: recreate restaurantSelectionCard rendering
// ============================================================
function simulateRestaurantSelectionCard(restaurant, role) {
  const borderColor = role === 'duplicate'
    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
    : 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20';
  const label = role === 'duplicate' ? 'Will be removed' : 'Will be kept';
  const labelColor = role === 'duplicate' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
  const sources = restaurant.external_ids?.map(e => e.source) || [];
  const ratings = restaurant.ratings || [];

  return `
    <div class="border ${borderColor} rounded-lg p-3 text-sm">
      <div class="flex items-start justify-between mb-1">
        <div>
          <span class="text-xs font-medium ${labelColor} uppercase tracking-wide">${label}</span>
          <p class="font-semibold text-cocoa dark:text-cream">
            ${escapeHtml(restaurant.name)}
            <span class="text-xs text-gray-400 dark:text-slate-500">#${restaurant.id}</span>
          </p>
        </div>
        <button type="button" class="text-gray-400 hover:text-red-500 cursor-pointer text-lg leading-none" data-action="clear-${role}" title="Clear selection">&times;</button>
      </div>
      <p class="text-gray-600 dark:text-slate-400 text-xs">${escapeHtml(restaurant.address || 'No address')}</p>
      <div class="flex flex-wrap gap-1 mt-1">
        ${sources.map(s => `<span class="tag tag-source">${escapeHtml(s)}</span>`).join('')}
      </div>
      ${ratings.length > 0 ? `
        <div class="flex flex-wrap gap-2 mt-1">
          ${ratings.filter(r => r.score > 0).map(r => `
            <span class="text-xs text-gray-500 dark:text-slate-400">${escapeHtml(r.source)}: ${r.score.toFixed(1)}</span>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================================
// Helper: recreate candidateCardHtml rendering
// ============================================================
function simulateCandidateCardHtml(candidate, index) {
  const { duplicate, potential_targets } = candidate;
  const bestMatch = potential_targets[0];
  const similarityPercent = (bestMatch.similarity * 100).toFixed(1);

  const dupSources = duplicate.external_ids?.map(e => e.source) || [];
  const targetSources = bestMatch.restaurant.external_ids?.map(e => e.source) || [];

  return `
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4" data-candidate-index="${index}">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
          ${similarityPercent}% match
        </span>
        <div class="flex gap-2">
          <button
            type="button"
            class="text-xs btn-primary cursor-pointer py-1 px-3"
            data-action="quick-merge"
            data-duplicate-id="${duplicate.id}"
            data-target-id="${bestMatch.restaurant.id}"
          >
            Merge
          </button>
          <button
            type="button"
            class="text-xs btn-secondary cursor-pointer py-1 px-3"
            data-action="preview-candidate"
            data-duplicate-id="${duplicate.id}"
            data-target-id="${bestMatch.restaurant.id}"
          >
            Preview
          </button>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <div class="text-xs text-red-500 dark:text-red-400 font-medium mb-1">Duplicate</div>
          <p class="font-medium text-cocoa dark:text-cream text-sm">${escapeHtml(duplicate.name)} <span class="text-xs text-gray-400">#${duplicate.id}</span></p>
          <p class="text-xs text-gray-500 dark:text-slate-400">${escapeHtml(duplicate.address || 'No address')}</p>
          <div class="flex flex-wrap gap-1 mt-1">
            ${dupSources.map(s => `<span class="tag tag-source">${escapeHtml(s)}</span>`).join('')}
          </div>
        </div>
        <div>
          <div class="text-xs text-green-500 dark:text-green-400 font-medium mb-1">Merge into</div>
          <p class="font-medium text-cocoa dark:text-cream text-sm">${escapeHtml(bestMatch.restaurant.name)} <span class="text-xs text-gray-400">#${bestMatch.restaurant.id}</span></p>
          <p class="text-xs text-gray-500 dark:text-slate-400">${escapeHtml(bestMatch.restaurant.address || 'No address')}</p>
          <div class="flex flex-wrap gap-1 mt-1">
            ${targetSources.map(s => `<span class="tag tag-source">${escapeHtml(s)}</span>`).join('')}
          </div>
        </div>
      </div>

      ${potential_targets.length > 1 ? `
        <p class="text-xs text-gray-400 dark:text-slate-500 mt-2">
          +${potential_targets.length - 1} other potential match${potential_targets.length > 2 ? 'es' : ''}
        </p>
      ` : ''}
    </div>
  `;
}

// ============================================================
// Helper: recreate mergePreviewHtml rendering
// ============================================================
function simulateMergePreviewHtml(data) {
  const { duplicate, target, similarity, preview } = data;

  const similarityPercent = (similarity * 100).toFixed(1);
  const similarityColor = similarity >= 0.85 ? 'text-green-600 dark:text-green-400'
    : similarity >= 0.6 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400';

  return `
    <div class="border-2 border-electric/30 rounded-xl p-5 bg-electric/5 dark:bg-electric/10">
      <div class="flex items-center justify-between mb-4">
        <h4 class="font-semibold text-cocoa dark:text-cream flex items-center gap-2">
          <span>📋</span> Merge Preview
        </h4>
        <span class="text-sm ${similarityColor} font-medium">
          ${similarityPercent}% name similarity
        </span>
      </div>
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="btn-primary cursor-pointer"
          data-action="merge"
          data-duplicate-id="${duplicate.id}"
          data-target-id="${target.id}"
        >
          Merge Restaurants
        </button>
        <button
          type="button"
          class="btn-secondary cursor-pointer"
          data-action="swap-merge"
        >
          Swap Direction
        </button>
      </div>
    </div>
  `;
}

// ============================================================
// Sample test data
// ============================================================
const sampleRestaurant = {
  id: 1,
  name: 'Test Bakery',
  address: '123 Main St',
  phone: '+15551234567',
  external_ids: [{ source: 'yelp', external_id: 'test-123' }],
  ratings: [{ source: 'yelp', score: 4.5, review_count: 100 }],
  categories: ['Bakeries'],
};

const sampleRestaurantTA = {
  id: 2,
  name: 'Test Bakery TA',
  address: '123 Main Street',
  phone: '+15551234568',
  external_ids: [{ source: 'tripadvisor', external_id: 'ta-456' }],
  ratings: [{ source: 'tripadvisor', score: 4.2, review_count: 50 }],
  categories: ['Bakeries'],
};

const sampleCandidate = {
  duplicate: sampleRestaurantTA,
  potential_targets: [
    { restaurant: sampleRestaurant, similarity: 0.92 },
  ],
  source: 'auto_detected',
};

const samplePreviewData = {
  duplicate: sampleRestaurantTA,
  target: sampleRestaurant,
  similarity: 0.92,
  preview: {
    name: 'Test Bakery',
    address: '123 Main St',
    combined_sources: ['yelp', 'tripadvisor'],
    combined_ratings: [
      { source: 'yelp', score: 4.5, review_count: 100 },
      { source: 'tripadvisor', score: 4.2, review_count: 50 },
    ],
    combined_categories: ['Bakeries'],
    media_count: 5,
    review_count: 3,
  },
};

// ============================================================
// API Client Tests
// ============================================================

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

test('getMergeCandidates returns empty data for empty result', async () => {
  setupMockFetch();
  mockResponse('GET', '/admin/merge-candidates', {
    data: [],
    meta: { count: 0 }
  });

  const result = await getMergeCandidates();

  assertEqual(result.data.length, 0, 'Should have 0 candidates');
  assertEqual(result.meta.count, 0, 'Meta count should be 0');

  teardownMockFetch();
});

test('getMergeCandidates returns multiple candidates', async () => {
  setupMockFetch();
  mockResponse('GET', '/admin/merge-candidates', {
    data: [
      {
        duplicate: { id: 1, name: 'Place A' },
        potential_targets: [{ restaurant: { id: 3, name: 'Place A Dup' }, similarity: 0.95 }],
      },
      {
        duplicate: { id: 2, name: 'Place B' },
        potential_targets: [{ restaurant: { id: 4, name: 'Place B Dup' }, similarity: 0.88 }],
      }
    ],
    meta: { count: 2 }
  });

  const result = await getMergeCandidates();

  assertEqual(result.data.length, 2, 'Should have 2 candidates');
  assertEqual(result.data[0].duplicate.id, 1, 'First candidate has id 1');
  assertEqual(result.data[1].duplicate.id, 2, 'Second candidate has id 2');

  teardownMockFetch();
});

// ============================================================
// UI Rendering Tests: restaurantSelectionCard
// ============================================================

test('admin-merge: selection card renders restaurant name', () => {
  const container = createContainer();
  container.innerHTML = simulateRestaurantSelectionCard(sampleRestaurant, 'duplicate');

  assertTruthy(container.textContent.includes('Test Bakery'), 'Should render restaurant name');

  destroyContainer(container);
});

test('admin-merge: selection card renders restaurant ID', () => {
  const container = createContainer();
  container.innerHTML = simulateRestaurantSelectionCard(sampleRestaurant, 'duplicate');

  assertTruthy(container.textContent.includes('#1'), 'Should render restaurant ID');

  destroyContainer(container);
});

test('admin-merge: selection card renders address', () => {
  const container = createContainer();
  container.innerHTML = simulateRestaurantSelectionCard(sampleRestaurant, 'duplicate');

  assertTruthy(container.textContent.includes('123 Main St'), 'Should render address');

  destroyContainer(container);
});

test('admin-merge: selection card shows "No address" when address missing', () => {
  const restaurant = { ...sampleRestaurant, address: null };
  const container = createContainer();
  container.innerHTML = simulateRestaurantSelectionCard(restaurant, 'target');

  assertTruthy(container.textContent.includes('No address'), 'Should show "No address" placeholder');

  destroyContainer(container);
});

test('admin-merge: duplicate selection card shows "Will be removed" label', () => {
  const container = createContainer();
  container.innerHTML = simulateRestaurantSelectionCard(sampleRestaurant, 'duplicate');

  assertTruthy(container.textContent.includes('Will be removed'), 'Should show "Will be removed"');
  assertTruthy(container.innerHTML.includes('text-red-600'), 'Should use red color for duplicate');

  destroyContainer(container);
});

test('admin-merge: target selection card shows "Will be kept" label', () => {
  const container = createContainer();
  container.innerHTML = simulateRestaurantSelectionCard(sampleRestaurant, 'target');

  assertTruthy(container.textContent.includes('Will be kept'), 'Should show "Will be kept"');
  assertTruthy(container.innerHTML.includes('text-green-600'), 'Should use green color for target');

  destroyContainer(container);
});

test('admin-merge: selection card renders source tags', () => {
  const container = createContainer();
  container.innerHTML = simulateRestaurantSelectionCard(sampleRestaurant, 'duplicate');

  assertTruthy(container.textContent.includes('yelp'), 'Should render yelp source tag');
  assertTruthy(container.querySelector('.tag-source'), 'Should have tag-source class');

  destroyContainer(container);
});

test('admin-merge: selection card renders ratings', () => {
  const container = createContainer();
  container.innerHTML = simulateRestaurantSelectionCard(sampleRestaurant, 'duplicate');

  assertTruthy(container.textContent.includes('4.5'), 'Should render rating score');

  destroyContainer(container);
});

test('admin-merge: selection card handles empty ratings', () => {
  const restaurant = { ...sampleRestaurant, ratings: [] };
  const container = createContainer();
  container.innerHTML = simulateRestaurantSelectionCard(restaurant, 'duplicate');

  // Should render without error
  assertTruthy(container.textContent.includes('Test Bakery'), 'Should still render name');

  destroyContainer(container);
});

test('admin-merge: selection card handles missing external_ids', () => {
  const restaurant = { ...sampleRestaurant, external_ids: undefined };
  const container = createContainer();
  container.innerHTML = simulateRestaurantSelectionCard(restaurant, 'duplicate');

  // Should render without error
  assertTruthy(container.textContent.includes('Test Bakery'), 'Should still render name');
  assertFalsy(container.querySelector('.tag-source'), 'Should have no source tags');

  destroyContainer(container);
});

test('admin-merge: selection card has clear button with correct action', () => {
  const container = createContainer();
  container.innerHTML = simulateRestaurantSelectionCard(sampleRestaurant, 'duplicate');

  const clearBtn = container.querySelector('[data-action="clear-duplicate"]');
  assertTruthy(clearBtn, 'Should have clear button with data-action');
  assertEqual(clearBtn.title, 'Clear selection', 'Should have accessible title');

  destroyContainer(container);
});

test('admin-merge: target selection card clear button uses correct action', () => {
  const container = createContainer();
  container.innerHTML = simulateRestaurantSelectionCard(sampleRestaurant, 'target');

  const clearBtn = container.querySelector('[data-action="clear-target"]');
  assertTruthy(clearBtn, 'Should have clear button with target action');

  destroyContainer(container);
});

test('admin-merge: selection card escapes HTML in name', () => {
  const restaurant = { ...sampleRestaurant, name: '<script>alert("xss")</script>' };
  const container = createContainer();
  container.innerHTML = simulateRestaurantSelectionCard(restaurant, 'duplicate');

  assertFalsy(container.querySelector('script'), 'Should not contain script tag');
  assertTruthy(container.textContent.includes('<script>'), 'Should show escaped text');

  destroyContainer(container);
});

// ============================================================
// UI Rendering Tests: candidateCardHtml
// ============================================================

test('admin-merge: candidate card renders duplicate name', () => {
  const container = createContainer();
  container.innerHTML = simulateCandidateCardHtml(sampleCandidate, 0);

  assertTruthy(container.textContent.includes('Test Bakery TA'), 'Should render duplicate name');

  destroyContainer(container);
});

test('admin-merge: candidate card renders target name', () => {
  const container = createContainer();
  container.innerHTML = simulateCandidateCardHtml(sampleCandidate, 0);

  assertTruthy(container.textContent.includes('Test Bakery'), 'Should render target name');

  destroyContainer(container);
});

test('admin-merge: candidate card renders similarity percentage', () => {
  const container = createContainer();
  container.innerHTML = simulateCandidateCardHtml(sampleCandidate, 0);

  assertTruthy(container.textContent.includes('92.0%'), 'Should render similarity as percentage');

  destroyContainer(container);
});

test('admin-merge: candidate card has merge button with correct data attributes', () => {
  const container = createContainer();
  container.innerHTML = simulateCandidateCardHtml(sampleCandidate, 0);

  const mergeBtn = container.querySelector('[data-action="quick-merge"]');
  assertTruthy(mergeBtn, 'Should have merge button');
  assertEqual(mergeBtn.dataset.duplicateId, '2', 'Should have correct duplicate ID');
  assertEqual(mergeBtn.dataset.targetId, '1', 'Should have correct target ID');

  destroyContainer(container);
});

test('admin-merge: candidate card has preview button', () => {
  const container = createContainer();
  container.innerHTML = simulateCandidateCardHtml(sampleCandidate, 0);

  const previewBtn = container.querySelector('[data-action="preview-candidate"]');
  assertTruthy(previewBtn, 'Should have preview button');
  assertEqual(previewBtn.dataset.duplicateId, '2', 'Preview button has correct duplicate ID');
  assertEqual(previewBtn.dataset.targetId, '1', 'Preview button has correct target ID');

  destroyContainer(container);
});

test('admin-merge: candidate card has data-candidate-index attribute', () => {
  const container = createContainer();
  container.innerHTML = simulateCandidateCardHtml(sampleCandidate, 3);

  const card = container.querySelector('[data-candidate-index="3"]');
  assertTruthy(card, 'Should have data-candidate-index attribute');

  destroyContainer(container);
});

test('admin-merge: candidate card renders source tags for both restaurants', () => {
  const container = createContainer();
  container.innerHTML = simulateCandidateCardHtml(sampleCandidate, 0);

  const sourceTags = container.querySelectorAll('.tag-source');
  assertEqual(sourceTags.length, 2, 'Should have 2 source tags (one per restaurant)');

  destroyContainer(container);
});

test('admin-merge: candidate card shows "Duplicate" and "Merge into" labels', () => {
  const container = createContainer();
  container.innerHTML = simulateCandidateCardHtml(sampleCandidate, 0);

  assertTruthy(container.textContent.includes('Duplicate'), 'Should show Duplicate label');
  assertTruthy(container.textContent.includes('Merge into'), 'Should show Merge into label');

  destroyContainer(container);
});

test('admin-merge: candidate card shows additional matches count', () => {
  const candidateMultiMatch = {
    ...sampleCandidate,
    potential_targets: [
      { restaurant: sampleRestaurant, similarity: 0.92 },
      { restaurant: { ...sampleRestaurant, id: 3, name: 'Another Match' }, similarity: 0.87 },
    ],
  };

  const container = createContainer();
  container.innerHTML = simulateCandidateCardHtml(candidateMultiMatch, 0);

  assertTruthy(container.textContent.includes('+1 other potential match'), 'Should show additional matches');

  destroyContainer(container);
});

test('admin-merge: candidate card pluralizes "matches" for 3+ targets', () => {
  const candidateMultiMatch = {
    ...sampleCandidate,
    potential_targets: [
      { restaurant: sampleRestaurant, similarity: 0.92 },
      { restaurant: { ...sampleRestaurant, id: 3 }, similarity: 0.87 },
      { restaurant: { ...sampleRestaurant, id: 4 }, similarity: 0.85 },
    ],
  };

  const container = createContainer();
  container.innerHTML = simulateCandidateCardHtml(candidateMultiMatch, 0);

  assertTruthy(container.textContent.includes('+2 other potential matches'), 'Should pluralize "matches"');

  destroyContainer(container);
});

test('admin-merge: candidate card does not show extra matches text for single target', () => {
  const container = createContainer();
  container.innerHTML = simulateCandidateCardHtml(sampleCandidate, 0);

  assertFalsy(container.textContent.includes('other potential'), 'Should not show extra matches text');

  destroyContainer(container);
});

test('admin-merge: candidate card handles missing address on duplicate', () => {
  const candidate = {
    duplicate: { ...sampleRestaurantTA, address: null },
    potential_targets: [{ restaurant: sampleRestaurant, similarity: 0.92 }],
  };
  const container = createContainer();
  container.innerHTML = simulateCandidateCardHtml(candidate, 0);

  assertTruthy(container.textContent.includes('No address'), 'Should show "No address" for null address');

  destroyContainer(container);
});

test('admin-merge: candidate card escapes HTML in restaurant names', () => {
  const candidate = {
    duplicate: { ...sampleRestaurantTA, name: '<img src=x onerror=alert(1)>' },
    potential_targets: [{ restaurant: sampleRestaurant, similarity: 0.92 }],
  };
  const container = createContainer();
  container.innerHTML = simulateCandidateCardHtml(candidate, 0);

  assertFalsy(container.querySelector('img'), 'Should not have img tag from name injection');

  destroyContainer(container);
});

// ============================================================
// UI Rendering Tests: mergePreviewHtml
// ============================================================

test('admin-merge: preview renders "Merge Preview" heading', () => {
  const container = createContainer();
  container.innerHTML = simulateMergePreviewHtml(samplePreviewData);

  assertTruthy(container.textContent.includes('Merge Preview'), 'Should show "Merge Preview" heading');

  destroyContainer(container);
});

test('admin-merge: preview renders similarity percentage', () => {
  const container = createContainer();
  container.innerHTML = simulateMergePreviewHtml(samplePreviewData);

  assertTruthy(container.textContent.includes('92.0%'), 'Should show similarity percentage');
  assertTruthy(container.textContent.includes('name similarity'), 'Should label it as name similarity');

  destroyContainer(container);
});

test('admin-merge: preview uses green for high similarity', () => {
  const container = createContainer();
  container.innerHTML = simulateMergePreviewHtml(samplePreviewData);

  assertTruthy(container.innerHTML.includes('text-green-600'), 'Should use green for >= 0.85 similarity');

  destroyContainer(container);
});

test('admin-merge: preview uses yellow for medium similarity', () => {
  const data = { ...samplePreviewData, similarity: 0.72 };
  const container = createContainer();
  container.innerHTML = simulateMergePreviewHtml(data);

  assertTruthy(container.innerHTML.includes('text-yellow-600'), 'Should use yellow for >= 0.6 similarity');

  destroyContainer(container);
});

test('admin-merge: preview uses red for low similarity', () => {
  const data = { ...samplePreviewData, similarity: 0.4 };
  const container = createContainer();
  container.innerHTML = simulateMergePreviewHtml(data);

  assertTruthy(container.innerHTML.includes('text-red-600'), 'Should use red for < 0.6 similarity');

  destroyContainer(container);
});

test('admin-merge: preview has merge button with correct data attributes', () => {
  const container = createContainer();
  container.innerHTML = simulateMergePreviewHtml(samplePreviewData);

  const mergeBtn = container.querySelector('[data-action="merge"]');
  assertTruthy(mergeBtn, 'Should have merge button');
  assertEqual(mergeBtn.dataset.duplicateId, '2', 'Should have correct duplicate ID');
  assertEqual(mergeBtn.dataset.targetId, '1', 'Should have correct target ID');
  assertTruthy(mergeBtn.textContent.includes('Merge Restaurants'), 'Should have correct button text');

  destroyContainer(container);
});

test('admin-merge: preview has swap direction button', () => {
  const container = createContainer();
  container.innerHTML = simulateMergePreviewHtml(samplePreviewData);

  const swapBtn = container.querySelector('[data-action="swap-merge"]');
  assertTruthy(swapBtn, 'Should have swap direction button');
  assertTruthy(swapBtn.textContent.includes('Swap Direction'), 'Should have correct button text');

  destroyContainer(container);
});

// ============================================================
// escapeHtml Tests
// ============================================================

test('admin-merge: escapeHtml escapes angle brackets', () => {
  const result = escapeHtml('<div>test</div>');
  assertTruthy(result.includes('&lt;'), 'Should escape <');
  assertTruthy(result.includes('&gt;'), 'Should escape >');
});

test('admin-merge: escapeHtml escapes ampersand', () => {
  const result = escapeHtml('A & B');
  assertTruthy(result.includes('&amp;'), 'Should escape &');
});

test('admin-merge: escapeHtml handles text with quotes', () => {
  const result = escapeHtml('"hello"');
  // textContent-based escaping preserves quotes since they are safe in text nodes
  // The important thing is that it doesn't break HTML structure
  assertTruthy(result.includes('hello'), 'Should preserve text content with quotes');
});

test('admin-merge: escapeHtml returns empty for null', () => {
  assertEqual(escapeHtml(null), '', 'Should return empty for null');
});

test('admin-merge: escapeHtml returns empty for undefined', () => {
  assertEqual(escapeHtml(undefined), '', 'Should return empty for undefined');
});

test('admin-merge: escapeHtml returns empty for empty string', () => {
  assertEqual(escapeHtml(''), '', 'Should return empty for empty string');
});

test('admin-merge: escapeHtml preserves normal text', () => {
  assertEqual(escapeHtml('Hello World'), 'Hello World', 'Should preserve normal text');
});
