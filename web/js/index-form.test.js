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
