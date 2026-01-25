/**
 * Tests for Onboarding Banner Component
 */

import {
  test,
  assert,
  assertEqual,
  assertIncludes,
  createContainer,
  destroyContainer,
  click
} from '../test-framework.js';

import {
  onboardingBanner,
  noLocationsEmptyState,
  isOnboardingDismissed,
  dismissOnboarding,
  resetOnboarding,
  initOnboardingBanner
} from './onboarding-banner.js';

// Clean up localStorage before each test
function cleanupStorage() {
  try {
    localStorage.removeItem('grub_stars_onboarding_dismissed');
  } catch {
    // localStorage not available
  }
}

test('onboardingBanner renders with locations', () => {
  const html = onboardingBanner({ hasLocations: true });

  assertIncludes(html, 'How grub stars works', 'Should show title');
  assertIncludes(html, 'Index a location', 'Should show step 1');
  assertIncludes(html, 'Data is fetched', 'Should show step 2');
  assertIncludes(html, 'Search offline', 'Should show step 3');
  assertIncludes(html, 'local collection', 'Should explain local-first model');
  assert(!html.includes("haven't indexed any locations"), 'Should not show CTA for no locations');
});

test('onboardingBanner renders without locations (shows CTA)', () => {
  const html = onboardingBanner({ hasLocations: false });

  assertIncludes(html, 'How grub stars works', 'Should show title');
  assertIncludes(html, "haven't indexed any locations", 'Should show no locations message');
  assertIncludes(html, 'Index Your First Location', 'Should show CTA button');
  assertIncludes(html, '/index-location.html', 'Should link to index page');
});

test('onboardingBanner includes dismiss button', () => {
  const html = onboardingBanner({ hasLocations: true });

  assertIncludes(html, 'dismiss-onboarding', 'Should have dismiss button');
  assertIncludes(html, 'Dismiss', 'Should have dismiss aria-label');
});

test('noLocationsEmptyState renders correctly', () => {
  const html = noLocationsEmptyState();

  assertIncludes(html, 'No locations indexed yet', 'Should show title');
  assertIncludes(html, 'Index Your First Location', 'Should show CTA button');
  assertIncludes(html, '/index-location.html', 'Should link to index page');
  assertIncludes(html, 'fetches restaurant data', 'Should explain what indexing does');
});

test('dismissOnboarding and isOnboardingDismissed work together', () => {
  cleanupStorage();

  assert(!isOnboardingDismissed(), 'Should not be dismissed initially');

  dismissOnboarding();

  assert(isOnboardingDismissed(), 'Should be dismissed after calling dismissOnboarding');

  cleanupStorage();
});

test('resetOnboarding clears dismissed state', () => {
  cleanupStorage();

  dismissOnboarding();
  assert(isOnboardingDismissed(), 'Should be dismissed');

  resetOnboarding();
  assert(!isOnboardingDismissed(), 'Should not be dismissed after reset');

  cleanupStorage();
});

test('initOnboardingBanner sets up dismiss button click handler', () => {
  cleanupStorage();
  const container = createContainer();

  container.innerHTML = onboardingBanner({ hasLocations: true });
  initOnboardingBanner();

  const banner = container.querySelector('#onboarding-banner');
  const dismissBtn = container.querySelector('#dismiss-onboarding');

  assert(banner, 'Banner should exist');
  assert(dismissBtn, 'Dismiss button should exist');
  assertEqual(banner.style.display, '', 'Banner should be visible initially');

  // Click dismiss
  click(dismissBtn);

  assertEqual(banner.style.display, 'none', 'Banner should be hidden after dismiss');
  assert(isOnboardingDismissed(), 'Dismissed state should be saved');

  destroyContainer(container);
  cleanupStorage();
});

test('onboarding banner has proper accessibility', () => {
  const html = onboardingBanner({ hasLocations: true });

  assertIncludes(html, 'aria-label="Dismiss"', 'Dismiss button should have aria-label');
  assertIncludes(html, 'title="Dismiss"', 'Dismiss button should have title');
});
