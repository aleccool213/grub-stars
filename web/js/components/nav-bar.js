/**
 * Navigation Bar Component
 * Shared navigation for all pages
 */

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
    { href: '/index-location.html', label: 'Add Area', icon: '📍', id: 'index' }
  ];

  const linkHtml = navLinks.map(link => {
    const isActive = currentPage === link.id;
    const activeClass = isActive
      ? 'text-electric font-semibold'
      : 'text-cocoa/70 hover:text-electric';

    return `
      <a href="${link.href}"
         class="${activeClass} transition-colors font-medium flex items-center gap-1"
         ${isActive ? 'aria-current="page"' : ''}>
        <span class="hidden sm:inline">${link.icon}</span>
        ${link.label}
      </a>
    `;
  }).join('');

  return `
    <header class="bg-gradient-to-r from-electric via-hotpink to-mango p-1">
      <div class="bg-cream">
        <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" class="font-display text-2xl text-cocoa flex items-center gap-2 hover:text-electric transition-colors">
            <span class="animate-float">⭐</span>
            grub stars
          </a>

          <!-- Desktop Navigation -->
          <nav class="hidden md:flex gap-6" aria-label="Main navigation">
            ${linkHtml}
          </nav>

          <!-- Mobile Menu Button -->
          <button
            type="button"
            id="mobile-menu-btn"
            class="md:hidden text-cocoa p-2 hover:text-electric transition-colors cursor-pointer"
            aria-label="Toggle menu"
            aria-expanded="false"
            aria-controls="mobile-menu">
            <svg class="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>

        <!-- Mobile Navigation -->
        <nav id="mobile-menu" class="hidden md:hidden px-4 pb-4" aria-label="Mobile navigation">
          <div class="flex flex-col gap-3 bg-latte/50 rounded-xl p-4">
            ${navLinks.map(link => {
              const isActive = currentPage === link.id;
              const activeClass = isActive
                ? 'text-electric font-semibold bg-electric/10'
                : 'text-cocoa/70 hover:text-electric hover:bg-electric/5';

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
 * Initialize mobile menu toggle functionality
 * Call this after inserting the navBar into the DOM
 */
export function initNavBar() {
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
