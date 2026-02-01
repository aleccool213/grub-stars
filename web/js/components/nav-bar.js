/**
 * Navigation Bar Component
 * Shared navigation for all pages
 */

import { isDarkMode, toggleTheme, initDarkMode } from '../dark-mode.js';

/**
 * Render the navigation bar
 * @param {Object} options - Configuration options
 * @param {string} options.currentPage - Current page identifier ('search', 'categories', 'index', 'details')
 * @returns {string} - HTML string for the navigation bar
 */
export function navBar(options = {}) {
  const { currentPage = '' } = options;

  const navLinks = [
    { href: '/', label: 'Search', icon: '🔍', id: 'search' },
    { href: '/categories.html', label: 'Categories', icon: '📂', id: 'categories' },
    { href: '/bookmarks.html', label: 'Bookmarks', icon: '💖', id: 'bookmarks' },
    { href: '/index-location.html', label: 'Add Area', icon: '📍', id: 'index' },
    { href: '/add-restaurant.html', label: 'Add Restaurant', icon: '🍽️', id: 'add-restaurant' },
    { href: '/stats.html', label: 'Stats', icon: '📊', id: 'stats' }
  ];

  const linkHtml = navLinks.map(link => {
    const isActive = currentPage === link.id;
    const activeClass = isActive
      ? 'text-electric font-semibold'
      : 'text-cocoa/70 dark:text-cream/70 hover:text-electric';

    return `
      <a href="${link.href}"
         class="${activeClass} transition-colors font-medium flex items-center gap-1"
         ${isActive ? 'aria-current="page"' : ''}>
        <span class="hidden sm:inline">${link.icon}</span>
        ${link.label}
      </a>
    `;
  }).join('');

  const darkMode = isDarkMode();

  return `
    <header class="bg-gradient-to-r from-electric via-hotpink to-mango p-1">
      <div class="bg-cream dark:bg-slate-900 transition-colors duration-200">
        <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" class="font-display text-2xl text-cocoa dark:text-cream flex items-center gap-2 hover:text-electric transition-colors">
            <span class="animate-float">⭐</span>
            grub stars
          </a>

          <!-- Desktop Navigation -->
          <nav class="hidden md:flex items-center gap-6" aria-label="Main navigation">
            ${linkHtml}
            <!-- Theme Toggle Button (Desktop) -->
            <button
              type="button"
              id="theme-toggle-desktop"
              class="theme-toggle text-cocoa dark:text-cream p-2 hover:text-electric hover:bg-electric/10 rounded-full transition-all cursor-pointer"
              aria-label="${darkMode ? 'Switch to light mode' : 'Switch to dark mode'}"
              title="${darkMode ? 'Switch to light mode' : 'Switch to dark mode'}">
              ${darkMode ? sunIcon() : moonIcon()}
            </button>
          </nav>

          <!-- Mobile Menu Button and Theme Toggle -->
          <div class="flex items-center gap-2 md:hidden">
            <!-- Theme Toggle Button (Mobile) -->
            <button
              type="button"
              id="theme-toggle-mobile"
              class="theme-toggle text-cocoa dark:text-cream p-2 hover:text-electric transition-colors cursor-pointer"
              aria-label="${darkMode ? 'Switch to light mode' : 'Switch to dark mode'}"
              title="${darkMode ? 'Switch to light mode' : 'Switch to dark mode'}">
              ${darkMode ? sunIcon() : moonIcon()}
            </button>

            <!-- Mobile Menu Button -->
            <button
              type="button"
              id="mobile-menu-btn"
              class="text-cocoa dark:text-cream p-2 hover:text-electric transition-colors cursor-pointer"
              aria-label="Toggle menu"
              aria-expanded="false"
              aria-controls="mobile-menu">
              <svg class="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Mobile Navigation -->
        <nav id="mobile-menu" class="hidden md:hidden px-4 pb-4" aria-label="Mobile navigation">
          <div class="flex flex-col gap-3 bg-latte/50 dark:bg-slate-800/50 rounded-xl p-4">
            ${navLinks.map(link => {
              const isActive = currentPage === link.id;
              const activeClass = isActive
                ? 'text-electric font-semibold bg-electric/10'
                : 'text-cocoa/70 dark:text-cream/70 hover:text-electric hover:bg-electric/5';

              return `
                <a href="${link.href}"
                   class="${activeClass} transition-all font-medium flex items-center gap-2 px-3 py-2 rounded-lg"
                   ${isActive ? 'aria-current="page"' : ''}>
                  <span>${link.icon}</span>
                  ${link.label}
                </a>
              `;
            }).join('')}
          </div>
        </nav>
      </div>
    </header>
  `;
}

/**
 * SVG icon for moon (dark mode)
 * @returns {string} - SVG HTML string
 */
function moonIcon() {
  return `
    <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
    </svg>
  `;
}

/**
 * SVG icon for sun (light mode)
 * @returns {string} - SVG HTML string
 */
function sunIcon() {
  return `
    <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
    </svg>
  `;
}

/**
 * Update theme toggle button appearance
 * @param {HTMLElement} button - The theme toggle button
 * @param {boolean} isDark - Whether dark mode is active
 */
function updateThemeButtonAppearance(button, isDark) {
  button.innerHTML = isDark ? sunIcon() : moonIcon();
  button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  button.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
}

/**
 * Initialize mobile menu toggle functionality
 * Call this after inserting the navBar into the DOM
 */
export function initNavBar() {
  // Initialize dark mode first
  initDarkMode();

  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  if (menuBtn && mobileMenu) {
    // Track menu state - starts closed
    let isMenuOpen = false;

    // Initially hide the menu using inline style
    // (Twind hashes class names, so classList.toggle('hidden') doesn't work)
    mobileMenu.style.display = 'none';

    const toggleMenu = (event) => {
      // Prevent double-firing on touch devices
      event.preventDefault();

      isMenuOpen = !isMenuOpen;
      menuBtn.setAttribute('aria-expanded', String(isMenuOpen));

      // Toggle visibility using inline style (works with Twind)
      mobileMenu.style.display = isMenuOpen ? 'block' : 'none';

      // Update icon based on state
      const svg = menuBtn.querySelector('svg');
      if (svg) {
        if (isMenuOpen) {
          svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>';
        } else {
          svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>';
        }
      }
    };

    menuBtn.addEventListener('click', toggleMenu);
  }

  // Initialize theme toggle buttons
  initThemeToggle();
}

/**
 * Initialize theme toggle button functionality
 */
function initThemeToggle() {
  const themeButtons = document.querySelectorAll('.theme-toggle');

  // Sync button appearance with current theme state on load
  // This ensures the icon is correct after page navigation
  const currentlyDark = isDarkMode();
  themeButtons.forEach(button => {
    updateThemeButtonAppearance(button, currentlyDark);
  });

  themeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();

      // Toggle theme and get new state
      const newTheme = toggleTheme();
      const isDark = newTheme === 'dark';

      // Update all theme toggle buttons
      themeButtons.forEach(button => {
        updateThemeButtonAppearance(button, isDark);
      });
    });
  });

  // Listen for theme changes from other sources (e.g., system preference)
  document.addEventListener('themeChange', (e) => {
    const { isDark } = e.detail;
    themeButtons.forEach(button => {
      updateThemeButtonAppearance(button, isDark);
    });
  });
}

/**
 * Render the navigation bar and insert it at the start of the body
 * @param {Object} options - Configuration options
 */
export function insertNavBar(options = {}) {
  const nav = navBar(options);
  document.body.insertAdjacentHTML('afterbegin', nav);
  initNavBar();
}
