/**
 * Map Page Controller
 * Handles interactive restaurant map with geolocation and marker clustering
 */

import { getRestaurantsInBounds } from './api.js';
import { insertNavBar } from './components/nav-bar.js';
import { mapRestaurantCard } from './components/map-restaurant-card.js';
import { initBookmarkButtons } from './components/bookmark-button.js';

// Default location (Barrie, Ontario)
const DEFAULT_CENTER = { lat: 44.389, lng: -79.690 };
const DEFAULT_ZOOM = 13;

// Debounce delay for map movement (ms)
const FETCH_DEBOUNCE_MS = 300;

// Map instance and state
let map = null;
let markersLayer = null;
let userMarker = null;
let selectedRestaurantId = null;
let fetchTimeoutId = null;

/**
 * Initialize the map page
 */
async function init() {
  // Insert navigation bar
  insertNavBar({ currentPage: 'map' });

  // Get DOM elements
  const mapContainer = document.getElementById('map-container');
  const locateMeBtn = document.getElementById('locate-me-btn');

  // Ensure map container is visible before initializing Leaflet
  // (Leaflet needs visible container with dimensions to render correctly)
  mapContainer.style.display = 'block';

  // Initialize the map immediately (don't wait for async operations)
  map = L.map(mapContainer, {
    center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
    zoom: DEFAULT_ZOOM,
    zoomControl: true
  });

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  // Create markers layer
  markersLayer = L.layerGroup().addTo(map);

  // Listen for map movement
  map.on('moveend', handleMapMove);
  map.on('zoomend', handleMapMove);

  // Set up locate me button
  if (locateMeBtn) {
    locateMeBtn.addEventListener('click', handleLocateMe);
  }

  // Now do async operations (user location + restaurant loading)
  // Show loading indicator in restaurant count
  updateRestaurantCount(-1); // -1 = loading state

  // Try to get user location
  const userLocation = await getUserLocation();
  if (userLocation) {
    // Center map on user location
    map.setView([userLocation.lat, userLocation.lng], DEFAULT_ZOOM);
    addUserMarker(userLocation);
  }

  // Load initial restaurants
  await loadRestaurantsInView();

  // Force a resize in case container size changed
  setTimeout(() => {
    map.invalidateSize();
  }, 100);
}

/**
 * Get user's current location using Geolocation API
 * @returns {Promise<{lat: number, lng: number}|null>}
 */
function getUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.log('Geolocation error:', error.message);
        resolve(null);
      },
      {
        timeout: 10000,
        enableHighAccuracy: false,
        maximumAge: 300000 // Cache for 5 minutes
      }
    );
  });
}

/**
 * Add user location marker to map
 * @param {{lat: number, lng: number}} location
 */
function addUserMarker(location) {
  if (userMarker) {
    map.removeLayer(userMarker);
  }

  // Create a pulsing circle marker for user location
  userMarker = L.circleMarker([location.lat, location.lng], {
    radius: 10,
    fillColor: '#A855F7', // electric purple
    fillOpacity: 0.8,
    color: '#A855F7',
    weight: 2,
    opacity: 1
  }).addTo(map);

  userMarker.bindPopup('<strong>You are here</strong>').openPopup();

  // Add a larger, fading outer ring
  L.circleMarker([location.lat, location.lng], {
    radius: 20,
    fillColor: '#A855F7',
    fillOpacity: 0.2,
    color: '#A855F7',
    weight: 1,
    opacity: 0.5
  }).addTo(map);
}

/**
 * Handle map movement/zoom - debounced
 */
function handleMapMove() {
  // Clear existing timeout
  if (fetchTimeoutId) {
    clearTimeout(fetchTimeoutId);
  }

  // Debounce the fetch
  fetchTimeoutId = setTimeout(() => {
    loadRestaurantsInView();
  }, FETCH_DEBOUNCE_MS);
}

/**
 * Load restaurants within current map bounds
 */
async function loadRestaurantsInView() {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  try {
    const response = await getRestaurantsInBounds({
      sw_lat: sw.lat,
      sw_lng: sw.lng,
      ne_lat: ne.lat,
      ne_lng: ne.lng
    });

    const restaurants = response.data || [];
    updateRestaurantCount(restaurants.length);

    if (restaurants.length === 0) {
      showEmpty(true);
      markersLayer.clearLayers();
      return;
    }

    showEmpty(false);
    updateMarkers(restaurants);

  } catch (error) {
    console.error('Failed to load restaurants:', error);
    updateRestaurantCount(0);
  }
}

/**
 * Update markers on map
 * @param {Array} restaurants
 */
function updateMarkers(restaurants) {
  // Clear existing markers
  markersLayer.clearLayers();

  // Create custom icon
  const restaurantIcon = L.divIcon({
    className: 'restaurant-marker',
    html: `<div class="marker-pin">🍽️</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });

  // Add markers for each restaurant
  restaurants.forEach(restaurant => {
    if (!restaurant.latitude || !restaurant.longitude) return;

    const marker = L.marker([restaurant.latitude, restaurant.longitude], {
      icon: restaurantIcon
    });

    // Create popup content
    const avgRating = calculateAverageRating(restaurant.ratings);
    const ratingText = avgRating ? `${avgRating.toFixed(1)} ★` : '';

    marker.bindPopup(`
      <div class="map-popup">
        <strong>${escapeHtml(restaurant.name)}</strong>
        ${ratingText ? `<br><span class="text-mango">${ratingText}</span>` : ''}
        ${restaurant.address ? `<br><small>${escapeHtml(restaurant.address)}</small>` : ''}
      </div>
    `);

    // Handle marker click
    marker.on('click', () => {
      showRestaurantCard(restaurant);
    });

    markersLayer.addLayer(marker);
  });
}

/**
 * Show restaurant card below map
 * @param {Object} restaurant
 */
function showRestaurantCard(restaurant) {
  const container = document.getElementById('selected-restaurant');
  if (!container) return;

  selectedRestaurantId = restaurant.id;
  container.innerHTML = mapRestaurantCard(restaurant);
  container.style.display = 'block';

  // Initialize bookmark buttons
  initBookmarkButtons(container);

  // Smooth scroll to card on mobile
  if (window.innerWidth < 768) {
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Handle "Find My Location" button click
 */
async function handleLocateMe() {
  const btn = document.getElementById('locate-me-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin inline-block">⏳</span> Locating...';
  }

  const location = await getUserLocation();

  if (location) {
    map.setView([location.lat, location.lng], DEFAULT_ZOOM);
    addUserMarker(location);
  } else {
    alert('Unable to get your location. Please check your browser permissions.');
  }

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span>📍</span> Find My Location';
  }
}

/**
 * Update restaurant count display
 * @param {number} count - Number of restaurants, or -1 for loading state
 */
function updateRestaurantCount(count) {
  const el = document.getElementById('restaurant-count');
  if (el) {
    if (count === -1) {
      el.textContent = 'Loading...';
    } else if (count === 0) {
      el.textContent = 'No restaurants in view';
    } else {
      el.textContent = count === 1 ? '1 restaurant' : `${count} restaurants`;
    }
  }
}

/**
 * Show/hide empty state
 * @param {boolean} show
 */
function showEmpty(show) {
  const emptyEl = document.getElementById('map-empty');
  if (emptyEl) {
    emptyEl.style.display = show ? 'block' : 'none';
  }
}

/**
 * Calculate average rating from ratings array
 * @param {Array} ratings
 * @returns {number|null}
 */
function calculateAverageRating(ratings) {
  if (!ratings || ratings.length === 0) return null;
  const total = ratings.reduce((sum, r) => sum + (r.score || 0), 0);
  return total / ratings.length;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
