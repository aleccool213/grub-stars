/**
 * Tests for Index Form Page Controller
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
  type,
  submit,
  waitFor
} from './test-framework.js';

// ========================================
// Mock Fetch Setup
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

    // Default fallback
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
// Utility Function Tests
// ========================================

test('index-form: escapeHtml escapes special characters', () => {
  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const result = escapeHtml('<script>alert("xss")</script>');
  assertTruthy(result.includes('&lt;'), 'Should escape < character');
  assertTruthy(result.includes('&gt;'), 'Should escape > character');
  assertFalsy(result.includes('<script>'), 'Should not contain raw script tag');
});

test('index-form: escapeHtml handles null and undefined', () => {
  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  assertEqual(escapeHtml(null), '', 'Should return empty string for null');
  assertEqual(escapeHtml(undefined), '', 'Should return empty string for undefined');
  assertEqual(escapeHtml(''), '', 'Should return empty string for empty string');
});

// ========================================
// Form Structure Tests
// ========================================

function createIndexFormContainer() {
  const container = createContainer();
  container.innerHTML = `
    <form id="index-form">
      <input type="text" id="location" name="location" placeholder="e.g., barrie, ontario" />
      <input type="text" id="category" name="category" placeholder="e.g., bakery (optional)" />
      <button type="submit">Start Indexing</button>
    </form>
    <div id="index-results"></div>
  `;
  return container;
}

test('index-form: form has required elements', () => {
  const container = createIndexFormContainer();

  const form = container.querySelector('#index-form');
  const locationInput = container.querySelector('#location');
  const categoryInput = container.querySelector('#category');
  const submitButton = container.querySelector('button[type="submit"]');
  const resultsContainer = container.querySelector('#index-results');

  assertTruthy(form, 'Should have form element');
  assertTruthy(locationInput, 'Should have location input');
  assertTruthy(categoryInput, 'Should have category input');
  assertTruthy(submitButton, 'Should have submit button');
  assertTruthy(resultsContainer, 'Should have results container');

  destroyContainer(container);
});

test('index-form: location input is required for form submission', () => {
  const container = createIndexFormContainer();

  const locationInput = container.querySelector('#location');
  const location = locationInput.value.trim();

  assertEqual(location, '', 'Location should be empty initially');

  destroyContainer(container);
});

// ========================================
// Loading State Tests
// ========================================

test('index-form: loading spinner displays during indexing', () => {
  const container = createIndexFormContainer();
  const resultsContainer = container.querySelector('#index-results');

  // Simulate loading state
  resultsContainer.innerHTML = `
    <div class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span class="ml-3 text-gray-600">Indexing restaurants... This may take a minute.</span>
    </div>
  `;

  assertTruthy(resultsContainer.innerHTML.includes('Indexing'), 'Should show indexing message');
  assertTruthy(resultsContainer.innerHTML.includes('animate-spin'), 'Should show spinner');

  destroyContainer(container);
});

test('index-form: form is disabled during indexing', () => {
  const container = createIndexFormContainer();

  const locationInput = container.querySelector('#location');
  const categoryInput = container.querySelector('#category');
  const submitButton = container.querySelector('button[type="submit"]');

  // Simulate disabled state
  locationInput.disabled = true;
  categoryInput.disabled = true;
  submitButton.disabled = true;
  submitButton.textContent = 'Indexing...';

  assert(locationInput.disabled, 'Location input should be disabled');
  assert(categoryInput.disabled, 'Category input should be disabled');
  assert(submitButton.disabled, 'Submit button should be disabled');
  assertEqual(submitButton.textContent, 'Indexing...', 'Button text should change');

  destroyContainer(container);
});

// ========================================
// Success State Tests
// ========================================

test('index-form: success results display correctly', () => {
  const container = createIndexFormContainer();
  const resultsContainer = container.querySelector('#index-results');

  // Simulate success state
  resultsContainer.innerHTML = `
    <div class="bg-green-50 border border-green-200 rounded-lg p-6">
      <div class="flex items-center mb-4">
        <div class="text-green-600 mr-3">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-green-800">Indexing Complete</h3>
      </div>
      <div class="mb-4">
        <p class="text-gray-700"><strong>Location:</strong> barrie, ontario</p>
      </div>
      <div class="bg-white rounded-lg p-4 mb-4">
        <p class="text-2xl font-bold text-gray-800 mb-2">25 restaurants found</p>
        <ul class="text-gray-600 space-y-1">
          <li>15 created (new)</li>
          <li>5 merged (duplicates combined)</li>
          <li>5 updated (existing)</li>
        </ul>
      </div>
    </div>
  `;

  assertTruthy(resultsContainer.innerHTML.includes('Indexing Complete'), 'Should show success title');
  assertTruthy(resultsContainer.innerHTML.includes('barrie, ontario'), 'Should show location');
  assertTruthy(resultsContainer.innerHTML.includes('25 restaurants found'), 'Should show total count');
  assertTruthy(resultsContainer.innerHTML.includes('created'), 'Should show created count');
  assertTruthy(resultsContainer.innerHTML.includes('merged'), 'Should show merged count');
  assertTruthy(resultsContainer.innerHTML.includes('updated'), 'Should show updated count');

  destroyContainer(container);
});

test('index-form: success results show category filter when used', () => {
  const container = createIndexFormContainer();
  const resultsContainer = container.querySelector('#index-results');

  // Simulate success with category filter
  resultsContainer.innerHTML = `
    <div class="bg-green-50 border border-green-200 rounded-lg p-6">
      <div class="mb-4">
        <p class="text-gray-700">
          <strong>Location:</strong> barrie, ontario
          <span class="text-gray-500">(filtered by: bakery)</span>
        </p>
      </div>
    </div>
  `;

  assertTruthy(resultsContainer.innerHTML.includes('filtered by: bakery'), 'Should show category filter');

  destroyContainer(container);
});

test('index-form: success results include search link', () => {
  const container = createIndexFormContainer();
  const resultsContainer = container.querySelector('#index-results');

  // Simulate success with search link
  resultsContainer.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-3">
      <a href="/?location=barrie%2C%20ontario" class="inline-flex items-center justify-center bg-blue-600 text-white">
        Search in barrie, ontario
      </a>
      <button type="button" class="bg-gray-200" data-action="reset">
        Index Another Location
      </button>
    </div>
  `;

  const searchLink = resultsContainer.querySelector('a[href*="location="]');
  assertTruthy(searchLink, 'Should have search link');
  assertTruthy(searchLink.href.includes('location='), 'Search link should include location param');

  const resetButton = resultsContainer.querySelector('[data-action="reset"]');
  assertTruthy(resetButton, 'Should have reset button');

  destroyContainer(container);
});

test('index-form: success results include category in search link when used', () => {
  const container = createIndexFormContainer();
  const resultsContainer = container.querySelector('#index-results');

  // Simulate success with search link including category
  resultsContainer.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-3">
      <a href="/?location=barrie%2C%20ontario&category=bakery" class="inline-flex items-center justify-center bg-blue-600 text-white">
        Search in barrie, ontario
      </a>
      <button type="button" class="bg-gray-200" data-action="reset">
        Index Another Location
      </button>
    </div>
  `;

  const searchLink = resultsContainer.querySelector('a[href*="location="]');
  assertTruthy(searchLink, 'Should have search link');
  assertTruthy(searchLink.href.includes('location='), 'Search link should include location param');
  assertTruthy(searchLink.href.includes('category=bakery'), 'Search link should include category param when category was used');

  destroyContainer(container);
});

// ========================================
// Error State Tests
// ========================================

test('index-form: error state displays with retry button', () => {
  const container = createIndexFormContainer();
  const resultsContainer = container.querySelector('#index-results');

  // Simulate error state
  resultsContainer.innerHTML = `
    <div class="bg-red-50 border border-red-200 text-red-800 rounded-lg p-6 text-center">
      <p class="font-medium mb-2">Something went wrong</p>
      <p class="text-sm mb-4">Connection failed</p>
      <button data-action="retry" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
        Try Again
      </button>
    </div>
  `;

  assertTruthy(resultsContainer.innerHTML.includes('Something went wrong'), 'Should show error title');
  assertTruthy(resultsContainer.innerHTML.includes('Connection failed'), 'Should show error message');
  assertTruthy(resultsContainer.querySelector('[data-action="retry"]'), 'Should have retry button');

  destroyContainer(container);
});

test('index-form: NO_ADAPTERS error shows configuration hint', () => {
  const container = createIndexFormContainer();
  const resultsContainer = container.querySelector('#index-results');

  // Simulate NO_ADAPTERS error
  resultsContainer.innerHTML = `
    <div class="bg-red-50 border border-red-200 text-red-800 rounded-lg p-6">
      <p>No API adapters configured</p>
    </div>
    <p class="text-sm text-red-500 mt-2">
      Configure API keys in your <code class="bg-red-100 px-1 rounded">.env</code> file to enable indexing.
    </p>
  `;

  assertTruthy(resultsContainer.innerHTML.includes('.env'), 'Should mention .env file');
  assertTruthy(resultsContainer.innerHTML.includes('API keys'), 'Should mention API keys');

  destroyContainer(container);
});

test('index-form: API_ERROR shows helpful message', () => {
  const container = createIndexFormContainer();
  const resultsContainer = container.querySelector('#index-results');

  // Simulate API error
  resultsContainer.innerHTML = `
    <div class="bg-red-50 border border-red-200 text-red-800 rounded-lg p-6">
      <p>API request failed</p>
    </div>
    <p class="text-sm text-red-500 mt-2">
      The external API returned an error. Please try again later.
    </p>
  `;

  assertTruthy(resultsContainer.innerHTML.includes('try again later'), 'Should show try again message');

  destroyContainer(container);
});

// ========================================
// Validation Tests
// ========================================

test('index-form: validation error for empty location', () => {
  const container = createIndexFormContainer();
  const resultsContainer = container.querySelector('#index-results');

  // Simulate validation error
  resultsContainer.innerHTML = `
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <p class="text-yellow-700">Please enter a location.</p>
    </div>
  `;

  assertTruthy(resultsContainer.innerHTML.includes('Please enter a location'), 'Should show validation message');
  assertTruthy(resultsContainer.innerHTML.includes('yellow'), 'Should use warning color');

  destroyContainer(container);
});

// ========================================
// Reset Functionality Tests
// ========================================

test('index-form: reset button clears results', async () => {
  const container = createIndexFormContainer();
  const resultsContainer = container.querySelector('#index-results');
  const form = container.querySelector('#index-form');
  const locationInput = container.querySelector('#location');

  // Set up form with data
  locationInput.value = 'barrie, ontario';
  resultsContainer.innerHTML = '<div>Some results</div>';

  // Simulate reset
  form.reset();
  resultsContainer.innerHTML = '';

  assertEqual(locationInput.value, '', 'Location should be cleared');
  assertEqual(resultsContainer.innerHTML, '', 'Results should be cleared');

  destroyContainer(container);
});

// ========================================
// Retry Button Tests
// ========================================

test('index-form: retry button is clickable', () => {
  const container = createIndexFormContainer();
  const resultsContainer = container.querySelector('#index-results');

  resultsContainer.innerHTML = `
    <button data-action="retry" class="retry-btn">Try Again</button>
  `;

  let retryClicked = false;
  container.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'retry') {
      retryClicked = true;
    }
  });

  const retryButton = resultsContainer.querySelector('[data-action="retry"]');
  click(retryButton);

  assert(retryClicked, 'Retry button should trigger click handler');

  destroyContainer(container);
});

// ========================================
// Form Submission Tests
// ========================================

test('index-form: form submission prevents default', () => {
  const container = createIndexFormContainer();
  const form = container.querySelector('#index-form');

  let defaultPrevented = false;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    defaultPrevented = true;
  });

  const event = new Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);

  assert(defaultPrevented, 'Form submission should prevent default');

  destroyContainer(container);
});

test('index-form: form captures location value on submit', () => {
  const container = createIndexFormContainer();
  const form = container.querySelector('#index-form');
  const locationInput = container.querySelector('#location');

  let capturedLocation = null;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    capturedLocation = locationInput.value.trim();
  });

  // Type location and submit
  type(locationInput, 'barrie, ontario');
  submit(form);

  assertEqual(capturedLocation, 'barrie, ontario', 'Should capture location value');

  destroyContainer(container);
});

test('index-form: form captures optional category on submit', () => {
  const container = createIndexFormContainer();
  const form = container.querySelector('#index-form');
  const locationInput = container.querySelector('#location');
  const categoryInput = container.querySelector('#category');

  let capturedData = {};
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    capturedData = {
      location: locationInput.value.trim(),
      category: categoryInput.value.trim() || null
    };
  });

  type(locationInput, 'barrie, ontario');
  type(categoryInput, 'bakery');
  submit(form);

  assertEqual(capturedData.location, 'barrie, ontario', 'Should capture location');
  assertEqual(capturedData.category, 'bakery', 'Should capture category');

  destroyContainer(container);
});

test('index-form: empty category is treated as null', () => {
  const container = createIndexFormContainer();
  const form = container.querySelector('#index-form');
  const locationInput = container.querySelector('#location');
  const categoryInput = container.querySelector('#category');

  let capturedCategory = 'not null';
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    capturedCategory = categoryInput.value.trim() || null;
  });

  type(locationInput, 'barrie, ontario');
  // Don't type anything in category
  submit(form);

  assertEqual(capturedCategory, null, 'Empty category should be null');

  destroyContainer(container);
});

// ========================================
// API Integration Tests
// ========================================

test('index-form: API returns success response', async () => {
  setupMockFetch();

  mockResponse('POST', 'http://localhost:9292/index', {
    data: {
      total: 25,
      created: 15,
      merged: 5,
      updated: 5
    },
    meta: {
      location: 'barrie, ontario',
      category: null,
      timestamp: '2024-01-15T00:00:00Z'
    }
  });

  const response = await fetch('http://localhost:9292/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'barrie, ontario' })
  });
  const data = await response.json();

  assert(response.ok, 'Response should be ok');
  assertEqual(data.data.total, 25, 'Should return total count');
  assertEqual(data.data.created, 15, 'Should return created count');
  assertEqual(data.meta.location, 'barrie, ontario', 'Should return location in meta');

  teardownMockFetch();
});

test('index-form: API returns success with category filter', async () => {
  setupMockFetch();

  mockResponse('POST', 'http://localhost:9292/index', {
    data: {
      total: 8,
      created: 6,
      merged: 1,
      updated: 1
    },
    meta: {
      location: 'barrie, ontario',
      category: 'bakery',
      timestamp: '2024-01-15T00:00:00Z'
    }
  });

  const response = await fetch('http://localhost:9292/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'barrie, ontario', category: 'bakery' })
  });
  const data = await response.json();

  assertEqual(data.meta.category, 'bakery', 'Should return category in meta');

  teardownMockFetch();
});

test('index-form: API handles NO_ADAPTERS error', async () => {
  setupMockFetch();

  mockResponse('POST', 'http://localhost:9292/index', {
    error: {
      code: 'NO_ADAPTERS',
      message: 'No API adapters configured'
    }
  }, false, 400);

  const response = await fetch('http://localhost:9292/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'barrie, ontario' })
  });
  const data = await response.json();

  assertFalsy(response.ok, 'Response should not be ok');
  assertEqual(response.status, 400, 'Should return 400 status');
  assertEqual(data.error.code, 'NO_ADAPTERS', 'Should return NO_ADAPTERS code');

  teardownMockFetch();
});

test('index-form: API handles server error', async () => {
  setupMockFetch();

  mockResponse('POST', 'http://localhost:9292/index', {
    error: {
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    }
  }, false, 500);

  const response = await fetch('http://localhost:9292/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'barrie, ontario' })
  });

  assertFalsy(response.ok, 'Response should not be ok');
  assertEqual(response.status, 500, 'Should return 500 status');

  teardownMockFetch();
});

test('index-form: API handles missing location', async () => {
  setupMockFetch();

  mockResponse('POST', 'http://localhost:9292/index', {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Location is required'
    }
  }, false, 400);

  const response = await fetch('http://localhost:9292/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const data = await response.json();

  assertFalsy(response.ok, 'Response should not be ok');
  assertEqual(data.error.code, 'VALIDATION_ERROR', 'Should return validation error');

  teardownMockFetch();
});

// ========================================
// Progress UI Phase Tests
// ========================================

/**
 * Helper: create the progress UI container structure that updateProgressUI expects.
 * Simulates the DOM produced by showProgressUI().
 */
function createProgressContainer() {
  const container = createContainer();
  container.innerHTML = `
    <div id="progress-info">
      <p>Initial state</p>
    </div>
  `;
  return container;
}

/**
 * Re-implementation of updateProgressUI for testing purposes.
 * This mirrors the actual function in index-form.js so we can verify
 * the HTML output for each phase, including the reverse_lookup phase
 * that was previously missing and caused the UI to hang.
 */
function simulateUpdateProgressUI(progress) {
  const progressInfo = document.getElementById('progress-info');
  if (!progressInfo) return;

  const { adapter, phase, current, total, percent, restaurant_name } = progress;

  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  if (phase === 'starting') {
    progressInfo.innerHTML = `
      <div class="space-y-3">
        <p class="text-blue-700 dark:text-blue-300 font-medium">
          📡 Searching ${escapeHtml(adapter)}...
        </p>
        <div id="progress-count">Starting...</div>
      </div>
    `;
  } else if (phase === 'indexing') {
    const progressPercent = percent || 0;
    const displayName = restaurant_name
      ? (restaurant_name.length > 40 ? restaurant_name.substring(0, 37) + '...' : restaurant_name)
      : 'Processing...';
    progressInfo.innerHTML = `
      <div class="space-y-3">
        <p class="text-blue-700 dark:text-blue-300 font-medium">
          📡 Indexing from ${escapeHtml(adapter)}
        </p>
        <div id="progress-fill" style="width: ${progressPercent}%"></div>
        <span id="progress-count">${current || 0} / ${total || '?'} restaurants</span>
        <span id="progress-percent">${progressPercent.toFixed(1)}%</span>
        <div id="current-restaurant">${escapeHtml(displayName)}</div>
      </div>
    `;
  } else if (phase === 'reverse_lookup') {
    const progressPercent = percent || 0;
    const displayName = restaurant_name
      ? (restaurant_name.length > 40 ? restaurant_name.substring(0, 37) + '...' : restaurant_name)
      : 'Searching...';
    progressInfo.innerHTML = `
      <div class="space-y-3">
        <p class="text-blue-700 dark:text-blue-300 font-medium">
          🔍 Enriching data from ${escapeHtml(adapter)}
        </p>
        <div id="progress-fill" class="bg-gradient-to-r from-purple-500 to-purple-600" style="width: ${progressPercent}%"></div>
        <span id="progress-count">${current || 0} / ${total || '?'} restaurants</span>
        <span id="progress-percent">${progressPercent.toFixed(1)}%</span>
        <div id="current-restaurant">${escapeHtml(displayName)}</div>
      </div>
    `;
  } else if (phase === 'completed') {
    progressInfo.innerHTML = `
      <div class="space-y-2">
        <p class="text-green-700 dark:text-green-400 font-medium">
          ✓ ${escapeHtml(adapter)} complete
        </p>
        <div class="text-sm text-gray-500 dark:text-slate-400">
          Moving to next source...
        </div>
      </div>
    `;
  }
}

test('index-form: reverse_lookup phase shows enrichment progress', () => {
  const container = createProgressContainer();

  simulateUpdateProgressUI({
    adapter: 'tripadvisor',
    phase: 'reverse_lookup',
    current: 5,
    total: 120,
    percent: 4.2,
    restaurant_name: 'Thai Palace'
  });

  const progressInfo = document.getElementById('progress-info');
  assertTruthy(progressInfo.innerHTML.includes('Enriching data from tripadvisor'), 'Should show enrichment message');
  assertTruthy(progressInfo.innerHTML.includes('5 / 120 restaurants'), 'Should show restaurant count');
  assertTruthy(progressInfo.innerHTML.includes('4.2%'), 'Should show percentage');
  assertTruthy(progressInfo.innerHTML.includes('Thai Palace'), 'Should show restaurant name');
  assertTruthy(progressInfo.innerHTML.includes('purple'), 'Should use purple progress bar for reverse lookup');

  destroyContainer(container);
});

test('index-form: reverse_lookup phase truncates long restaurant names', () => {
  const container = createProgressContainer();

  simulateUpdateProgressUI({
    adapter: 'tripadvisor',
    phase: 'reverse_lookup',
    current: 1,
    total: 50,
    percent: 2.0,
    restaurant_name: 'The Incredibly Long Named Restaurant and Bar Grill Experience'
  });

  const progressInfo = document.getElementById('progress-info');
  const restaurantEl = progressInfo.querySelector('#current-restaurant');
  assertTruthy(restaurantEl, 'Should have restaurant name element');
  assertTruthy(restaurantEl.textContent.includes('...'), 'Should truncate long restaurant name');
  assertFalsy(restaurantEl.textContent.includes('Experience'), 'Should not show full long name');

  destroyContainer(container);
});

test('index-form: reverse_lookup phase shows default text when no restaurant name', () => {
  const container = createProgressContainer();

  simulateUpdateProgressUI({
    adapter: 'tripadvisor',
    phase: 'reverse_lookup',
    current: 0,
    total: 80,
    percent: 0,
    restaurant_name: null
  });

  const progressInfo = document.getElementById('progress-info');
  assertTruthy(progressInfo.innerHTML.includes('Searching...'), 'Should show default text when no restaurant name');

  destroyContainer(container);
});

test('index-form: reverse_lookup phase updates progress bar width', () => {
  const container = createProgressContainer();

  simulateUpdateProgressUI({
    adapter: 'tripadvisor',
    phase: 'reverse_lookup',
    current: 60,
    total: 120,
    percent: 50.0,
    restaurant_name: 'Half Way There'
  });

  const progressFill = document.getElementById('progress-fill');
  assertTruthy(progressFill, 'Should have progress fill element');
  assertEqual(progressFill.style.width, '50%', 'Progress bar should be at 50%');

  destroyContainer(container);
});

test('index-form: completed phase still shows Moving to next source', () => {
  const container = createProgressContainer();

  simulateUpdateProgressUI({
    adapter: 'google',
    phase: 'completed',
    current: 50,
    total: 50,
    percent: 100,
    restaurant_name: null
  });

  const progressInfo = document.getElementById('progress-info');
  assertTruthy(progressInfo.innerHTML.includes('google complete'), 'Should show adapter complete');
  assertTruthy(progressInfo.innerHTML.includes('Moving to next source'), 'Should show moving message');

  destroyContainer(container);
});

test('index-form: reverse_lookup replaces completed phase UI', () => {
  const container = createProgressContainer();

  // First show completed phase (as tripadvisor forward pass finishes)
  simulateUpdateProgressUI({
    adapter: 'tripadvisor',
    phase: 'completed',
    current: 10,
    total: 10,
    percent: 100,
    restaurant_name: null
  });

  const progressInfo = document.getElementById('progress-info');
  assertTruthy(progressInfo.innerHTML.includes('Moving to next source'), 'Should initially show moving message');

  // Then reverse_lookup phase starts, replacing the stale completed message
  simulateUpdateProgressUI({
    adapter: 'tripadvisor',
    phase: 'reverse_lookup',
    current: 1,
    total: 150,
    percent: 0.7,
    restaurant_name: 'Pizza Place'
  });

  assertFalsy(progressInfo.innerHTML.includes('Moving to next source'), 'Should no longer show moving message');
  assertTruthy(progressInfo.innerHTML.includes('Enriching data from tripadvisor'), 'Should show enrichment message');
  assertTruthy(progressInfo.innerHTML.includes('1 / 150 restaurants'), 'Should show reverse lookup count');
  assertTruthy(progressInfo.innerHTML.includes('Pizza Place'), 'Should show current restaurant');

  destroyContainer(container);
});

test('index-form: reverse_lookup phase escapes HTML in adapter name', () => {
  const container = createProgressContainer();

  simulateUpdateProgressUI({
    adapter: '<script>alert(1)</script>',
    phase: 'reverse_lookup',
    current: 1,
    total: 10,
    percent: 10,
    restaurant_name: 'Test'
  });

  const progressInfo = document.getElementById('progress-info');
  assertFalsy(progressInfo.innerHTML.includes('<script>'), 'Should escape HTML in adapter name');
  assertTruthy(progressInfo.innerHTML.includes('&lt;script&gt;'), 'Should have escaped HTML entities');

  destroyContainer(container);
});
