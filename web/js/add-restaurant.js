/**
 * Add Restaurant Page Controller
 * Handles searching external APIs and indexing individual restaurants
 */

import { getAdapters, searchExternal, indexSingleRestaurant } from './api.js';
import { loadingSpinner } from './components/loading-spinner.js';
import { errorMessage } from './components/error-message.js';
import { insertNavBar } from './components/nav-bar.js';
import { initAddressAutocomplete } from './components/address-autocomplete.js';

// DOM elements
let form;
let adapterSelect;
let locationInput;
let resultsContainer;
let searchBtn;

// Autocomplete instance
let addressAutocomplete;

// Store selected location data
let selectedLocationData = null;

/**
 * Initialize the page
 */
async function init() {
  // Insert navigation bar
  insertNavBar({ currentPage: 'add-restaurant' });

  // Get DOM elements
  form = document.getElementById('add-restaurant-form');
  adapterSelect = document.getElementById('search-adapter');
  locationInput = document.getElementById('search-location');
  resultsContainer = document.getElementById('search-results');
  searchBtn = document.getElementById('search-btn');

  // Initialize address autocomplete on location input
  if (locationInput) {
    addressAutocomplete = initAddressAutocomplete(locationInput, {
      onSelect: (suggestion) => {
        selectedLocationData = suggestion;
      },
    });
  }

  // Load available adapters
  await loadAdapters();

  // Set up form submission
  form.addEventListener('submit', handleSearch);

  // Check for pre-filled name from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const prefillName = urlParams.get('name');
  if (prefillName) {
    document.getElementById('restaurant-name').value = prefillName;
  }
}

/**
 * Load available adapters into the select dropdown
 */
async function loadAdapters() {
  try {
    const response = await getAdapters();
    const adapters = response.data || [];
    const configuredAdapters = adapters.filter(a => a.configured);

    if (configuredAdapters.length === 0) {
      adapterSelect.innerHTML = '<option value="">No adapters configured</option>';
      adapterSelect.disabled = true;
      searchBtn.disabled = true;
      resultsContainer.innerHTML = errorMessage(
        'No API adapters are configured. Please set up API keys in the .env file.'
      );
    } else {
      adapterSelect.innerHTML = configuredAdapters.map(a =>
        `<option value="${a.name}">${getAdapterLabel(a.name)}</option>`
      ).join('');
    }
  } catch (error) {
    console.error('Failed to load adapters:', error);
    adapterSelect.innerHTML = '<option value="">Failed to load</option>';
    resultsContainer.innerHTML = errorMessage('Failed to load available search adapters.');
  }
}

/**
 * Handle search form submission
 * @param {Event} event
 */
async function handleSearch(event) {
  event.preventDefault();

  const formData = new FormData(form);
  const name = formData.get('name')?.trim();
  const adapter = formData.get('adapter');
  const location = formData.get('location')?.trim();

  if (!name || name.length < 2) {
    resultsContainer.innerHTML = errorMessage('Please enter at least 2 characters for the restaurant name.');
    return;
  }

  if (!adapter) {
    resultsContainer.innerHTML = errorMessage('Please select a search adapter.');
    return;
  }

  // Show loading state
  resultsContainer.innerHTML = loadingSpinner(`Searching ${getAdapterLabel(adapter)}...`);
  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching...';

  try {
    const response = await searchExternal({ name, adapter, location });
    const results = response.data || [];

    renderResults(results, adapter, location);
  } catch (error) {
    console.error('Search error:', error);
    resultsContainer.innerHTML = errorMessage(error.message || 'Failed to search external API.');
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search External APIs';
  }
}

/**
 * Render search results
 * @param {Array} results - Array of restaurant results
 * @param {string} adapter - Adapter used
 * @param {string} location - Location searched
 */
function renderResults(results, adapter, location) {
  if (!results || results.length === 0) {
    resultsContainer.innerHTML = `
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <div class="text-gray-400 mb-2">
          <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p class="text-gray-600 mb-2">No restaurants found.</p>
        <p class="text-sm text-gray-500">Try a different name, location, or adapter.</p>
      </div>
    `;
    return;
  }

  const adapterLabel = getAdapterLabel(adapter);

  resultsContainer.innerHTML = `
    <div class="mb-4">
      <p class="text-sm text-cocoa/70">
        Found <strong>${results.length}</strong> results from <strong>${adapterLabel}</strong>
      </p>
    </div>
    <div class="space-y-4" id="results-list">
      ${results.map((result, index) => renderResultCard(result, index)).join('')}
    </div>
  `;

  // Set up index buttons
  initIndexButtons(results, adapter, location);
}

/**
 * Render a single result card
 * @param {Object} result - Restaurant data
 * @param {number} index - Index in results
 * @returns {string} - HTML string
 */
function renderResultCard(result, index) {
  const rating = result.rating ? `${result.rating.toFixed(1)} ★` : 'No rating';
  const reviewCount = result.review_count ? `(${result.review_count} reviews)` : '';
  const categories = (result.categories || []).slice(0, 3).join(', ') || 'Restaurant';
  const photoUrl = result.photos?.[0];

  return `
    <article
      class="result-card bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
      data-result-index="${index}"
    >
      <div class="flex gap-4">
        ${photoUrl ? `
          <div class="flex-shrink-0">
            <img
              src="${escapeHtml(photoUrl)}"
              alt="${escapeHtml(result.name)}"
              class="w-20 h-20 object-cover rounded-lg"
              onerror="this.style.display='none'"
            >
          </div>
        ` : ''}
        <div class="flex-grow min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h3 class="font-semibold text-gray-900 truncate">${escapeHtml(result.name)}</h3>
              <p class="text-sm text-gray-500 truncate">${escapeHtml(result.address || 'Address not available')}</p>
            </div>
            <div class="flex-shrink-0 text-right">
              <div class="text-sm font-medium text-amber-600">${rating}</div>
              <div class="text-xs text-gray-400">${reviewCount}</div>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-1">${escapeHtml(categories)}</p>
          <div class="mt-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              class="index-btn px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              data-result-index="${index}"
            >
              Index Restaurant
            </button>
            ${result.url ? `
              <a
                href="${escapeHtml(result.url)}"
                target="_blank"
                rel="noopener noreferrer"
                class="px-3 py-1.5 text-gray-500 text-sm hover:text-gray-700 hover:underline"
              >
                View on ${getAdapterLabel(result.source)} ↗
              </a>
            ` : ''}
          </div>
        </div>
      </div>
    </article>
  `;
}

/**
 * Initialize click handlers for index buttons
 * @param {Array} results - Search results
 * @param {string} adapter - Adapter used
 * @param {string} location - Location searched
 */
function initIndexButtons(results, adapter, location) {
  const buttons = resultsContainer.querySelectorAll('.index-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.resultIndex, 10);
      const result = results[index];

      if (!result) return;

      // Update button state
      btn.disabled = true;
      btn.textContent = 'Indexing...';
      btn.classList.remove('bg-green-600', 'hover:bg-green-700');
      btn.classList.add('bg-gray-400');

      try {
        const response = await indexSingleRestaurant(result, adapter, location || null);

        // Update button to success state
        btn.textContent = '✓ Indexed';
        btn.classList.remove('bg-gray-400');
        btn.classList.add('bg-green-500');

        // Add "View" link
        const viewLink = document.createElement('a');
        viewLink.href = `/details.html?id=${response.data.restaurant_id}`;
        viewLink.className = 'ml-2 text-sm text-blue-600 hover:underline';
        viewLink.textContent = 'View →';
        btn.parentNode.insertBefore(viewLink, btn.nextSibling);

      } catch (error) {
        console.error('Failed to index restaurant:', error);
        btn.disabled = false;
        btn.textContent = 'Failed - Retry';
        btn.classList.remove('bg-gray-400');
        btn.classList.add('bg-red-500', 'hover:bg-red-600');
      }
    });
  });
}

/**
 * Get display label for adapter
 * @param {string} adapter - Adapter name
 * @returns {string} - Display label
 */
function getAdapterLabel(adapter) {
  const labels = {
    yelp: 'Yelp',
    google: 'Google Maps',
    tripadvisor: 'TripAdvisor'
  };
  return labels[adapter] || adapter;
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
document.addEventListener('DOMContentLoaded', init);
