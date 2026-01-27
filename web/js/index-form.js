/**
 * Index Form Controller
 * Handles the index location page functionality
 */

import { indexLocation } from './api.js';
import { loadingSpinner } from './components/loading-spinner.js';
import { errorMessage } from './components/error-message.js';
import { insertNavBar } from './components/nav-bar.js';
import { initAddressAutocomplete } from './components/address-autocomplete.js';

// DOM elements
let indexForm;
let locationInput;
let categoryInput;
let submitButton;
let resultsContainer;

// Autocomplete instance
let addressAutocomplete;

// Store selected location data (for future use with coordinates)
let selectedLocationData = null;

/**
 * Initialize the index form page
 */
function init() {
  // Insert navigation bar
  insertNavBar({ currentPage: 'index' });

  // Get DOM elements
  indexForm = document.getElementById('index-form');
  locationInput = document.getElementById('location');
  categoryInput = document.getElementById('category');
  submitButton = indexForm?.querySelector('button[type="submit"]');
  resultsContainer = document.getElementById('index-results');

  if (!indexForm || !resultsContainer) {
    console.error('Required elements not found on page');
    return;
  }

  // Initialize address autocomplete on location input
  if (locationInput) {
    addressAutocomplete = initAddressAutocomplete(locationInput, {
      onSelect: (suggestion) => {
        selectedLocationData = suggestion;
      },
    });
  }

  // Set up event listeners
  indexForm.addEventListener('submit', handleFormSubmit);

  // Add retry handler for error messages
  resultsContainer.addEventListener('click', handleRetryClick);
}

/**
 * Handle form submission
 * @param {Event} event - Form submit event
 */
async function handleFormSubmit(event) {
  event.preventDefault();

  const location = locationInput?.value.trim();
  const category = categoryInput?.value.trim() || null;

  if (!location) {
    showValidationError('Please enter a location.');
    return;
  }

  await performIndexing(location, category);
}

/**
 * Perform the indexing operation
 * @param {string} location - Location to index
 * @param {string|null} category - Optional category filter
 */
async function performIndexing(location, category) {
  // Disable form during indexing
  setFormDisabled(true);

  // Show loading state
  resultsContainer.innerHTML = loadingSpinner('Indexing restaurants... This may take a minute.');

  try {
    const response = await indexLocation(location, category);
    const stats = response.data || {};
    const meta = response.meta || {};

    showResults(stats, meta.location || location, meta.category || category);
  } catch (error) {
    console.error('Indexing error:', error);
    showError(error.message, error.code);
  } finally {
    // Re-enable form
    setFormDisabled(false);
  }
}

/**
 * Display indexing results
 * @param {Object} stats - Indexing statistics
 * @param {string} location - Location that was indexed
 * @param {string|null} category - Category filter used
 */
function showResults(stats, location, category) {
  const { total = 0, created = 0, updated = 0, merged = 0 } = stats;

  const categoryText = category
    ? `<span class="text-gray-500">(filtered by: ${escapeHtml(category)})</span>`
    : '';

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
        <p class="text-gray-700">
          <strong>Location:</strong> ${escapeHtml(location)} ${categoryText}
        </p>
      </div>

      <div class="bg-white rounded-lg p-4 mb-4">
        <p class="text-2xl font-bold text-gray-800 mb-2">${total} restaurants found</p>
        <ul class="text-gray-600 space-y-1">
          <li class="flex items-center">
            <span class="w-4 h-4 bg-green-500 rounded-full mr-2"></span>
            ${created} created (new)
          </li>
          <li class="flex items-center">
            <span class="w-4 h-4 bg-blue-500 rounded-full mr-2"></span>
            ${merged} merged (duplicates combined)
          </li>
          <li class="flex items-center">
            <span class="w-4 h-4 bg-yellow-500 rounded-full mr-2"></span>
            ${updated} updated (existing)
          </li>
        </ul>
      </div>

      <div class="flex flex-col sm:flex-row gap-3">
        <a
          href="/?location=${encodeURIComponent(location)}${category ? `&category=${encodeURIComponent(category)}` : ''}"
          class="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search in ${escapeHtml(location)}
        </a>
        <button
          type="button"
          class="inline-flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
          data-action="reset"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Index Another Location
        </button>
      </div>
    </div>
  `;

  // Add reset handler
  resultsContainer.querySelector('[data-action="reset"]')?.addEventListener('click', resetForm);
}

/**
 * Display error message with specific handling for known error codes
 * @param {string} message - Error message
 * @param {string} code - Error code
 */
function showError(message, code) {
  let displayMessage = message;
  let additionalInfo = '';

  // Provide helpful context for known error codes
  if (code === 'NO_ADAPTERS') {
    additionalInfo = `
      <p class="text-sm text-red-500 mt-2">
        Configure API keys in your <code class="bg-red-100 px-1 rounded">.env</code> file to enable indexing.
      </p>
    `;
  } else if (code === 'API_ERROR') {
    additionalInfo = `
      <p class="text-sm text-red-500 mt-2">
        The external API returned an error. Please try again later.
      </p>
    `;
  }

  resultsContainer.innerHTML = `
    ${errorMessage(displayMessage, { showRetry: true })}
    ${additionalInfo}
  `;
}

/**
 * Display validation error
 * @param {string} message - Validation error message
 */
function showValidationError(message) {
  resultsContainer.innerHTML = `
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <p class="text-yellow-700">${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Handle retry button clicks
 * @param {Event} event - Click event
 */
function handleRetryClick(event) {
  if (event.target.dataset.action === 'retry') {
    handleFormSubmit(new Event('submit'));
  }
}

/**
 * Reset the form and clear results
 */
function resetForm() {
  if (indexForm) {
    indexForm.reset();
  }
  if (resultsContainer) {
    resultsContainer.innerHTML = '';
  }
  // Clear autocomplete and selected data
  if (addressAutocomplete) {
    addressAutocomplete.clear();
  }
  selectedLocationData = null;
  if (locationInput) {
    locationInput.focus();
  }
}

/**
 * Enable or disable the form
 * @param {boolean} disabled - Whether to disable the form
 */
function setFormDisabled(disabled) {
  if (locationInput) locationInput.disabled = disabled;
  if (categoryInput) categoryInput.disabled = disabled;
  if (submitButton) {
    submitButton.disabled = disabled;
    submitButton.textContent = disabled ? 'Indexing...' : 'Start Indexing';
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
