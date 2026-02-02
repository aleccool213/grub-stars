/**
 * Tests for map-restaurant-card component
 * Run by opening test.html in browser
 */

import { test, assert, assertEqual, assertTruthy, assertFalsy } from '../test-framework.js';
import { mapRestaurantCard } from './map-restaurant-card.js';

// Test data
const mockRestaurant = {
  id: 1,
  name: 'Test Restaurant',
  address: '123 Main St, City, State',
  latitude: 44.389,
  longitude: -79.690,
  phone: '555-123-4567',
  categories: ['Italian', 'Pizza', 'Pasta', 'Dinner'],
  ratings: [
    { source: 'Yelp', score: 4.5, review_count: 100 },
    { source: 'Google', score: 4.2, review_count: 50 }
  ]
};

const mockRestaurantMinimal = {
  id: 2,
  name: 'Minimal Restaurant'
};

const mockRestaurantNoRatings = {
  id: 3,
  name: 'No Ratings Place',
  address: '456 Oak Ave',
  categories: ['Cafe'],
  ratings: []
};

// mapRestaurantCard tests

test('mapRestaurantCard renders restaurant name', () => {
  const html = mapRestaurantCard(mockRestaurant);
  assertTruthy(html.includes('Test Restaurant'), 'Should include restaurant name');
});

test('mapRestaurantCard renders link to details page', () => {
  const html = mapRestaurantCard(mockRestaurant);
  assertTruthy(html.includes('href="/details.html?id=1"'), 'Should include link to details');
});

test('mapRestaurantCard renders address with icon', () => {
  const html = mapRestaurantCard(mockRestaurant);
  assertTruthy(html.includes('123 Main St'), 'Should include address');
  assertTruthy(html.includes('📍'), 'Should include location icon');
});

test('mapRestaurantCard renders phone number', () => {
  const html = mapRestaurantCard(mockRestaurant);
  assertTruthy(html.includes('555-123-4567'), 'Should include phone number');
  assertTruthy(html.includes('tel:555-123-4567'), 'Should include tel: link');
  assertTruthy(html.includes('📞'), 'Should include phone icon');
});

test('mapRestaurantCard renders categories (max 4)', () => {
  const html = mapRestaurantCard(mockRestaurant);
  assertTruthy(html.includes('Italian'), 'Should include first category');
  assertTruthy(html.includes('Pizza'), 'Should include second category');
  assertTruthy(html.includes('Pasta'), 'Should include third category');
  assertTruthy(html.includes('Dinner'), 'Should include fourth category');
});

test('mapRestaurantCard limits categories to 4', () => {
  const restaurant = {
    ...mockRestaurant,
    categories: ['Italian', 'Pizza', 'Pasta', 'Dinner', 'Lunch', 'Breakfast']
  };
  const html = mapRestaurantCard(restaurant);
  assertFalsy(html.includes('Lunch'), 'Should not include fifth category');
  assertFalsy(html.includes('Breakfast'), 'Should not include sixth category');
});

test('mapRestaurantCard renders average rating', () => {
  const html = mapRestaurantCard(mockRestaurant);
  // Average of 4.5 and 4.2 is 4.35
  assertTruthy(html.includes('4.4') || html.includes('4.3'), 'Should display average rating');
});

test('mapRestaurantCard renders star rating', () => {
  const html = mapRestaurantCard(mockRestaurant);
  assertTruthy(html.includes('★'), 'Should include star character');
});

test('mapRestaurantCard renders rating sources', () => {
  const html = mapRestaurantCard(mockRestaurant);
  assertTruthy(html.includes('yelp') || html.includes('Yelp'), 'Should include Yelp in sources');
});

test('mapRestaurantCard renders directions link with coordinates', () => {
  const html = mapRestaurantCard(mockRestaurant);
  assertTruthy(html.includes('google.com/maps/dir'), 'Should include directions link');
  assertTruthy(html.includes('44.389'), 'Should include latitude in URL');
  // Note: JavaScript drops trailing zeros, so -79.690 becomes -79.69
  assertTruthy(html.includes('-79.69'), 'Should include longitude in URL');
});

test('mapRestaurantCard renders View Details button', () => {
  const html = mapRestaurantCard(mockRestaurant);
  assertTruthy(html.includes('View Details'), 'Should include View Details button');
  assertTruthy(html.includes('btn-primary'), 'Should have primary button class');
});

test('mapRestaurantCard renders Directions button', () => {
  const html = mapRestaurantCard(mockRestaurant);
  assertTruthy(html.includes('Directions'), 'Should include Directions button');
  assertTruthy(html.includes('🧭'), 'Should include compass icon');
});

test('mapRestaurantCard renders bookmark button', () => {
  const html = mapRestaurantCard(mockRestaurant);
  assertTruthy(html.includes('bookmark-btn'), 'Should include bookmark button');
  assertTruthy(html.includes('data-restaurant-id="1"'), 'Should include restaurant id data attribute');
});

test('mapRestaurantCard handles missing address', () => {
  const html = mapRestaurantCard(mockRestaurantMinimal);
  assertFalsy(html.includes('📍'), 'Should not show location icon without address');
});

test('mapRestaurantCard handles missing phone', () => {
  const html = mapRestaurantCard(mockRestaurantMinimal);
  assertFalsy(html.includes('📞'), 'Should not show phone icon without phone');
});

test('mapRestaurantCard handles empty ratings', () => {
  const html = mapRestaurantCard(mockRestaurantNoRatings);
  assertFalsy(html.includes('★★★'), 'Should not show star rating without ratings');
});

test('mapRestaurantCard handles missing coordinates for directions', () => {
  const restaurant = {
    id: 4,
    name: 'No Coords Restaurant',
    address: '789 Elm St'
  };
  const html = mapRestaurantCard(restaurant);
  // Should fall back to address-based search
  assertTruthy(html.includes('google.com/maps/search'), 'Should use search URL without coordinates');
});

test('mapRestaurantCard escapes HTML in name', () => {
  const restaurant = {
    id: 1,
    name: '<script>alert("xss")</script>',
    address: '123 Main St'
  };
  const html = mapRestaurantCard(restaurant);
  assertFalsy(html.includes('<script>alert'), 'Should escape script tags');
});

test('mapRestaurantCard escapes HTML in address', () => {
  const restaurant = {
    id: 1,
    name: 'Safe Name',
    address: '<img src=x onerror=alert(1)>'
  };
  const html = mapRestaurantCard(restaurant);
  assertFalsy(html.includes('<img'), 'Should escape img tags');
});

test('mapRestaurantCard has proper article structure', () => {
  const html = mapRestaurantCard(mockRestaurant);
  assertTruthy(html.includes('<article'), 'Should use article element');
  assertTruthy(html.includes('</article>'), 'Should close article element');
});

test('mapRestaurantCard has dark mode classes', () => {
  const html = mapRestaurantCard(mockRestaurant);
  assertTruthy(html.includes('dark:'), 'Should include dark mode utility classes');
});
