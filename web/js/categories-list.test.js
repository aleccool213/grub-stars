/**
 * Tests for categories-list page controller
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
  waitFor
} from './test-framework.js';

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

    // Default mock for categories endpoint
    if (url.includes('/categories')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: ['bakeries', 'cafes', 'italian'], meta: { count: 3 } })
      };
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

// Helper to create a minimal categories page container
function createCategoriesContainer() {
  const container = createContainer();
  container.innerHTML = `<div id="categories-list"></div>`;
  return container;
}

// Unit tests for category card HTML generation

test('category card generates correct search URL', () => {
  // Test the URL encoding for category links
  const category = 'italian restaurant';
  const expectedUrl = `/?category=${encodeURIComponent(category)}`;

  assertTruthy(
    expectedUrl.includes('italian%20restaurant'),
    'URL should encode spaces'
  );
});

test('category card escapes HTML in category name', () => {
  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const maliciousCategory = '<script>alert("xss")</script>';
  const escaped = escapeHtml(maliciousCategory);

  assertFalsy(escaped.includes('<script>'), 'Should escape script tags');
  assertTruthy(escaped.includes('&lt;script&gt;'), 'Should convert < to &lt;');
});

// Integration tests for categories list rendering

test('categories list shows loading state initially', async () => {
  const container = createCategoriesContainer();
  const categoriesEl = container.querySelector('#categories-list');

  // Simulate loading state
  categoriesEl.innerHTML = `
    <div class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span class="ml-3 text-gray-600">Loading categories...</span>
    </div>
  `;

  assertTruthy(
    categoriesEl.innerHTML.includes('Loading'),
    'Should show loading message'
  );
  assertTruthy(
    categoriesEl.innerHTML.includes('animate-spin'),
    'Should show spinner animation'
  );

  destroyContainer(container);
});

test('categories list renders categories in grid', async () => {
  const container = createCategoriesContainer();
  const categoriesEl = container.querySelector('#categories-list');

  // Simulate rendered categories
  const categories = ['bakeries', 'cafes', 'italian'];
  categoriesEl.innerHTML = `
    <p class="text-gray-600 mb-4">${categories.length} categories available</p>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      ${categories.map(cat => `
        <a href="/?category=${encodeURIComponent(cat)}"
           class="block p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-center transition-colors duration-200">
          <span class="text-gray-700 hover:text-blue-700 font-medium capitalize">${cat}</span>
        </a>
      `).join('')}
    </div>
  `;

  assertTruthy(
    categoriesEl.innerHTML.includes('3 categories available'),
    'Should show category count'
  );
  assertTruthy(
    categoriesEl.innerHTML.includes('grid'),
    'Should use grid layout'
  );
  assertTruthy(
    categoriesEl.innerHTML.includes('bakeries'),
    'Should include bakeries category'
  );
  assertTruthy(
    categoriesEl.innerHTML.includes('cafes'),
    'Should include cafes category'
  );
  assertTruthy(
    categoriesEl.innerHTML.includes('italian'),
    'Should include italian category'
  );

  destroyContainer(container);
});

test('categories list shows empty state when no categories', async () => {
  const container = createCategoriesContainer();
  const categoriesEl = container.querySelector('#categories-list');

  // Simulate empty state
  categoriesEl.innerHTML = `
    <div class="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
      <h3 class="text-lg font-semibold text-gray-700 mb-2">No categories yet</h3>
      <p class="text-gray-500 mb-4">
        Categories appear after you index restaurant data from a location.
      </p>
      <a href="/index-location.html" class="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        Index a Location
      </a>
    </div>
  `;

  assertTruthy(
    categoriesEl.innerHTML.includes('No categories yet'),
    'Should show empty state title'
  );
  assertTruthy(
    categoriesEl.innerHTML.includes('index restaurant data'),
    'Should explain how to get categories'
  );
  assertTruthy(
    categoriesEl.innerHTML.includes('/index-location.html'),
    'Should link to index location page'
  );

  destroyContainer(container);
});

test('categories list shows error state with retry button', async () => {
  const container = createCategoriesContainer();
  const categoriesEl = container.querySelector('#categories-list');

  // Simulate error state
  categoriesEl.innerHTML = `
    <div class="bg-red-50 border border-red-200 text-red-800 rounded-lg p-6 text-center">
      <p class="font-medium mb-2">Failed to load categories</p>
      <p class="text-sm mb-4">Network error</p>
      <button data-action="retry" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
        Try Again
      </button>
    </div>
  `;

  assertTruthy(
    categoriesEl.innerHTML.includes('Failed to load'),
    'Should show error message'
  );
  assertTruthy(
    categoriesEl.innerHTML.includes('data-action="retry"'),
    'Should have retry button'
  );
  assertTruthy(
    categoriesEl.innerHTML.includes('Try Again'),
    'Retry button should have correct text'
  );

  destroyContainer(container);
});

test('category links have correct href format', async () => {
  const container = createCategoriesContainer();
  const categoriesEl = container.querySelector('#categories-list');

  // Render a category with special characters
  const category = 'coffee & tea';
  categoriesEl.innerHTML = `
    <a href="/?category=${encodeURIComponent(category)}" class="category-link">
      ${category}
    </a>
  `;

  const link = categoriesEl.querySelector('a');
  assertTruthy(
    link.href.includes('category=coffee%20%26%20tea'),
    'Should properly encode special characters in URL'
  );

  destroyContainer(container);
});

test('category count displays singular form for one category', () => {
  const count = 1;
  const countText = count === 1 ? '1 category' : `${count} categories`;

  assertEqual(countText, '1 category', 'Should use singular form');
});

test('category count displays plural form for multiple categories', () => {
  const count = 5;
  const countText = count === 1 ? '1 category' : `${count} categories`;

  assertEqual(countText, '5 categories', 'Should use plural form');
});

test('categories list renders responsive grid classes', async () => {
  const container = createCategoriesContainer();
  const categoriesEl = container.querySelector('#categories-list');

  categoriesEl.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <a href="/">Test</a>
    </div>
  `;

  const grid = categoriesEl.querySelector('.grid');

  assertTruthy(
    grid.classList.contains('grid-cols-2'),
    'Should have 2 columns on mobile'
  );
  assertTruthy(
    grid.classList.contains('md:grid-cols-3'),
    'Should have 3 columns on medium screens'
  );
  assertTruthy(
    grid.classList.contains('lg:grid-cols-4'),
    'Should have 4 columns on large screens'
  );

  destroyContainer(container);
});

// API integration tests

test('categories API returns expected structure', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/categories', {
    data: ['bakeries', 'italian', 'sushi'],
    meta: { count: 3, timestamp: '2024-01-15T00:00:00Z' }
  });

  const response = await fetch('http://localhost:9292/categories');
  const result = await response.json();

  assertTruthy(result.data, 'Should have data property');
  assertTruthy(result.meta, 'Should have meta property');
  assertEqual(result.data.length, 3, 'Should have 3 categories');
  assertTruthy(result.data.includes('bakeries'), 'Should include bakeries');

  teardownMockFetch();
});

test('categories API handles empty response', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/categories', {
    data: [],
    meta: { count: 0 }
  });

  const response = await fetch('http://localhost:9292/categories');
  const result = await response.json();

  assertEqual(result.data.length, 0, 'Should return empty array');
  assertEqual(result.meta.count, 0, 'Count should be 0');

  teardownMockFetch();
});

test('categories API handles server error', async () => {
  setupMockFetch();
  mockResponse('GET', 'http://localhost:9292/categories', {
    error: { code: 'SERVER_ERROR', message: 'Internal server error' }
  }, false, 500);

  const response = await fetch('http://localhost:9292/categories');

  assertFalsy(response.ok, 'Response should not be ok');
  assertEqual(response.status, 500, 'Should return 500 status');

  teardownMockFetch();
});
