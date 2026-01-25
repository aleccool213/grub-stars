/**
 * Bookmarks List Page Controller
 * Manages the display and interaction of bookmarked restaurants
 */

import { getBookmarks, getBookmarksSortedByDate, getBookmarksSortedByName, removeBookmark, clearBookmarks } from './bookmarks.js';
import { insertNavBar } from './components/nav-bar.js';
import { initBookmarkButtons } from './components/bookmark-button.js';

/**
 * Render a bookmark item (minimal card showing just name and remove button)
 * @param {Object} bookmark - Bookmark object
 * @returns {string} - HTML string for the bookmark item
 */
function bookmarkItem(bookmark) {
  return `
    <div class="card p-4 flex items-center justify-between group hover:shadow-md transition-shadow" data-bookmark-id="${bookmark.restaurantId}">
      <div class="flex-1">
        <a href="/details.html?id=${bookmark.restaurantId}" class="text-lg font-semibold text-electric hover:text-blue-700 transition-colors">
          ${escapeHtml(bookmark.name)}
        </a>
        <p class="text-xs text-gray-500 mt-1">
          Bookmarked on ${formatDate(new Date(bookmark.bookmarkedAt))}
        </p>
      </div>

      <button
        type="button"
        class="remove-bookmark-btn ml-4 px-3 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        data-restaurant-id="${bookmark.restaurantId}"
        title="Remove bookmark">
        Remove
      </button>
    </div>
  `;
}

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Render all bookmarks
 * @param {Array} bookmarks - Array of bookmark objects
 * @returns {string} - HTML string for all bookmarks
 */
function renderBookmarks(bookmarks) {
  if (!bookmarks || bookmarks.length === 0) {
    return '';
  }

  return `
    <div class="space-y-3">
      ${bookmarks.map(b => bookmarkItem(b)).join('')}
    </div>
  `;
}

/**
 * Update the display based on bookmark list
 */
function updateDisplay() {
  const sortValue = document.getElementById('sort-select')?.value || 'date';
  const bookmarks = sortValue === 'name' ? getBookmarksSortedByName() : getBookmarksSortedByDate();

  const emptyState = document.getElementById('empty-state');
  const bookmarksList = document.getElementById('bookmarks-list');
  const clearBtn = document.getElementById('clear-all-btn');

  if (!bookmarks || bookmarks.length === 0) {
    // Show empty state
    if (emptyState) emptyState.style.display = 'block';
    if (bookmarksList) bookmarksList.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
  } else {
    // Show bookmarks list
    if (emptyState) emptyState.style.display = 'none';
    if (bookmarksList) {
      bookmarksList.style.display = 'block';
      bookmarksList.innerHTML = renderBookmarks(bookmarks);
      initRemoveButtons();
    }
    if (clearBtn) clearBtn.style.display = 'inline-block';
  }
}

/**
 * Initialize remove bookmark buttons
 */
function initRemoveButtons() {
  document.querySelectorAll('.remove-bookmark-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const restaurantId = parseInt(btn.dataset.restaurantId, 10);
      if (removeBookmark(restaurantId)) {
        // Remove the bookmark item from DOM with animation
        const item = btn.closest('[data-bookmark-id]');
        if (item) {
          item.style.opacity = '0';
          item.style.transition = 'opacity 200ms ease-out';
          setTimeout(() => {
            item.remove();
            updateDisplay();
          }, 200);
        }
      }
    });
  });
}

/**
 * Initialize sort select
 */
function initSortSelect() {
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      updateDisplay();
    });
  }
}

/**
 * Initialize clear all button
 */
function initClearAllButton() {
  const clearBtn = document.getElementById('clear-all-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all bookmarks? This cannot be undone.')) {
        clearBookmarks();
        updateDisplay();
      }
    });
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

/**
 * Initialize the page
 */
function init() {
  // Insert navigation bar
  insertNavBar({ currentPage: 'bookmarks' });

  // Initialize controls
  initSortSelect();
  initClearAllButton();

  // Initial display
  updateDisplay();

  // Listen for bookmark changes from other pages
  document.addEventListener('bookmarkToggled', () => {
    updateDisplay();
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
