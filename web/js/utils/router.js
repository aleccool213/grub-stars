/**
 * Router Utility
 * URL state management and navigation helpers
 */

/**
 * Get URL search parameters as an object
 * @returns {Object} - Key-value pairs from URL query string
 */
export function getParams() {
  const params = new URLSearchParams(window.location.search);
  const result = {};

  for (const [key, value] of params.entries()) {
    result[key] = value;
  }

  return result;
}

/**
 * Get a single URL parameter
 * @param {string} name - Parameter name
 * @param {*} defaultValue - Default value if not found
 * @returns {string|*} - Parameter value or default
 */
export function getParam(name, defaultValue = null) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) ?? defaultValue;
}

/**
 * Get a URL parameter as an integer
 * @param {string} name - Parameter name
 * @param {number|null} defaultValue - Default value if not found or invalid
 * @returns {number|null} - Parsed integer or default
 */
export function getParamInt(name, defaultValue = null) {
  const value = getParam(name);
  if (value === null) return defaultValue;

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Update URL with new parameters (without page reload)
 * @param {Object} params - Parameters to set (null values remove the param)
 * @param {Object} options - Options
 * @param {boolean} options.replace - Use replaceState instead of pushState
 * @param {boolean} options.clear - Clear existing params first
 */
export function setParams(params, options = {}) {
  const { replace = false, clear = false } = options;

  const url = new URL(window.location);

  if (clear) {
    // Remove all existing params
    for (const key of [...url.searchParams.keys()]) {
      url.searchParams.delete(key);
    }
  }

  // Set new params
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }

  // Update URL
  if (replace) {
    window.history.replaceState({}, '', url);
  } else {
    window.history.pushState({}, '', url);
  }
}

/**
 * Navigate to a URL
 * @param {string} path - Path or full URL
 * @param {Object} params - Query parameters to add
 */
export function navigate(path, params = {}) {
  const url = new URL(path, window.location.origin);

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  window.location.href = url.toString();
}

/**
 * Build a URL path with query parameters
 * @param {string} path - Base path
 * @param {Object} params - Query parameters
 * @returns {string} - Full URL path with query string
 */
export function buildUrl(path, params = {}) {
  const url = new URL(path, window.location.origin);

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  return url.pathname + url.search;
}

/**
 * Listen for browser back/forward navigation
 * @param {Function} callback - Function to call with new params
 * @returns {Function} - Cleanup function to remove listener
 */
export function onPopState(callback) {
  const handler = () => callback(getParams());
  window.addEventListener('popstate', handler);

  return () => window.removeEventListener('popstate', handler);
}
