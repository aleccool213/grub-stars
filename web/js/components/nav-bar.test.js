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
  document.body.appendChild(container);

  initNavBar();

  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  assertTruthy(menuBtn, 'Menu button should exist');
  assertTruthy(mobileMenu, 'Mobile menu should exist');

  // Simulate click
  menuBtn.click();

  assertEqual(menuBtn.getAttribute('aria-expanded'), 'true', 'Should toggle aria-expanded to true');
  assertFalsy(mobileMenu.classList.contains('hidden'), 'Mobile menu should be visible');

  // Click again to close
  menuBtn.click();

  assertEqual(menuBtn.getAttribute('aria-expanded'), 'false', 'Should toggle aria-expanded to false');
  assertTruthy(mobileMenu.classList.contains('hidden'), 'Mobile menu should be hidden');

  destroyContainer(container);
});
