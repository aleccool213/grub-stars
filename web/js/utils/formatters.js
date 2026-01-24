/**
 * Formatters Utility
 * Consistent data formatting across the application
 */

/**
 * Format a rating value
 * @param {number} rating - Rating value (0-5)
 * @param {Object} options - Formatting options
 * @param {number} options.decimals - Number of decimal places (default: 1)
 * @param {boolean} options.showStars - Include star emoji (default: false)
 * @returns {string} - Formatted rating
 */
export function formatRating(rating, options = {}) {
  const { decimals = 1, showStars = false } = options;

  if (rating === null || rating === undefined || isNaN(rating)) {
    return 'No rating';
  }

  const formatted = Number(rating).toFixed(decimals);
  return showStars ? `${formatted} stars` : formatted;
}

/**
 * Format a review count
 * @param {number} count - Number of reviews
 * @returns {string} - Formatted count (e.g., "1 review", "42 reviews")
 */
export function formatReviewCount(count) {
  if (count === null || count === undefined || isNaN(count)) {
    return 'No reviews';
  }

  const num = Number(count);
  return num === 1 ? '1 review' : `${num} reviews`;
}

/**
 * Format a phone number
 * @param {string} phone - Phone number string
 * @returns {string} - Formatted phone number
 */
export function formatPhone(phone) {
  if (!phone) return '';

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Format based on length
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Return original if can't format
  return phone;
}

/**
 * Format a distance value
 * @param {number} meters - Distance in meters
 * @param {Object} options - Formatting options
 * @param {string} options.unit - 'metric' or 'imperial' (default: 'imperial')
 * @returns {string} - Formatted distance
 */
export function formatDistance(meters, options = {}) {
  const { unit = 'imperial' } = options;

  if (meters === null || meters === undefined || isNaN(meters)) {
    return '';
  }

  if (unit === 'metric') {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }

  // Imperial (miles)
  const miles = meters / 1609.344;
  if (miles < 0.1) {
    const feet = Math.round(meters * 3.28084);
    return `${feet} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

/**
 * Format a date
 * @param {string|Date} date - Date to format
 * @param {Object} options - Formatting options
 * @param {string} options.style - 'short', 'medium', 'long', 'relative' (default: 'medium')
 * @returns {string} - Formatted date
 */
export function formatDate(date, options = {}) {
  const { style = 'medium' } = options;

  if (!date) return '';

  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) return '';

  if (style === 'relative') {
    return formatRelativeDate(d);
  }

  const formatOptions = {
    short: { month: 'numeric', day: 'numeric', year: '2-digit' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' }
  };

  return d.toLocaleDateString('en-US', formatOptions[style] || formatOptions.medium);
}

/**
 * Format a date as relative time
 * @param {Date} date - Date to format
 * @returns {string} - Relative time string
 */
function formatRelativeDate(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return formatDate(date, { style: 'short' });
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (default: 100)
 * @param {string} suffix - Suffix to add if truncated (default: '...')
 * @returns {string} - Truncated text
 */
export function truncate(text, maxLength = 100, suffix = '...') {
  if (!text) return '';
  if (text.length <= maxLength) return text;

  return text.slice(0, maxLength - suffix.length).trim() + suffix;
}

/**
 * Capitalize the first letter of each word
 * @param {string} text - Text to capitalize
 * @returns {string} - Capitalized text
 */
export function titleCase(text) {
  if (!text) return '';

  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format a list of items with proper grammar
 * @param {Array<string>} items - Items to join
 * @param {Object} options - Formatting options
 * @param {string} options.conjunction - Word to use before last item (default: 'and')
 * @param {number} options.limit - Max items to show before "and X more"
 * @returns {string} - Formatted list
 */
export function formatList(items, options = {}) {
  const { conjunction = 'and', limit = 0 } = options;

  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0];

  if (limit > 0 && items.length > limit) {
    const shown = items.slice(0, limit);
    const remaining = items.length - limit;
    return `${shown.join(', ')} ${conjunction} ${remaining} more`;
  }

  if (items.length === 2) {
    return items.join(` ${conjunction} `);
  }

  const lastItem = items[items.length - 1];
  const otherItems = items.slice(0, -1);
  return `${otherItems.join(', ')}, ${conjunction} ${lastItem}`;
}
