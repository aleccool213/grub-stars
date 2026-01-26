/**
 * Tests for dark-mode.js module
 */

import {
  test, assertEqual, assertTruthy, assertFalsy
} from './test-framework.js';

import {
  getTheme, setTheme, toggleTheme, isDarkMode, applyTheme,
  initDarkMode, clearThemePreference, THEME_DARK, THEME_LIGHT
} from './dark-mode.js';

const STORAGE_KEY = 'grub_stars_theme';

// Clean up theme before each test
function cleanupTheme() {
  localStorage.removeItem(STORAGE_KEY);
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
}

test('THEME_DARK constant equals "dark"', () => {
  assertEqual(THEME_DARK, 'dark', 'THEME_DARK should equal "dark"');
});

test('THEME_LIGHT constant equals "light"', () => {
  assertEqual(THEME_LIGHT, 'light', 'THEME_LIGHT should equal "light"');
});

test('getTheme returns "light" by default when no preference set', () => {
  cleanupTheme();

  // Mock matchMedia to return light preference
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {}
  });

  const theme = getTheme();
  assertEqual(theme, 'light', 'Should default to light theme');

  window.matchMedia = originalMatchMedia;
});

test('getTheme returns stored theme from localStorage', () => {
  cleanupTheme();
  localStorage.setItem(STORAGE_KEY, 'dark');

  const theme = getTheme();
  assertEqual(theme, 'dark', 'Should return stored dark theme');

  cleanupTheme();
  localStorage.setItem(STORAGE_KEY, 'light');

  const theme2 = getTheme();
  assertEqual(theme2, 'light', 'Should return stored light theme');
});

test('setTheme stores theme in localStorage', () => {
  cleanupTheme();

  setTheme('dark');
  assertEqual(localStorage.getItem(STORAGE_KEY), 'dark', 'Should store dark theme');

  setTheme('light');
  assertEqual(localStorage.getItem(STORAGE_KEY), 'light', 'Should store light theme');
});

test('setTheme adds dark class to html element when setting dark theme', () => {
  cleanupTheme();

  setTheme('dark');
  assertTruthy(document.documentElement.classList.contains('dark'), 'HTML should have dark class');
  assertEqual(document.documentElement.style.colorScheme, 'dark', 'Color scheme should be dark');
});

test('setTheme removes dark class from html element when setting light theme', () => {
  cleanupTheme();

  // First set dark
  setTheme('dark');
  // Then set light
  setTheme('light');

  assertFalsy(document.documentElement.classList.contains('dark'), 'HTML should not have dark class');
  assertEqual(document.documentElement.style.colorScheme, 'light', 'Color scheme should be light');
});

test('setTheme defaults to light for invalid theme values', () => {
  cleanupTheme();

  setTheme('invalid');
  assertEqual(localStorage.getItem(STORAGE_KEY), 'light', 'Should store light for invalid value');
  assertFalsy(document.documentElement.classList.contains('dark'), 'Should not have dark class');
});

test('toggleTheme switches from light to dark', () => {
  cleanupTheme();
  setTheme('light');

  const newTheme = toggleTheme();
  assertEqual(newTheme, 'dark', 'Should return dark after toggling from light');
  assertEqual(localStorage.getItem(STORAGE_KEY), 'dark', 'Should store dark theme');
});

test('toggleTheme switches from dark to light', () => {
  cleanupTheme();
  setTheme('dark');

  const newTheme = toggleTheme();
  assertEqual(newTheme, 'light', 'Should return light after toggling from dark');
  assertEqual(localStorage.getItem(STORAGE_KEY), 'light', 'Should store light theme');
});

test('isDarkMode returns true when theme is dark', () => {
  cleanupTheme();
  setTheme('dark');

  assertTruthy(isDarkMode(), 'isDarkMode should return true when dark');
});

test('isDarkMode returns false when theme is light', () => {
  cleanupTheme();
  setTheme('light');

  assertFalsy(isDarkMode(), 'isDarkMode should return false when light');
});

test('applyTheme adds dark class for dark theme', () => {
  cleanupTheme();

  applyTheme('dark');
  assertTruthy(document.documentElement.classList.contains('dark'), 'Should add dark class');
});

test('applyTheme removes dark class for light theme', () => {
  cleanupTheme();
  document.documentElement.classList.add('dark');

  applyTheme('light');
  assertFalsy(document.documentElement.classList.contains('dark'), 'Should remove dark class');
});

test('applyTheme dispatches themeChange event', () => {
  cleanupTheme();

  let eventReceived = false;
  let eventDetail = null;

  const handler = (e) => {
    eventReceived = true;
    eventDetail = e.detail;
  };

  document.addEventListener('themeChange', handler);

  applyTheme('dark');

  document.removeEventListener('themeChange', handler);

  assertTruthy(eventReceived, 'Should dispatch themeChange event');
  assertEqual(eventDetail.theme, 'dark', 'Event detail should have theme');
  assertEqual(eventDetail.isDark, true, 'Event detail should have isDark flag');
});

test('clearThemePreference removes stored preference', () => {
  cleanupTheme();
  setTheme('dark');

  clearThemePreference();
  assertFalsy(localStorage.getItem(STORAGE_KEY), 'Should remove stored preference');
});

test('initDarkMode applies stored theme on initialization', () => {
  cleanupTheme();
  localStorage.setItem(STORAGE_KEY, 'dark');

  initDarkMode();
  assertTruthy(document.documentElement.classList.contains('dark'), 'Should apply stored dark theme');
});

test('initDarkMode applies light theme when no preference', () => {
  cleanupTheme();

  // Mock matchMedia to return light preference
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {}
  });

  initDarkMode();
  assertFalsy(document.documentElement.classList.contains('dark'), 'Should not have dark class');

  window.matchMedia = originalMatchMedia;
});

test('theme persists across simulated page loads', () => {
  cleanupTheme();

  // Simulate user setting dark theme
  setTheme('dark');

  // Simulate "page reload" by clearing the DOM state but keeping localStorage
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';

  // Re-initialize (like page load)
  initDarkMode();

  assertTruthy(document.documentElement.classList.contains('dark'), 'Dark theme should persist');
});

// Cleanup after all tests
cleanupTheme();
