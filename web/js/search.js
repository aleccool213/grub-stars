/**
 * Search Page Controller
 * Handles the main search page functionality with two distinct search paths:
 * 1. Find a Restaurant - autocomplete by name, navigates directly to details
 * 2. Browse by Category - search by category with optional location filter
 */

import { searchRestaurants, getCategories, getLocations } from './api.js';
import { restaurantList } from './components/restaurant-card.js';
import { loadingSpinner } from './components/loading-spinner.js';
import { errorMessage } from './components/error-message.js';
import { insertNavBar } from './components/nav-bar.js';
import { initBookmarkButtons } from './components/bookmark-button.js';
import {
  onboardingBanner,
  noLocationsEmptyState,
  isOnboardingDismissed,
  initOnboardingBanner
} from './components/onboarding-banner.js';
import { initRestaurantAutocomplete } from './components/restaurant-autocomplete.js';

// DOM elements
let browseForm;
let searchNameInput;
let categorySelect;
let locationSelect;
let resultsContainer;
let onboardingContainer;

// State
let hasIndexedLocations = false;

/**
 * Initialize the search page
 */
async function init() {
  // Insert navigation bar
  insertNavBar({ currentPage: 'search' });

  // Get DOM elements
  browseForm = document.getElementById('browse-form');
  searchNameInput = document.getElementById('search-name');
  categorySelect = document.getElementById('search-category');
  locationSelect = document.getElementById('search-location');
  resultsContainer = document.getElementById('results');
  onboardingContainer = document.getElementById('onboarding-container');

  if (!resultsContainer) {
    console.error('Required elements not found on page');
    return;
  }

  // Set up browse form submission
  if (browseForm) {
    browseForm.addEventListener('submit', handleBrowse);
  }

  // Add retry handler for error messages
  resultsContainer.addEventListener('click', handleRetryClick);

  // Initialize restaurant name autocomplete
  // When user selects a restaurant, navigate directly to its details page
  if (searchNameInput) {
    initRestaurantAutocomplete(searchNameInput, {
      onSelect: (restaurant) => {
        window.location.href = `/details.html?id=${restaurant.id}`;
      }
    });
  }

  // Load categories and locations in parallel
  await Promise.all([
    loadCategories(),
    loadLocations()
  ]);

  // Show onboarding banner if not dismissed
  showOnboardingIfNeeded();

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

    // Track if there are any indexed locations
    hasIndexedLocations = locations.length > 0;

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
    hasIndexedLocations = false;
  }
}

/**
 * Show onboarding banner if not dismissed
 */
function showOnboardingIfNeeded() {
  if (!onboardingContainer) return;

  // Don't show if user has already dismissed onboarding
  if (isOnboardingDismissed()) return;

  // Show onboarding with appropriate CTA based on whether locations exist
  onboardingContainer.innerHTML = onboardingBanner({ hasLocations: hasIndexedLocations });
  initOnboardingBanner();
}

/**
 * Handle URL parameters for direct linking
 */
async function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');
  const location = params.get('location');

  // If browse params exist, populate form and search
  if (category || location) {
    if (category && categorySelect) categorySelect.value = category;
    if (location && locationSelect) {
      // Find matching option case-insensitively (API returns lowercase locations)
      const locationLower = location.toLowerCase();
      const matchingOption = Array.from(locationSelect.options).find(
        opt => opt.value.toLowerCase() === locationLower
      );
      if (matchingOption) {
        locationSelect.value = matchingOption.value;
      }
    }

    await performSearch({ category, location });
  }
}

/**
 * Handle browse form submission (category + location search)
 * @param {Event} event - Form submit event
 */
async function handleBrowse(event) {
  event.preventDefault();

  const formData = new FormData(browseForm);
  const params = {
    category: formData.get('category') || '',
    location: formData.get('location') || ''
  };

  // Validate: category is required
  if (!params.category) {
    showEmptyState('Please select a category to browse restaurants.');
    return;
  }

  // Update URL with search params
  updateUrl(params);

  await performSearch(params);
}

/**
 * Perform the search and display results
 * @param {Object} params - Search parameters
 */
async function performSearch(params) {
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

  // Initialize bookmark buttons
  initBookmarkButtons(resultsContainer);
}

/**
 * Display empty results message
 * @param {Object} params - Search parameters used
 */
function showEmptyResults(params) {
  // If no locations are indexed, show a more helpful message
  if (!hasIndexedLocations) {
    resultsContainer.innerHTML = noLocationsEmptyState();
    return;
  }

  const searchTerms = [];
  if (params.category) searchTerms.push(`category "${params.category}"`);
  if (params.location) searchTerms.push(`location "${params.location}"`);

  const searchDescription = searchTerms.join(' in ');

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
        Try a different category,
        <a href="/index-location.html" class="text-blue-600 hover:underline">index a new location</a>,
        or <a href="/add-restaurant.html" class="text-blue-600 hover:underline">index a specific restaurant</a>.
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
    handleBrowse(new Event('submit'));
  }
}

/**
 * Update URL with search parameters
 * @param {Object} params - Search parameters
 */
function updateUrl(params) {
  const url = new URL(window.location);

  // Clear existing params
  url.searchParams.delete('category');
  url.searchParams.delete('location');

  // Add non-empty params
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
