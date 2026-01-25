/**
 * Tests for bookmark-button component
 */

import {
  test, assertEqual, assertTruthy, assertFalsy, createContainer, destroyContainer, click
} from '../test-framework.js';

import { bookmarkButton, initBookmarkButtons } from './bookmark-button.js';
import { clearBookmarks } from '../bookmarks.js';

// Clean up bookmarks before each test
function cleanupBookmarks() {
  localStorage.removeItem('grub_stars_bookmarks');
  clearBookmarks();
}

test('bookmarkButton renders icon variant by default', () => {
  const html = bookmarkButton({ restaurantId: 1, name: 'Test Restaurant' });
  assertTruthy(html.includes('svg'), 'Should include SVG icon');
  assertTruthy(html.includes('bookmark-btn'), 'Should have bookmark-btn class');
  assertTruthy(html.includes('data-restaurant-id="1"'), 'Should have restaurant ID attribute');
});

test('bookmarkButton renders button variant when specified', () => {
  const html = bookmarkButton({ restaurantId: 1, name: 'Test Restaurant', variant: 'button' });
  assertTruthy(html.includes('Add to bookmarks'), 'Should include button text');
  assertTruthy(html.includes('svg'), 'Should still include icon');
});

test('bookmarkButton shows filled heart when already bookmarked', () => {
  cleanupBookmarks();

  // Add bookmark first
  localStorage.setItem('grub_stars_bookmarks', JSON.stringify([
    { restaurantId: 1, name: 'Test Restaurant', bookmarkedAt: new Date().toISOString() }
  ]));

  const html = bookmarkButton({ restaurantId: 1, name: 'Test Restaurant' });
  assertTruthy(html.includes('text-hotpink'), 'Should have hotpink color for bookmarked');
  assertTruthy(html.includes('fill="currentColor"'), 'Should have filled heart for bookmarked');
});

test('bookmarkButton shows outlined heart when not bookmarked', () => {
  cleanupBookmarks();

  const html = bookmarkButton({ restaurantId: 1, name: 'Test Restaurant' });
  assertTruthy(html.includes('text-gray-400'), 'Should have gray color for non-bookmarked');
  assertTruthy(html.includes('fill="none"'), 'Should have outlined heart for non-bookmarked');
});

test('bookmarkButton requires restaurantId', () => {
  try {
    bookmarkButton({ name: 'Test Restaurant' });
    assertFalsy(true, 'Should throw error without restaurantId');
  } catch (error) {
    assertTruthy(error.message.includes('restaurantId'), 'Should mention restaurantId in error');
  }
});

test('bookmarkButton accepts different sizes', () => {
  const html = bookmarkButton({ restaurantId: 1, name: 'Test Restaurant', size: 'lg' });
  assertTruthy(html.includes('w-8 h-8'), 'Should include large size classes');
});

test('bookmarkButton escapes HTML in restaurant name', () => {
  const html = bookmarkButton({ restaurantId: 1, name: '<script>alert("xss")</script>' });
  assertFalsy(html.includes('<script>'), 'Should escape script tags');
  assertTruthy(html.includes('data-restaurant-name='), 'Should include escaped name in data attribute');
});

test('initBookmarkButtons binds click handler', () => {
  cleanupBookmarks();

  const container = createContainer();
  const html = bookmarkButton({ restaurantId: 1, name: 'Pizza Place', variant: 'button' });
  container.innerHTML = html;

  let clickCount = 0;
  document.addEventListener('bookmarkToggled', () => {
    clickCount++;
  });

  const button = container.querySelector('.bookmark-btn');
  assertTruthy(button, 'Button should exist in DOM');

  initBookmarkButtons(container);
  click(button);

  // Give event handler time to execute
  setTimeout(() => {
    assertTruthy(clickCount > 0, 'Event should have been fired');
    destroyContainer(container);
  }, 100);
});

test('initBookmarkButtons toggles bookmark on click', () => {
  cleanupBookmarks();

  const container = createContainer();
  const html = bookmarkButton({ restaurantId: 1, name: 'Pizza Place' });
  container.innerHTML = html;

  const button = container.querySelector('.bookmark-btn');
  initBookmarkButtons(container);

  // Click to bookmark
  click(button);

  // Check that button appearance changed
  setTimeout(() => {
    assertTruthy(button.classList.contains('text-hotpink'), 'Button should show bookmarked state');
    destroyContainer(container);
  }, 100);
});

test('initBookmarkButtons dispatches custom event with correct data', () => {
  cleanupBookmarks();

  const container = createContainer();
  const html = bookmarkButton({ restaurantId: 5, name: 'Burger Joint', variant: 'button' });
  container.innerHTML = html;

  let eventData = null;
  document.addEventListener('bookmarkToggled', (e) => {
    eventData = e.detail;
  });

  const button = container.querySelector('.bookmark-btn');
  initBookmarkButtons(container);
  click(button);

  setTimeout(() => {
    assertTruthy(eventData, 'Event data should exist');
    assertEqual(eventData.restaurantId, 5, 'Event should include restaurant ID');
    assertEqual(eventData.restaurantName, 'Burger Joint', 'Event should include restaurant name');
    assertEqual(eventData.isBookmarked, true, 'Event should show bookmark was added');
    destroyContainer(container);
  }, 100);
});

test('initBookmarkButtons with callback function', () => {
  cleanupBookmarks();

  const container = createContainer();
  const html = bookmarkButton({ restaurantId: 1, name: 'Pizza Place' });
  container.innerHTML = html;

  let callbackData = null;
  const callback = (data) => {
    callbackData = data;
  };

  const button = container.querySelector('.bookmark-btn');
  initBookmarkButtons(container, callback);
  click(button);

  setTimeout(() => {
    assertTruthy(callbackData, 'Callback should have been called');
    assertEqual(callbackData.restaurantId, 1, 'Callback should include restaurant ID');
    assertTruthy(callbackData.isBookmarked, 'Callback should show bookmark state');
    destroyContainer(container);
  }, 100);
});

test('bookmarkButton shows "Bookmarked!" text for button variant when bookmarked', () => {
  cleanupBookmarks();

  localStorage.setItem('grub_stars_bookmarks', JSON.stringify([
    { restaurantId: 1, name: 'Pizza Place', bookmarkedAt: new Date().toISOString() }
  ]));

  const html = bookmarkButton({ restaurantId: 1, name: 'Pizza Place', variant: 'button' });
  assertTruthy(html.includes('Bookmarked!'), 'Should show "Bookmarked!" text');
});

test('bookmarkButton shows accessibility attributes', () => {
  cleanupBookmarks();

  const html = bookmarkButton({ restaurantId: 1, name: 'Pizza Place' });
  assertTruthy(html.includes('aria-label'), 'Should include aria-label');
  assertTruthy(html.includes('title='), 'Should include title attribute');
  assertTruthy(html.includes('Add to bookmarks'), 'Should have accessible text');
});

test('multiple bookmark buttons can coexist', () => {
  cleanupBookmarks();

  const container = createContainer();
  const html1 = bookmarkButton({ restaurantId: 1, name: 'Pizza Place' });
  const html2 = bookmarkButton({ restaurantId: 2, name: 'Burger Joint' });
  const html3 = bookmarkButton({ restaurantId: 3, name: 'Sushi Bar' });

  container.innerHTML = `${html1}${html2}${html3}`;

  const buttons = container.querySelectorAll('.bookmark-btn');
  assertEqual(buttons.length, 3, 'Should have 3 buttons');

  initBookmarkButtons(container);

  // Click first button
  click(buttons[0]);

  setTimeout(() => {
    // Verify first button is bookmarked
    assertTruthy(buttons[0].classList.contains('text-hotpink'), 'First button should be bookmarked');
    assertFalsy(buttons[1].classList.contains('text-hotpink'), 'Second button should not be bookmarked');
    assertFalsy(buttons[2].classList.contains('text-hotpink'), 'Third button should not be bookmarked');
    destroyContainer(container);
  }, 100);
});
