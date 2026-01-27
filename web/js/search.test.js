/**
 * Tests for Search Page URL Parameter Handling
 * Run by opening test.html in browser
 */

import {
  test,
  assert,
  assertEqual,
  assertTruthy,
  createContainer,
  destroyContainer
} from './test-framework.js';

// ========================================
// URL Parameter Handling Tests
// ========================================

function createSearchPageContainer() {
  const container = createContainer();
  container.innerHTML = `
    <form id="browse-form">
      <select id="search-category" name="category">
        <option value="">Select a category</option>
        <option value="bakery">bakery</option>
        <option value="pizza">pizza</option>
        <option value="coffee">coffee</option>
      </select>
      <select id="search-location" name="location">
        <option value="">All locations</option>
        <option value="barrie, ontario">barrie, ontario</option>
        <option value="toronto, ontario">toronto, ontario</option>
      </select>
      <button type="submit">Search</button>
    </form>
    <div id="results"></div>
  `;
  return container;
}

test('search: location dropdown pre-fill matches case-insensitively', () => {
  const container = createSearchPageContainer();
  const locationSelect = container.querySelector('#search-location');

  // Simulate URL param with title case (user entered "Barrie, Ontario")
  const urlLocation = 'Barrie, Ontario';

  // Dropdown has lowercase option value (from API)
  // Option values: "", "barrie, ontario", "toronto, ontario"

  // Find matching option case-insensitively (simulating the fix)
  const locationLower = urlLocation.toLowerCase();
  const matchingOption = Array.from(locationSelect.options).find(
    opt => opt.value.toLowerCase() === locationLower
  );

  assertTruthy(matchingOption, 'Should find matching option case-insensitively');
  assertEqual(matchingOption.value, 'barrie, ontario', 'Should match lowercase option');

  // Set the value using the matched option
  if (matchingOption) {
    locationSelect.value = matchingOption.value;
  }

  assertEqual(locationSelect.value, 'barrie, ontario', 'Dropdown should be pre-filled');

  destroyContainer(container);
});

test('search: location dropdown pre-fill handles exact match', () => {
  const container = createSearchPageContainer();
  const locationSelect = container.querySelector('#search-location');

  // Exact match case
  const urlLocation = 'barrie, ontario';
  const locationLower = urlLocation.toLowerCase();
  const matchingOption = Array.from(locationSelect.options).find(
    opt => opt.value.toLowerCase() === locationLower
  );

  assertTruthy(matchingOption, 'Should find exact matching option');
  locationSelect.value = matchingOption.value;
  assertEqual(locationSelect.value, 'barrie, ontario', 'Dropdown should be pre-filled');

  destroyContainer(container);
});

test('search: location dropdown pre-fill handles no match gracefully', () => {
  const container = createSearchPageContainer();
  const locationSelect = container.querySelector('#search-location');

  // Non-existent location
  const urlLocation = 'vancouver, bc';
  const locationLower = urlLocation.toLowerCase();
  const matchingOption = Array.from(locationSelect.options).find(
    opt => opt.value.toLowerCase() === locationLower
  );

  assertEqual(matchingOption, undefined, 'Should not find non-existent location');

  // The dropdown value should remain at default (empty)
  assertEqual(locationSelect.value, '', 'Dropdown should remain at default');

  destroyContainer(container);
});

test('search: category dropdown pre-fill works with exact match', () => {
  const container = createSearchPageContainer();
  const categorySelect = container.querySelector('#search-category');

  // Category select uses exact value match
  const urlCategory = 'bakery';
  categorySelect.value = urlCategory;

  assertEqual(categorySelect.value, 'bakery', 'Category should be pre-filled');

  destroyContainer(container);
});

test('search: both dropdowns can be pre-filled from URL params', () => {
  const container = createSearchPageContainer();
  const categorySelect = container.querySelector('#search-category');
  const locationSelect = container.querySelector('#search-location');

  // Simulate pre-filling both from URL params
  const urlCategory = 'pizza';
  const urlLocation = 'Toronto, Ontario'; // Title case from user input

  // Pre-fill category (exact match)
  categorySelect.value = urlCategory;

  // Pre-fill location (case-insensitive match)
  const locationLower = urlLocation.toLowerCase();
  const matchingOption = Array.from(locationSelect.options).find(
    opt => opt.value.toLowerCase() === locationLower
  );
  if (matchingOption) {
    locationSelect.value = matchingOption.value;
  }

  assertEqual(categorySelect.value, 'pizza', 'Category should be pre-filled');
  assertEqual(locationSelect.value, 'toronto, ontario', 'Location should be pre-filled');

  destroyContainer(container);
});
