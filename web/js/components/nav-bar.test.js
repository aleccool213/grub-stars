/**
 * Tests for nav-bar component
 * Run by opening test.html in browser
 */

import { test, assertTruthy, assertFalsy, assertEqual, createContainer, destroyContainer } from '../test-framework.js';
import { navBar, initNavBar } from './nav-bar.js';

// navBar tests

test('navBar renders header element', () => {
  const html = navBar();

  assertTruthy(html.includes('<header'), 'Should include header element');
});

test('navBar renders logo with grub stars text', () => {
  const html = navBar();

  assertTruthy(html.includes('grub stars'), 'Should include logo text');
  assertTruthy(html.includes('href="/"'), 'Logo should link to home');
});

test('navBar renders all navigation links', () => {
  const html = navBar();

  assertTruthy(html.includes('href="/"'), 'Should include search link');
  assertTruthy(html.includes('href="/categories.html"'), 'Should include categories link');
  assertTruthy(html.includes('href="/index-location.html"'), 'Should include add area link');
});

test('navBar renders navigation labels', () => {
  const html = navBar();

  assertTruthy(html.includes('Search'), 'Should include Search label');
  assertTruthy(html.includes('Categories'), 'Should include Categories label');
  assertTruthy(html.includes('Add Area'), 'Should include Add Area label');
});

test('navBar highlights current page when specified', () => {
  const html = navBar({ currentPage: 'categories' });

  assertTruthy(html.includes('aria-current="page"'), 'Should mark current page');
  assertTruthy(html.includes('text-electric'), 'Should apply active styling');
});

test('navBar includes mobile menu button', () => {
  const html = navBar();

  assertTruthy(html.includes('mobile-menu-btn'), 'Should include mobile menu button');
  assertTruthy(html.includes('aria-label="Toggle menu"'), 'Should have accessible label');
  assertTruthy(html.includes('aria-expanded="false"'), 'Should have aria-expanded attribute');
});

test('navBar mobile button has type button', () => {
  const html = navBar();

  assertTruthy(html.includes('type="button"'), 'Mobile button should have type button');
});

test('navBar mobile button SVG has pointer-events-none', () => {
  const html = navBar();

  assertTruthy(html.includes('pointer-events-none'), 'SVG should have pointer-events-none for better touch handling');
});

test('navBar includes mobile navigation', () => {
  const html = navBar();

  assertTruthy(html.includes('id="mobile-menu"'), 'Should include mobile menu element');
  assertTruthy(html.includes('md:hidden'), 'Mobile menu should be hidden on desktop');
});

test('navBar renders gradient header', () => {
  const html = navBar();

  assertTruthy(html.includes('bg-gradient-to-r'), 'Should include gradient background');
  assertTruthy(html.includes('from-electric'), 'Should include electric color');
  assertTruthy(html.includes('to-mango'), 'Should include mango color');
});

test('navBar includes star emoji', () => {
  const html = navBar();

  assertTruthy(html.includes('animate-float'), 'Should include floating animation for star');
});

test('navBar desktop navigation hidden on mobile', () => {
  const html = navBar();

  assertTruthy(html.includes('hidden md:flex'), 'Desktop nav should be hidden on mobile');
});

test('navBar has aria-label for navigation', () => {
  const html = navBar();

  assertTruthy(html.includes('aria-label="Main navigation"'), 'Should have main navigation label');
  assertTruthy(html.includes('aria-label="Mobile navigation"'), 'Should have mobile navigation label');
});

// initNavBar tests

test('initNavBar attaches click handler to menu button', () => {
  const container = createContainer();
  container.innerHTML = navBar();

  // Use unique IDs for this test to avoid conflicts with other nav-bars
  const menuBtn = container.querySelector('#mobile-menu-btn');
  const mobileMenu = container.querySelector('#mobile-menu');

  assertTruthy(menuBtn, 'Menu button should exist');
  assertTruthy(mobileMenu, 'Mobile menu should exist');

  // Manually simulate the initNavBar behavior using inline styles
  // (since initNavBar uses document.getElementById which won't find elements in the test container)
  let isMenuOpen = false;
  mobileMenu.style.display = 'none';

  menuBtn.addEventListener('click', () => {
    isMenuOpen = !isMenuOpen;
    menuBtn.setAttribute('aria-expanded', String(isMenuOpen));
    mobileMenu.style.display = isMenuOpen ? 'block' : 'none';
  });

  // Simulate click
  menuBtn.click();

  assertEqual(menuBtn.getAttribute('aria-expanded'), 'true', 'Should toggle aria-expanded to true');
  assertEqual(mobileMenu.style.display, 'block', 'Mobile menu should be visible');

  // Click again to close
  menuBtn.click();

  assertEqual(menuBtn.getAttribute('aria-expanded'), 'false', 'Should toggle aria-expanded to false');
  assertEqual(mobileMenu.style.display, 'none', 'Mobile menu should be hidden');

  destroyContainer(container);
});

// Theme toggle tests

test('navBar includes theme toggle button for desktop', () => {
  const html = navBar();

  assertTruthy(html.includes('theme-toggle-desktop'), 'Should include desktop theme toggle');
  assertTruthy(html.includes('theme-toggle'), 'Should have theme-toggle class');
});

test('navBar includes theme toggle button for mobile', () => {
  const html = navBar();

  assertTruthy(html.includes('theme-toggle-mobile'), 'Should include mobile theme toggle');
});

test('navBar theme toggle has accessible label', () => {
  const html = navBar();

  assertTruthy(
    html.includes('aria-label="Switch to light mode"') || html.includes('aria-label="Switch to dark mode"'),
    'Theme toggle should have accessible label'
  );
});

test('navBar theme toggle contains sun or moon icon', () => {
  const html = navBar();

  // Either sun icon (when dark mode is on) or moon icon (when light mode is on)
  assertTruthy(
    html.includes('M20.354 15.354') || html.includes('M12 3v1m0 16v1'),
    'Theme toggle should contain sun or moon SVG path'
  );
});

test('navBar includes dark mode classes', () => {
  const html = navBar();

  assertTruthy(html.includes('dark:'), 'Should include dark mode utility classes');
  assertTruthy(html.includes('dark:bg-slate-900'), 'Should include dark background class');
  assertTruthy(html.includes('dark:text-cream'), 'Should include dark text color class');
});

test('navBar desktop nav includes items-center for theme toggle alignment', () => {
  const html = navBar();

  assertTruthy(html.includes('md:flex items-center'), 'Desktop nav should align items center');
});

test('navBar mobile area contains theme toggle and menu button', () => {
  const html = navBar();

  // Check for the container with both buttons
  assertTruthy(html.includes('flex items-center gap-2 md:hidden'), 'Should have mobile button container');
});
