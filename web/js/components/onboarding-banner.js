/**
 * Onboarding Banner Component
 * Explains the local-first model and guides new users
 */

const STORAGE_KEY = 'grub_stars_onboarding_dismissed';

/**
 * Check if onboarding has been dismissed
 * @returns {boolean}
 */
export function isOnboardingDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Dismiss the onboarding banner
 */
export function dismissOnboarding() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage not available
  }
}

/**
 * Reset onboarding (show again)
 */
export function resetOnboarding() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage not available
  }
}

/**
 * Render the "How it works" onboarding banner
 * @param {Object} options - Options
 * @param {boolean} options.hasLocations - Whether any locations are indexed
 * @returns {string} - HTML string
 */
export function onboardingBanner(options = {}) {
  const { hasLocations = true } = options;

  const steps = [
    {
      icon: '1',
      title: 'Index a location',
      description: 'Choose a city or area to add restaurants to your local collection'
    },
    {
      icon: '2',
      title: 'Data is fetched',
      description: 'We pull restaurant info from Yelp, Google, and TripAdvisor'
    },
    {
      icon: '3',
      title: 'Search offline',
      description: 'Search your collection instantly without hitting APIs again'
    }
  ];

  const stepsHtml = steps.map(step => `
    <div class="flex items-start gap-3">
      <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-mango to-hotpink flex items-center justify-center text-white font-bold text-sm">
        ${step.icon}
      </div>
      <div>
        <h4 class="font-semibold text-cocoa">${step.title}</h4>
        <p class="text-sm text-cocoa/70">${step.description}</p>
      </div>
    </div>
  `).join('');

  const ctaSection = !hasLocations ? `
    <div class="mt-4 pt-4 border-t border-mango/30">
      <p class="text-sm font-medium text-cocoa mb-3">
        You haven't indexed any locations yet. Get started now!
      </p>
      <a href="/index-location.html" class="btn-primary inline-flex items-center gap-2">
        Index Your First Location
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </a>
    </div>
  ` : '';

  return `
    <div id="onboarding-banner" class="card p-5 mb-6 animate-pop-in bg-gradient-to-br from-mango/10 to-purple-500/10 border-2 border-mango/30 dark:from-mango/5 dark:to-purple-500/5 dark:border-mango/20">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-2xl">🗂️</span>
            <h3 class="text-lg font-bold text-cocoa">
              How grub stars works
            </h3>
          </div>
          <p class="text-sm text-cocoa/80 mb-4">
            This app searches your <strong>local collection</strong>, not live APIs. Index locations once, then search lightning-fast offline!
          </p>
          <div class="grid gap-4 sm:grid-cols-3">
            ${stepsHtml}
          </div>
          ${ctaSection}
        </div>
        <button
          type="button"
          id="dismiss-onboarding"
          class="flex-shrink-0 text-cocoa/50 hover:text-cocoa transition-colors p-1 bg-transparent border-none cursor-pointer"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Render a compact "no locations" empty state
 * @returns {string} - HTML string
 */
export function noLocationsEmptyState() {
  return `
    <div class="card p-8 text-center bg-gradient-to-br from-mango/15 to-purple-500/10 dark:from-mango/10 dark:to-purple-500/5">
      <div class="empty-state-icon mb-4 text-6xl">🗺️</div>
      <h3 class="text-xl font-bold text-cocoa mb-2">
        No locations indexed yet
      </h3>
      <p class="text-cocoa/70 mb-6 max-w-md mx-auto">
        Before you can search, you need to index at least one location. This fetches restaurant data from multiple sources and stores it locally.
      </p>
      <a href="/index-location.html" class="btn-primary inline-flex items-center gap-2 text-lg">
        Index Your First Location
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </a>
    </div>
  `;
}

/**
 * Initialize onboarding banner event listeners
 * Call this after inserting the banner into the DOM
 */
export function initOnboardingBanner() {
  const dismissBtn = document.getElementById('dismiss-onboarding');
  const banner = document.getElementById('onboarding-banner');

  if (dismissBtn && banner) {
    dismissBtn.addEventListener('click', () => {
      dismissOnboarding();
      banner.style.display = 'none';
    });
  }
}
