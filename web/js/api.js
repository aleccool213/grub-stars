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
  if (params.sort) queryParams.append('sort', params.sort);

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
 * @param {number} limit - Optional max restaurants to index (default: 100, max: 500)
 * @returns {Promise<Object>} - Indexing results including limit and limit_reached fields
 */
export async function indexLocation(location, category = null, limit = null) {
  const body = { location };
  if (category) body.category = category;
  if (limit) body.limit = limit;

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

/**
 * Get restaurants within geographic bounds (for map view)
 * @param {Object} bounds - Bounding box coordinates
 * @param {number} bounds.sw_lat - Southwest corner latitude
 * @param {number} bounds.sw_lng - Southwest corner longitude
 * @param {number} bounds.ne_lat - Northeast corner latitude
 * @param {number} bounds.ne_lng - Northeast corner longitude
 * @param {number} limit - Maximum results (default 100, max 500)
 * @returns {Promise<Object>} - Restaurants within bounds with data and meta
 */
export async function getRestaurantsInBounds(bounds, limit = 100) {
  const queryParams = new URLSearchParams({
    sw_lat: bounds.sw_lat.toString(),
    sw_lng: bounds.sw_lng.toString(),
    ne_lat: bounds.ne_lat.toString(),
    ne_lng: bounds.ne_lng.toString(),
    limit: limit.toString()
  });
  return apiRequest(`/restaurants/bounds?${queryParams}`);
}

/**
 * Get application statistics (admin stats)
 * @returns {Promise<Object>} - Statistics including restaurant counts, API usage, and data coverage
 */
export async function getStats() {
  return apiRequest('/stats');
}

/**
 * Index a location with real-time progress updates via Server-Sent Events
 * @param {string} location - Location to index (e.g., "barrie, ontario")
 * @param {string|null} category - Optional category filter
 * @param {Object} callbacks - Event callbacks
 * @param {Function} callbacks.onProgress - Called for each progress update
 *   Receives: { adapter, phase, current, total, percent, restaurant_name }
 * @param {Function} callbacks.onComplete - Called when indexing completes
 *   Receives: { total, created, updated, merged, adapters, restaurants_created, restaurants_updated, restaurants_merged }
 * @param {Function} callbacks.onError - Called if an error occurs
 *   Receives: { code, message }
 * @returns {EventSource} - The EventSource instance (call .close() to cancel)
 */
export function indexLocationWithProgress(location, category, callbacks) {
  const params = new URLSearchParams({ location });
  if (category) params.append('category', category);

  const url = `${API_BASE_URL}/index/stream?${params}`;
  const eventSource = new EventSource(url);

  eventSource.addEventListener('progress', (event) => {
    const data = JSON.parse(event.data);
    callbacks.onProgress?.(data);
  });

  eventSource.addEventListener('complete', (event) => {
    const data = JSON.parse(event.data);
    eventSource.close();
    callbacks.onComplete?.(data);
  });

  eventSource.addEventListener('error', (event) => {
    // Check if it's a custom error event with data
    if (event.data) {
      const data = JSON.parse(event.data);
      eventSource.close();
      callbacks.onError?.(data);
    } else {
      // Connection error
      eventSource.close();
      callbacks.onError?.({ code: 'CONNECTION_ERROR', message: 'Lost connection to server' });
    }
  });

  // Handle connection errors (onerror fires for all errors)
  eventSource.onerror = (event) => {
    // Only handle if the EventSource is closed (connection failed)
    if (eventSource.readyState === EventSource.CLOSED) {
      callbacks.onError?.({ code: 'CONNECTION_ERROR', message: 'Unable to connect to server' });
    }
  };

  return eventSource;
}
