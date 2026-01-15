/**
 * REST API Client for grub stars
 * Handles all communication with the backend API
 */

// API base URL - same origin since Sinatra serves both
const API_BASE_URL = 'http://localhost:9292';

/**
 * Make an API request with error handling
 * @param {string} endpoint - API endpoint path
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Response data
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // API returned an error
      const errorMessage = data.error?.message || 'API request failed';
      const error = new Error(errorMessage);
      error.code = data.error?.code;
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    // Network error or parse error
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Unable to connect to API server. Is it running on port 9292?');
    }
    throw error;
  }
}

/**
 * Search restaurants by name or category
 * @param {Object} params - Search parameters
 * @param {string} params.name - Restaurant name to search
 * @param {string} params.category - Category to filter by
 * @param {string} params.location - Location to filter by
 * @returns {Promise<Object>} - Search results with data and meta
 */
export async function searchRestaurants(params) {
  const queryParams = new URLSearchParams();

  if (params.name) queryParams.append('name', params.name);
  if (params.category) queryParams.append('category', params.category);
  if (params.location) queryParams.append('location', params.location);

  return apiRequest(`/restaurants/search?${queryParams}`);
}

/**
 * Get detailed restaurant information
 * @param {number} id - Restaurant ID
 * @returns {Promise<Object>} - Restaurant details
 */
export async function getRestaurant(id) {
  return apiRequest(`/restaurants/${id}`);
}

/**
 * Get list of all categories
 * @returns {Promise<Object>} - Categories list
 */
export async function getCategories() {
  return apiRequest('/categories');
}

/**
 * Get list of indexed locations
 * @returns {Promise<Object>} - Locations list
 */
export async function getLocations() {
  return apiRequest('/locations');
}

/**
 * Index a new location
 * @param {string} location - Location to index (e.g., "barrie, ontario")
 * @param {string} category - Optional category filter
 * @returns {Promise<Object>} - Indexing results
 */
export async function indexLocation(location, category = null) {
  const body = { location };
  if (category) body.category = category;

  return apiRequest('/index', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Check API health
 * @returns {Promise<Object>} - Health status
 */
export async function checkHealth() {
  return apiRequest('/health');
}
