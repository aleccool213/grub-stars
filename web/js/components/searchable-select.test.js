/**
 * Searchable Select Component Tests
 */
import {
  test,
  assert,
  assertEqual,
  assertTruthy,
  assertFalsy,
  createContainer,
  destroyContainer,
  click,
  type,
  keyPress,
  focus,
  waitFor,
  createMockFn
} from '../test-framework.js';
import { initSearchableSelect } from './searchable-select.js';

// Test: Basic initialization
test('searchable-select: initializes with input element', () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const instance = initSearchableSelect(input, {
    options: ['Option 1', 'Option 2', 'Option 3']
  });

  assertTruthy(instance, 'Instance should be created');
  assertTruthy(instance.getValue, 'Instance should have getValue method');
  assertTruthy(instance.setValue, 'Instance should have setValue method');
  assertTruthy(instance.setOptions, 'Instance should have setOptions method');
  assertTruthy(instance.destroy, 'Instance should have destroy method');

  // Check wrapper was created
  const wrapper = container.querySelector('.autocomplete-wrapper');
  assertTruthy(wrapper, 'Wrapper should be created');

  instance.destroy();
  destroyContainer(container);
});

// Test: ARIA attributes
test('searchable-select: sets proper ARIA attributes', () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const instance = initSearchableSelect(input, {
    options: ['Option 1', 'Option 2']
  });

  assertEqual(input.getAttribute('role'), 'combobox', 'Should have combobox role');
  assertEqual(input.getAttribute('aria-autocomplete'), 'list', 'Should have aria-autocomplete');
  assertEqual(input.getAttribute('aria-expanded'), 'false', 'Should start collapsed');

  instance.destroy();
  destroyContainer(container);
});

// Test: Dropdown opens on focus
test('searchable-select: opens dropdown on focus', async () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const instance = initSearchableSelect(input, {
    options: ['Apple', 'Banana', 'Cherry']
  });

  focus(input);

  await waitFor(() => {
    const dropdown = container.querySelector('.autocomplete-dropdown');
    return dropdown !== null;
  }, 1000);

  const dropdown = container.querySelector('.autocomplete-dropdown');
  assertTruthy(dropdown, 'Dropdown should be visible');
  assertEqual(input.getAttribute('aria-expanded'), 'true', 'Should be expanded');

  // Check all options are shown
  const items = container.querySelectorAll('.autocomplete-item');
  assertEqual(items.length, 3, 'Should show all options');

  instance.destroy();
  destroyContainer(container);
});

// Test: Filters options on input
test('searchable-select: filters options on input', async () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const instance = initSearchableSelect(input, {
    options: ['Apple', 'Apricot', 'Banana', 'Cherry']
  });

  type(input, 'Ap');

  await waitFor(() => {
    const items = container.querySelectorAll('.autocomplete-item');
    return items.length === 2;
  }, 1000);

  const items = container.querySelectorAll('.autocomplete-item');
  assertEqual(items.length, 2, 'Should filter to matching options');

  instance.destroy();
  destroyContainer(container);
});

// Test: Case insensitive filtering
test('searchable-select: filtering is case insensitive', async () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const instance = initSearchableSelect(input, {
    options: ['Apple', 'Banana', 'Cherry']
  });

  type(input, 'aPpLe');

  await waitFor(() => {
    const items = container.querySelectorAll('.autocomplete-item');
    return items.length === 1;
  }, 1000);

  const items = container.querySelectorAll('.autocomplete-item');
  assertEqual(items.length, 1, 'Should find option regardless of case');

  instance.destroy();
  destroyContainer(container);
});

// Test: Selecting an option
test('searchable-select: selects option on click', async () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const onSelect = createMockFn();
  const instance = initSearchableSelect(input, {
    options: ['Apple', 'Banana', 'Cherry'],
    onSelect
  });

  focus(input);

  await waitFor(() => {
    const items = container.querySelectorAll('.autocomplete-item');
    return items.length === 3;
  }, 1000);

  const items = container.querySelectorAll('.autocomplete-item');
  click(items[1]); // Click 'Banana'

  assertEqual(instance.getValue(), 'Banana', 'Should have selected value');
  assertEqual(input.value, 'Banana', 'Input should show selected label');
  assertEqual(onSelect.calls.length, 1, 'onSelect should be called');

  instance.destroy();
  destroyContainer(container);
});

// Test: Keyboard navigation
test('searchable-select: supports keyboard navigation', async () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const instance = initSearchableSelect(input, {
    options: ['Apple', 'Banana', 'Cherry']
  });

  focus(input);

  await waitFor(() => {
    const dropdown = container.querySelector('.autocomplete-dropdown');
    return dropdown !== null;
  }, 1000);

  // Press down arrow to highlight first item
  keyPress(input, 'ArrowDown');

  await waitFor(() => {
    const activeItem = container.querySelector('.autocomplete-item-active');
    return activeItem !== null;
  }, 1000);

  let activeItem = container.querySelector('.autocomplete-item-active');
  assertTruthy(activeItem, 'Should have active item');

  // Press down again
  keyPress(input, 'ArrowDown');

  await waitFor(() => {
    const items = container.querySelectorAll('.autocomplete-item');
    return items[1].classList.contains('autocomplete-item-active');
  }, 1000);

  // Press Enter to select
  keyPress(input, 'Enter');

  assertEqual(instance.getValue(), 'Banana', 'Should select second option');

  instance.destroy();
  destroyContainer(container);
});

// Test: Escape closes dropdown
test('searchable-select: escape closes dropdown', async () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const instance = initSearchableSelect(input, {
    options: ['Apple', 'Banana', 'Cherry']
  });

  focus(input);

  await waitFor(() => {
    const dropdown = container.querySelector('.autocomplete-dropdown');
    return dropdown !== null;
  }, 1000);

  keyPress(input, 'Escape');

  await waitFor(() => {
    const dropdown = container.querySelector('.autocomplete-dropdown');
    return dropdown === null;
  }, 1000);

  const dropdown = container.querySelector('.autocomplete-dropdown');
  assertFalsy(dropdown, 'Dropdown should be hidden');
  assertEqual(input.getAttribute('aria-expanded'), 'false', 'Should be collapsed');

  instance.destroy();
  destroyContainer(container);
});

// Test: setValue works
test('searchable-select: setValue sets the value programmatically', () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const instance = initSearchableSelect(input, {
    options: ['Apple', 'Banana', 'Cherry']
  });

  instance.setValue('Cherry');

  assertEqual(instance.getValue(), 'Cherry', 'getValue should return set value');
  assertEqual(input.value, 'Cherry', 'Input should show set label');

  instance.destroy();
  destroyContainer(container);
});

// Test: setOptions updates options
test('searchable-select: setOptions updates the options list', async () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const instance = initSearchableSelect(input, {
    options: ['Apple', 'Banana']
  });

  focus(input);

  await waitFor(() => {
    const items = container.querySelectorAll('.autocomplete-item');
    return items.length === 2;
  }, 1000);

  // Update options
  instance.setOptions(['Dog', 'Cat', 'Bird']);

  // Type to refresh dropdown
  type(input, '');
  focus(input);

  await waitFor(() => {
    const items = container.querySelectorAll('.autocomplete-item');
    return items.length === 3;
  }, 1000);

  const items = container.querySelectorAll('.autocomplete-item');
  assertEqual(items.length, 3, 'Should show new options');

  instance.destroy();
  destroyContainer(container);
});

// Test: Empty message displays
test('searchable-select: shows empty message when no options match', async () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const instance = initSearchableSelect(input, {
    options: ['Apple', 'Banana', 'Cherry'],
    emptyMessage: 'No fruits found'
  });

  type(input, 'xyz');

  await waitFor(() => {
    const empty = container.querySelector('.autocomplete-empty');
    return empty !== null;
  }, 1000);

  const empty = container.querySelector('.autocomplete-empty');
  assertTruthy(empty, 'Should show empty state');
  assert(empty.textContent.includes('No fruits found'), 'Should show custom empty message');

  instance.destroy();
  destroyContainer(container);
});

// Test: Custom icons
test('searchable-select: displays custom icons', async () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const instance = initSearchableSelect(input, {
    options: [
      { value: 'cat1', label: 'Category 1', icon: '🍕' },
      { value: 'cat2', label: 'Category 2', icon: '🍔' }
    ]
  });

  focus(input);

  await waitFor(() => {
    const items = container.querySelectorAll('.autocomplete-item');
    return items.length === 2;
  }, 1000);

  const icons = container.querySelectorAll('.autocomplete-icon');
  assertEqual(icons[0].textContent, '🍕', 'Should show first custom icon');
  assertEqual(icons[1].textContent, '🍔', 'Should show second custom icon');

  instance.destroy();
  destroyContainer(container);
});

// Test: Destroy cleans up properly
test('searchable-select: destroy cleans up DOM and listeners', () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const instance = initSearchableSelect(input, {
    options: ['Apple', 'Banana']
  });

  // Verify wrapper exists
  assertTruthy(container.querySelector('.autocomplete-wrapper'), 'Wrapper should exist');

  instance.destroy();

  // Verify wrapper is removed
  assertFalsy(container.querySelector('.autocomplete-wrapper'), 'Wrapper should be removed');

  // Verify ARIA attributes are removed
  assertFalsy(input.getAttribute('role'), 'Role should be removed');
  assertFalsy(input.getAttribute('aria-autocomplete'), 'aria-autocomplete should be removed');

  destroyContainer(container);
});

// Test: allowEmpty option
test('searchable-select: allowEmpty allows clearing selection', () => {
  const container = createContainer();
  container.innerHTML = '<input type="text" id="test-input">';
  const input = container.querySelector('#test-input');

  const instance = initSearchableSelect(input, {
    options: ['Apple', 'Banana'],
    allowEmpty: true,
    emptyLabel: 'All items'
  });

  instance.setValue('Apple');
  assertEqual(instance.getValue(), 'Apple', 'Should have value');

  instance.clear();
  assertEqual(instance.getValue(), '', 'Should be empty after clear');
  assertEqual(input.value, '', 'Input should be empty');

  instance.destroy();
  destroyContainer(container);
});

// Test: Click outside closes dropdown
test('searchable-select: clicking outside closes dropdown', async () => {
  const container = createContainer();
  container.innerHTML = `
    <input type="text" id="test-input">
    <button id="outside-btn">Outside</button>
  `;
  const input = container.querySelector('#test-input');
  const outsideBtn = container.querySelector('#outside-btn');

  const instance = initSearchableSelect(input, {
    options: ['Apple', 'Banana']
  });

  focus(input);

  await waitFor(() => {
    const dropdown = container.querySelector('.autocomplete-dropdown');
    return dropdown !== null;
  }, 1000);

  // Click outside
  click(outsideBtn);

  await waitFor(() => {
    const dropdown = container.querySelector('.autocomplete-dropdown');
    return dropdown === null;
  }, 1000);

  const dropdown = container.querySelector('.autocomplete-dropdown');
  assertFalsy(dropdown, 'Dropdown should close when clicking outside');

  instance.destroy();
  destroyContainer(container);
});
