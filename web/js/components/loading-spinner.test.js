/**
 * Tests for loading-spinner component
 * Run by opening test.html in browser
 */

import { test, assert, assertEqual, assertTruthy, assertFalsy } from '../test-framework.js';
import { loadingSpinner, inlineSpinner } from './loading-spinner.js';

// loadingSpinner tests

test('loadingSpinner renders with default message', () => {
  const html = loadingSpinner();

  assertTruthy(html.includes('Loading...'), 'Should include default loading message');
});

test('loadingSpinner renders with custom message', () => {
  const html = loadingSpinner('Searching restaurants...');

  assertTruthy(html.includes('Searching restaurants...'), 'Should include custom message');
  assertFalsy(html.includes('Loading...'), 'Should not include default message');
});

test('loadingSpinner includes animation class', () => {
  const html = loadingSpinner();

  assertTruthy(html.includes('animate-spin'), 'Should include spin animation class');
});

test('loadingSpinner includes spinner element', () => {
  const html = loadingSpinner();

  assertTruthy(html.includes('rounded-full'), 'Should include rounded-full class for circular spinner');
  assertTruthy(html.includes('border-'), 'Should include border styling');
});

test('loadingSpinner is centered', () => {
  const html = loadingSpinner();

  assertTruthy(html.includes('items-center'), 'Should include items-center for centering');
  assertTruthy(html.includes('justify-center'), 'Should include justify-center for centering');
});

test('loadingSpinner escapes HTML in message', () => {
  const html = loadingSpinner('<script>alert("xss")</script>');

  assertFalsy(html.includes('<script>'), 'Should escape script tags');
});

// inlineSpinner tests

test('inlineSpinner renders small spinner', () => {
  const html = inlineSpinner();

  assertTruthy(html.includes('animate-spin'), 'Should include spin animation');
  assertTruthy(html.includes('h-4') || html.includes('w-4'), 'Should be small size');
});

test('inlineSpinner is inline element', () => {
  const html = inlineSpinner();

  assertTruthy(html.includes('inline-block'), 'Should be inline-block for inline display');
});

test('inlineSpinner includes border styling', () => {
  const html = inlineSpinner();

  assertTruthy(html.includes('border-'), 'Should include border styling');
  assertTruthy(html.includes('rounded-full'), 'Should be circular');
});
