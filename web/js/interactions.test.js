/**
 * Interaction Tests
 * Tests for DOM interactions: clicks, form submissions, typing, etc.
 * Demonstrates usage of the test framework's DOM interaction utilities.
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
  dblclick,
  submit,
  type,
  clear,
  select,
  keyPress,
  focus,
  blur,
  waitFor,
  waitForElement,
  waitForText,
  createMockFn
} from './test-framework.js';

import { errorMessage } from './components/error-message.js';
import { restaurantCard } from './components/restaurant-card.js';

// ========================================
// Click Interaction Tests
// ========================================

test('click triggers event handler', () => {
  const container = createContainer();
  let clicked = false;

  container.innerHTML = '<button id="test-btn">Click Me</button>';
  const button = container.querySelector('#test-btn');

  button.addEventListener('click', () => {
    clicked = true;
  });

  click(button);

  assert(clicked, 'Button click should have triggered handler');
  destroyContainer(container);
});

test('click event bubbles to parent', () => {
  const container = createContainer();
  let parentClicked = false;
  let childClicked = false;

  container.innerHTML = `
    <div id="parent">
      <button id="child">Click Me</button>
    </div>
  `;

  container.querySelector('#parent').addEventListener('click', () => {
    parentClicked = true;
  });

  container.querySelector('#child').addEventListener('click', () => {
    childClicked = true;
  });

  click(container.querySelector('#child'));

  assert(childClicked, 'Child click handler should fire');
  assert(parentClicked, 'Parent click handler should fire (bubbling)');
  destroyContainer(container);
});

test('retry button click is detected via data-action attribute', () => {
  const container = createContainer();
  let retryTriggered = false;

  // Render error message with retry button
  container.innerHTML = errorMessage('Connection failed', { showRetry: true });

  // Set up delegated click handler (like search.js does)
  container.addEventListener('click', (event) => {
    if (event.target.dataset.action === 'retry') {
      retryTriggered = true;
    }
  });

  // Find and click the retry button
  const retryButton = container.querySelector('[data-action="retry"]');
  assertTruthy(retryButton, 'Retry button should exist');

  click(retryButton);

  assert(retryTriggered, 'Retry action should have been triggered');
  destroyContainer(container);
});

test('double click triggers dblclick handler', () => {
  const container = createContainer();
  let doubleClicked = false;

  container.innerHTML = '<div id="dbl-target">Double click me</div>';
  const target = container.querySelector('#dbl-target');

  target.addEventListener('dblclick', () => {
    doubleClicked = true;
  });

  dblclick(target);

  assert(doubleClicked, 'Double click handler should have fired');
  destroyContainer(container);
});

test('restaurant card link receives click', () => {
  const container = createContainer();
  let linkClicked = false;

  const restaurant = {
    id: 123,
    name: 'Test Restaurant',
    address: '123 Main St',
    ratings: []
  };

  container.innerHTML = restaurantCard(restaurant);

  // Intercept link click
  const link = container.querySelector('a');
  link.addEventListener('click', (e) => {
    e.preventDefault();
    linkClicked = true;
  });

  click(link);

  assert(linkClicked, 'Restaurant card link should be clickable');
  assertTruthy(link.href.includes('details.html?id=123'), 'Link should go to details page');
  destroyContainer(container);
});

// ========================================
// Form Submission Tests
// ========================================

test('form submit event fires', () => {
  const container = createContainer();
  let formSubmitted = false;

  container.innerHTML = `
    <form id="test-form">
      <input type="text" name="query" />
      <button type="submit">Search</button>
    </form>
  `;

  const form = container.querySelector('#test-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    formSubmitted = true;
  });

  submit(form);

  assert(formSubmitted, 'Form submit event should have fired');
  destroyContainer(container);
});

test('form submit captures input values', () => {
  const container = createContainer();
  let capturedData = null;

  container.innerHTML = `
    <form id="search-form">
      <input type="text" name="name" id="name-input" />
      <select name="category" id="category-select">
        <option value="">All</option>
        <option value="italian">Italian</option>
        <option value="bakery">Bakery</option>
      </select>
      <button type="submit">Search</button>
    </form>
  `;

  const form = container.querySelector('#search-form');
  const nameInput = container.querySelector('#name-input');
  const categorySelect = container.querySelector('#category-select');

  // Fill in the form
  type(nameInput, 'Pizza Palace');
  select(categorySelect, 'italian');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    capturedData = {
      name: formData.get('name'),
      category: formData.get('category')
    };
  });

  submit(form);

  assertEqual(capturedData.name, 'Pizza Palace', 'Name should be captured');
  assertEqual(capturedData.category, 'italian', 'Category should be captured');
  destroyContainer(container);
});

test('submit button click triggers form submission', () => {
  const container = createContainer();
  let formSubmitted = false;

  container.innerHTML = `
    <form id="test-form">
      <input type="text" name="query" />
      <button type="submit" id="submit-btn">Submit</button>
    </form>
  `;

  const form = container.querySelector('#test-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    formSubmitted = true;
  });

  // Click the submit button instead of calling submit()
  click(container.querySelector('#submit-btn'));

  assert(formSubmitted, 'Clicking submit button should trigger form submission');
  destroyContainer(container);
});

// ========================================
// Input Typing Tests
// ========================================

test('type sets input value', () => {
  const container = createContainer();

  container.innerHTML = '<input type="text" id="test-input" />';
  const input = container.querySelector('#test-input');

  type(input, 'Hello World');

  assertEqual(input.value, 'Hello World', 'Input value should be set');
  destroyContainer(container);
});

test('type triggers input event', () => {
  const container = createContainer();
  let inputEventFired = false;

  container.innerHTML = '<input type="text" id="test-input" />';
  const input = container.querySelector('#test-input');

  input.addEventListener('input', () => {
    inputEventFired = true;
  });

  type(input, 'Test');

  assert(inputEventFired, 'Input event should have fired');
  destroyContainer(container);
});

test('type triggers change event', () => {
  const container = createContainer();
  let changeEventFired = false;

  container.innerHTML = '<input type="text" id="test-input" />';
  const input = container.querySelector('#test-input');

  input.addEventListener('change', () => {
    changeEventFired = true;
  });

  type(input, 'Test');

  assert(changeEventFired, 'Change event should have fired');
  destroyContainer(container);
});

test('clear empties input value', () => {
  const container = createContainer();

  container.innerHTML = '<input type="text" id="test-input" value="existing value" />';
  const input = container.querySelector('#test-input');

  assertEqual(input.value, 'existing value', 'Input should have initial value');

  clear(input);

  assertEqual(input.value, '', 'Input should be empty after clear');
  destroyContainer(container);
});

// ========================================
// Select Dropdown Tests
// ========================================

test('select changes dropdown value', () => {
  const container = createContainer();

  container.innerHTML = `
    <select id="test-select">
      <option value="">Choose...</option>
      <option value="a">Option A</option>
      <option value="b">Option B</option>
    </select>
  `;

  const dropdown = container.querySelector('#test-select');
  select(dropdown, 'b');

  assertEqual(dropdown.value, 'b', 'Dropdown value should be changed');
  destroyContainer(container);
});

test('select triggers change event', () => {
  const container = createContainer();
  let changeValue = null;

  container.innerHTML = `
    <select id="test-select">
      <option value="">Choose...</option>
      <option value="italian">Italian</option>
    </select>
  `;

  const dropdown = container.querySelector('#test-select');

  dropdown.addEventListener('change', (e) => {
    changeValue = e.target.value;
  });

  select(dropdown, 'italian');

  assertEqual(changeValue, 'italian', 'Change event should capture new value');
  destroyContainer(container);
});

// ========================================
// Keyboard Event Tests
// ========================================

test('keyPress triggers keydown event', () => {
  const container = createContainer();
  let keyPressed = null;

  container.innerHTML = '<input type="text" id="test-input" />';
  const input = container.querySelector('#test-input');

  input.addEventListener('keydown', (e) => {
    keyPressed = e.key;
  });

  keyPress(input, 'Enter');

  assertEqual(keyPressed, 'Enter', 'Enter key should have been pressed');
  destroyContainer(container);
});

test('keyPress can trigger keyup event', () => {
  const container = createContainer();
  let keyReleased = null;

  container.innerHTML = '<input type="text" id="test-input" />';
  const input = container.querySelector('#test-input');

  input.addEventListener('keyup', (e) => {
    keyReleased = e.key;
  });

  keyPress(input, 'Escape', 'keyup');

  assertEqual(keyReleased, 'Escape', 'Escape key should have been released');
  destroyContainer(container);
});

test('Enter key can submit form', () => {
  const container = createContainer();
  let formSubmitted = false;

  container.innerHTML = `
    <form id="test-form">
      <input type="text" id="test-input" />
    </form>
  `;

  const form = container.querySelector('#test-form');
  const input = container.querySelector('#test-input');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    formSubmitted = true;
  });

  // Simulate Enter key on input (browser behavior varies)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submit(form);
    }
  });

  keyPress(input, 'Enter');

  assert(formSubmitted, 'Enter key should trigger form submission');
  destroyContainer(container);
});

// ========================================
// Focus and Blur Tests
// ========================================

test('focus triggers focus event', () => {
  const container = createContainer();
  let focused = false;

  container.innerHTML = '<input type="text" id="test-input" />';
  const input = container.querySelector('#test-input');

  input.addEventListener('focus', () => {
    focused = true;
  });

  focus(input);

  assert(focused, 'Focus event should have fired');
  destroyContainer(container);
});

test('blur triggers blur event', () => {
  const container = createContainer();
  let blurred = false;

  container.innerHTML = '<input type="text" id="test-input" />';
  const input = container.querySelector('#test-input');

  input.addEventListener('blur', () => {
    blurred = true;
  });

  focus(input);
  blur(input);

  assert(blurred, 'Blur event should have fired');
  destroyContainer(container);
});

// ========================================
// Mock Function Tests
// ========================================

test('createMockFn tracks calls', () => {
  const mockFn = createMockFn();

  mockFn('arg1', 'arg2');
  mockFn('arg3');

  assertEqual(mockFn.callCount(), 2, 'Should track call count');
  assert(mockFn.calledWith('arg1', 'arg2'), 'Should track call arguments');
  assert(mockFn.calledWith('arg3'), 'Should track second call');
  assertFalsy(mockFn.calledWith('never'), 'Should not match uncalled args');
});

test('createMockFn can return values', () => {
  const mockFn = createMockFn().returns('mocked value');

  const result = mockFn();

  assertEqual(result, 'mocked value', 'Should return configured value');
});

test('createMockFn can be reset', () => {
  const mockFn = createMockFn();

  mockFn('call1');
  mockFn('call2');
  assertEqual(mockFn.callCount(), 2, 'Should have 2 calls');

  mockFn.reset();

  assertEqual(mockFn.callCount(), 0, 'Should have 0 calls after reset');
});

test('mock function as click handler', () => {
  const container = createContainer();
  const mockHandler = createMockFn();

  container.innerHTML = '<button id="btn">Click</button>';
  const button = container.querySelector('#btn');

  button.addEventListener('click', mockHandler);

  click(button);
  click(button);

  assertEqual(mockHandler.callCount(), 2, 'Handler should be called twice');
  destroyContainer(container);
});

// ========================================
// Async Wait Tests
// ========================================

test('waitFor resolves when condition is met', async () => {
  let conditionMet = false;

  // Simulate async operation
  setTimeout(() => {
    conditionMet = true;
  }, 100);

  await waitFor(() => conditionMet, 500);

  assert(conditionMet, 'Condition should be met');
});

test('waitFor throws on timeout', async () => {
  let threw = false;

  try {
    await waitFor(() => false, 100);
  } catch (e) {
    threw = true;
    assertTruthy(e.message.includes('Timeout'), 'Should throw timeout error');
  }

  assert(threw, 'Should have thrown timeout error');
});

test('waitForElement finds dynamically added element', async () => {
  const container = createContainer();

  // Add element after delay
  setTimeout(() => {
    container.innerHTML = '<div id="dynamic">I appeared!</div>';
  }, 50);

  const element = await waitForElement(container, '#dynamic', 500);

  assertTruthy(element, 'Should find the element');
  assertEqual(element.textContent, 'I appeared!', 'Should have correct content');
  destroyContainer(container);
});

test('waitForText finds text in element', async () => {
  const container = createContainer();
  container.innerHTML = '<div id="status">Loading...</div>';
  const statusDiv = container.querySelector('#status');

  // Update text after delay
  setTimeout(() => {
    statusDiv.textContent = 'Complete!';
  }, 50);

  await waitForText(statusDiv, 'Complete', 500);

  assertTruthy(statusDiv.textContent.includes('Complete'), 'Text should be updated');
  destroyContainer(container);
});

// ========================================
// Integration: Simulating Search Flow
// ========================================

test('simulated search flow: type, select, submit', async () => {
  const container = createContainer();
  let searchParams = null;

  container.innerHTML = `
    <form id="search-form">
      <input type="text" name="name" id="search-name" />
      <select name="category" id="search-category">
        <option value="">All Categories</option>
        <option value="bakery">Bakery</option>
        <option value="italian">Italian</option>
      </select>
      <select name="location" id="search-location">
        <option value="">All Locations</option>
        <option value="barrie">Barrie, Ontario</option>
      </select>
      <button type="submit">Search</button>
    </form>
    <div id="results"></div>
  `;

  const form = container.querySelector('#search-form');
  const nameInput = container.querySelector('#search-name');
  const categorySelect = container.querySelector('#search-category');
  const locationSelect = container.querySelector('#search-location');
  const resultsDiv = container.querySelector('#results');

  // Set up form handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    searchParams = {
      name: formData.get('name'),
      category: formData.get('category'),
      location: formData.get('location')
    };

    // Simulate showing results
    resultsDiv.innerHTML = '<div class="result">Found 5 restaurants</div>';
  });

  // Simulate user interaction
  type(nameInput, 'Pizza');
  select(categorySelect, 'italian');
  select(locationSelect, 'barrie');
  submit(form);

  // Verify form data was captured
  assertEqual(searchParams.name, 'Pizza', 'Name should be captured');
  assertEqual(searchParams.category, 'italian', 'Category should be captured');
  assertEqual(searchParams.location, 'barrie', 'Location should be captured');

  // Verify results appeared
  const result = await waitForElement(container, '.result', 500);
  assertTruthy(result.textContent.includes('5 restaurants'), 'Results should show');

  destroyContainer(container);
});

test('simulated error and retry flow', async () => {
  const container = createContainer();
  let searchAttempts = 0;

  container.innerHTML = '<div id="results"></div>';
  const resultsDiv = container.querySelector('#results');

  // Simulate a search that fails first, then succeeds
  const performSearch = () => {
    searchAttempts++;
    if (searchAttempts === 1) {
      resultsDiv.innerHTML = errorMessage('Network error', { showRetry: true });
    } else {
      resultsDiv.innerHTML = '<div class="success">Found results!</div>';
    }
  };

  // Set up retry handler
  container.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'retry') {
      performSearch();
    }
  });

  // Initial search fails
  performSearch();
  assertEqual(searchAttempts, 1, 'Should have 1 search attempt');

  // Find and click retry button
  const retryButton = await waitForElement(container, '[data-action="retry"]', 500);
  click(retryButton);

  assertEqual(searchAttempts, 2, 'Should have 2 search attempts after retry');

  // Verify success message
  const success = await waitForElement(container, '.success', 500);
  assertTruthy(success.textContent.includes('Found results'), 'Should show success');

  destroyContainer(container);
});
