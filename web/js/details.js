/**
 * Restaurant Details Page Controller
 * Enhanced with map, photo lightbox, share, and more
 */

import { getRestaurant, searchRestaurants, reindexRestaurant } from './api.js';
import { loadingSpinner } from './components/loading-spinner.js';
import { errorMessage } from './components/error-message.js';
import { insertNavBar } from './components/nav-bar.js';
import { bookmarkButton, initBookmarkButtons } from './components/bookmark-button.js';

// DOM elements
let detailsContainer;
let currentRestaurant = null;

/**
 * Initialize the details page
 */
async function init() {
  // Insert navigation bar
  insertNavBar({ currentPage: 'details' });

  detailsContainer = document.getElementById('restaurant-details');

  if (!detailsContainer) {
    console.error('Details container not found on page');
    return;
  }

  // Add event handlers
  detailsContainer.addEventListener('click', handleRetryClick);
  detailsContainer.addEventListener('click', handlePhotoClick);
  detailsContainer.addEventListener('click', handleShareClick);
  detailsContainer.addEventListener('click', handleReindexClick);

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

    currentRestaurant = restaurant;
    showRestaurant(restaurant);

    // Load similar restaurants in background
    loadSimilarRestaurants(restaurant);
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
  const externalIds = restaurant.external_ids || [];

  // Calculate average rating
  const avgRating = calculateAverageRating(ratings);
  const totalReviews = ratings.reduce((sum, r) => sum + (r.review_count || 0), 0);

  // Get last updated timestamp
  const lastUpdated = getLastUpdated(ratings, reviews, photos);

  // Create bookmark button
  const bookmarkBtn = bookmarkButton({
    restaurantId: restaurant.id,
    name: restaurant.name,
    size: 'lg',
    variant: 'button'
  });

  // Update page title
  document.title = `${restaurant.name} - grub stars`;

  detailsContainer.innerHTML = `
    <article class="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden">
      <!-- Header Section -->
      <div class="p-6 border-b border-gray-200 dark:border-slate-700">
        <div class="flex items-start justify-between gap-4 mb-4">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-slate-100">${escapeHtml(restaurant.name)}</h2>
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Refresh Data Button -->
            <button id="reindex-btn" class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="Refresh data from sources" aria-label="Refresh data from sources">
              <svg id="reindex-icon" class="w-6 h-6 text-gray-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <!-- Share Button -->
            <button id="share-btn" class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="Share restaurant" aria-label="Share restaurant">
              <svg class="w-6 h-6 text-gray-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            ${bookmarkBtn}
          </div>
        </div>

        ${categories.length > 0 ? `
          <div class="mb-3">
            ${categories.map(cat => `
              <a href="/?category=${encodeURIComponent(cat)}"
                 class="inline-block bg-blue-100 dark:bg-slate-700 text-blue-700 dark:text-slate-300 text-sm px-2 py-1 rounded mr-1 mb-1 hover:bg-blue-200 dark:hover:bg-slate-600 transition-colors">
                ${escapeHtml(cat)}
              </a>
            `).join('')}
          </div>
        ` : ''}

        <div class="text-gray-600 dark:text-slate-300 space-y-1">
          ${restaurant.address ? `
            <p class="flex items-center">
              <svg class="w-5 h-5 mr-2 text-gray-400 dark:text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>${escapeHtml(restaurant.address)}</span>
              ${restaurant.latitude && restaurant.longitude ? `
                <a href="${getDirectionsUrl(restaurant)}"
                   target="_blank" rel="noopener noreferrer"
                   class="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm">
                  (Get directions)
                </a>
              ` : ''}
            </p>
          ` : ''}

          ${restaurant.phone ? `
            <p class="flex items-center">
              <svg class="w-5 h-5 mr-2 text-gray-400 dark:text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <a href="tel:${escapeHtml(restaurant.phone)}" class="text-blue-600 dark:text-blue-400 hover:underline">
                ${escapeHtml(restaurant.phone)}
              </a>
            </p>
          ` : ''}

          ${restaurant.location ? `
            <p class="flex items-center">
              <svg class="w-5 h-5 mr-2 text-gray-400 dark:text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-gray-600 dark:text-slate-300">${escapeHtml(restaurant.location)}</span>
            </p>
          ` : ''}
        </div>

        ${restaurant.description ? `
          <div class="mt-4 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
            <p class="text-gray-700 dark:text-slate-200 italic">"${escapeHtml(restaurant.description)}"</p>
          </div>
        ` : ''}
      </div>

      <!-- Map Section -->
      ${restaurant.latitude && restaurant.longitude ? `
        <div class="p-6 border-b border-gray-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4 flex items-center">
            <svg class="w-5 h-5 mr-2 text-electric" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Location
          </h3>
          <div id="restaurant-map" class="w-full h-64 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700"></div>
          <p class="text-sm text-gray-500 dark:text-slate-400 mt-2">
            Click the map to open in Google Maps
          </p>
        </div>
      ` : ''}

      <!-- Ratings Section -->
      ${ratings.length > 0 ? `
        <div class="p-6 border-b border-gray-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4 flex items-center">
            <svg class="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            Ratings
          </h3>

          ${avgRating ? `
            <div class="flex items-center mb-4">
              <span class="text-3xl font-bold text-yellow-500">${avgRating.toFixed(1)}</span>
              <div class="ml-2">
                <div class="flex">${renderStars(avgRating)}</div>
                <p class="text-sm text-gray-500 dark:text-slate-400">${totalReviews} ${totalReviews === 1 ? 'review' : 'reviews'} total</p>
              </div>
            </div>
          ` : ''}

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            ${ratings.map(rating => `
              <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 rating-card">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center">
                    ${getSourceIcon(rating.source)}
                    <span class="font-medium text-gray-700 dark:text-slate-200 capitalize ml-2">${escapeHtml(rating.source)}</span>
                  </div>
                  <span class="text-lg font-bold text-yellow-600">${rating.score.toFixed(1)}</span>
                </div>
                <div class="flex items-center text-sm text-gray-500 dark:text-slate-400">
                  ${renderStars(rating.score)}
                  <span class="ml-2">(${rating.review_count || 0} reviews)</span>
                </div>
                ${getExternalLink(rating.source, externalIds, restaurant.name)}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Photos Section -->
      ${photos.length > 0 ? `
        <div class="p-6 border-b border-gray-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4 flex items-center">
            <svg class="w-5 h-5 mr-2 text-hotpink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Photos
            <span class="ml-2 text-sm font-normal text-gray-500 dark:text-slate-400">(${photos.length})</span>
          </h3>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            ${photos.map((photo, index) => `
              <button class="photo-thumb block aspect-square overflow-hidden rounded-lg hover:opacity-90 transition-all hover:ring-2 hover:ring-electric bg-gray-100 dark:bg-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-electric"
                      data-photo-index="${index}"
                      data-photo-url="${escapeHtml(photo.url)}"
                      data-photo-source="${escapeHtml(photo.source)}"
                      aria-label="View photo ${index + 1} from ${escapeHtml(photo.source)}">
                <img src="${escapeHtml(photo.url)}" alt="Photo from ${escapeHtml(photo.source)}"
                     class="w-full h-full object-cover"
                     loading="lazy"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="photo-placeholder w-full h-full items-center justify-center text-gray-400 dark:text-slate-500" style="display: none;">
                  <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Videos Section -->
      ${videos.length > 0 ? `
        <div class="p-6 border-b border-gray-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4 flex items-center">
            <svg class="w-5 h-5 mr-2 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Videos
            <span class="ml-2 text-sm font-normal text-gray-500 dark:text-slate-400">(${videos.length})</span>
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${videos.map(video => `
              <a href="${escapeHtml(video.url)}" target="_blank" rel="noopener noreferrer"
                 class="flex items-center p-4 bg-gray-50 dark:bg-slate-800 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors group">
                <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                  <svg class="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
                <div class="ml-4">
                  <span class="text-gray-700 dark:text-slate-200 font-medium">Video from ${escapeHtml(video.source)}</span>
                  <p class="text-sm text-gray-500 dark:text-slate-400">Click to watch</p>
                </div>
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Reviews Section -->
      ${reviews.length > 0 ? `
        <div class="p-6 border-b border-gray-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4 flex items-center">
            <svg class="w-5 h-5 mr-2 text-mango" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Review Snippets
            <span class="ml-2 text-sm font-normal text-gray-500 dark:text-slate-400">(${reviews.length})</span>
          </h3>
          <div class="space-y-4" id="reviews-container">
            ${reviews.slice(0, 3).map((review, index) => renderReview(review, index)).join('')}
          </div>
          ${reviews.length > 3 ? `
            <button id="show-more-reviews" class="mt-4 text-electric hover:text-hotpink font-medium transition-colors" data-expanded="false">
              Show ${reviews.length - 3} more reviews
            </button>
            <div id="hidden-reviews" style="display: none;" class="space-y-4 mt-4">
              ${reviews.slice(3).map((review, index) => renderReview(review, index + 3)).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}


      <!-- Similar Restaurants Section (loaded async) -->
      <div id="similar-restaurants" class="p-6 border-b border-gray-200 dark:border-slate-700" style="display: none;">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4 flex items-center">
          <svg class="w-5 h-5 mr-2 text-mint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Similar Restaurants
        </h3>
        <div id="similar-restaurants-list" class="grid grid-cols-1 sm:grid-cols-2 gap-4"></div>
      </div>

      <!-- Sources & Timestamp Section -->
      <div class="p-6 bg-gray-50 dark:bg-slate-800">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          ${sources.length > 0 ? `
            <p class="text-sm text-gray-500 dark:text-slate-400">
              Data sources: ${sources.map(s => `<span class="capitalize">${escapeHtml(s)}</span>`).join(', ')}
            </p>
          ` : ''}
          ${lastUpdated ? `
            <p class="text-sm text-gray-400 dark:text-slate-500">
              Last updated: ${formatDate(lastUpdated)}
            </p>
          ` : ''}
        </div>
      </div>
    </article>

    <!-- Photo Lightbox Modal -->
    <div id="photo-lightbox" class="fixed inset-0 z-50 flex items-center justify-center bg-black/90" style="display: none;" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <button id="lightbox-close" class="absolute top-4 right-4 text-white hover:text-gray-300 p-2" aria-label="Close photo viewer">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <button id="lightbox-prev" class="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 p-2" aria-label="Previous photo">
        <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button id="lightbox-next" class="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 p-2" aria-label="Next photo">
        <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <div class="max-w-5xl max-h-full p-4">
        <img id="lightbox-image" src="" alt="" class="max-w-full max-h-[85vh] object-contain">
      </div>
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
        <span id="lightbox-counter">1 / 1</span>
        <span id="lightbox-source" class="ml-2 text-gray-400 dark:text-slate-500"></span>
      </div>
    </div>

    <!-- Toast Notification -->
    <div id="toast" class="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 dark:bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg transition-opacity duration-300 opacity-0 max-w-md text-center" style="display: none; z-index: 60;">
      <span id="toast-message"></span>
    </div>
  `;

  // Initialize bookmark buttons
  initBookmarkButtons(detailsContainer);

  // Initialize map if coordinates exist
  if (restaurant.latitude && restaurant.longitude) {
    initMap(restaurant);
  }

  // Setup lightbox handlers
  setupLightbox(photos);

  // Setup show more reviews
  setupReviewsToggle();
}

/**
 * Render a single review
 */
function renderReview(review, index) {
  return `
    <blockquote class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 review-card">
      <p class="text-gray-700 dark:text-slate-200 italic mb-2">"${escapeHtml(review.snippet)}"</p>
      <footer class="flex items-center justify-between">
        <span class="text-sm text-gray-500 dark:text-slate-400 flex items-center">
          ${getSourceIcon(review.source)}
          <span class="ml-2 capitalize">— ${escapeHtml(review.source)}</span>
        </span>
        ${review.url ? `
          <a href="${escapeHtml(review.url)}" target="_blank" rel="noopener noreferrer"
             class="text-sm text-blue-600 dark:text-blue-400 hover:underline">Read full review</a>
        ` : ''}
      </footer>
    </blockquote>
  `;
}

/**
 * Setup reviews toggle for show more/less
 */
function setupReviewsToggle() {
  const btn = document.getElementById('show-more-reviews');
  const hiddenReviews = document.getElementById('hidden-reviews');

  if (!btn || !hiddenReviews) return;

  btn.addEventListener('click', () => {
    const expanded = btn.dataset.expanded === 'true';
    if (expanded) {
      hiddenReviews.style.display = 'none';
      btn.textContent = btn.textContent.replace('Show less', `Show ${hiddenReviews.children.length} more reviews`);
      btn.dataset.expanded = 'false';
    } else {
      hiddenReviews.style.display = 'block';
      btn.textContent = 'Show less';
      btn.dataset.expanded = 'true';
    }
  });
}

/**
 * Get source icon SVG
 */
function getSourceIcon(source) {
  const icons = {
    yelp: `<svg class="w-4 h-4" style="width: 16px; height: 16px; color: #d32323;" viewBox="0 0 24 24" fill="currentColor"><path d="M12.14 12.78l-3.66 2.27a.73.73 0 01-1.1-.79l1.06-4.17a.73.73 0 011.18-.35l3.05 2.72a.73.73 0 01-.53 1.32zm-.14-5.56V3.73a.73.73 0 00-1.36-.38L7.1 9.52a.73.73 0 00.63 1.1h3.54a.73.73 0 00.73-.73v-2.67zm4.14 5.44l2.27-3.66a.73.73 0 00-.79-1.1l-4.17 1.06a.73.73 0 00-.35 1.18l2.72 3.05a.73.73 0 001.32-.53z"/></svg>`,
    google: `<svg class="w-4 h-4" style="width: 16px; height: 16px;" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`,
    tripadvisor: `<svg class="w-4 h-4" style="width: 16px; height: 16px; color: #00aa6c;" viewBox="0 0 24 24" fill="currentColor"><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="12" r="2.5"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-5.5 14c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm11 0c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>`
  };
  return icons[source.toLowerCase()] || `<span class="w-4 h-4 inline-block rounded-full bg-gray-400" style="width: 16px; height: 16px;"></span>`;
}

/**
 * Get external link for a source
 */
function getExternalLink(source, externalIds, restaurantName) {
  const extId = externalIds.find(e => e.source === source);
  if (!extId) return '';

  const url = getSourceUrl(source, extId.external_id, restaurantName);
  if (!url) return '';

  return `
    <a href="${url}" target="_blank" rel="noopener noreferrer"
       class="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 block">
      View on ${escapeHtml(source)}
    </a>
  `;
}

/**
 * Strip source prefix from external ID (e.g., "yelp:abc123" -> "abc123")
 */
function stripSourcePrefix(externalId) {
  if (!externalId) return '';
  return externalId.replace(/^(yelp|google|tripadvisor):/, '');
}

/**
 * Build Google Maps directions URL using restaurant name and address
 * Falls back to coordinates if address is unavailable
 */
function getDirectionsUrl(restaurant) {
  // Build a search query with name and address for better UX
  const parts = [];
  if (restaurant.name) parts.push(restaurant.name);
  if (restaurant.address) parts.push(restaurant.address);

  if (parts.length > 0) {
    const query = encodeURIComponent(parts.join(', '));
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  // Fallback to coordinates if no name/address
  if (restaurant.latitude && restaurant.longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`;
  }

  return '#';
}

/**
 * Get URL for a source
 */
function getSourceUrl(source, externalId, restaurantName) {
  const cleanId = stripSourcePrefix(externalId);
  const urls = {
    yelp: `https://www.yelp.com/biz/${cleanId}`,
    google: `https://www.google.com/maps/place/?q=place_id:${cleanId}`,
    tripadvisor: `https://www.tripadvisor.com/${cleanId}`
  };
  return urls[source.toLowerCase()];
}

/**
 * Initialize interactive map
 */
function initMap(restaurant) {
  const mapContainer = document.getElementById('restaurant-map');
  if (!mapContainer) return;

  const lat = restaurant.latitude;
  const lng = restaurant.longitude;
  const zoom = 16;

  // Use OpenStreetMap embed iframe - more reliable than static map services
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`;

  mapContainer.innerHTML = `
    <div class="relative w-full h-full">
      <iframe
        src="${osmEmbedUrl}"
        class="w-full h-full border-0"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        title="Map showing location of ${escapeHtml(restaurant.name)}"
        allowfullscreen>
      </iframe>
      <a href="${getDirectionsUrl(restaurant)}"
         target="_blank" rel="noopener noreferrer"
         class="absolute bottom-3 right-3 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 px-3 py-2 rounded-lg shadow-md hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-sm font-medium flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Get Directions
      </a>
    </div>
  `;
}

/**
 * Setup photo lightbox
 */
function setupLightbox(photos) {
  const lightbox = document.getElementById('photo-lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxCounter = document.getElementById('lightbox-counter');
  const lightboxSource = document.getElementById('lightbox-source');
  const closeBtn = document.getElementById('lightbox-close');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');

  if (!lightbox || !photos.length) return;

  let currentIndex = 0;

  const updateLightbox = () => {
    const photo = photos[currentIndex];
    lightboxImage.src = photo.url;
    lightboxImage.alt = `Photo from ${photo.source}`;
    lightboxCounter.textContent = `${currentIndex + 1} / ${photos.length}`;
    lightboxSource.textContent = `from ${photo.source}`;

    // Update nav visibility
    prevBtn.style.visibility = currentIndex === 0 ? 'hidden' : 'visible';
    nextBtn.style.visibility = currentIndex === photos.length - 1 ? 'hidden' : 'visible';
  };

  const openLightbox = (index) => {
    currentIndex = index;
    updateLightbox();
    lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    lightbox.style.display = 'none';
    document.body.style.overflow = '';
  };

  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateLightbox();
    }
  });
  nextBtn.addEventListener('click', () => {
    if (currentIndex < photos.length - 1) {
      currentIndex++;
      updateLightbox();
    }
  });

  // Close on background click
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (lightbox.style.display !== 'flex') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft' && currentIndex > 0) {
      currentIndex--;
      updateLightbox();
    }
    if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) {
      currentIndex++;
      updateLightbox();
    }
  });

  // Store openLightbox function for photo click handler
  window._openLightbox = openLightbox;
}

/**
 * Handle photo thumbnail click
 */
function handlePhotoClick(event) {
  const thumb = event.target.closest('.photo-thumb');
  if (thumb && window._openLightbox) {
    const index = parseInt(thumb.dataset.photoIndex, 10);
    window._openLightbox(index);
  }
}

/**
 * Handle share button click
 */
function handleShareClick(event) {
  const shareBtn = event.target.closest('#share-btn');
  if (!shareBtn || !currentRestaurant) return;

  const url = window.location.href;
  const title = `${currentRestaurant.name} - grub stars`;
  const text = `Check out ${currentRestaurant.name} on grub stars!`;

  // Try native share first (mobile)
  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {
      // User cancelled or error - fallback to clipboard
      copyToClipboard(url);
    });
  } else {
    // Desktop fallback - copy to clipboard
    copyToClipboard(url);
  }
}

/**
 * Copy text to clipboard and show toast
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showShareToast();
  }).catch(() => {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showShareToast();
  });
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {number} duration - Duration in ms (default 3000)
 */
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;
  toast.style.display = 'block';
  toast.style.opacity = '1';

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 300);
  }, duration);
}

/**
 * Show share toast notification
 */
function showShareToast() {
  showToast('Link copied to clipboard!', 2000);
}

/**
 * Handle reindex button click
 */
async function handleReindexClick(event) {
  const reindexBtn = event.target.closest('#reindex-btn');
  if (!reindexBtn || !currentRestaurant) return;

  const reindexIcon = document.getElementById('reindex-icon');

  // Disable button and show spinner
  reindexBtn.disabled = true;
  reindexBtn.classList.add('cursor-not-allowed', 'opacity-50');
  if (reindexIcon) {
    reindexIcon.classList.add('animate-spin');
  }

  try {
    showToast('Refreshing data from sources...', 10000);

    const response = await reindexRestaurant(currentRestaurant.id);
    const result = response.data.result;

    // Show success message
    showToast(result.message || 'Data refreshed successfully!', 4000);

    // Reload restaurant data if we got updated restaurant
    if (response.data.restaurant) {
      currentRestaurant = response.data.restaurant;
      showRestaurant(currentRestaurant);

      // Re-load similar restaurants
      loadSimilarRestaurants(currentRestaurant);
    }
  } catch (error) {
    console.error('Error re-indexing restaurant:', error);
    showToast(`Failed to refresh: ${error.message}`, 4000);
  } finally {
    // Re-enable button
    reindexBtn.disabled = false;
    reindexBtn.classList.remove('cursor-not-allowed', 'opacity-50');
    if (reindexIcon) {
      reindexIcon.classList.remove('animate-spin');
    }
  }
}

/**
 * Load similar restaurants by category
 */
async function loadSimilarRestaurants(restaurant) {
  const container = document.getElementById('similar-restaurants');
  const list = document.getElementById('similar-restaurants-list');

  if (!container || !list || !restaurant.categories || !restaurant.categories.length) return;

  try {
    // Search for restaurants with the same first category
    const category = restaurant.categories[0];
    const response = await searchRestaurants({ category, location: restaurant.location });

    // Filter out current restaurant and limit to 4
    const similar = (response.data || [])
      .filter(r => r.id !== restaurant.id)
      .slice(0, 4);

    if (similar.length === 0) return;

    // Show container and render results
    container.style.display = 'block';
    list.innerHTML = similar.map(r => `
      <a href="/details.html?id=${r.id}" class="flex items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors group similar-card">
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-gray-800 dark:text-slate-100 truncate group-hover:text-electric">${escapeHtml(r.name)}</h4>
          <p class="text-sm text-gray-500 dark:text-slate-400 truncate">${escapeHtml(r.address || r.location || '')}</p>
          ${r.ratings && r.ratings.length > 0 ? `
            <div class="flex items-center mt-1">
              ${renderStars(r.ratings[0].score)}
              <span class="ml-1 text-xs text-gray-500 dark:text-slate-400">${r.ratings[0].score.toFixed(1)}</span>
            </div>
          ` : ''}
        </div>
        <svg class="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-electric ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </a>
    `).join('');
  } catch (error) {
    console.error('Error loading similar restaurants:', error);
    // Silently fail - this is a nice-to-have feature
  }
}

/**
 * Get the most recent update timestamp
 */
function getLastUpdated(ratings, reviews, photos) {
  const timestamps = [
    ...ratings.map(r => r.fetched_at),
    ...reviews.map(r => r.fetched_at),
    ...photos.map(p => p.fetched_at)
  ].filter(Boolean);

  if (timestamps.length === 0) return null;

  return timestamps.reduce((latest, current) => {
    return new Date(current) > new Date(latest) ? current : latest;
  });
}

/**
 * Format a date string for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Display not found message
 * @param {number} id - Restaurant ID that was not found
 */
function showNotFound(id) {
  detailsContainer.innerHTML = `
    <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-8 text-center">
      <div class="text-yellow-500 dark:text-yellow-400 mb-4">
        <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Restaurant Not Found</h3>
      <p class="text-yellow-700 dark:text-yellow-300 mb-4">
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
    stars += `<svg class="w-4 h-4 text-yellow-400" style="width: 16px; height: 16px; color: #facc15;" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
    </svg>`;
  }

  // Half star
  if (hasHalfStar) {
    stars += `<svg class="w-4 h-4 text-yellow-400" style="width: 16px; height: 16px; color: #facc15;" viewBox="0 0 20 20">
      <defs>
        <linearGradient id="half-star-${Math.random().toString(36).substr(2, 9)}">
          <stop offset="50%" stop-color="currentColor"/>
          <stop offset="50%" stop-color="#D1D5DB"/>
        </linearGradient>
      </defs>
      <path fill="url(#half-star-${Math.random().toString(36).substr(2, 9)})" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
    </svg>`;
  }

  // Empty stars
  for (let i = 0; i < emptyStars; i++) {
    stars += `<svg class="w-4 h-4 text-gray-300" style="width: 16px; height: 16px; color: #d1d5db;" fill="currentColor" viewBox="0 0 20 20">
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
