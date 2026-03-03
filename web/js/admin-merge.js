/**
 * Admin Merge Page Controller
 * Allows manual merging of duplicate restaurants
 */

import { getMergeCandidates, getMergePreview, mergeRestaurants, getRestaurant } from './api.js';
import { initRestaurantAutocomplete } from './components/restaurant-autocomplete.js';
import { loadingSpinner } from './components/loading-spinner.js';
import { errorMessage } from './components/error-message.js';
import { insertNavBar } from './components/nav-bar.js';

// State
let selectedDuplicate = null;
let selectedTarget = null;
let duplicateAutocomplete = null;
let targetAutocomplete = null;

// DOM elements
let duplicateSelectedEl;
let targetSelectedEl;
let mergePreviewEl;
let candidatesContainer;

/**
 * Initialize the merge page
 */
async function init() {
  insertNavBar({ currentPage: 'merge' });

  duplicateSelectedEl = document.getElementById('duplicate-selected');
  targetSelectedEl = document.getElementById('target-selected');
  mergePreviewEl = document.getElementById('merge-preview');
  candidatesContainer = document.getElementById('candidates-container');

  // Set up autocomplete for manual merge
  const duplicateInput = document.getElementById('duplicate-search');
  const targetInput = document.getElementById('target-search');

  if (duplicateInput) {
    duplicateAutocomplete = initRestaurantAutocomplete(duplicateInput, {
      onSelect: (restaurant) => selectDuplicate(restaurant),
    });
  }

  if (targetInput) {
    targetAutocomplete = initRestaurantAutocomplete(targetInput, {
      onSelect: (restaurant) => selectTarget(restaurant),
    });
  }

  // Add event delegation for buttons
  document.addEventListener('click', handleGlobalClick);

  // Load auto-detected candidates
  await loadCandidates();
}

/**
 * Handle restaurant selection as duplicate (to remove)
 * @param {Object} restaurant - Selected restaurant summary from autocomplete
 */
async function selectDuplicate(restaurant) {
  try {
    const response = await getRestaurant(restaurant.id);
    selectedDuplicate = response.data;
    duplicateSelectedEl.innerHTML = restaurantSelectionCard(selectedDuplicate, 'duplicate');
    updateMergePreview();
  } catch (error) {
    duplicateSelectedEl.innerHTML = errorMessage(error.message);
  }
}

/**
 * Handle restaurant selection as target (to keep)
 * @param {Object} restaurant - Selected restaurant summary from autocomplete
 */
async function selectTarget(restaurant) {
  try {
    const response = await getRestaurant(restaurant.id);
    selectedTarget = response.data;
    targetSelectedEl.innerHTML = restaurantSelectionCard(selectedTarget, 'target');
    updateMergePreview();
  } catch (error) {
    targetSelectedEl.innerHTML = errorMessage(error.message);
  }
}

/**
 * Update merge preview when both restaurants are selected
 */
async function updateMergePreview() {
  if (!selectedDuplicate || !selectedTarget) {
    mergePreviewEl.innerHTML = '';
    return;
  }

  if (selectedDuplicate.id === selectedTarget.id) {
    mergePreviewEl.innerHTML = `
      <div class="bg-yellow-50 dark:bg-slate-800 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-4 text-center">
        <p class="text-yellow-700 dark:text-yellow-300">Cannot merge a restaurant with itself. Please select two different restaurants.</p>
      </div>
    `;
    return;
  }

  mergePreviewEl.innerHTML = loadingSpinner('Loading merge preview...');

  try {
    const response = await getMergePreview(selectedDuplicate.id, selectedTarget.id);
    const data = response.data;
    mergePreviewEl.innerHTML = mergePreviewHtml(data);
  } catch (error) {
    mergePreviewEl.innerHTML = errorMessage(error.message);
  }
}

/**
 * Generate HTML for merge preview
 * @param {Object} data - Preview data from API
 * @returns {string} HTML string
 */
function mergePreviewHtml(data) {
  const { duplicate, target, similarity, preview } = data;

  const similarityPercent = (similarity * 100).toFixed(1);
  const similarityColor = similarity >= 0.85 ? 'text-green-600 dark:text-green-400'
    : similarity >= 0.6 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400';

  return `
    <div class="border-2 border-electric/30 rounded-xl p-5 bg-electric/5 dark:bg-electric/10">
      <div class="flex items-center justify-between mb-4">
        <h4 class="font-semibold text-cocoa dark:text-cream flex items-center gap-2">
          <span>📋</span> Merge Preview
        </h4>
        <span class="text-sm ${similarityColor} font-medium">
          ${similarityPercent}% name similarity
        </span>
      </div>

      <!-- Side-by-side comparison -->
      <div class="grid gap-4 md:grid-cols-2 mb-4">
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-3">
          <div class="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">Will be removed</div>
          ${comparisonCard(duplicate)}
        </div>
        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg p-3">
          <div class="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide mb-2">Will be kept</div>
          ${comparisonCard(target)}
        </div>
      </div>

      <!-- Combined result -->
      <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 mb-4">
        <div class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">After merge</div>
        <div class="text-sm space-y-1">
          <p><strong class="text-cocoa dark:text-cream">Name:</strong> <span class="text-gray-700 dark:text-slate-300">${escapeHtml(preview.name)}</span></p>
          <p><strong class="text-cocoa dark:text-cream">Address:</strong> <span class="text-gray-700 dark:text-slate-300">${escapeHtml(preview.address || 'N/A')}</span></p>
          <p><strong class="text-cocoa dark:text-cream">Sources:</strong> <span class="text-gray-700 dark:text-slate-300">${preview.combined_sources.join(', ')}</span></p>
          <p><strong class="text-cocoa dark:text-cream">Categories:</strong> <span class="text-gray-700 dark:text-slate-300">${preview.combined_categories.join(', ') || 'None'}</span></p>
          <p><strong class="text-cocoa dark:text-cream">Ratings:</strong> <span class="text-gray-700 dark:text-slate-300">${preview.combined_ratings.map(r => `${r.source}: ${r.score}`).join(', ') || 'None'}</span></p>
          <p><strong class="text-cocoa dark:text-cream">Media:</strong> <span class="text-gray-700 dark:text-slate-300">${preview.media_count} items</span></p>
          <p><strong class="text-cocoa dark:text-cream">Reviews:</strong> <span class="text-gray-700 dark:text-slate-300">${preview.review_count} snippets</span></p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="btn-primary cursor-pointer"
          data-action="merge"
          data-duplicate-id="${duplicate.id}"
          data-target-id="${target.id}"
        >
          Merge Restaurants
        </button>
        <button
          type="button"
          class="btn-secondary cursor-pointer"
          data-action="swap-merge"
        >
          Swap Direction
        </button>
        <p class="text-xs text-cocoa/50 dark:text-cream/50">
          Restaurant #${duplicate.id} will be deleted. This action cannot be undone.
        </p>
      </div>
    </div>
  `;
}

/**
 * Generate comparison card HTML for a restaurant
 * @param {Object} restaurant - Restaurant data
 * @returns {string} HTML string
 */
function comparisonCard(restaurant) {
  const ratings = restaurant.ratings || [];
  const sources = restaurant.external_ids?.map(e => e.source) || [];

  return `
    <div class="text-sm">
      <p class="font-semibold text-cocoa dark:text-cream mb-1">
        <a href="/details.html?id=${restaurant.id}" class="hover:text-electric transition-colors" target="_blank">
          ${escapeHtml(restaurant.name)}
        </a>
        <span class="text-xs text-gray-400 dark:text-slate-500 ml-1">#${restaurant.id}</span>
      </p>
      <p class="text-gray-600 dark:text-slate-400 text-xs mb-1">${escapeHtml(restaurant.address || 'No address')}</p>
      ${restaurant.phone ? `<p class="text-gray-600 dark:text-slate-400 text-xs mb-1">${escapeHtml(restaurant.phone)}</p>` : ''}
      <div class="flex flex-wrap gap-1 mt-2">
        ${sources.map(s => `<span class="tag tag-source">${escapeHtml(s)}</span>`).join('')}
      </div>
      ${ratings.length > 0 ? `
        <div class="flex flex-wrap gap-2 mt-1">
          ${ratings.filter(r => r.score > 0).map(r => `
            <span class="text-xs text-gray-500 dark:text-slate-400">${escapeHtml(r.source)}: ${r.score.toFixed(1)} (${r.review_count})</span>
          `).join('')}
        </div>
      ` : ''}
      <div class="flex flex-wrap gap-1 mt-1">
        ${(restaurant.categories || []).slice(0, 3).map(c => `<span class="tag tag-category text-xs">${escapeHtml(c)}</span>`).join('')}
      </div>
    </div>
  `;
}

/**
 * Generate HTML for a selected restaurant card in the manual merge section
 * @param {Object} restaurant - Restaurant data
 * @param {string} role - 'duplicate' or 'target'
 * @returns {string} HTML string
 */
function restaurantSelectionCard(restaurant, role) {
  const borderColor = role === 'duplicate'
    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
    : 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20';
  const label = role === 'duplicate' ? 'Will be removed' : 'Will be kept';
  const labelColor = role === 'duplicate' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
  const sources = restaurant.external_ids?.map(e => e.source) || [];
  const ratings = restaurant.ratings || [];

  return `
    <div class="border ${borderColor} rounded-lg p-3 text-sm">
      <div class="flex items-start justify-between mb-1">
        <div>
          <span class="text-xs font-medium ${labelColor} uppercase tracking-wide">${label}</span>
          <p class="font-semibold text-cocoa dark:text-cream">
            ${escapeHtml(restaurant.name)}
            <span class="text-xs text-gray-400 dark:text-slate-500">#${restaurant.id}</span>
          </p>
        </div>
        <button type="button" class="text-gray-400 hover:text-red-500 cursor-pointer text-lg leading-none" data-action="clear-${role}" title="Clear selection">&times;</button>
      </div>
      <p class="text-gray-600 dark:text-slate-400 text-xs">${escapeHtml(restaurant.address || 'No address')}</p>
      <div class="flex flex-wrap gap-1 mt-1">
        ${sources.map(s => `<span class="tag tag-source">${escapeHtml(s)}</span>`).join('')}
      </div>
      ${ratings.length > 0 ? `
        <div class="flex flex-wrap gap-2 mt-1">
          ${ratings.filter(r => r.score > 0).map(r => `
            <span class="text-xs text-gray-500 dark:text-slate-400">${escapeHtml(r.source)}: ${r.score.toFixed(1)}</span>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Load auto-detected merge candidates
 */
async function loadCandidates() {
  candidatesContainer.innerHTML = loadingSpinner('Scanning for potential duplicates...');

  try {
    const response = await getMergeCandidates();
    const candidates = response.data || [];

    if (candidates.length === 0) {
      candidatesContainer.innerHTML = `
        <div class="text-center py-8">
          <div class="text-4xl mb-3">✅</div>
          <p class="text-gray-600 dark:text-slate-400 font-medium">No duplicates detected</p>
          <p class="text-gray-500 dark:text-slate-500 text-sm mt-1">All restaurants appear to be unique. Use manual merge above if you spot duplicates.</p>
        </div>
      `;
      return;
    }

    candidatesContainer.innerHTML = `
      <div class="space-y-4" id="candidates-list">
        ${candidates.map((c, i) => candidateCardHtml(c, i)).join('')}
      </div>
      <p class="text-xs text-gray-400 dark:text-slate-500 mt-3">${candidates.length} potential duplicate${candidates.length === 1 ? '' : 's'} found</p>
    `;
  } catch (error) {
    candidatesContainer.innerHTML = errorMessage(error.message, { showRetry: true });
  }
}

/**
 * Generate HTML for an auto-detected candidate card
 * @param {Object} candidate - Candidate data with duplicate and potential_targets
 * @param {number} index - Candidate index
 * @returns {string} HTML string
 */
function candidateCardHtml(candidate, index) {
  const { duplicate, potential_targets } = candidate;
  const bestMatch = potential_targets[0];
  const similarityPercent = (bestMatch.similarity * 100).toFixed(1);

  const dupSources = duplicate.external_ids?.map(e => e.source) || [];
  const targetSources = bestMatch.restaurant.external_ids?.map(e => e.source) || [];

  return `
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4" data-candidate-index="${index}">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
          ${similarityPercent}% match
        </span>
        <div class="flex gap-2">
          <button
            type="button"
            class="text-xs btn-primary cursor-pointer py-1 px-3"
            data-action="quick-merge"
            data-duplicate-id="${duplicate.id}"
            data-target-id="${bestMatch.restaurant.id}"
          >
            Merge
          </button>
          <button
            type="button"
            class="text-xs btn-secondary cursor-pointer py-1 px-3"
            data-action="preview-candidate"
            data-duplicate-id="${duplicate.id}"
            data-target-id="${bestMatch.restaurant.id}"
          >
            Preview
          </button>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <div class="text-xs text-red-500 dark:text-red-400 font-medium mb-1">Duplicate</div>
          <p class="font-medium text-cocoa dark:text-cream text-sm">${escapeHtml(duplicate.name)} <span class="text-xs text-gray-400">#${duplicate.id}</span></p>
          <p class="text-xs text-gray-500 dark:text-slate-400">${escapeHtml(duplicate.address || 'No address')}</p>
          <div class="flex flex-wrap gap-1 mt-1">
            ${dupSources.map(s => `<span class="tag tag-source">${escapeHtml(s)}</span>`).join('')}
          </div>
        </div>
        <div>
          <div class="text-xs text-green-500 dark:text-green-400 font-medium mb-1">Merge into</div>
          <p class="font-medium text-cocoa dark:text-cream text-sm">${escapeHtml(bestMatch.restaurant.name)} <span class="text-xs text-gray-400">#${bestMatch.restaurant.id}</span></p>
          <p class="text-xs text-gray-500 dark:text-slate-400">${escapeHtml(bestMatch.restaurant.address || 'No address')}</p>
          <div class="flex flex-wrap gap-1 mt-1">
            ${targetSources.map(s => `<span class="tag tag-source">${escapeHtml(s)}</span>`).join('')}
          </div>
        </div>
      </div>

      ${potential_targets.length > 1 ? `
        <p class="text-xs text-gray-400 dark:text-slate-500 mt-2">
          +${potential_targets.length - 1} other potential match${potential_targets.length > 2 ? 'es' : ''}
        </p>
      ` : ''}
    </div>
  `;
}

/**
 * Handle global click events (event delegation)
 * @param {Event} event - Click event
 */
async function handleGlobalClick(event) {
  const action = event.target.dataset.action;
  if (!action) return;

  if (action === 'merge' || action === 'quick-merge') {
    const duplicateId = parseInt(event.target.dataset.duplicateId, 10);
    const targetId = parseInt(event.target.dataset.targetId, 10);
    await executeMerge(duplicateId, targetId, event.target);
  }

  if (action === 'swap-merge') {
    swapMergeDirection();
  }

  if (action === 'clear-duplicate') {
    selectedDuplicate = null;
    duplicateSelectedEl.innerHTML = '';
    if (duplicateAutocomplete) duplicateAutocomplete.clear();
    mergePreviewEl.innerHTML = '';
  }

  if (action === 'clear-target') {
    selectedTarget = null;
    targetSelectedEl.innerHTML = '';
    if (targetAutocomplete) targetAutocomplete.clear();
    mergePreviewEl.innerHTML = '';
  }

  if (action === 'preview-candidate') {
    const duplicateId = parseInt(event.target.dataset.duplicateId, 10);
    const targetId = parseInt(event.target.dataset.targetId, 10);
    await previewCandidate(duplicateId, targetId);
  }

  if (action === 'retry') {
    await loadCandidates();
  }
}

/**
 * Execute a merge operation
 * @param {number} duplicateId - ID of restaurant to remove
 * @param {number} targetId - ID of restaurant to keep
 * @param {HTMLElement} button - The button that triggered the merge
 */
async function executeMerge(duplicateId, targetId, button) {
  if (!confirm(`Merge restaurant #${duplicateId} into #${targetId}? Restaurant #${duplicateId} will be permanently deleted.`)) {
    return;
  }

  const originalText = button.textContent;
  button.textContent = 'Merging...';
  button.disabled = true;

  try {
    const response = await mergeRestaurants(duplicateId, targetId);
    const result = response.data;

    if (result.merged) {
      // Show success message
      const successHtml = `
        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center animate-pop-in">
          <p class="text-green-800 dark:text-green-300 font-medium">
            Successfully merged! Restaurant #${duplicateId} has been merged into
            <a href="/details.html?id=${targetId}" class="underline hover:text-green-600">#${targetId} ${escapeHtml(result.restaurant?.name || '')}</a>.
          </p>
        </div>
      `;

      // If this was from manual merge, update the preview area
      if (mergePreviewEl && selectedDuplicate?.id === duplicateId) {
        mergePreviewEl.innerHTML = successHtml;
        selectedDuplicate = null;
        selectedTarget = null;
        duplicateSelectedEl.innerHTML = '';
        targetSelectedEl.innerHTML = '';
        if (duplicateAutocomplete) duplicateAutocomplete.clear();
        if (targetAutocomplete) targetAutocomplete.clear();
      }

      // If from candidate list, remove the card and show success
      const candidateCard = button.closest('[data-candidate-index]');
      if (candidateCard) {
        candidateCard.innerHTML = successHtml;
        // Fade out after a moment
        setTimeout(() => {
          candidateCard.style.transition = 'opacity 0.5s, max-height 0.5s';
          candidateCard.style.opacity = '0';
          candidateCard.style.maxHeight = '0';
          candidateCard.style.overflow = 'hidden';
          candidateCard.style.padding = '0';
          candidateCard.style.margin = '0';
          candidateCard.style.border = 'none';
        }, 2000);
      }
    }
  } catch (error) {
    alert(`Merge failed: ${error.message}`);
    button.textContent = originalText;
    button.disabled = false;
  }
}

/**
 * Swap the merge direction (duplicate becomes target and vice versa)
 */
function swapMergeDirection() {
  const temp = selectedDuplicate;
  selectedDuplicate = selectedTarget;
  selectedTarget = temp;

  if (selectedDuplicate) {
    duplicateSelectedEl.innerHTML = restaurantSelectionCard(selectedDuplicate, 'duplicate');
  }
  if (selectedTarget) {
    targetSelectedEl.innerHTML = restaurantSelectionCard(selectedTarget, 'target');
  }

  updateMergePreview();
}

/**
 * Load a candidate into the manual merge preview
 * @param {number} duplicateId - Duplicate restaurant ID
 * @param {number} targetId - Target restaurant ID
 */
async function previewCandidate(duplicateId, targetId) {
  try {
    const [dupResponse, targetResponse] = await Promise.all([
      getRestaurant(duplicateId),
      getRestaurant(targetId),
    ]);

    selectedDuplicate = dupResponse.data;
    selectedTarget = targetResponse.data;

    duplicateSelectedEl.innerHTML = restaurantSelectionCard(selectedDuplicate, 'duplicate');
    targetSelectedEl.innerHTML = restaurantSelectionCard(selectedTarget, 'target');

    await updateMergePreview();

    // Scroll to the manual merge section
    document.getElementById('manual-merge-section').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    alert(`Failed to load preview: ${error.message}`);
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
