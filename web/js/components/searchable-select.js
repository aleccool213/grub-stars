/**
 * Searchable Select Component
 * A custom dropdown with client-side search/filter functionality.
 * Styled to match the autocomplete dropdowns used elsewhere in the app.
 */

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
 * Render the dropdown HTML
 * @param {Array} filteredOptions - Array of option objects { value, label, icon? }
 * @param {string} emptyMessage - Message to show when no options match
 * @param {string} listboxId - ID for the listbox element
 * @returns {string} - HTML string
 */
function renderDropdown(filteredOptions, emptyMessage, listboxId) {
  if (!filteredOptions.length) {
    return `
      <div class="autocomplete-dropdown">
        <div class="autocomplete-empty">
          <span>${escapeHtml(emptyMessage)}</span>
        </div>
      </div>
    `;
  }

  const items = filteredOptions.map((option, index) => `
    <li
      role="option"
      id="${listboxId}-option-${index}"
      class="autocomplete-item"
      data-index="${index}"
      data-value="${escapeHtml(option.value)}"
      tabindex="-1"
    >
      <span class="autocomplete-icon">${option.icon || '📍'}</span>
      <span class="autocomplete-text">${escapeHtml(option.label)}</span>
    </li>
  `).join('');

  return `
    <ul role="listbox" class="autocomplete-dropdown" id="${listboxId}">
      ${items}
    </ul>
  `;
}

/**
 * Initialize a searchable select on an input element
 * @param {HTMLInputElement} input - Input element to enhance
 * @param {Object} options - Configuration options
 * @param {Array} options.options - Array of options: { value: string, label: string, icon?: string }
 * @param {string} options.placeholder - Placeholder text for the input
 * @param {string} options.emptyMessage - Message when no options match
 * @param {string} options.defaultIcon - Default icon for options
 * @param {Function} options.onSelect - Callback when an option is selected
 * @param {boolean} options.allowEmpty - Allow selecting empty/clearing the selection
 * @param {string} options.emptyLabel - Label for the empty option (e.g., "All locations")
 * @returns {Object} - Searchable select instance with methods
 */
export function initSearchableSelect(input, options = {}) {
  const {
    options: selectOptions = [],
    placeholder = 'Search...',
    emptyMessage = 'No options found',
    defaultIcon = '📍',
    onSelect,
    allowEmpty = false,
    emptyLabel = ''
  } = options;

  // State
  let allOptions = selectOptions.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt, icon: defaultIcon } : { icon: defaultIcon, ...opt }
  );
  let filteredOptions = [...allOptions];
  let activeIndex = -1;
  let dropdownContainer = null;
  let isOpen = false;
  let selectedValue = '';
  const listboxId = `searchable-select-${Math.random().toString(36).substr(2, 9)}`;

  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'autocomplete-wrapper';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  // Create dropdown container
  dropdownContainer = document.createElement('div');
  dropdownContainer.className = 'autocomplete-container';
  dropdownContainer.setAttribute('aria-live', 'polite');
  wrapper.appendChild(dropdownContainer);

  // Update input attributes
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listboxId);
  input.setAttribute('autocomplete', 'off');
  if (placeholder) {
    input.setAttribute('placeholder', placeholder);
  }

  /**
   * Filter options based on query
   * @param {string} query - Search query
   */
  function filterOptions(query) {
    const normalizedQuery = query.toLowerCase().trim();

    if (!normalizedQuery) {
      filteredOptions = [...allOptions];
    } else {
      filteredOptions = allOptions.filter(opt =>
        opt.label.toLowerCase().includes(normalizedQuery) ||
        opt.value.toLowerCase().includes(normalizedQuery)
      );
    }
  }

  /**
   * Show the dropdown
   */
  function showDropdown() {
    dropdownContainer.innerHTML = renderDropdown(filteredOptions, emptyMessage, listboxId);
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
   * Select an option
   * @param {number} index - Index of option to select
   */
  function selectOption(index) {
    const option = filteredOptions[index];
    if (!option) return;

    selectedValue = option.value;
    input.value = option.label;
    hideDropdown();

    if (onSelect) {
      onSelect(option);
    }
  }

  /**
   * Clear the selection
   */
  function clearSelection() {
    selectedValue = '';
    input.value = '';

    if (onSelect) {
      onSelect({ value: '', label: emptyLabel });
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
  function handleInput() {
    const query = input.value;
    filterOptions(query);
    showDropdown();

    // If input is cleared and allowEmpty, clear the selection
    if (!query && allowEmpty) {
      selectedValue = '';
    }
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    if (!isOpen) {
      // Open dropdown on arrow down or enter
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault();
        filterOptions(input.value);
        showDropdown();
        if (filteredOptions.length > 0) {
          setActiveItem(0);
        }
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
        event.preventDefault();
        if (activeIndex >= 0) {
          selectOption(activeIndex);
        } else if (filteredOptions.length > 0) {
          // Select first option if none is active
          selectOption(0);
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
   * Handle click on dropdown item
   * @param {MouseEvent} event
   */
  function handleDropdownClick(event) {
    const item = event.target.closest('.autocomplete-item');
    if (item) {
      const index = parseInt(item.dataset.index, 10);
      selectOption(index);
    }
  }

  /**
   * Handle mouse over on dropdown item
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
   * Handle focus to open dropdown
   */
  function handleFocus() {
    filterOptions(input.value);
    showDropdown();
  }

  // Attach event listeners
  input.addEventListener('input', handleInput);
  input.addEventListener('keydown', handleKeydown);
  input.addEventListener('focus', handleFocus);
  dropdownContainer.addEventListener('click', handleDropdownClick);
  dropdownContainer.addEventListener('mouseover', handleDropdownMouseover);
  document.addEventListener('click', handleDocumentClick);

  // Return instance with methods
  return {
    /**
     * Get the currently selected value
     * @returns {string}
     */
    getValue() {
      return selectedValue;
    },

    /**
     * Set the selected value programmatically
     * @param {string} value - Value to select
     */
    setValue(value) {
      const option = allOptions.find(opt => opt.value === value);
      if (option) {
        selectedValue = option.value;
        input.value = option.label;
      } else if (allowEmpty && !value) {
        selectedValue = '';
        input.value = '';
      }
    },

    /**
     * Update the options list
     * @param {Array} newOptions - New array of options
     */
    setOptions(newOptions) {
      allOptions = newOptions.map(opt =>
        typeof opt === 'string' ? { value: opt, label: opt, icon: defaultIcon } : { icon: defaultIcon, ...opt }
      );
      filteredOptions = [...allOptions];

      // If dropdown is open, refresh it
      if (isOpen) {
        filterOptions(input.value);
        showDropdown();
      }
    },

    /**
     * Clear the selection
     */
    clear() {
      clearSelection();
      hideDropdown();
    },

    /**
     * Destroy the component and clean up
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
    }
  };
}
