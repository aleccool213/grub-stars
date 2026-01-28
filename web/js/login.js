/**
 * Login Page Controller
 * Handles login form submission and redirects
 */

import { login, getAuthStatus } from './auth.js';

// DOM elements
let loginForm;
let passwordInput;
let loginButton;
let errorContainer;

/**
 * Initialize the login page
 */
async function init() {
  // Get DOM elements
  loginForm = document.getElementById('login-form');
  passwordInput = document.getElementById('password');
  loginButton = document.getElementById('login-button');
  errorContainer = document.getElementById('login-error');

  if (!loginForm) {
    console.error('Login form not found');
    return;
  }

  // Check if already logged in
  try {
    const status = await getAuthStatus();
    if (status.authenticated) {
      // Already logged in, redirect to intended destination or home
      redirectAfterLogin();
      return;
    }
    if (!status.auth_required) {
      // Auth is disabled, redirect to intended destination
      redirectAfterLogin();
      return;
    }
  } catch (error) {
    console.error('Failed to check auth status:', error);
  }

  // Set up form submission
  loginForm.addEventListener('submit', handleLogin);

  // Focus password input
  passwordInput?.focus();
}

/**
 * Handle login form submission
 * @param {Event} event - Form submit event
 */
async function handleLogin(event) {
  event.preventDefault();

  const password = passwordInput?.value;

  if (!password) {
    showError('Please enter a password');
    return;
  }

  // Disable form during login
  setFormDisabled(true);
  hideError();

  try {
    await login(password);
    // Success - redirect to intended destination
    redirectAfterLogin();
  } catch (error) {
    console.error('Login failed:', error);
    showError(error.message || 'Invalid password. Please try again.');
    passwordInput?.focus();
    passwordInput?.select();
  } finally {
    setFormDisabled(false);
  }
}

/**
 * Redirect to the intended page after successful login
 */
function redirectAfterLogin() {
  // Check for redirect URL in query params
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');

  if (redirect && redirect.startsWith('/')) {
    // Only allow relative redirects for security
    window.location.href = redirect;
  } else {
    // Default to index location page (the protected feature)
    window.location.href = '/index-location.html';
  }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  if (errorContainer) {
    const errorText = errorContainer.querySelector('p');
    if (errorText) {
      errorText.textContent = message;
    }
    errorContainer.style.display = 'block';
  }
}

/**
 * Hide error message
 */
function hideError() {
  if (errorContainer) {
    errorContainer.style.display = 'none';
  }
}

/**
 * Enable or disable the form
 * @param {boolean} disabled - Whether to disable the form
 */
function setFormDisabled(disabled) {
  if (passwordInput) passwordInput.disabled = disabled;
  if (loginButton) {
    loginButton.disabled = disabled;
    loginButton.textContent = disabled ? 'Logging in...' : 'Log In';
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
