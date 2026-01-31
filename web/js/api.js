/**
 * REST API Client for grub stars
 * Handles all communication with the backend API
 */

// API base URL - use current origin in production, localhost in development
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:9292'
  : '';

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

/**
 * Autocomplete restaurant names
 * @param {string} query - Partial restaurant name (min 2 characters)
 * @param {number} limit - Maximum results (default 10, max 20)
 * @returns {Promise<Object>} - Autocomplete results with data and meta
 */
export async function autocompleteRestaurants(query, limit = 10) {
  const queryParams = new URLSearchParams({ q: query, limit: limit.toString() });
  return apiRequest(`/restaurants/autocomplete?${queryParams}`);
}

/**
 * Get list of available adapters
 * @returns {Promise<Object>} - Adapters list with configured status
 */
export async function getAdapters() {
  return apiRequest('/adapters');
}

/**
 * Search external APIs by restaurant name
 * @param {Object} params - Search parameters
 * @param {string} params.name - Restaurant name to search (min 2 characters)
 * @param {string} params.adapter - Adapter to use (yelp, google, or tripadvisor)
 * @param {string} params.location - Optional location to narrow results
 * @param {number} params.limit - Maximum results (default 10, max 20)
 * @returns {Promise<Object>} - External search results with data and meta
 */
export async function searchExternal(params) {
  const queryParams = new URLSearchParams();
  queryParams.append('name', params.name);
  queryParams.append('adapter', params.adapter);
  if (params.location) queryParams.append('location', params.location);
  if (params.limit) queryParams.append('limit', params.limit.toString());

  return apiRequest(`/restaurants/search-external?${queryParams}`);
}

/**
 * Index a single restaurant from external search results
 * @param {Object} businessData - The restaurant data from external search
 * @param {string} source - The adapter source (yelp, google, or tripadvisor)
 * @param {string} location - Optional location to associate with the restaurant
 * @returns {Promise<Object>} - Indexing result with restaurant_id
 */
export async function indexSingleRestaurant(businessData, source, location = null) {
  const body = {
    business_data: businessData,
    source: source
  };
  if (location) body.location = location;

  return apiRequest('/restaurants/index-single', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Re-index a restaurant by fetching fresh data from all known sources
 * Updates the existing restaurant without creating a new one
 * @param {number} id - Restaurant ID to re-index
 * @returns {Promise<Object>} - Result with sources_updated, sources_failed, changes, and updated restaurant
 */
export async function reindexRestaurant(id) {
  return apiRequest(`/restaurants/${id}/reindex`, {
    method: 'POST',
  });
}
