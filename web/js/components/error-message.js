/**
 * Error Message Component
 * Displays error messages with optional retry functionality
 */

/**
 * Render an error message
 * @param {string} message - Error message to display
 * @param {Object} options - Options for the error display
 * @param {boolean} options.showRetry - Show retry button
 * @param {string} options.retryText - Custom retry button text
 * @returns {string} - HTML string for the error message
 */
export function errorMessage(message, options = {}) {
  const { showRetry = false, retryText = 'Try Again' } = options;

  const retryButton = showRetry ? `
    <button
      type="button"
      class="mt-4 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded transition-colors"
      data-action="retry"
    >
      ${escapeHtml(retryText)}
    </button>
  ` : '';

  return `
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-6 text-center">
      <div class="text-red-600 dark:text-red-400 mb-2">
        <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-red-800 dark:text-red-300 mb-1">Something went wrong</h3>
      <p class="text-red-600 dark:text-red-400">${escapeHtml(message)}</p>
      ${retryButton}
    </div>
  `;
}

/**
 * Render a warning/info message (less severe than error)
 * @param {string} message - Message to display
 * @returns {string} - HTML string for the warning message
 */
export function warningMessage(message) {
  return `
    <div class="bg-yellow-50 dark:bg-slate-800 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-4 text-center">
      <p class="text-yellow-700 dark:text-yellow-300">${escapeHtml(message)}</p>
    </div>
  `;
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
