/**
 * Tests for bookmarks.js module
 */

import {
  test, assertEqual, assertTruthy, assertFalsy, createContainer, destroyContainer
} from './test-framework.js';

import {
  addBookmark, removeBookmark, toggleBookmark, isBookmarked, getBookmarks,
  getBookmarksSortedByDate, getBookmarksSortedByName, clearBookmarks,
  getBookmarkCount, exportBookmarks, importBookmarks
} from './bookmarks.js';

// Clean up bookmarks before each test
function cleanupBookmarks() {
  localStorage.removeItem('grub_stars_bookmarks');
}

test('addBookmark adds a new bookmark', () => {
  cleanupBookmarks();

  const result = addBookmark(1, 'Pizza Place');
  assertEqual(result, true, 'Should return true when adding new bookmark');
  assertEqual(getBookmarkCount(), 1, 'Should have 1 bookmark');

  const bookmarks = getBookmarks();
  assertTruthy(bookmarks[0].restaurantId === 1, 'Bookmark should have correct ID');
  assertTruthy(bookmarks[0].name === 'Pizza Place', 'Bookmark should have correct name');
  assertTruthy(bookmarks[0].bookmarkedAt, 'Bookmark should have timestamp');
});

test('addBookmark returns false for duplicate', () => {
  cleanupBookmarks();

  addBookmark(1, 'Pizza Place');
  const result = addBookmark(1, 'Pizza Place');
  assertEqual(result, false, 'Should return false when adding duplicate');
  assertEqual(getBookmarkCount(), 1, 'Should still have only 1 bookmark');
});

test('removeBookmark removes a bookmark', () => {
  cleanupBookmarks();

  addBookmark(1, 'Pizza Place');
  const result = removeBookmark(1);
  assertEqual(result, true, 'Should return true when removing existing bookmark');
  assertEqual(getBookmarkCount(), 0, 'Should have 0 bookmarks');
});

test('removeBookmark returns false for non-existent bookmark', () => {
  cleanupBookmarks();

  const result = removeBookmark(999);
  assertEqual(result, false, 'Should return false when removing non-existent bookmark');
});

test('toggleBookmark adds bookmark if not exists', () => {
  cleanupBookmarks();

  const result = toggleBookmark(1, 'Pizza Place');
  assertEqual(result, true, 'Should return true when adding bookmark');
  assertEqual(isBookmarked(1), true, 'Restaurant should be bookmarked');
});

test('toggleBookmark removes bookmark if exists', () => {
  cleanupBookmarks();

  addBookmark(1, 'Pizza Place');
  const result = toggleBookmark(1, 'Pizza Place');
  assertEqual(result, false, 'Should return false when removing bookmark');
  assertEqual(isBookmarked(1), false, 'Restaurant should not be bookmarked');
});

test('isBookmarked correctly identifies bookmarked restaurants', () => {
  cleanupBookmarks();

  addBookmark(1, 'Pizza Place');
  assertEqual(isBookmarked(1), true, 'Should return true for bookmarked restaurant');
  assertEqual(isBookmarked(2), false, 'Should return false for non-bookmarked restaurant');
});

test('getBookmarks returns all bookmarks', () => {
  cleanupBookmarks();

  addBookmark(1, 'Pizza Place');
  addBookmark(2, 'Burger Joint');
  addBookmark(3, 'Sushi Bar');

  const bookmarks = getBookmarks();
  assertEqual(bookmarks.length, 3, 'Should have 3 bookmarks');
});

test('getBookmarksSortedByDate returns bookmarks sorted newest first', () => {
  cleanupBookmarks();

  addBookmark(1, 'Pizza Place');
  // Add small delay to ensure different timestamps
  const bookmarks1 = getBookmarks();
  const savedTime = bookmarks1[0].bookmarkedAt;

  // Add another bookmark
  addBookmark(2, 'Burger Joint');
  const bookmarks2 = getBookmarks();
  bookmarks2[1].bookmarkedAt = savedTime; // Same as first

  localStorage.setItem('grub_stars_bookmarks', JSON.stringify(bookmarks2));

  addBookmark(3, 'Sushi Bar');

  const sorted = getBookmarksSortedByDate();
  assertEqual(sorted.length, 3, 'Should have 3 bookmarks');
  assertEqual(sorted[0].restaurantId, 3, 'Most recent should be first');
});

test('getBookmarksSortedByName returns bookmarks sorted A-Z', () => {
  cleanupBookmarks();

  addBookmark(1, 'Zebra Restaurant');
  addBookmark(2, 'Apple Cafe');
  addBookmark(3, 'Mango Bar');

  const sorted = getBookmarksSortedByName();
  assertEqual(sorted.length, 3, 'Should have 3 bookmarks');
  assertEqual(sorted[0].name, 'Apple Cafe', 'First should be Apple Cafe');
  assertEqual(sorted[1].name, 'Mango Bar', 'Second should be Mango Bar');
  assertEqual(sorted[2].name, 'Zebra Restaurant', 'Third should be Zebra Restaurant');
});

test('clearBookmarks removes all bookmarks', () => {
  cleanupBookmarks();

  addBookmark(1, 'Pizza Place');
  addBookmark(2, 'Burger Joint');

  const count = clearBookmarks();
  assertEqual(count, 2, 'Should return count of cleared bookmarks');
  assertEqual(getBookmarkCount(), 0, 'Should have 0 bookmarks after clearing');
});

test('getBookmarkCount returns correct count', () => {
  cleanupBookmarks();

  assertEqual(getBookmarkCount(), 0, 'Should have 0 bookmarks initially');
  addBookmark(1, 'Pizza Place');
  assertEqual(getBookmarkCount(), 1, 'Should have 1 bookmark');
  addBookmark(2, 'Burger Joint');
  assertEqual(getBookmarkCount(), 2, 'Should have 2 bookmarks');
  removeBookmark(1);
  assertEqual(getBookmarkCount(), 1, 'Should have 1 bookmark after removal');
});

test('exportBookmarks returns valid JSON', () => {
  cleanupBookmarks();

  addBookmark(1, 'Pizza Place');
  addBookmark(2, 'Burger Joint');

  const json = exportBookmarks();
  const parsed = JSON.parse(json);

  assertEqual(Array.isArray(parsed), true, 'Should export as array');
  assertEqual(parsed.length, 2, 'Should have 2 bookmarks');
  assertEqual(parsed[0].restaurantId, 1, 'Should have correct first bookmark');
});

test('importBookmarks merges bookmarks correctly', () => {
  cleanupBookmarks();

  addBookmark(1, 'Pizza Place');

  const importJson = JSON.stringify([
    { restaurantId: 2, name: 'Burger Joint', bookmarkedAt: new Date().toISOString() },
    { restaurantId: 3, name: 'Sushi Bar', bookmarkedAt: new Date().toISOString() }
  ]);

  const result = importBookmarks(importJson);
  assertEqual(result.success, true, 'Should succeed');
  assertEqual(result.count, 2, 'Should add 2 new bookmarks');
  assertEqual(getBookmarkCount(), 3, 'Should have 3 total bookmarks');
});

test('importBookmarks skips duplicates', () => {
  cleanupBookmarks();

  addBookmark(1, 'Pizza Place');

  const importJson = JSON.stringify([
    { restaurantId: 1, name: 'Pizza Place', bookmarkedAt: new Date().toISOString() },
    { restaurantId: 2, name: 'Burger Joint', bookmarkedAt: new Date().toISOString() }
  ]);

  const result = importBookmarks(importJson);
  assertEqual(result.count, 1, 'Should add only 1 new bookmark (skip duplicate)');
  assertEqual(getBookmarkCount(), 2, 'Should have 2 total bookmarks');
});

test('importBookmarks handles invalid JSON', () => {
  cleanupBookmarks();

  const result = importBookmarks('invalid json');
  assertEqual(result.success, false, 'Should fail on invalid JSON');
  assertTruthy(result.error, 'Should have error message');
});

test('importBookmarks requires array format', () => {
  cleanupBookmarks();

  const result = importBookmarks('{"not": "array"}');
  assertEqual(result.success, false, 'Should fail on non-array JSON');
  assertTruthy(result.error, 'Should have error message');
});

test('bookmarks persist in localStorage', () => {
  cleanupBookmarks();

  addBookmark(1, 'Pizza Place');
  addBookmark(2, 'Burger Joint');

  const stored = localStorage.getItem('grub_stars_bookmarks');
  assertTruthy(stored, 'Should be stored in localStorage');

  const parsed = JSON.parse(stored);
  assertEqual(parsed.length, 2, 'Stored data should have 2 bookmarks');
});
