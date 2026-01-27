/**
 * Restaurant Autocomplete Component
 * Searches local database for restaurant names with typeahead suggestions
 */

import { autocompleteRestaurants } from '../api.js';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 8;

/**
 * Create a debounced function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render the autocomplete dropdown HTML
 * @param {Array} suggestions - Array of restaurant objects
 * @param {string} query - Current search query (for linking to add page)
 * @returns {string} - HTML string
 */
function renderDropdown(suggestions, query = '') {
  if (!suggestions.length) {
    const indexUrl = query ? `/add-restaurant.html?name=${encodeURIComponent(query)}` : '/add-restaurant.html';
    return `
      <div class="autocomplete-dropdown">
        <div class="autocomplete-empty">
          <span>No restaurants found</span>
          <a href="${indexUrl}" class="autocomplete-add-link">+ Index a restaurant</a>
        </div>
      </div>
    `;
  }

  const items = suggestions.map((restaurant, index) => {
    const details = [];
    if (restaurant.primary_category) {
      details.push(restaurant.primary_category);
    }
    if (restaurant.location) {
      details.push(restaurant.location);
    }
    const detailsHtml = details.length
      ? `<div class="autocomplete-details">${escapeHtml(details.join(' • '))}</div>`
      : '';

    return `
      <li
        role="option"
        id="restaurant-suggestion-${index}"
        class="autocomplete-item"
        data-index="${index}"
        data-id="${restaurant.id}"
        tabindex="-1"
      >
        <span class="autocomplete-icon">🍽️</span>
        <div class="autocomplete-content">
          <span class="autocomplete-text">${escapeHtml(restaurant.name)}</span>
          ${detailsHtml}
        </div>
      </li>
    `;
  }).join('');

  return `
    <ul role="listbox" class="autocomplete-dropdown" id="restaurant-autocomplete-listbox">
      ${items}
    </ul>
  `;
}

/**
 * Initialize restaurant autocomplete on an input element
 * @param {HTMLInputElement} input - Input element to enhance
 * @param {Object} options - Configuration options
 * @param {Function} options.onSelect - Callback when restaurant is selected
 * @returns {Object} - Autocomplete instance with destroy method
 */
export function initRestaurantAutocomplete(input, options = {}) {
  const { onSelect } = options;

  let suggestions = [];
  let activeIndex = -1;
  let dropdownContainer = null;
  let isOpen = false;
  let isLoading = false;
  let currentQuery = '';

  // Create wrapper if needed
  const wrapper = document.createElement('div');
  wrapper.className = 'autocomplete-wrapper';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  // Create dropdown container
  dropdownContainer = document.createElement('div');
  dropdownContainer.className = 'autocomplete-container';
  dropdownContainer.setAttribute('aria-live', 'polite');
  wrapper.appendChild(dropdownContainer);

  // Update ARIA attributes on input
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'restaurant-autocomplete-listbox');

  /**
   * Show loading state
   */
  function showLoading() {
    isLoading = true;
    dropdownContainer.innerHTML = `
      <div class="autocomplete-dropdown">
        <div class="autocomplete-loading">Searching...</div>
      </div>
    `;
    isOpen = true;
    input.setAttribute('aria-expanded', 'true');
  }

  /**
   * Show the dropdown with current suggestions
   */
  function showDropdown() {
    dropdownContainer.innerHTML = renderDropdown(suggestions, currentQuery);
    isOpen = true;
    isLoading = false;
    activeIndex = -1;
    input.setAttribute('aria-expanded', 'true');
  }

  /**
   * Hide the dropdown
   */
  function hideDropdown() {
    dropdownContainer.innerHTML = '';
    isOpen = false;
    isLoading = false;
    activeIndex = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  /**
   * Select a suggestion
   * @param {number} index - Index of suggestion to select
   */
  function selectSuggestion(index) {
    const restaurant = suggestions[index];
    if (!restaurant) return;

    input.value = restaurant.name;
    hideDropdown();

    if (onSelect) {
      onSelect(restaurant);
    }
  }

  /**
   * Update active item highlight
   * @param {number} newIndex - New active index
   */
  function setActiveItem(newIndex) {
    const items = dropdownContainer.querySelectorAll('.autocomplete-item');

    // Remove active class from all items
    items.forEach(item => item.classList.remove('autocomplete-item-active'));

    // Clamp index to valid range
    if (newIndex < 0) {
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
      return;
    }

    if (newIndex >= items.length) {
      activeIndex = items.length - 1;
    } else {
      activeIndex = newIndex;
    }

    // Add active class to new item
    const activeItem = items[activeIndex];
    if (activeItem) {
      activeItem.classList.add('autocomplete-item-active');
      input.setAttribute('aria-activedescendant', activeItem.id);
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Handle input changes
   */
  const handleInput = debounce(async () => {
    const query = input.value.trim();
    currentQuery = query;

    if (query.length < MIN_QUERY_LENGTH) {
      suggestions = [];
      hideDropdown();
      return;
    }

    showLoading();

    try {
      const response = await autocompleteRestaurants(query, MAX_SUGGESTIONS);
      suggestions = response.data || [];
      showDropdown();
    } catch (error) {
      console.error('Failed to fetch restaurant suggestions:', error);
      suggestions = [];
      hideDropdown();
    }
  }, DEBOUNCE_MS);

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    if (!isOpen || isLoading) {
      // Open dropdown on arrow down if we have cached suggestions
      if (event.key === 'ArrowDown' && suggestions.length) {
        showDropdown();
        setActiveItem(0);
        event.preventDefault();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveItem(activeIndex + 1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        setActiveItem(activeIndex - 1);
        break;

      case 'Enter':
        if (activeIndex >= 0) {
          event.preventDefault();
          selectSuggestion(activeIndex);
        }
        break;

      case 'Escape':
        hideDropdown();
        break;

      case 'Tab':
        hideDropdown();
        break;
    }
  }

  /**
   * Handle click on suggestion item
   * @param {MouseEvent} event
   */
  function handleDropdownClick(event) {
    const item = event.target.closest('.autocomplete-item');
    if (item) {
      const index = parseInt(item.dataset.index, 10);
      selectSuggestion(index);
    }
  }

  /**
   * Handle mouse over on suggestion item
   * @param {MouseEvent} event
   */
  function handleDropdownMouseover(event) {
    const item = event.target.closest('.autocomplete-item');
    if (item) {
      const index = parseInt(item.dataset.index, 10);
      setActiveItem(index);
    }
  }

  /**
   * Handle clicks outside to close dropdown
   * @param {MouseEvent} event
   */
  function handleDocumentClick(event) {
    if (!wrapper.contains(event.target)) {
      hideDropdown();
    }
  }

  /**
   * Handle focus to potentially reopen dropdown
   */
  function handleFocus() {
    if (suggestions.length && input.value.length >= MIN_QUERY_LENGTH) {
      showDropdown();
    }
  }

  // Attach event listeners
  input.addEventListener('input', handleInput);
  input.addEventListener('keydown', handleKeydown);
  input.addEventListener('focus', handleFocus);
  dropdownContainer.addEventListener('click', handleDropdownClick);
  dropdownContainer.addEventListener('mouseover', handleDropdownMouseover);
  document.addEventListener('click', handleDocumentClick);

  // Return instance with destroy method
  return {
    /**
     * Destroy the autocomplete instance and clean up
     */
    destroy() {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('keydown', handleKeydown);
      input.removeEventListener('focus', handleFocus);
      dropdownContainer.removeEventListener('click', handleDropdownClick);
      dropdownContainer.removeEventListener('mouseover', handleDropdownMouseover);
      document.removeEventListener('click', handleDocumentClick);

      // Restore original DOM structure
      wrapper.parentNode.insertBefore(input, wrapper);
      wrapper.remove();

      // Clean up ARIA attributes
      input.removeAttribute('role');
      input.removeAttribute('aria-autocomplete');
      input.removeAttribute('aria-expanded');
      input.removeAttribute('aria-controls');
      input.removeAttribute('aria-activedescendant');
    },

    /**
     * Get currently selected restaurant data
     * @returns {Object|null}
     */
    getSelectedData() {
      return suggestions[activeIndex] || null;
    },

    /**
     * Clear the input and suggestions
     */
    clear() {
      input.value = '';
      suggestions = [];
      hideDropdown();
    },
  };
}
