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
      <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-mango to-hotpink flex items-center justify-center text-white font-bold text-sm" style="background: linear-gradient(135deg, #FFB347, #FF6B9D); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.875rem;">
        ${step.icon}
      </div>
      <div>
        <h4 class="font-semibold text-cocoa" style="font-weight: 600; color: #4A3728;">${step.title}</h4>
        <p class="text-sm text-cocoa/70" style="font-size: 0.875rem; color: rgba(74, 55, 40, 0.7);">${step.description}</p>
      </div>
    </div>
  `).join('');

  const ctaSection = !hasLocations ? `
    <div class="mt-4 pt-4 border-t border-mango/30" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255, 179, 71, 0.3);">
      <p class="text-sm font-medium text-cocoa mb-3" style="font-size: 0.875rem; font-weight: 500; color: #4A3728; margin-bottom: 0.75rem;">
        You haven't indexed any locations yet. Get started now!
      </p>
      <a href="/index-location.html" class="btn-primary inline-flex items-center gap-2" style="display: inline-flex; align-items: center; gap: 0.5rem;">
        Index Your First Location
        <svg class="w-4 h-4" style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </a>
    </div>
  ` : '';

  return `
    <div id="onboarding-banner" class="card p-5 mb-6 animate-pop-in" style="background: linear-gradient(135deg, rgba(255, 179, 71, 0.1), rgba(168, 85, 247, 0.1)); border: 2px solid rgba(255, 179, 71, 0.3);">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-2xl">🗂️</span>
            <h3 class="text-lg font-bold text-cocoa" style="font-size: 1.125rem; font-weight: 700; color: #4A3728;">
              How grub stars works
            </h3>
          </div>
          <p class="text-sm text-cocoa/80 mb-4" style="font-size: 0.875rem; color: rgba(74, 55, 40, 0.8); margin-bottom: 1rem;">
            This app searches your <strong>local collection</strong>, not live APIs. Index locations once, then search lightning-fast offline!
          </p>
          <div class="grid gap-4 sm:grid-cols-3" style="display: grid; gap: 1rem;">
            ${stepsHtml}
          </div>
          ${ctaSection}
        </div>
        <button
          type="button"
          id="dismiss-onboarding"
          class="flex-shrink-0 text-cocoa/50 hover:text-cocoa transition-colors p-1"
          style="color: rgba(74, 55, 40, 0.5); padding: 4px; background: none; border: none; cursor: pointer;"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <svg class="w-5 h-5" style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <div class="card p-8 text-center" style="background: linear-gradient(135deg, rgba(255, 179, 71, 0.15), rgba(168, 85, 247, 0.1));">
      <div class="empty-state-icon mb-4" style="font-size: 4rem; margin-bottom: 1rem;">🗺️</div>
      <h3 class="text-xl font-bold text-cocoa mb-2" style="font-size: 1.25rem; font-weight: 700; color: #4A3728; margin-bottom: 0.5rem;">
        No locations indexed yet
      </h3>
      <p class="text-cocoa/70 mb-6 max-w-md mx-auto" style="color: rgba(74, 55, 40, 0.7); margin-bottom: 1.5rem; max-width: 28rem; margin-left: auto; margin-right: auto;">
        Before you can search, you need to index at least one location. This fetches restaurant data from multiple sources and stores it locally.
      </p>
      <a href="/index-location.html" class="btn-primary inline-flex items-center gap-2 text-lg" style="display: inline-flex; align-items: center; gap: 0.5rem; font-size: 1.125rem;">
        Index Your First Location
        <svg class="w-5 h-5" style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
