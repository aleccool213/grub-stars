/**
 * Simple browser-based test framework
 * Zero dependencies, runs in browser console
 */

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = { passed: 0, failed: 0, total: 0 };
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
export const test = runner.test.bind(runner);
export const assert = runner.assert.bind(runner);
export const assertEqual = runner.assertEqual.bind(runner);
export const assertTruthy = runner.assertTruthy.bind(runner);
export const assertFalsy = runner.assertFalsy.bind(runner);
export const assertIncludes = runner.assertIncludes.bind(runner);
export const assertThrows = runner.assertThrows.bind(runner);
export const runTests = runner.run.bind(runner);
export const renderResults = runner.renderResults.bind(runner);
