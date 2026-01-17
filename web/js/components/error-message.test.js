/**
 * Tests for error-message component
 * Run by opening test.html in browser
 */

import { test, assert, assertEqual, assertTruthy, assertFalsy } from '../test-framework.js';
import { errorMessage, warningMessage } from './error-message.js';

// errorMessage tests

test('errorMessage renders error text', () => {
  const html = errorMessage('Connection failed');

  assertTruthy(html.includes('Connection failed'), 'Should include error message text');
});

test('errorMessage renders error container styling', () => {
  const html = errorMessage('Test error');

  assertTruthy(html.includes('bg-red-'), 'Should include red background');
  assertTruthy(html.includes('border'), 'Should include border');
});

test('errorMessage includes error icon', () => {
  const html = errorMessage('Test error');

  assertTruthy(html.includes('svg'), 'Should include SVG icon');
  assertTruthy(html.includes('text-red-'), 'Should include red icon color');
});

test('errorMessage includes header', () => {
  const html = errorMessage('Test error');

  assertTruthy(html.includes('Something went wrong'), 'Should include generic error header');
});

test('errorMessage shows retry button when enabled', () => {
  const html = errorMessage('Test error', { showRetry: true });

  assertTruthy(html.includes('button'), 'Should include button element');
  assertTruthy(html.includes('Try Again'), 'Should include retry text');
  assertTruthy(html.includes('data-action="retry"'), 'Should include retry action attribute');
});

test('errorMessage hides retry button by default', () => {
  const html = errorMessage('Test error');

  assertFalsy(html.includes('data-action="retry"'), 'Should not include retry button by default');
});

test('errorMessage shows custom retry text', () => {
  const html = errorMessage('Test error', { showRetry: true, retryText: 'Reload' });

  assertTruthy(html.includes('Reload'), 'Should include custom retry text');
  assertFalsy(html.includes('Try Again'), 'Should not include default retry text');
});

test('errorMessage escapes HTML in message', () => {
  const html = errorMessage('<script>alert("xss")</script>');

  assertFalsy(html.includes('<script>'), 'Should escape script tags in message');
});

test('errorMessage escapes HTML in retry text', () => {
  const html = errorMessage('Error', { showRetry: true, retryText: '<img src=x onerror=alert(1)>' });

  // Check that the raw HTML tag is escaped (< becomes &lt;)
  assertFalsy(html.includes('<img'), 'Should escape img tags in retry text');
  assertTruthy(html.includes('&lt;img'), 'Should convert < to &lt;');
});

// warningMessage tests

test('warningMessage renders warning text', () => {
  const html = warningMessage('Please try again later');

  assertTruthy(html.includes('Please try again later'), 'Should include warning message');
});

test('warningMessage renders warning styling', () => {
  const html = warningMessage('Test warning');

  assertTruthy(html.includes('bg-yellow-'), 'Should include yellow background');
  assertTruthy(html.includes('text-yellow-'), 'Should include yellow text');
});

test('warningMessage escapes HTML', () => {
  const html = warningMessage('<b>Bold</b> text');

  assertFalsy(html.includes('<b>'), 'Should escape HTML tags');
});

test('warningMessage is simpler than errorMessage', () => {
  const error = errorMessage('Test');
  const warning = warningMessage('Test');

  // Warning should not have the icon
  assertFalsy(warning.includes('svg'), 'Warning should not include icon');
  // Error should have icon
  assertTruthy(error.includes('svg'), 'Error should include icon');
});
