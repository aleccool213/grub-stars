/**
 * Authentication helpers for grub stars
 * Handles login, logout, and auth status checks
 */

// API base URL - use current origin in production, localhost in development
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:9292'
  : '';

/**
 * Get current authentication status
 * @returns {Promise<{authenticated: boolean, auth_required: boolean}>}
 */
export async function getAuthStatus() {
  const response = await fetch(`${API_BASE_URL}/auth/status`, {
    credentials: 'include', // Include cookies for session
  });

  if (!response.ok) {
    throw new Error('Failed to check auth status');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Log in with password
 * @param {string} password - The password to authenticate with
 * @returns {Promise<{success: boolean}>}
 */
export async function login(password) {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for session
    body: JSON.stringify({ password }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.error?.message || 'Login failed';
    throw new Error(errorMessage);
  }

  return data.data;
}

/**
 * Log out current user
 * @returns {Promise<{success: boolean}>}
 */
export async function logout() {
  const response = await fetch(`${API_BASE_URL}/logout`, {
    method: 'POST',
    credentials: 'include', // Include cookies for session
  });

  if (!response.ok) {
    throw new Error('Logout failed');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Check if user is authenticated, redirect to login if not
 * Use this on protected pages to enforce authentication
 * @param {string} [currentPath] - Current page path for redirect after login
 * @returns {Promise<boolean>} - True if authenticated, false if redirecting
 */
export async function requireAuth(currentPath = null) {
  try {
    const status = await getAuthStatus();

    if (!status.auth_required) {
      // Auth is disabled, allow access
      return true;
    }

    if (!status.authenticated) {
      // Not logged in, redirect to login page
      const redirect = currentPath || window.location.pathname;
      window.location.href = `/login.html?redirect=${encodeURIComponent(redirect)}`;
      return false;
    }

    return true;
  } catch (error) {
    console.error('Auth check failed:', error);
    // On error, assume not authenticated and redirect
    window.location.href = '/login.html';
    return false;
  }
}

/**
 * Check if authentication is required for this app instance
 * @returns {Promise<boolean>}
 */
export async function isAuthRequired() {
  try {
    const status = await getAuthStatus();
    return status.auth_required;
  } catch (error) {
    console.error('Failed to check if auth is required:', error);
    return false;
  }
}

/**
 * Check if user is currently logged in
 * @returns {Promise<boolean>}
 */
export async function isLoggedIn() {
  try {
    const status = await getAuthStatus();
    return status.authenticated;
  } catch (error) {
    console.error('Failed to check login status:', error);
    return false;
  }
}
