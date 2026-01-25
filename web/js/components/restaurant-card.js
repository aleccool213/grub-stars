/**
 * Restaurant Card Component
 * Displays a restaurant in search results
 */

import { bookmarkButton } from './bookmark-button.js';

/**
 * Render a restaurant card
 * @param {Object} restaurant - Restaurant data
 * @param {number} restaurant.id - Restaurant ID
 * @param {string} restaurant.name - Restaurant name
 * @param {string} restaurant.address - Full address
 * @param {Array} restaurant.categories - Array of category names
 * @param {Array} restaurant.ratings - Array of rating objects with source, score, review_count
 * @returns {string} - HTML string for the card
 */
export function restaurantCard(restaurant) {
  const categories = restaurant.categories || [];
  const ratings = restaurant.ratings || [];

  // Calculate average rating if available
  const avgRating = calculateAverageRating(ratings);
  const ratingDisplay = avgRating ? `${avgRating.toFixed(1)} stars` : 'No ratings';

  // Get total review count
  const totalReviews = ratings.reduce((sum, r) => sum + (r.review_count || 0), 0);
  const reviewText = totalReviews === 1 ? '1 review' : `${totalReviews} reviews`;

  // Format categories (limit to 3)
  const categoryTags = categories.slice(0, 3).map(cat =>
    `<span class="inline-block bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded mr-1 mb-1">${escapeHtml(cat)}</span>`
  ).join('');

  // Rating source badges (only show ratings with valid values)
  const ratingBadges = ratings
    .filter(r => r.score != null && r.score > 0)
    .slice(0, 3)
    .map(r =>
      `<span class="inline-flex items-center text-xs text-gray-500 mr-2">
        <span class="font-medium">${escapeHtml(r.source)}:</span>
        <span class="ml-1">${r.score.toFixed(1)}</span>
      </span>`
    ).join('');

  // Create bookmark button
  const bookmarkBtn = bookmarkButton({
    restaurantId: restaurant.id,
    name: restaurant.name,
    size: 'md',
    variant: 'icon'
  });

  return `
    <article class="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 group">
      <div class="flex items-start justify-between gap-2 mb-3">
        <a href="/details.html?id=${restaurant.id}" class="flex-1 block">
          <h3 class="text-lg font-semibold text-gray-800 hover:text-blue-600 mb-1">
            ${escapeHtml(restaurant.name)}
          </h3>
        </a>
        <div class="flex-shrink-0">
          ${bookmarkBtn}
        </div>
      </div>

      <a href="/details.html?id=${restaurant.id}" class="block">
        <p class="text-sm text-gray-600 mb-2">
          ${escapeHtml(restaurant.address || 'Address not available')}
        </p>
        <div class="flex items-center text-sm text-gray-700 mb-2">
          <span class="font-medium text-yellow-600">${ratingDisplay}</span>
          <span class="mx-2 text-gray-300">|</span>
          <span class="text-gray-500">${reviewText}</span>
        </div>
        ${ratingBadges ? `<div class="mb-2">${ratingBadges}</div>` : ''}
        ${categoryTags ? `<div class="mt-2">${categoryTags}</div>` : ''}
      </a>
    </article>
  `;
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

/**
 * Render a list of restaurant cards
 * @param {Array} restaurants - Array of restaurant objects
 * @returns {string} - HTML string for all cards
 */
export function restaurantList(restaurants) {
  if (!restaurants || restaurants.length === 0) {
    return '';
  }
  return `
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      ${restaurants.map(r => restaurantCard(r)).join('')}
    </div>
  `;
}
