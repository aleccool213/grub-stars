/**
 * Dark Mode Manager
 * Handles theme toggling and persistence via localStorage
 */

const STORAGE_KEY = 'grub_stars_theme';
const THEME_DARK = 'dark';
const THEME_LIGHT = 'light';

/**
 * Get the current theme from localStorage or system preference
 * @returns {string} - 'dark' or 'light'
 */
export function getTheme() {
  // Check localStorage first
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === THEME_DARK || stored === THEME_LIGHT) {
    return stored;
  }

  // Fall back to system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return THEME_DARK;
  }

  return THEME_LIGHT;
}

/**
 * Set the theme and persist to localStorage
 * @param {string} theme - 'dark' or 'light'
 */
export function setTheme(theme) {
  if (theme !== THEME_DARK && theme !== THEME_LIGHT) {
    console.warn(`Invalid theme: ${theme}. Using 'light' instead.`);
    theme = THEME_LIGHT;
  }

  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

/**
 * Toggle between dark and light themes
 * @returns {string} - The new theme ('dark' or 'light')
 */
export function toggleTheme() {
  const current = getTheme();
  const newTheme = current === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  setTheme(newTheme);
  return newTheme;
}

/**
 * Check if dark mode is currently active
 * @returns {boolean}
 */
export function isDarkMode() {
  return getTheme() === THEME_DARK;
}

/**
 * Apply the theme to the document
 * @param {string} theme - 'dark' or 'light'
 */
export function applyTheme(theme) {
  const html = document.documentElement;

  if (theme === THEME_DARK) {
    html.classList.add('dark');
    html.style.colorScheme = 'dark';
  } else {
    html.classList.remove('dark');
    html.style.colorScheme = 'light';
  }

  // Dispatch custom event for components that need to react
  const event = new CustomEvent('themeChange', {
    detail: { theme, isDark: theme === THEME_DARK }
  });
  document.dispatchEvent(event);
}

/**
 * Initialize dark mode on page load
 * Call this early in the page lifecycle to prevent flash of wrong theme
 */
export function initDarkMode() {
  const theme = getTheme();
  applyTheme(theme);

  // Listen for system preference changes
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't explicitly set a preference
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        applyTheme(e.matches ? THEME_DARK : THEME_LIGHT);
      }
    });
  }
}

/**
 * Clear theme preference (revert to system default)
 */
export function clearThemePreference() {
  localStorage.removeItem(STORAGE_KEY);
  const systemTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? THEME_DARK
    : THEME_LIGHT;
  applyTheme(systemTheme);
}

// Export constants for external use
export { THEME_DARK, THEME_LIGHT };
