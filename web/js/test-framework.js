/**
 * Simple browser-based test framework
 * Zero dependencies, runs in browser console
 */

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = { passed: 0, failed: 0, total: 0 };
  }

  // ========================================
  // DOM Interaction Utilities
  // ========================================

  /**
   * Create an isolated test container in the DOM
   * @returns {HTMLElement} - Container element for testing
   */
  createContainer() {
    const container = document.createElement('div');
    container.id = 'test-container-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
    document.body.appendChild(container);
    return container;
  }

  /**
   * Clean up a test container
   * @param {HTMLElement} container - Container to remove
   */
  destroyContainer(container) {
    if (container && container.parentNode) {
      container.remove();
    }
  }

  /**
   * Simulate a click event on an element
   * @param {HTMLElement} element - Element to click
   * @param {Object} options - Additional event options
   */
  click(element, options = {}) {
    if (!element) {
      throw new Error('Cannot click on null element');
    }
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      ...options
    });
    element.dispatchEvent(event);
  }

  /**
   * Simulate a double click event
   * @param {HTMLElement} element - Element to double-click
   */
  dblclick(element) {
    if (!element) {
      throw new Error('Cannot double-click on null element');
    }
    element.dispatchEvent(new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  }

  /**
   * Simulate form submission
   * @param {HTMLFormElement} formElement - Form to submit
   */
  submit(formElement) {
    if (!formElement) {
      throw new Error('Cannot submit null form');
    }
    formElement.dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true
    }));
  }

  /**
   * Simulate typing into an input element
   * @param {HTMLInputElement} element - Input element
   * @param {string} text - Text to type
   */
  type(element, text) {
    if (!element) {
      throw new Error('Cannot type into null element');
    }
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Clear an input element
   * @param {HTMLInputElement} element - Input element to clear
   */
  clear(element) {
    this.type(element, '');
  }

  /**
   * Simulate selecting an option in a select element
   * @param {HTMLSelectElement} element - Select element
   * @param {string} value - Option value to select
   */
  select(element, value) {
    if (!element) {
      throw new Error('Cannot select on null element');
    }
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Simulate a keyboard event
   * @param {HTMLElement} element - Target element
   * @param {string} key - Key to press (e.g., 'Enter', 'Escape')
   * @param {string} eventType - 'keydown', 'keyup', or 'keypress'
   */
  keyPress(element, key, eventType = 'keydown') {
    if (!element) {
      throw new Error('Cannot dispatch key event on null element');
    }
    element.dispatchEvent(new KeyboardEvent(eventType, {
      key: key,
      code: key,
      bubbles: true,
      cancelable: true
    }));
  }

  /**
   * Simulate focus on an element
   * @param {HTMLElement} element - Element to focus
   */
  focus(element) {
    if (!element) {
      throw new Error('Cannot focus null element');
    }
    element.focus();
    element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  }

  /**
   * Simulate blur on an element
   * @param {HTMLElement} element - Element to blur
   */
  blur(element) {
    if (!element) {
      throw new Error('Cannot blur null element');
    }
    element.blur();
    element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  }

  /**
   * Wait for a condition to be true (useful for async operations)
   * @param {Function} conditionFn - Function that returns true when condition is met
   * @param {number} timeout - Maximum time to wait in ms (default 1000)
   * @param {number} interval - Check interval in ms (default 50)
   * @returns {Promise<boolean>} - Resolves when condition is met
   */
  async waitFor(conditionFn, timeout = 1000, interval = 50) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (conditionFn()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Timeout after ${timeout}ms waiting for condition`);
  }

  /**
   * Wait for an element to appear in the DOM
   * @param {HTMLElement} container - Container to search in
   * @param {string} selector - CSS selector
   * @param {number} timeout - Maximum wait time in ms
   * @returns {Promise<HTMLElement>} - The found element
   */
  async waitForElement(container, selector, timeout = 1000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const element = container.querySelector(selector);
      if (element) {
        return element;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Timeout waiting for element: ${selector}`);
  }

  /**
   * Wait for text to appear in an element
   * @param {HTMLElement} element - Element to check
   * @param {string} text - Text to look for
   * @param {number} timeout - Maximum wait time in ms
   */
  async waitForText(element, text, timeout = 1000) {
    await this.waitFor(
      () => element.textContent.includes(text),
      timeout
    );
  }

  /**
   * Create a mock function that tracks calls
   * @returns {Function} - Mock function with call tracking
   */
  createMockFn() {
    const calls = [];
    const mockFn = (...args) => {
      calls.push(args);
      return mockFn.returnValue;
    };
    mockFn.calls = calls;
    mockFn.callCount = () => calls.length;
    mockFn.calledWith = (...expectedArgs) =>
      calls.some(callArgs =>
        JSON.stringify(callArgs) === JSON.stringify(expectedArgs)
      );
    mockFn.reset = () => { calls.length = 0; };
    mockFn.returnValue = undefined;
    mockFn.returns = (value) => { mockFn.returnValue = value; return mockFn; };
    return mockFn;
  }

  /**
   * Register a test
   * @param {string} name - Test name
   * @param {Function} fn - Test function (can be async)
   */
  test(name, fn) {
    this.tests.push({ name, fn });
  }

  /**
   * Assert a condition is true
   * @param {boolean} condition - Condition to check
   * @param {string} message - Error message if assertion fails
   */
  assert(condition, message = 'Assertion failed') {
    if (!condition) {
      throw new Error(message);
    }
  }

  /**
   * Assert two values are equal
   * @param {*} actual - Actual value
   * @param {*} expected - Expected value
   * @param {string} message - Error message if assertion fails
   */
  assertEqual(actual, expected, message) {
    const defaultMessage = `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`;
    this.assert(actual === expected, message || defaultMessage);
  }

  /**
   * Assert value is truthy
   */
  assertTruthy(value, message = 'Expected truthy value') {
    this.assert(!!value, message);
  }

  /**
   * Assert value is falsy
   */
  assertFalsy(value, message = 'Expected falsy value') {
    this.assert(!value, message);
  }

  /**
   * Assert array includes value
   */
  assertIncludes(array, value, message) {
    const defaultMessage = `Expected array to include ${JSON.stringify(value)}`;
    this.assert(array.includes(value), message || defaultMessage);
  }

  /**
   * Assert function throws error
   */
  async assertThrows(fn, message = 'Expected function to throw') {
    let threw = false;
    try {
      await fn();
    } catch (e) {
      threw = true;
    }
    this.assert(threw, message);
  }

  /**
   * Run all registered tests
   */
  async run() {
    console.log('🧪 Running tests...\n');
    this.results = { passed: 0, failed: 0, total: 0 };
    const startTime = performance.now();

    for (const test of this.tests) {
      this.results.total++;
      try {
        await test.fn();
        this.results.passed++;
        console.log(`✅ ${test.name}`);
      } catch (error) {
        this.results.failed++;
        console.error(`❌ ${test.name}`);
        console.error(`   ${error.message}`);
        if (error.stack) {
          console.error(`   ${error.stack.split('\n').slice(1, 3).join('\n')}`);
        }
      }
    }

    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Test Results: ${this.results.passed}/${this.results.total} passed`);
    if (this.results.failed > 0) {
      console.log(`   ❌ ${this.results.failed} failed`);
    }
    console.log(`   ⏱️  Duration: ${duration}s`);
    console.log('='.repeat(50));

    return this.results;
  }

  /**
   * Render results to DOM
   */
  renderResults(containerId = 'test-results') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const passRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
    const statusClass = this.results.failed === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

    container.innerHTML = `
      <div class="max-w-2xl mx-auto p-6">
        <div class="${statusClass} rounded-lg p-6 mb-4">
          <h2 class="text-2xl font-bold mb-2">Test Results</h2>
          <p class="text-lg">
            ${this.results.passed} / ${this.results.total} passed (${passRate}%)
          </p>
          ${this.results.failed > 0 ? `<p class="text-lg font-semibold">${this.results.failed} failed</p>` : ''}
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <p class="text-sm text-gray-600">Check browser console for detailed results</p>
        </div>
      </div>
    `;
  }
}

// Create global test runner instance
const runner = new TestRunner();

// Export for use in test files
// Assertions
export const test = runner.test.bind(runner);
export const assert = runner.assert.bind(runner);
export const assertEqual = runner.assertEqual.bind(runner);
export const assertTruthy = runner.assertTruthy.bind(runner);
export const assertFalsy = runner.assertFalsy.bind(runner);
export const assertIncludes = runner.assertIncludes.bind(runner);
export const assertThrows = runner.assertThrows.bind(runner);

// Test execution
export const runTests = runner.run.bind(runner);
export const renderResults = runner.renderResults.bind(runner);

// DOM interaction utilities
export const createContainer = runner.createContainer.bind(runner);
export const destroyContainer = runner.destroyContainer.bind(runner);
export const click = runner.click.bind(runner);
export const dblclick = runner.dblclick.bind(runner);
export const submit = runner.submit.bind(runner);
export const type = runner.type.bind(runner);
export const clear = runner.clear.bind(runner);
export const select = runner.select.bind(runner);
export const keyPress = runner.keyPress.bind(runner);
export const focus = runner.focus.bind(runner);
export const blur = runner.blur.bind(runner);
export const waitFor = runner.waitFor.bind(runner);
export const waitForElement = runner.waitForElement.bind(runner);
export const waitForText = runner.waitForText.bind(runner);
export const createMockFn = runner.createMockFn.bind(runner);
