/**
 * Search Page Controller
 * Handles the main search page functionality
 */

import { searchRestaurants, getCategories, getLocations } from './api.js';
import { restaurantList } from './components/restaurant-card.js';
import { loadingSpinner } from './components/loading-spinner.js';
import { errorMessage } from './components/error-message.js';
import { insertNavBar } from './components/nav-bar.js';

// DOM elements
let searchForm;
let searchNameInput;
let categorySelect;
let locationSelect;
let resultsContainer;
let searchHint;
let searchHintText;

/**
 * Initialize the search page
 */
async function init() {
  // Insert navigation bar
  insertNavBar({ currentPage: 'search' });

  // Get DOM elements
  searchForm = document.getElementById('search-form');
  searchNameInput = document.getElementById('search-name');
  categorySelect = document.getElementById('search-category');
  locationSelect = document.getElementById('search-location');
  resultsContainer = document.getElementById('results');
  searchHint = document.getElementById('search-hint');
  searchHintText = document.getElementById('search-hint-text');

  if (!searchForm || !resultsContainer) {
    console.error('Required elements not found on page');
    return;
  }

  // Set up event listeners
  searchForm.addEventListener('submit', handleSearch);

  // Add retry handler for error messages
  resultsContainer.addEventListener('click', handleRetryClick);

  // Add input listeners for dynamic validation hints
  if (searchNameInput) searchNameInput.addEventListener('input', updateValidationHint);
  if (categorySelect) categorySelect.addEventListener('change', updateValidationHint);
  if (locationSelect) locationSelect.addEventListener('change', updateValidationHint);

  // Load categories and locations in parallel
  await Promise.all([
    loadCategories(),
    loadLocations()
  ]);

  // Show initial hint
  updateValidationHint();

  // Check URL for initial search parameters
  await handleUrlParams();
}

/**
 * Load categories into the dropdown
 */
async function loadCategories() {
  if (!categorySelect) return;

  try {
    const response = await getCategories();
    const categories = response.data || [];

    // Add categories to select
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categorySelect.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load categories:', error);
    // Non-critical, continue without categories
  }
}

/**
 * Load locations into the dropdown
 */
async function loadLocations() {
  if (!locationSelect) return;

  try {
    const response = await getLocations();
    const locations = response.data || [];

    // Add locations to select
    locations.forEach(location => {
      const option = document.createElement('option');
      option.value = location;
      option.textContent = location;
      locationSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load locations:', error);
    // Non-critical, continue without locations
  }
}

/**
 * Handle URL parameters for direct linking
 */
async function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('name');
  const category = params.get('category');
  const location = params.get('location');

  // If any search params exist, populate form and search
  if (name || category || location) {
    if (name && searchNameInput) searchNameInput.value = name;
    if (category && categorySelect) categorySelect.value = category;
    if (location && locationSelect) locationSelect.value = location;

    await performSearch({ name, category, location });
  }
}

/**
 * Handle search form submission
 * @param {Event} event - Form submit event
 */
async function handleSearch(event) {
  event.preventDefault();

  const formData = new FormData(searchForm);
  const params = {
    name: formData.get('name')?.trim() || '',
    category: formData.get('category') || '',
    location: formData.get('location') || ''
  };

  // Update URL with search params
  updateUrl(params);

  await performSearch(params);
}

/**
 * Update the validation hint based on current form state
 */
function updateValidationHint() {
  if (!searchHint || !searchHintText) return;

  const name = searchNameInput?.value?.trim() || '';
  const category = categorySelect?.value || '';
  const location = locationSelect?.value || '';

  // Determine what's filled in
  const hasName = name.length > 0;
  const hasCategory = category.length > 0;
  const hasLocation = location.length > 0;

  // Valid combinations:
  // - name (with or without location)
  // - category (with or without location)
  // - name + category (with or without location)
  const isValid = hasName || hasCategory;

  if (!hasName && !hasCategory && !hasLocation) {
    // Nothing filled in - show helpful hint
    searchHint.style.display = 'block';
    searchHint.className = 'text-sm rounded-lg p-3 transition-all bg-blue-50 border border-blue-200';
    searchHintText.innerHTML = '💡 <strong>Search by name or category</strong> (location is optional to filter results)';
  } else if (!isValid && hasLocation) {
    // Only location filled - show error hint
    searchHint.style.display = 'block';
    searchHint.className = 'text-sm rounded-lg p-3 transition-all bg-amber-50 border border-amber-200';
    searchHintText.innerHTML = '⚠️ Please enter a <strong>name</strong> or select a <strong>category</strong> to search. Location alone is not enough.';
  } else {
    // Valid combination - hide hint
    searchHint.style.display = 'none';
  }
}

/**
 * Perform the search and display results
 * @param {Object} params - Search parameters
 */
async function performSearch(params) {
  // Validate: name or category required (location is just a filter)
  if (!params.name && !params.category) {
    showEmptyState('Please enter a restaurant name or select a category to search. Location is optional to filter results.');
    return;
  }

  // Show loading state
  resultsContainer.innerHTML = loadingSpinner('Searching restaurants...');

  try {
    const response = await searchRestaurants(params);
    const restaurants = response.data || [];
    const meta = response.meta || {};

    if (restaurants.length === 0) {
      showEmptyResults(params);
    } else {
      showResults(restaurants, meta);
    }
  } catch (error) {
    console.error('Search error:', error);
    showError(error.message);
  }
}

/**
 * Display search results
 * @param {Array} restaurants - Restaurant results
 * @param {Object} meta - Response metadata
 */
function showResults(restaurants, meta) {
  const count = meta.count || restaurants.length;
  const countText = count === 1 ? '1 restaurant found' : `${count} restaurants found`;

  resultsContainer.innerHTML = `
    <div class="mb-4">
      <p class="text-gray-600">${countText}</p>
    </div>
    ${restaurantList(restaurants)}
  `;
}

/**
 * Display empty results message
 * @param {Object} params - Search parameters used
 */
function showEmptyResults(params) {
  const searchTerms = [];
  if (params.name) searchTerms.push(`name "${params.name}"`);
  if (params.category) searchTerms.push(`category "${params.category}"`);
  if (params.location) searchTerms.push(`location "${params.location}"`);

  const searchDescription = searchTerms.join(', ');

  resultsContainer.innerHTML = `
    <div class="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
      <div class="text-gray-400 mb-4">
        <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-gray-700 mb-2">No restaurants found</h3>
      <p class="text-gray-500 mb-4">
        No results for ${escapeHtml(searchDescription)}.
      </p>
      <p class="text-sm text-gray-500">
        Try adjusting your search terms or
        <a href="/index-location.html" class="text-blue-600 hover:underline">index a new location</a>.
      </p>
    </div>
  `;
}

/**
 * Display empty state (no search performed)
 * @param {string} message - Message to display
 */
function showEmptyState(message) {
  resultsContainer.innerHTML = `
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
      <p class="text-blue-700">${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Display error message
 * @param {string} message - Error message
 */
function showError(message) {
  resultsContainer.innerHTML = errorMessage(message, { showRetry: true });
}

/**
 * Handle retry button clicks
 * @param {Event} event - Click event
 */
function handleRetryClick(event) {
  if (event.target.dataset.action === 'retry') {
    handleSearch(new Event('submit'));
  }
}

/**
 * Update URL with search parameters
 * @param {Object} params - Search parameters
 */
function updateUrl(params) {
  const url = new URL(window.location);

  // Clear existing params
  url.searchParams.delete('name');
  url.searchParams.delete('category');
  url.searchParams.delete('location');

  // Add non-empty params
  if (params.name) url.searchParams.set('name', params.name);
  if (params.category) url.searchParams.set('category', params.category);
  if (params.location) url.searchParams.set('location', params.location);

  // Update URL without reload
  window.history.pushState({}, '', url);
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
