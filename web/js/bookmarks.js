/**
 * Bookmarks Module
 * Manages browser-based restaurant bookmarks using LocalStorage
 */

const BOOKMARKS_KEY = 'grub_stars_bookmarks';

/**
 * Add a restaurant to bookmarks
 * @param {number} restaurantId - Restaurant ID
 * @param {string} name - Restaurant name
 * @returns {boolean} - true if added, false if already bookmarked
 */
export function addBookmark(restaurantId, name) {
  const bookmarks = getBookmarks();

  // Check if already bookmarked
  if (bookmarks.some(b => b.restaurantId === restaurantId)) {
    return false;
  }

  bookmarks.push({
    restaurantId,
    name,
    bookmarkedAt: new Date().toISOString()
  });

  saveBookmarks(bookmarks);
  return true;
}

/**
 * Remove a restaurant from bookmarks
 * @param {number} restaurantId - Restaurant ID
 * @returns {boolean} - true if removed, false if not found
 */
export function removeBookmark(restaurantId) {
  const bookmarks = getBookmarks();
  const initialLength = bookmarks.length;

  const filtered = bookmarks.filter(b => b.restaurantId !== restaurantId);

  if (filtered.length < initialLength) {
    saveBookmarks(filtered);
    return true;
  }

  return false;
}

/**
 * Toggle bookmark status for a restaurant
 * @param {number} restaurantId - Restaurant ID
 * @param {string} name - Restaurant name
 * @returns {boolean} - true if bookmarked after toggle, false if unbookmarked
 */
export function toggleBookmark(restaurantId, name) {
  if (isBookmarked(restaurantId)) {
    removeBookmark(restaurantId);
    return false;
  } else {
    addBookmark(restaurantId, name);
    return true;
  }
}

/**
 * Check if a restaurant is bookmarked
 * @param {number} restaurantId - Restaurant ID
 * @returns {boolean} - true if bookmarked
 */
export function isBookmarked(restaurantId) {
  const bookmarks = getBookmarks();
  return bookmarks.some(b => b.restaurantId === restaurantId);
}

/**
 * Get all bookmarks
 * @returns {Array} - Array of bookmark objects
 */
export function getBookmarks() {
  try {
    const stored = localStorage.getItem(BOOKMARKS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error reading bookmarks from localStorage:', e);
    return [];
  }
}

/**
 * Save bookmarks to localStorage
 * @param {Array} bookmarks - Array of bookmark objects
 */
function saveBookmarks(bookmarks) {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch (e) {
    console.error('Error saving bookmarks to localStorage:', e);
  }
}

/**
 * Get bookmarks sorted by date (newest first)
 * @returns {Array} - Bookmarks sorted by date
 */
export function getBookmarksSortedByDate() {
  const bookmarks = getBookmarks();
  return bookmarks.sort((a, b) => {
    const dateA = new Date(a.bookmarkedAt);
    const dateB = new Date(b.bookmarkedAt);
    return dateB - dateA;
  });
}

/**
 * Get bookmarks sorted by name (A-Z)
 * @returns {Array} - Bookmarks sorted by name
 */
export function getBookmarksSortedByName() {
  const bookmarks = getBookmarks();
  return bookmarks.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Clear all bookmarks
 * @returns {number} - Number of bookmarks that were cleared
 */
export function clearBookmarks() {
  const count = getBookmarks().length;
  localStorage.removeItem(BOOKMARKS_KEY);
  return count;
}

/**
 * Get bookmark count
 * @returns {number} - Total number of bookmarks
 */
export function getBookmarkCount() {
  return getBookmarks().length;
}

/**
 * Export bookmarks as JSON
 * @returns {string} - JSON string of bookmarks
 */
export function exportBookmarks() {
  const bookmarks = getBookmarks();
  return JSON.stringify(bookmarks, null, 2);
}

/**
 * Import bookmarks from JSON (merges with existing)
 * @param {string} jsonString - JSON string of bookmarks
 * @returns {Object} - { success: boolean, count: number, error?: string }
 */
export function importBookmarks(jsonString) {
  try {
    const imported = JSON.parse(jsonString);
    if (!Array.isArray(imported)) {
      return { success: false, count: 0, error: 'JSON must be an array' };
    }

    const current = getBookmarks();

    // Merge, removing duplicates
    const merged = [...current];
    let addedCount = 0;

    for (const item of imported) {
      if (item.restaurantId && !current.some(b => b.restaurantId === item.restaurantId)) {
        merged.push(item);
        addedCount++;
      }
    }

    saveBookmarks(merged);
    return { success: true, count: addedCount };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}
