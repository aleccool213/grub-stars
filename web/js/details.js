/**
 * Restaurant Details Page Controller
 * Handles loading and displaying restaurant details
 */

import { getRestaurant } from './api.js';
import { loadingSpinner } from './components/loading-spinner.js';
import { errorMessage } from './components/error-message.js';

// DOM elements
let detailsContainer;

/**
 * Initialize the details page
 */
async function init() {
  detailsContainer = document.getElementById('restaurant-details');

  if (!detailsContainer) {
    console.error('Details container not found on page');
    return;
  }

  // Add retry handler for error messages
  detailsContainer.addEventListener('click', handleRetryClick);

  // Get restaurant ID from URL
  const id = getRestaurantIdFromUrl();

  if (!id) {
    showError('No restaurant ID provided. Please select a restaurant from the search results.');
    return;
  }

  await loadRestaurant(id);
}

/**
 * Get restaurant ID from URL query parameters
 * @returns {number|null} - Restaurant ID or null if not found
 */
function getRestaurantIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  return id ? parseInt(id, 10) : null;
}

/**
 * Load restaurant details from API
 * @param {number} id - Restaurant ID
 */
async function loadRestaurant(id) {
  // Show loading state
  detailsContainer.innerHTML = loadingSpinner('Loading restaurant details...');

  try {
    const response = await getRestaurant(id);
    const restaurant = response.data;

    if (!restaurant) {
      showNotFound(id);
      return;
    }

    showRestaurant(restaurant);
  } catch (error) {
    console.error('Error loading restaurant:', error);

    if (error.status === 404) {
      showNotFound(id);
    } else {
      showError(error.message);
    }
  }
}

/**
 * Display restaurant details
 * @param {Object} restaurant - Restaurant data from API
 */
function showRestaurant(restaurant) {
  const ratings = restaurant.ratings || [];
  const reviews = restaurant.reviews || [];
  const photos = restaurant.photos || [];
  const videos = restaurant.videos || [];
  const categories = restaurant.categories || [];
  const sources = restaurant.sources || [];

  // Calculate average rating
  const avgRating = calculateAverageRating(ratings);
  const totalReviews = ratings.reduce((sum, r) => sum + (r.review_count || 0), 0);

  // Update page title
  document.title = `${restaurant.name} - grub stars`;

  detailsContainer.innerHTML = `
    <article class="bg-white rounded-lg shadow-lg overflow-hidden">
      <!-- Header Section -->
      <div class="p-6 border-b border-gray-200">
        <h2 class="text-2xl font-bold text-gray-800 mb-2">${escapeHtml(restaurant.name)}</h2>

        ${categories.length > 0 ? `
          <div class="mb-3">
            ${categories.map(cat => `
              <a href="/?category=${encodeURIComponent(cat)}"
                 class="inline-block bg-blue-100 text-blue-700 text-sm px-2 py-1 rounded mr-1 mb-1 hover:bg-blue-200 transition-colors">
                ${escapeHtml(cat)}
              </a>
            `).join('')}
          </div>
        ` : ''}

        <div class="text-gray-600 space-y-1">
          ${restaurant.address ? `
            <p class="flex items-center">
              <svg class="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              ${escapeHtml(restaurant.address)}
            </p>
          ` : ''}

          ${restaurant.phone ? `
            <p class="flex items-center">
              <svg class="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <a href="tel:${escapeHtml(restaurant.phone)}" class="text-blue-600 hover:underline">
                ${escapeHtml(restaurant.phone)}
              </a>
            </p>
          ` : ''}

          ${restaurant.location ? `
            <p class="flex items-center">
              <svg class="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ${escapeHtml(restaurant.location)}
            </p>
          ` : ''}
        </div>
      </div>

      <!-- Ratings Section -->
      ${ratings.length > 0 ? `
        <div class="p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Ratings</h3>

          ${avgRating ? `
            <div class="flex items-center mb-4">
              <span class="text-3xl font-bold text-yellow-500">${avgRating.toFixed(1)}</span>
              <div class="ml-2">
                <div class="flex">${renderStars(avgRating)}</div>
                <p class="text-sm text-gray-500">${totalReviews} ${totalReviews === 1 ? 'review' : 'reviews'} total</p>
              </div>
            </div>
          ` : ''}

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            ${ratings.map(rating => `
              <div class="bg-gray-50 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium text-gray-700 capitalize">${escapeHtml(rating.source)}</span>
                  <span class="text-lg font-bold text-yellow-600">${rating.score.toFixed(1)}</span>
                </div>
                <div class="flex items-center text-sm text-gray-500">
                  ${renderStars(rating.score)}
                  <span class="ml-2">(${rating.review_count || 0} reviews)</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Photos Section -->
      ${photos.length > 0 ? `
        <div class="p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Photos</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            ${photos.map(photo => `
              <a href="${escapeHtml(photo.url)}" target="_blank" rel="noopener noreferrer"
                 class="block aspect-square overflow-hidden rounded-lg hover:opacity-90 transition-opacity">
                <img src="${escapeHtml(photo.url)}" alt="Photo from ${escapeHtml(photo.source)}"
                     class="w-full h-full object-cover"
                     loading="lazy"
                     onerror="this.parentElement.style.display='none'">
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Videos Section -->
      ${videos.length > 0 ? `
        <div class="p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Videos</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${videos.map(video => `
              <a href="${escapeHtml(video.url)}" target="_blank" rel="noopener noreferrer"
                 class="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <svg class="w-8 h-8 text-red-500 mr-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <span class="text-gray-700">Video from ${escapeHtml(video.source)}</span>
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Reviews Section -->
      ${reviews.length > 0 ? `
        <div class="p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Review Snippets</h3>
          <div class="space-y-4">
            ${reviews.map(review => `
              <blockquote class="bg-gray-50 rounded-lg p-4">
                <p class="text-gray-700 italic mb-2">"${escapeHtml(review.snippet)}"</p>
                <footer class="flex items-center justify-between">
                  <span class="text-sm text-gray-500 capitalize">— ${escapeHtml(review.source)}</span>
                  ${review.url ? `
                    <a href="${escapeHtml(review.url)}" target="_blank" rel="noopener noreferrer"
                       class="text-sm text-blue-600 hover:underline">Read more</a>
                  ` : ''}
                </footer>
              </blockquote>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Sources Section -->
      ${sources.length > 0 ? `
        <div class="p-6 bg-gray-50">
          <p class="text-sm text-gray-500">
            Data sources: ${sources.map(s => `<span class="capitalize">${escapeHtml(s)}</span>`).join(', ')}
          </p>
        </div>
      ` : ''}
    </article>
  `;
}

/**
 * Display not found message
 * @param {number} id - Restaurant ID that was not found
 */
function showNotFound(id) {
  detailsContainer.innerHTML = `
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
      <div class="text-yellow-500 mb-4">
        <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-yellow-800 mb-2">Restaurant Not Found</h3>
      <p class="text-yellow-700 mb-4">
        We couldn't find a restaurant with ID ${escapeHtml(String(id))}.
      </p>
      <a href="/" class="inline-block bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded transition-colors">
        Back to Search
      </a>
    </div>
  `;
}

/**
 * Display error message
 * @param {string} message - Error message
 */
function showError(message) {
  detailsContainer.innerHTML = errorMessage(message, { showRetry: true });
}

/**
 * Handle retry button clicks
 * @param {Event} event - Click event
 */
function handleRetryClick(event) {
  if (event.target.dataset.action === 'retry') {
    const id = getRestaurantIdFromUrl();
    if (id) {
      loadRestaurant(id);
    }
  }
}

/**
 * Calculate average rating across all sources
 * @param {Array} ratings - Array of rating objects
 * @returns {number|null} - Average rating or null if no ratings
 */
function calculateAverageRating(ratings) {
  if (!ratings || ratings.length === 0) return null;
  const validRatings = ratings.filter(r => r.score && r.score > 0);
  if (validRatings.length === 0) return null;
  const sum = validRatings.reduce((acc, r) => acc + r.score, 0);
  return sum / validRatings.length;
}

/**
 * Render star icons for a rating
 * @param {number} rating - Rating value (0-5)
 * @returns {string} - HTML string with star icons
 */
function renderStars(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  let stars = '';

  // Full stars
  for (let i = 0; i < fullStars; i++) {
    stars += `<svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
    </svg>`;
  }

  // Half star
  if (hasHalfStar) {
    stars += `<svg class="w-4 h-4 text-yellow-400" viewBox="0 0 20 20">
      <defs>
        <linearGradient id="half-star">
          <stop offset="50%" stop-color="currentColor"/>
          <stop offset="50%" stop-color="#D1D5DB"/>
        </linearGradient>
      </defs>
      <path fill="url(#half-star)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
    </svg>`;
  }

  // Empty stars
  for (let i = 0; i < emptyStars; i++) {
    stars += `<svg class="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
    </svg>`;
  }

  return stars;
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

// Export for testing
export { getRestaurantIdFromUrl, calculateAverageRating, renderStars, escapeHtml };
