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
import { initSearchableSelect } from './components/searchable-select.js';

// DOM elements
let browseForm;
let searchNameInput;
let categorySelect;
let locationSelect;
let resultsContainer;
let onboardingContainer;

// State
let hasIndexedLocations = false;
let categorySearchable = null;
let locationSearchable = null;

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
 * Load categories into the searchable dropdown
 */
async function loadCategories() {
  if (!categorySelect) return;

  try {
    const response = await getCategories();
    const categories = response.data || [];

    // Initialize searchable select with categories
    categorySearchable = initSearchableSelect(categorySelect, {
      options: categories.map(cat => ({
        value: cat,
        label: cat,
        icon: '🍽️'
      })),
      placeholder: 'Search categories...',
      emptyMessage: 'No categories found',
      defaultIcon: '🍽️',
      allowEmpty: false
    });
  } catch (error) {
    console.error('Failed to load categories:', error);
    // Non-critical, continue without categories
  }
}

/**
 * Load locations into the searchable dropdown
 */
async function loadLocations() {
  if (!locationSelect) return;

  try {
    const response = await getLocations();
    const locations = response.data || [];

    // Track if there are any indexed locations
    hasIndexedLocations = locations.length > 0;

    // Initialize searchable select with locations
    locationSearchable = initSearchableSelect(locationSelect, {
      options: locations.map(loc => ({
        value: loc,
        label: loc,
        icon: '📍'
      })),
      placeholder: 'All locations',
      emptyMessage: 'No locations found',
      defaultIcon: '📍',
      allowEmpty: true,
      emptyLabel: 'All locations'
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
    if (category && categorySearchable) {
      categorySearchable.setValue(category);
    }
    if (location && locationSearchable) {
      locationSearchable.setValue(location);
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

  // Get values from searchable select components
  const params = {
    category: categorySearchable ? categorySearchable.getValue() : '',
    location: locationSearchable ? locationSearchable.getValue() : ''
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
 * Get display label for a sort option
 * @param {string} sort - Sort key from API meta
 * @returns {string} - Human-readable label
 */
function sortLabel(sort) {
  switch (sort) {
    case 'overall_rank': return 'Overall Rank';
    case 'relevance': return 'Relevance';
    default: return 'Overall Rank';
  }
}

/**
 * Build the sort info badge HTML
 * Uses inline styles because Twind hashes class names at runtime,
 * making dynamically inserted utility classes unreliable.
 * @param {string} sort - Sort key from API meta
 * @returns {string} - HTML string for the badge
 */
function sortBadge(sort) {
  const label = sortLabel(sort);
  const isDark = document.documentElement.classList.contains('dark');
  const bg = isDark ? 'rgba(168, 85, 247, 0.2)' : '#e9d5ff';
  const color = isDark ? '#c084fc' : '#6b21a8';

  return `<span style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; font-weight: 500; background-color: ${bg}; color: ${color}; padding: 0.25rem 0.625rem; border-radius: 9999px;">
      <svg style="width: 0.75rem; height: 0.75rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
      Sorted by: ${escapeHtml(label)}
    </span>`;
}

/**
 * Display search results
 * @param {Array} restaurants - Restaurant results
 * @param {Object} meta - Response metadata
 */
function showResults(restaurants, meta) {
  const count = meta.count || restaurants.length;
  const countText = count === 1 ? '1 restaurant found' : `${count} restaurants found`;
  const sort = meta.sort || 'overall_rank';

  const isDark = document.documentElement.classList.contains('dark');
  const countColor = isDark ? '#94a3b8' : '#4b5563';

  resultsContainer.innerHTML = `
    <div style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;">
      <p style="color: ${countColor}; margin: 0;">${countText}</p>
      ${sortBadge(sort)}
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
    <div class="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-8 text-center">
      <div class="text-gray-400 dark:text-slate-500 mb-4">
        <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-gray-700 dark:text-slate-200 mb-2">No restaurants found</h3>
      <p class="text-gray-500 dark:text-slate-400 mb-4">
        No results for ${escapeHtml(searchDescription)}.
      </p>
      <p class="text-sm text-gray-500 dark:text-slate-400">
        Try a different category,
        <a href="/index-location.html" class="text-blue-600 dark:text-blue-400 hover:underline">index a new location</a>,
        or <a href="/add-restaurant.html" class="text-blue-600 dark:text-blue-400 hover:underline">index a specific restaurant</a>.
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
    <div class="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-lg p-6 text-center">
      <p class="text-blue-700 dark:text-blue-400">${escapeHtml(message)}</p>
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
