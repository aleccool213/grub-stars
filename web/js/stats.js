/**
 * Stats Page Controller
 * Displays application statistics including restaurant counts, API usage, and data coverage
 */

import { getStats } from './api.js';
import { loadingSpinner } from './components/loading-spinner.js';
import { errorMessage } from './components/error-message.js';
import { insertNavBar } from './components/nav-bar.js';

// DOM elements
let statsContainer;

/**
 * Initialize the stats page
 */
async function init() {
  // Insert navigation bar
  insertNavBar({ currentPage: 'stats' });

  statsContainer = document.getElementById('stats-container');

  if (!statsContainer) {
    console.error('Stats container not found on page');
    return;
  }

  // Add retry handler for error messages
  statsContainer.addEventListener('click', handleRetryClick);

  // Load and display stats
  await loadStats();
}

/**
 * Load stats from API and display them
 */
async function loadStats() {
  // Show loading state
  statsContainer.innerHTML = loadingSpinner('Loading statistics...');

  try {
    const response = await getStats();
    const stats = response.data || {};

    showStats(stats);
  } catch (error) {
    console.error('Failed to load stats:', error);
    showError(error.message);
  }
}

/**
 * Display statistics
 * @param {Object} stats - Statistics data
 */
function showStats(stats) {
  const { restaurants, api_usage, data_coverage } = stats;

  statsContainer.innerHTML = `
    <!-- Restaurant Stats Section -->
    <section class="mb-8">
      <h3 class="text-lg font-semibold text-cocoa dark:text-cream mb-4 flex items-center gap-2">
        <span>🍽️</span> Restaurant Statistics
      </h3>
      ${restaurantStatsHtml(restaurants)}
    </section>

    <!-- API Usage Section -->
    <section class="mb-8">
      <h3 class="text-lg font-semibold text-cocoa dark:text-cream mb-4 flex items-center gap-2">
        <span>📡</span> API Usage This Month
      </h3>
      ${apiUsageHtml(api_usage)}
    </section>

    <!-- Data Coverage Section -->
    <section>
      <h3 class="text-lg font-semibold text-cocoa dark:text-cream mb-4 flex items-center gap-2">
        <span>📈</span> Data Coverage
      </h3>
      ${dataCoverageHtml(data_coverage)}
    </section>
  `;
}

/**
 * Generate HTML for restaurant statistics
 * @param {Object} restaurants - Restaurant stats
 * @returns {string} - HTML string
 */
function restaurantStatsHtml(restaurants) {
  if (!restaurants) {
    return '<p class="text-gray-500 dark:text-slate-400">No restaurant data available</p>';
  }

  const { total, by_location } = restaurants;
  const locationEntries = Object.entries(by_location || {});

  return `
    <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 mb-4">
      <div class="text-3xl font-bold text-electric mb-1">${total || 0}</div>
      <div class="text-gray-600 dark:text-slate-400">Total Restaurants</div>
    </div>
    ${locationEntries.length > 0 ? `
      <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
        <h4 class="font-medium text-cocoa dark:text-cream mb-3">By Location</h4>
        <div class="space-y-2">
          ${locationEntries.map(([location, count]) => `
            <div class="flex justify-between items-center">
              <span class="text-gray-700 dark:text-slate-300 capitalize">${escapeHtml(location)}</span>
              <span class="font-medium text-cocoa dark:text-cream">${count}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : `
      <p class="text-gray-500 dark:text-slate-400">No locations indexed yet</p>
    `}
  `;
}

/**
 * Generate HTML for API usage statistics
 * @param {Object} apiUsage - API usage stats per adapter
 * @returns {string} - HTML string
 */
function apiUsageHtml(apiUsage) {
  if (!apiUsage) {
    return '<p class="text-gray-500 dark:text-slate-400">No API usage data available</p>';
  }

  const adapters = Object.entries(apiUsage);

  return `
    <div class="grid gap-4 md:grid-cols-3">
      ${adapters.map(([name, usage]) => adapterUsageCard(name, usage)).join('')}
    </div>
  `;
}

/**
 * Generate HTML for a single adapter usage card
 * @param {string} name - Adapter name
 * @param {Object} usage - Usage data
 * @returns {string} - HTML string
 */
function adapterUsageCard(name, usage) {
  const { requests_used, request_limit, remaining, percentage_used, days_until_reset } = usage;

  // Determine color based on usage percentage
  let progressColor = 'bg-green-500';
  let textColor = 'text-green-600 dark:text-green-400';
  if (percentage_used >= 90) {
    progressColor = 'bg-red-500';
    textColor = 'text-red-600 dark:text-red-400';
  } else if (percentage_used >= 70) {
    progressColor = 'bg-yellow-500';
    textColor = 'text-yellow-600 dark:text-yellow-400';
  }

  const limitDisplay = request_limit ? request_limit.toLocaleString() : 'Unlimited';
  const remainingDisplay = remaining !== null ? remaining.toLocaleString() : 'N/A';
  const resetDisplay = days_until_reset !== null ? `${days_until_reset} days` : 'N/A';

  return `
    <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
      <h4 class="font-medium text-cocoa dark:text-cream mb-3 capitalize">${escapeHtml(name)}</h4>

      <!-- Progress bar -->
      <div class="mb-3">
        <div class="flex justify-between text-sm mb-1">
          <span class="text-gray-600 dark:text-slate-400">Used</span>
          <span class="${textColor} font-medium">${percentage_used}%</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
          <div class="${progressColor} h-2 rounded-full transition-all duration-300" style="width: ${Math.min(percentage_used, 100)}%"></div>
        </div>
      </div>

      <!-- Stats -->
      <div class="space-y-1 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-600 dark:text-slate-400">Requests</span>
          <span class="text-cocoa dark:text-cream">${requests_used.toLocaleString()} / ${limitDisplay}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600 dark:text-slate-400">Remaining</span>
          <span class="text-cocoa dark:text-cream">${remainingDisplay}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600 dark:text-slate-400">Resets in</span>
          <span class="text-cocoa dark:text-cream">${resetDisplay}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate HTML for data coverage statistics
 * @param {Object} dataCoverage - Data coverage stats
 * @returns {string} - HTML string
 */
function dataCoverageHtml(dataCoverage) {
  if (!dataCoverage) {
    return '<p class="text-gray-500 dark:text-slate-400">No data coverage information available</p>';
  }

  const {
    total_restaurants,
    with_all_sources,
    with_multiple_sources,
    with_single_source,
    by_source,
    configured_adapters
  } = dataCoverage;

  const allSourcesPercentage = total_restaurants > 0
    ? ((with_all_sources / total_restaurants) * 100).toFixed(1)
    : 0;

  return `
    <!-- Coverage Overview -->
    <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 mb-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div>
          <div class="text-2xl font-bold text-electric">${total_restaurants}</div>
          <div class="text-sm text-gray-600 dark:text-slate-400">Total</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">${with_all_sources}</div>
          <div class="text-sm text-gray-600 dark:text-slate-400">All Sources</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">${with_multiple_sources}</div>
          <div class="text-sm text-gray-600 dark:text-slate-400">2+ Sources</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-gray-600 dark:text-slate-400">${with_single_source}</div>
          <div class="text-sm text-gray-600 dark:text-slate-400">Single Source</div>
        </div>
      </div>
    </div>

    <!-- All Sources Highlight -->
    <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="font-medium text-green-800 dark:text-green-300">Restaurants with data from all ${configured_adapters?.length || 3} adapters</div>
          <div class="text-sm text-green-600 dark:text-green-400">Complete coverage across Yelp, Google, and TripAdvisor</div>
        </div>
        <div class="text-3xl font-bold text-green-600 dark:text-green-400">${allSourcesPercentage}%</div>
      </div>
    </div>

    <!-- By Source Breakdown -->
    <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
      <h4 class="font-medium text-cocoa dark:text-cream mb-3">Restaurants by Source</h4>
      <div class="space-y-3">
        ${Object.entries(by_source || {}).map(([source, count]) => {
          const percentage = total_restaurants > 0 ? ((count / total_restaurants) * 100).toFixed(1) : 0;
          return `
            <div>
              <div class="flex justify-between items-center mb-1">
                <span class="text-gray-700 dark:text-slate-300 capitalize">${escapeHtml(source)}</span>
                <span class="text-sm text-gray-600 dark:text-slate-400">${count} (${percentage}%)</span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                <div class="bg-electric h-2 rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Display error message
 * @param {string} message - Error message
 */
function showError(message) {
  statsContainer.innerHTML = errorMessage(message, { showRetry: true });
}

/**
 * Handle retry button clicks
 * @param {Event} event - Click event
 */
function handleRetryClick(event) {
  if (event.target.dataset.action === 'retry') {
    loadStats();
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
