/**
 * Bookmark Button Component
 * Reusable bookmark toggle button with heart icon
 */

import { toggleBookmark, isBookmarked } from '../bookmarks.js';

/**
 * Render a bookmark button
 * @param {Object} options - Configuration options
 * @param {number} options.restaurantId - Restaurant ID (required)
 * @param {string} options.name - Restaurant name (required)
 * @param {string} options.size - Button size: 'sm', 'md', 'lg' (default: 'md')
 * @param {string} options.variant - Button variant: 'icon', 'button' (default: 'icon')
 * @param {boolean} options.inline - Display inline (default: true)
 * @returns {string} - HTML string for the bookmark button
 */
export function bookmarkButton(options = {}) {
  const { restaurantId, name, size = 'md', variant = 'icon', inline = true } = options;

  if (!restaurantId) {
    throw new Error('bookmarkButton requires restaurantId option');
  }

  const isBookmarkedNow = isBookmarked(restaurantId);

  // Size classes
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }[size] || 'w-6 h-6';

  const buttonPaddingClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-2.5'
  }[size] || 'p-2';

  // Base classes for both variants
  const baseClasses = 'transition-all duration-200 hover:scale-110 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hotpink';

  // Icon-only variant (minimal, just the heart)
  if (variant === 'icon') {
    return `
      <button
        type="button"
        class="bookmark-btn ${baseClasses} ${isBookmarkedNow ? 'text-hotpink' : 'text-gray-400 hover:text-hotpink'} ${buttonPaddingClasses} inline-flex items-center justify-center"
        data-restaurant-id="${restaurantId}"
        data-restaurant-name="${escapeHtml(name)}"
        aria-label="${isBookmarkedNow ? 'Remove from bookmarks' : 'Add to bookmarks'}"
        title="${isBookmarkedNow ? 'Remove from bookmarks' : 'Add to bookmarks'}">
        <svg class="bookmark-icon ${sizeClasses} pointer-events-none" fill="${isBookmarkedNow ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
      </button>
    `;
  }

  // Button variant (with text label)
  return `
    <button
      type="button"
      class="bookmark-btn ${baseClasses} ${isBookmarkedNow ? 'bg-hotpink text-white hover:bg-pink-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} rounded-md font-medium flex items-center gap-2 ${buttonPaddingClasses}"
      data-restaurant-id="${restaurantId}"
      data-restaurant-name="${escapeHtml(name)}"
      aria-label="${isBookmarkedNow ? 'Remove from bookmarks' : 'Add to bookmarks'}">
      <svg class="bookmark-icon ${sizeClasses} pointer-events-none" fill="${isBookmarkedNow ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
      </svg>
      <span>${isBookmarkedNow ? 'Bookmarked!' : 'Add to bookmarks'}</span>
    </button>
  `;
}

/**
 * Initialize bookmark button functionality
 * Call this after inserting bookmark buttons into the DOM
 * @param {HTMLElement} container - Container element with bookmark buttons
 * @param {Function} onBookmarkChange - Optional callback when bookmark state changes
 */
export function initBookmarkButtons(container = document, onBookmarkChange = null) {
  const buttons = container.querySelectorAll('.bookmark-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const restaurantId = parseInt(btn.dataset.restaurantId, 10);
      const restaurantName = btn.dataset.restaurantName;

      if (!restaurantId) return;

      // Toggle bookmark
      const isNowBookmarked = toggleBookmark(restaurantId, restaurantName);

      // Update button appearance
      updateBookmarkButtonAppearance(btn, isNowBookmarked);

      // Call callback if provided
      if (onBookmarkChange) {
        onBookmarkChange({
          restaurantId,
          restaurantName,
          isBookmarked: isNowBookmarked
        });
      }

      // Dispatch custom event
      const event = new CustomEvent('bookmarkToggled', {
        detail: { restaurantId, restaurantName, isBookmarked: isNowBookmarked }
      });
      document.dispatchEvent(event);
    });
  });
}

/**
 * Update bookmark button appearance after toggling
 * @param {HTMLElement} button - The bookmark button
 * @param {boolean} isBookmarked - New bookmark state
 */
function updateBookmarkButtonAppearance(button, isBookmarked) {
  const icon = button.querySelector('.bookmark-icon');
  const textSpan = button.querySelector('span');
  const variant = textSpan ? 'button' : 'icon';

  // Update aria-label and title
  button.setAttribute('aria-label', isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks');
  button.title = isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks';

  if (variant === 'icon') {
    // Icon-only variant
    button.classList.toggle('text-hotpink', isBookmarked);
    button.classList.toggle('text-gray-400', !isBookmarked);
    button.classList.toggle('hover:text-hotpink', !isBookmarked);

    if (icon) {
      icon.setAttribute('fill', isBookmarked ? 'currentColor' : 'none');
    }
  } else {
    // Button variant with text
    button.classList.toggle('bg-hotpink', isBookmarked);
    button.classList.toggle('text-white', isBookmarked);
    button.classList.toggle('hover:bg-pink-600', isBookmarked);
    button.classList.toggle('bg-gray-200', !isBookmarked);
    button.classList.toggle('text-gray-700', !isBookmarked);
    button.classList.toggle('hover:bg-gray-300', !isBookmarked);

    if (textSpan) {
      textSpan.textContent = isBookmarked ? 'Bookmarked!' : 'Add to bookmarks';
    }

    if (icon) {
      icon.setAttribute('fill', isBookmarked ? 'currentColor' : 'none');
    }
  }

  // Add animation
  button.classList.add('scale-125');
  setTimeout(() => {
    button.classList.remove('scale-125');
  }, 200);
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
