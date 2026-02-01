import { getStats } from './api.js';

// DOM Elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const errorMessageEl = document.getElementById('error-message');
const statsContentEl = document.getElementById('stats-content');
const lastUpdatedEl = document.getElementById('last-updated');

// Load and display stats
async function loadStats() {
  showLoading();
  
  try {
    const response = await getStats();
    
    if (response.error) {
      throw new Error(response.error.message || 'Failed to load stats');
    }
    
    const stats = response.data;
    displayStats(stats);
    showContent();
  } catch (err) {
    console.error('Failed to load stats:', err);
    showError(err.message);
  }
}

// Display all stats
function displayStats(stats) {
  // Restaurant overview
  document.getElementById('stat-total-restaurants').textContent = formatNumber(stats.restaurants.total);
  document.getElementById('stat-with-photos').textContent = formatNumber(stats.restaurants.with_photos);
  document.getElementById('stat-with-reviews').textContent = formatNumber(stats.restaurants.with_reviews);
  document.getElementById('stat-with-ratings').textContent = formatNumber(stats.restaurants.with_ratings);
  
  // Data coverage
  displayProviderCoverage(stats.provider_coverage, stats.restaurants.total);
  document.getElementById('stat-multi-source').textContent = formatNumber(stats.restaurants.multi_source);
  document.getElementById('stat-single-source').textContent = formatNumber(stats.restaurants.single_source_only);
  
  // API usage
  displayApiUsage(stats.api_usage);
  
  // Locations
  displayLocations(stats.locations);
  
  // Last updated
  lastUpdatedEl.textContent = new Date().toLocaleString();
}

// Display provider coverage badges
function displayProviderCoverage(coverage, total) {
  const container = document.getElementById('provider-coverage');
  container.innerHTML = '';
  
  const providers = [
    { key: 'yelp', name: 'Yelp', icon: '⭐' },
    { key: 'google', name: 'Google', icon: '🔍' },
    { key: 'tripadvisor', name: 'TripAdvisor', icon: '🌟' }
  ];
  
  providers.forEach(provider => {
    const count = coverage[provider.key] || 0;
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    
    const div = document.createElement('div');
    div.className = 'text-center';
    div.innerHTML = `
      <div class="provider-badge ${provider.key} mb-2">
        <span>${provider.icon}</span>
        <span>${provider.name}</span>
      </div>
      <div class="text-2xl font-bold text-cocoa">${formatNumber(count)}</div>
      <div class="text-sm text-cocoa/60">${percentage}% of restaurants</div>
    `;
    container.appendChild(div);
  });
}

// Display API usage with progress bars
function displayApiUsage(apiUsage) {
  const container = document.getElementById('api-usage');
  container.innerHTML = '';
  
  apiUsage.forEach(adapter => {
    const hasLimit = adapter.request_limit !== null;
    const percentage = hasLimit ? adapter.usage_percent : 0;
    const progressClass = hasLimit ? getProgressClass(percentage) : 'low';
    
    const card = document.createElement('div');
    card.className = 'card p-6';
    
    const statusBadge = adapter.configured 
      ? '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ Configured</span>'
      : '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">✗ Not Configured</span>';
    
    let usageHtml;
    if (hasLimit) {
      usageHtml = `
        <div class="mt-4">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-cocoa/70">${formatNumber(adapter.request_count)} / ${formatNumber(adapter.request_limit)} requests</span>
            <span class="font-medium ${percentage > 80 ? 'text-red-600' : 'text-cocoa'}">${percentage}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
          </div>
          <div class="flex justify-between text-xs text-cocoa/50 mt-2">
            <span>${formatNumber(adapter.remaining)} remaining</span>
            <span>Resets in ${adapter.days_until_reset} days</span>
          </div>
        </div>
      `;
    } else {
      usageHtml = `
        <div class="mt-4">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-cocoa/70">${formatNumber(adapter.request_count)} requests made</span>
            <span class="font-medium text-cocoa">No limit set</span>
          </div>
          <div class="text-xs text-cocoa/50 mt-2">
            Last used: ${adapter.reset_at ? new Date(adapter.reset_at).toLocaleDateString() : 'Never'}
          </div>
        </div>
      `;
    }
    
    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-3">
          <span class="text-2xl">${getAdapterIcon(adapter.name)}</span>
          <div>
            <h3 class="text-lg font-bold text-cocoa capitalize">${adapter.name}</h3>
            <p class="text-sm text-cocoa/60">API Usage</p>
          </div>
        </div>
        ${statusBadge}
      </div>
      ${usageHtml}
    `;
    
    container.appendChild(card);
  });
}

// Display indexed locations
function displayLocations(locations) {
  const container = document.getElementById('locations-list');
  const noLocationsEl = document.getElementById('no-locations');
  
  container.innerHTML = '';
  
  if (!locations || locations.length === 0) {
    noLocationsEl.classList.remove('hidden');
    return;
  }
  
  noLocationsEl.classList.add('hidden');
  
  locations.forEach(location => {
    const tag = document.createElement('span');
    tag.className = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-mango/20 text-cocoa border border-mango/30';
    tag.innerHTML = `
      <span class="mr-1">📍</span>
      ${location}
    `;
    container.appendChild(tag);
  });
}

// Get progress bar color class based on percentage
function getProgressClass(percentage) {
  if (percentage < 50) return 'low';
  if (percentage < 80) return 'medium';
  return 'high';
}

// Get icon for adapter
function getAdapterIcon(name) {
  const icons = {
    yelp: '⭐',
    google: '🔍',
    tripadvisor: '🌟'
  };
  return icons[name] || '📡';
}

// Format number with commas
function formatNumber(num) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

// Show loading state
function showLoading() {
  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  statsContentEl.classList.add('hidden');
}

// Show content
function showContent() {
  loadingEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  statsContentEl.classList.remove('hidden');
}

// Show error
function showError(message) {
  loadingEl.classList.add('hidden');
  errorEl.classList.remove('hidden');
  statsContentEl.classList.add('hidden');
  errorMessageEl.textContent = message;
}

// Initialize
loadStats();

// Auto-refresh every 5 minutes
setInterval(loadStats, 5 * 60 * 1000);
