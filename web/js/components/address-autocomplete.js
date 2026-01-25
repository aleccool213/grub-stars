/**
 * Address Autocomplete Component
 * Uses Photon (photon.komoot.io) for geocoding suggestions
 */

const PHOTON_API_URL = 'https://photon.komoot.io/api/';
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 5;

/**
 * Format a Photon feature into a display string
 * @param {Object} feature - Photon feature object
 * @returns {string} - Formatted address string
 */
function formatAddress(feature) {
  const props = feature.properties || {};
  const parts = [];

  if (props.name && props.name !== props.city) {
    parts.push(props.name);
  }
  if (props.city) {
    parts.push(props.city);
  }
  if (props.state) {
    parts.push(props.state);
  }
  if (props.country) {
    parts.push(props.country);
  }

  return parts.join(', ') || 'Unknown location';
}

/**
 * Get location type icon based on OSM type
 * @param {Object} feature - Photon feature object
 * @returns {string} - Emoji icon
 */
function getLocationIcon(feature) {
  const props = feature.properties || {};
  const type = props.osm_value || props.type || '';

  if (type === 'city' || type === 'town') return '🏙️';
  if (type === 'village' || type === 'hamlet') return '🏘️';
  if (type === 'suburb' || type === 'neighbourhood') return '🏠';
  if (type === 'country') return '🌍';
  if (type === 'state' || type === 'province') return '🗺️';
  return '📍';
}

/**
 * Fetch address suggestions from Photon API
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Array of suggestion objects
 */
export async function fetchSuggestions(query) {
  if (!query || query.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const params = new URLSearchParams({
    q: query,
    limit: MAX_SUGGESTIONS,
  });

  try {
    const response = await fetch(`${PHOTON_API_URL}?${params}`);
    if (!response.ok) {
      throw new Error(`Photon API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.features || []).map(feature => ({
      id: feature.properties?.osm_id || Math.random().toString(36),
      displayName: formatAddress(feature),
      icon: getLocationIcon(feature),
      coordinates: {
        lat: feature.geometry?.coordinates?.[1],
        lng: feature.geometry?.coordinates?.[0],
      },
      properties: feature.properties || {},
      raw: feature,
    }));
  } catch (error) {
    console.error('Failed to fetch address suggestions:', error);
    return [];
  }
}

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
 * Render the autocomplete dropdown HTML
 * @param {Array} suggestions - Array of suggestion objects
 * @returns {string} - HTML string
 */
function renderDropdown(suggestions) {
  if (!suggestions.length) {
    return '';
  }

  const items = suggestions.map((suggestion, index) => `
    <li
      role="option"
      id="suggestion-${index}"
      class="autocomplete-item"
      data-index="${index}"
      tabindex="-1"
    >
      <span class="autocomplete-icon">${suggestion.icon}</span>
      <span class="autocomplete-text">${escapeHtml(suggestion.displayName)}</span>
    </li>
  `).join('');

  return `
    <ul role="listbox" class="autocomplete-dropdown" id="autocomplete-listbox">
      ${items}
    </ul>
  `;
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
 * Initialize address autocomplete on an input element
 * @param {HTMLInputElement} input - Input element to enhance
 * @param {Object} options - Configuration options
 * @param {Function} options.onSelect - Callback when suggestion is selected
 * @returns {Object} - Autocomplete instance with destroy method
 */
export function initAddressAutocomplete(input, options = {}) {
  const { onSelect } = options;

  let suggestions = [];
  let activeIndex = -1;
  let dropdownContainer = null;
  let isOpen = false;

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
  input.setAttribute('aria-controls', 'autocomplete-listbox');

  /**
   * Show the dropdown with current suggestions
   */
  function showDropdown() {
    if (!suggestions.length) {
      hideDropdown();
      return;
    }

    dropdownContainer.innerHTML = renderDropdown(suggestions);
    isOpen = true;
    activeIndex = -1;
    input.setAttribute('aria-expanded', 'true');
  }

  /**
   * Hide the dropdown
   */
  function hideDropdown() {
    dropdownContainer.innerHTML = '';
    isOpen = false;
    activeIndex = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  /**
   * Select a suggestion
   * @param {number} index - Index of suggestion to select
   */
  function selectSuggestion(index) {
    const suggestion = suggestions[index];
    if (!suggestion) return;

    input.value = suggestion.displayName;
    hideDropdown();

    if (onSelect) {
      onSelect(suggestion);
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

    if (query.length < MIN_QUERY_LENGTH) {
      suggestions = [];
      hideDropdown();
      return;
    }

    suggestions = await fetchSuggestions(query);
    showDropdown();
  }, DEBOUNCE_MS);

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    if (!isOpen) {
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
     * Get currently selected suggestion data
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
