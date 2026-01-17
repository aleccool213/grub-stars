/**
 * Tests for restaurant-card component
 * Run by opening test.html in browser
 */

import { test, assert, assertEqual, assertTruthy, assertFalsy } from '../test-framework.js';
import { restaurantCard, restaurantList } from './restaurant-card.js';

// Test data
const mockRestaurant = {
  id: 1,
  name: 'Test Restaurant',
  address: '123 Main St, City, State',
  categories: ['Italian', 'Pizza', 'Pasta'],
  ratings: [
    { source: 'Yelp', value: 4.5, review_count: 100 },
    { source: 'Google', value: 4.2, review_count: 50 }
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

// restaurantCard tests

test('restaurantCard renders restaurant name', () => {
  const html = restaurantCard(mockRestaurant);

  assertTruthy(html.includes('Test Restaurant'), 'Should include restaurant name');
});

test('restaurantCard renders address', () => {
  const html = restaurantCard(mockRestaurant);

  assertTruthy(html.includes('123 Main St'), 'Should include address');
});

test('restaurantCard renders link to details page', () => {
  const html = restaurantCard(mockRestaurant);

  assertTruthy(html.includes('href="/details.html?id=1"'), 'Should include link to details');
});

test('restaurantCard renders categories', () => {
  const html = restaurantCard(mockRestaurant);

  assertTruthy(html.includes('Italian'), 'Should include Italian category');
  assertTruthy(html.includes('Pizza'), 'Should include Pizza category');
  assertTruthy(html.includes('Pasta'), 'Should include Pasta category');
});

test('restaurantCard limits categories to 3', () => {
  const restaurant = {
    ...mockRestaurant,
    categories: ['Italian', 'Pizza', 'Pasta', 'Dinner', 'Lunch', 'Breakfast']
  };
  const html = restaurantCard(restaurant);

  assertTruthy(html.includes('Italian'), 'Should include first category');
  assertTruthy(html.includes('Pizza'), 'Should include second category');
  assertTruthy(html.includes('Pasta'), 'Should include third category');
  assertFalsy(html.includes('Dinner'), 'Should not include fourth category');
});

test('restaurantCard renders rating sources', () => {
  const html = restaurantCard(mockRestaurant);

  assertTruthy(html.includes('Yelp'), 'Should include Yelp source');
  assertTruthy(html.includes('Google'), 'Should include Google source');
  assertTruthy(html.includes('4.5'), 'Should include Yelp rating');
  assertTruthy(html.includes('4.2'), 'Should include Google rating');
});

test('restaurantCard calculates average rating', () => {
  const html = restaurantCard(mockRestaurant);
  // Average of 4.5 and 4.2 is 4.35, displayed as 4.4 stars
  assertTruthy(html.includes('4.4') || html.includes('4.3'), 'Should display average rating');
});

test('restaurantCard calculates total reviews', () => {
  const html = restaurantCard(mockRestaurant);
  // 100 + 50 = 150 reviews
  assertTruthy(html.includes('150 reviews'), 'Should display total review count');
});

test('restaurantCard handles missing address', () => {
  const html = restaurantCard(mockRestaurantMinimal);

  assertTruthy(html.includes('Address not available'), 'Should show address not available');
});

test('restaurantCard handles empty ratings', () => {
  const html = restaurantCard(mockRestaurantNoRatings);

  assertTruthy(html.includes('No ratings'), 'Should show no ratings message');
  assertTruthy(html.includes('0 reviews'), 'Should show 0 reviews');
});

test('restaurantCard handles missing categories', () => {
  const html = restaurantCard(mockRestaurantMinimal);

  // Should not throw error and should render
  assertTruthy(html.includes('Minimal Restaurant'), 'Should render without categories');
});

test('restaurantCard escapes HTML in name', () => {
  const restaurant = {
    id: 1,
    name: '<script>alert("xss")</script>',
    address: '123 Main St'
  };
  const html = restaurantCard(restaurant);

  assertFalsy(html.includes('<script>'), 'Should escape script tags');
  assertTruthy(html.includes('&lt;script&gt;') || !html.includes('alert'), 'Should escape or remove dangerous content');
});

// restaurantList tests

test('restaurantList renders multiple cards', () => {
  const restaurants = [mockRestaurant, mockRestaurantMinimal, mockRestaurantNoRatings];
  const html = restaurantList(restaurants);

  assertTruthy(html.includes('Test Restaurant'), 'Should include first restaurant');
  assertTruthy(html.includes('Minimal Restaurant'), 'Should include second restaurant');
  assertTruthy(html.includes('No Ratings Place'), 'Should include third restaurant');
});

test('restaurantList returns empty string for empty array', () => {
  const html = restaurantList([]);

  assertEqual(html, '', 'Should return empty string for empty array');
});

test('restaurantList returns empty string for null', () => {
  const html = restaurantList(null);

  assertEqual(html, '', 'Should return empty string for null');
});

test('restaurantList renders grid container', () => {
  const restaurants = [mockRestaurant];
  const html = restaurantList(restaurants);

  assertTruthy(html.includes('grid'), 'Should include grid class');
  assertTruthy(html.includes('md:grid-cols-2') || html.includes('lg:grid-cols-3'), 'Should include responsive grid classes');
});
