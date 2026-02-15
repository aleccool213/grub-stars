/**
 * Index Form Controller
 * Handles the index location page functionality
 */

import { indexLocationWithProgress } from './api.js';
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

// Track active EventSource for cancellation
let activeEventSource = null;

/**
 * Perform the indexing operation with real-time progress
 * @param {string} location - Location to index
 * @param {string|null} category - Optional category filter
 */
function performIndexing(location, category) {
  // Disable form during indexing
  setFormDisabled(true);

  // Show initial progress state
  showProgressUI(location, category);

  // Start SSE-based indexing with progress updates
  activeEventSource = indexLocationWithProgress(location, category, {
    onProgress: (progress) => {
      updateProgressUI(progress);
    },
    onComplete: (stats) => {
      activeEventSource = null;
      showResults(stats, location, category);
      setFormDisabled(false);
    },
    onError: (error) => {
      activeEventSource = null;
      console.error('Indexing error:', error);
      showError(error.message, error.code);
      setFormDisabled(false);
    }
  });
}

/**
 * Show the progress UI
 * @param {string} location - Location being indexed
 * @param {string|null} category - Category filter
 */
function showProgressUI(location, category) {
  const categoryText = category ? ` (${escapeHtml(category)})` : '';

  resultsContainer.innerHTML = `
    <div class="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-blue-700/50 rounded-lg p-6">
      <div class="flex items-center mb-4">
        <div class="animate-spin text-blue-600 dark:text-blue-400 mr-3">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-blue-800 dark:text-blue-300">
          Indexing ${escapeHtml(location)}${categoryText}
        </h3>
      </div>

      <!-- Progress info with progress bar -->
      <div id="progress-info" class="space-y-3">
        <div class="space-y-3">
          <p class="text-blue-700 dark:text-blue-300 font-medium">
            🔄 Initializing...
          </p>

          <!-- Progress bar container - visible immediately -->
          <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-4 border border-gray-300 dark:border-slate-600">
            <div
              id="progress-fill"
              class="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 h-4 rounded-full transition-all duration-300 ease-out"
              style="width: 0%"
            ></div>
          </div>

          <div class="flex justify-between text-sm font-medium text-gray-700 dark:text-slate-300">
            <span id="progress-count">Connecting to data sources...</span>
            <span id="progress-percent">0%</span>
          </div>

          <div id="current-restaurant" class="text-sm text-gray-500 dark:text-slate-400 truncate italic">
            Please wait while we search for restaurants in your area
          </div>
        </div>
      </div>

      <!-- Cancel button -->
      <div class="mt-4">
        <button
          type="button"
          id="cancel-indexing"
          class="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 underline"
        >
          Cancel
        </button>
      </div>
    </div>
  `;

  // Add cancel handler
  document.getElementById('cancel-indexing')?.addEventListener('click', cancelIndexing);
}

/**
 * Update the progress UI with current progress
 * @param {Object} progress - Progress data from SSE
 */
function updateProgressUI(progress) {
  const progressInfo = document.getElementById('progress-info');
  if (!progressInfo) return;

  const { adapter, phase, current, total, percent, restaurant_name } = progress;

  if (phase === 'starting') {
    // Show adapter starting message with empty progress bar
    progressInfo.innerHTML = `
      <div class="space-y-3">
        <p class="text-blue-700 dark:text-blue-300 font-medium">
          📡 Searching ${escapeHtml(adapter)}...
        </p>

        <!-- Progress bar container - always visible -->
        <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-4 border border-gray-300 dark:border-slate-600">
          <div
            id="progress-fill"
            class="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 h-4 rounded-full transition-all duration-300 ease-out"
            style="width: 0%"
          ></div>
        </div>

        <div class="flex justify-between text-sm font-medium text-gray-700 dark:text-slate-300">
          <span id="progress-count">Starting...</span>
          <span id="progress-percent">0%</span>
        </div>

        <div id="current-restaurant" class="text-sm text-gray-500 dark:text-slate-400 truncate italic">
          Connecting to data source...
        </div>
      </div>
    `;
  } else if (phase === 'indexing') {
    // Show progress bar and current restaurant
    const progressPercent = percent || 0;
    const displayName = restaurant_name
      ? (restaurant_name.length > 40 ? restaurant_name.substring(0, 37) + '...' : restaurant_name)
      : 'Processing...';

    progressInfo.innerHTML = `
      <div class="space-y-3">
        <p class="text-blue-700 dark:text-blue-300 font-medium">
          📡 Indexing from ${escapeHtml(adapter)}
        </p>

        <!-- Progress bar container -->
        <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-4 border border-gray-300 dark:border-slate-600">
          <div
            id="progress-fill"
            class="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 h-4 rounded-full transition-all duration-300 ease-out"
            style="width: ${progressPercent}%"
          ></div>
        </div>

        <div class="flex justify-between text-sm font-medium text-gray-700 dark:text-slate-300">
          <span id="progress-count">${current || 0} / ${total || '?'} restaurants</span>
          <span id="progress-percent">${progressPercent.toFixed(1)}%</span>
        </div>

        <div id="current-restaurant" class="text-sm text-gray-500 dark:text-slate-400 truncate italic">
          ${escapeHtml(displayName)}
        </div>
      </div>
    `;
  } else if (phase === 'reverse_lookup') {
    // Show reverse lookup progress (filling in missing data from adapters)
    const progressPercent = percent || 0;
    const displayName = restaurant_name
      ? (restaurant_name.length > 40 ? restaurant_name.substring(0, 37) + '...' : restaurant_name)
      : 'Searching...';

    progressInfo.innerHTML = `
      <div class="space-y-3">
        <p class="text-blue-700 dark:text-blue-300 font-medium">
          🔍 Enriching data from ${escapeHtml(adapter)}
        </p>

        <!-- Progress bar container -->
        <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-4 border border-gray-300 dark:border-slate-600">
          <div
            id="progress-fill"
            class="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500 h-4 rounded-full transition-all duration-300 ease-out"
            style="width: ${progressPercent}%"
          ></div>
        </div>

        <div class="flex justify-between text-sm font-medium text-gray-700 dark:text-slate-300">
          <span id="progress-count">${current || 0} / ${total || '?'} restaurants</span>
          <span id="progress-percent">${progressPercent.toFixed(1)}%</span>
        </div>

        <div id="current-restaurant" class="text-sm text-gray-500 dark:text-slate-400 truncate italic">
          ${escapeHtml(displayName)}
        </div>
      </div>
    `;
  } else if (phase === 'completed') {
    // Show adapter completed
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

/**
 * Cancel the current indexing operation
 */
function cancelIndexing() {
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }
  setFormDisabled(false);
  resultsContainer.innerHTML = `
    <div class="bg-yellow-50 dark:bg-slate-800 border border-yellow-200 dark:border-yellow-700/50 rounded-lg p-4">
      <p class="text-yellow-700 dark:text-yellow-300">Indexing cancelled.</p>
    </div>
  `;
}

/**
 * Display indexing results
 * @param {Object} stats - Indexing statistics
 * @param {string} location - Location that was indexed
 * @param {string|null} category - Category filter used
 */
function showResults(stats, location, category) {
  const {
    total = 0,
    created = 0,
    updated = 0,
    merged = 0,
    limit = 100,
    limit_reached = false,
    adapters = {},
    restaurants_created = [],
    restaurants_updated = [],
    restaurants_merged = []
  } = stats;

  const categoryText = category
    ? `<span class="text-gray-500 dark:text-slate-400">(filtered by: ${escapeHtml(category)})</span>`
    : '';

  // Show a notice if the limit was reached
  const limitNotice = limit_reached
    ? `<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg p-3 mb-4">
        <div class="flex items-start gap-2">
          <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="text-sm text-amber-700 dark:text-amber-300">
            <strong>Limit reached:</strong> There may be more restaurants in this area.
            The default limit is ${limit} restaurants per request to manage API costs.
          </p>
        </div>
      </div>`
    : '';

  // Build per-adapter breakdown HTML
  const adapterBreakdown = Object.keys(adapters).length > 0
    ? `
      <div class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
        <p class="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Per-source breakdown:</p>
        <div class="space-y-1">
          ${Object.entries(adapters).map(([source, s]) => `
            <div class="flex justify-between text-sm">
              <span class="text-purple-600 dark:text-purple-400 font-medium">${escapeHtml(source)}</span>
              <span class="text-gray-600 dark:text-slate-400">
                ${s.total} total (${s.created} new, ${s.merged} merged, ${s.updated} updated)
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    `
    : '';

  resultsContainer.innerHTML = `
    <div class="bg-green-50 dark:bg-slate-800 border border-green-200 dark:border-green-800/50 rounded-lg p-6">
      <div class="flex items-center mb-4">
        <div class="text-green-600 dark:text-green-400 mr-3">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-green-800 dark:text-green-300">Indexing Complete</h3>
      </div>

      <div class="mb-4">
        <p class="text-gray-700 dark:text-slate-200">
          <strong>Location:</strong> ${escapeHtml(location)} ${categoryText}
        </p>
      </div>

      ${limitNotice}

      <div class="bg-white dark:bg-slate-900 rounded-lg p-4 mb-4">
        <p class="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">${total} restaurants found</p>
        <ul class="text-gray-600 dark:text-slate-300 space-y-1">
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
        ${adapterBreakdown}
      </div>

      <!-- Collapsible restaurant lists -->
      ${renderRestaurantLists(restaurants_created, restaurants_merged, restaurants_updated)}

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
          class="inline-flex items-center justify-center bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 font-medium py-2 px-4 rounded-lg transition-colors"
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

  // Add reset handler and toggle handlers
  resultsContainer.querySelector('[data-action="reset"]')?.addEventListener('click', resetForm);
  resultsContainer.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.toggle;
      const target = document.getElementById(targetId);
      if (target) {
        const isHidden = target.style.display === 'none';
        target.style.display = isHidden ? 'block' : 'none';
        btn.querySelector('.toggle-icon')?.classList.toggle('rotate-180', isHidden);
      }
    });
  });
}

/**
 * Render collapsible restaurant lists
 * @param {Array} created - Newly created restaurants
 * @param {Array} merged - Merged restaurants
 * @param {Array} updated - Updated restaurants
 * @returns {string} - HTML string
 */
function renderRestaurantLists(created, merged, updated) {
  const hasAny = created.length > 0 || merged.length > 0 || updated.length > 0;
  if (!hasAny) return '';

  const renderList = (items, id, title, icon, colorClass) => {
    if (items.length === 0) return '';
    return `
      <div class="mb-3">
        <button
          type="button"
          data-toggle="${id}"
          class="flex items-center justify-between w-full text-left text-sm font-medium ${colorClass} p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        >
          <span>${icon} ${title} (${items.length})</span>
          <svg class="toggle-icon w-4 h-4 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div id="${id}" class="mt-2 pl-4 space-y-1" style="display: none;">
          ${items.slice(0, 50).map(r => `
            <div class="text-sm text-gray-600 dark:text-slate-400 py-1 border-b border-gray-100 dark:border-slate-700 last:border-0">
              <span class="font-medium text-gray-800 dark:text-slate-200">${escapeHtml(r.name)}</span>
              ${r.address ? `<span class="text-xs block text-gray-500 dark:text-slate-500 truncate">${escapeHtml(r.address)}</span>` : ''}
            </div>
          `).join('')}
          ${items.length > 50 ? `<p class="text-xs text-gray-500 dark:text-slate-500 italic">...and ${items.length - 50} more</p>` : ''}
        </div>
      </div>
    `;
  };

  return `
    <div class="mb-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3">
      <p class="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Restaurant details:</p>
      ${renderList(created, 'list-created', 'New restaurants', '🆕', 'text-green-700 dark:text-green-400')}
      ${renderList(merged, 'list-merged', 'Merged restaurants', '🔀', 'text-blue-700 dark:text-blue-400')}
      ${renderList(updated, 'list-updated', 'Updated restaurants', '📝', 'text-yellow-700 dark:text-yellow-400')}
    </div>
  `;
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
      <p class="text-sm text-red-500 dark:text-red-400 mt-2">
        Configure API keys in your <code class="bg-red-100 dark:bg-red-900/30 px-1 rounded">.env</code> file to enable indexing.
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
    <div class="bg-yellow-50 dark:bg-slate-800 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-4">
      <p class="text-yellow-700 dark:text-yellow-300">${escapeHtml(message)}</p>
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
