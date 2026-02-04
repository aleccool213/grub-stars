/**
 * Map Restaurant Card Component
 * Displays a selected restaurant's details below the map
 */

import { bookmarkButton } from './bookmark-button.js';

/**
 * Render a restaurant card for the map view
 * @param {Object} restaurant - Restaurant data from API
 * @returns {string} - HTML string for the restaurant card
 */
export function mapRestaurantCard(restaurant) {
  const {
    id,
    name,
    address,
    latitude,
    longitude,
    phone,
    ratings = [],
    categories = []
  } = restaurant;

  // Calculate average rating
  const avgRating = calculateAverageRating(ratings);
  const ratingDisplay = avgRating ? `${avgRating.toFixed(1)}` : 'No rating';
  const stars = avgRating ? renderStars(avgRating) : '';

  // Format categories
  const categoryTags = categories.slice(0, 4).map(cat =>
    `<span class="inline-block bg-mango/20 text-cocoa dark:bg-mango/30 dark:text-cream px-2 py-1 rounded-full text-xs font-medium">${escapeHtml(cat)}</span>`
  ).join(' ');

  // Format sources
  const sources = ratings.map(r => r.source).join(', ');

  // Google Maps directions URL
  const directionsUrl = latitude && longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || name)}`;

  return `
    <article class="card p-4 bg-white dark:bg-slate-800 transition-colors">
      <div class="flex flex-col sm:flex-row gap-4">
        <!-- Restaurant Info -->
        <div class="flex-1">
          <div class="flex items-start justify-between gap-2 mb-2">
            <h3 class="text-xl font-bold text-cocoa dark:text-cream">
              <a href="/details.html?id=${id}" class="hover:text-electric transition-colors">
                ${escapeHtml(name)}
              </a>
            </h3>
            ${bookmarkButton({ restaurantId: id, name: name, size: 'md', variant: 'icon' })}
          </div>

          ${address ? `
            <p class="text-cocoa/70 dark:text-cream/70 text-sm mb-2 flex items-center gap-1">
              <span>📍</span> ${escapeHtml(address)}
            </p>
          ` : ''}

          ${phone ? `
            <p class="text-cocoa/70 dark:text-cream/70 text-sm mb-2 flex items-center gap-1">
              <span>📞</span>
              <a href="tel:${escapeHtml(phone)}" class="hover:text-electric transition-colors">
                ${escapeHtml(phone)}
              </a>
            </p>
          ` : ''}

          <!-- Rating -->
          ${avgRating ? `
            <div class="flex items-center gap-2 mb-3">
              <span class="text-lg font-bold text-cocoa dark:text-cream">${ratingDisplay}</span>
              <span class="text-mango">${stars}</span>
              ${sources ? `<span class="text-xs text-cocoa/50 dark:text-cream/50">(${sources})</span>` : ''}
            </div>
          ` : ''}

          <!-- Categories -->
          ${categoryTags ? `
            <div class="flex flex-wrap gap-1 mb-4">
              ${categoryTags}
            </div>
          ` : ''}
        </div>

        <!-- Actions -->
        <div class="flex sm:flex-col gap-2 sm:items-end justify-end">
          <a href="/details.html?id=${id}"
             class="btn-primary text-sm px-4 py-2 inline-flex items-center gap-1">
            <span>View Details</span>
          </a>
          <a href="${directionsUrl}"
             target="_blank"
             rel="noopener noreferrer"
             class="btn-secondary text-sm px-4 py-2 inline-flex items-center gap-1">
            <span>🧭</span> Directions
          </a>
        </div>
      </div>
    </article>
  `;
}

/**
 * Calculate average rating from ratings array
 * @param {Array} ratings - Array of rating objects
 * @returns {number|null} - Average rating or null
 */
function calculateAverageRating(ratings) {
  if (!ratings || ratings.length === 0) return null;
  const total = ratings.reduce((sum, r) => sum + (r.score || 0), 0);
  return total / ratings.length;
}

/**
 * Render star rating display
 * @param {number} rating - Rating value (0-5)
 * @returns {string} - Star HTML
 */
function renderStars(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return '★'.repeat(fullStars) +
         (hasHalfStar ? '½' : '') +
         '☆'.repeat(emptyStars);
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
