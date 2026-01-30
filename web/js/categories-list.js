/**
 * Categories Page Controller
 * Displays all available restaurant categories with links to search
 */

import { getCategories } from './api.js';
import { loadingSpinner } from './components/loading-spinner.js';
import { errorMessage } from './components/error-message.js';
import { insertNavBar } from './components/nav-bar.js';

// DOM elements
let categoriesContainer;

/**
 * Initialize the categories page
 */
async function init() {
  // Insert navigation bar
  insertNavBar({ currentPage: 'categories' });

  categoriesContainer = document.getElementById('categories-list');

  if (!categoriesContainer) {
    console.error('Categories container not found on page');
    return;
  }

  // Add retry handler for error messages
  categoriesContainer.addEventListener('click', handleRetryClick);

  // Load and display categories
  await loadCategories();
}

/**
 * Load categories from API and display them
 */
async function loadCategories() {
  // Show loading state
  categoriesContainer.innerHTML = loadingSpinner('Loading categories...');

  try {
    const response = await getCategories();
    const categories = response.data || [];

    if (categories.length === 0) {
      showEmptyState();
    } else {
      showCategories(categories);
    }
  } catch (error) {
    console.error('Failed to load categories:', error);
    showError(error.message);
  }
}

/**
 * Display categories in a grid
 * @param {Array<string>} categories - List of category names
 */
function showCategories(categories) {
  const count = categories.length;
  const countText = count === 1 ? '1 category' : `${count} categories`;

  categoriesContainer.innerHTML = `
    <p class="text-gray-600 dark:text-slate-400 mb-4">${countText} available</p>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      ${categories.map(category => categoryCard(category)).join('')}
    </div>
  `;
}

/**
 * Generate HTML for a category card
 * @param {string} category - Category name
 * @returns {string} - HTML string
 */
function categoryCard(category) {
  const searchUrl = `/?category=${encodeURIComponent(category)}`;

  return `
    <a href="${searchUrl}"
       class="block p-4 bg-gray-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-600 rounded-lg text-center transition-colors duration-200">
      <span class="text-gray-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-slate-100 font-medium capitalize">${escapeHtml(category)}</span>
    </a>
  `;
}

/**
 * Display empty state when no categories exist
 */
function showEmptyState() {
  categoriesContainer.innerHTML = `
    <div class="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-8 text-center">
      <div class="text-gray-400 dark:text-slate-500 mb-4">
        <svg class="mx-auto" width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-gray-700 dark:text-slate-200 mb-2">No categories yet</h3>
      <p class="text-gray-500 dark:text-slate-400 mb-4">
        Categories appear after you index restaurant data from a location.
      </p>
      <a href="/index-location.html" class="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
        Index a Location
      </a>
    </div>
  `;
}

/**
 * Display error message
 * @param {string} message - Error message
 */
function showError(message) {
  categoriesContainer.innerHTML = errorMessage(message, { showRetry: true });
}

/**
 * Handle retry button clicks
 * @param {Event} event - Click event
 */
function handleRetryClick(event) {
  if (event.target.dataset.action === 'retry') {
    loadCategories();
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
