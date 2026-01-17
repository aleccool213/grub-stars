/**
 * Loading Spinner Component
 * Displays an animated loading indicator
 */

/**
 * Render a loading spinner
 * @param {string} message - Optional message to display with spinner
 * @returns {string} - HTML string for the spinner
 */
export function loadingSpinner(message = 'Loading...') {
  return `
    <div class="flex flex-col items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
      <p class="text-gray-600">${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Render a small inline spinner
 * @returns {string} - HTML string for inline spinner
 */
export function inlineSpinner() {
  return `
    <span class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-blue-600"></span>
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
