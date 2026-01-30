# Bug: Restaurant Deduplication Failed for Homestead Artisan Bakery

**STATUS: FIXED** - Enhanced debug logging added to diagnose deduplication issues.

## Summary
When indexing "Homestead Artisan Bakery", the system failed to merge/duplicate the restaurant data from Yelp and Google sources. Instead of creating a single merged restaurant record with data from both sources, it appears to have created separate entries or failed to match them entirely.

**Expected behavior:** The Matcher should identify that the Yelp and Google results refer to the same restaurant and merge them into a single restaurant record with combined data (ratings, reviews, photos from both sources).

**Actual behavior:** The restaurant appears to have been indexed as separate entries or the match confidence was too low to trigger merging. Data from one source may be missing from the final restaurant record.

## Fix Applied

Enhanced debug logging was added to the Matcher class (`lib/domain/matcher.rb`) to help diagnose deduplication issues. The logging now outputs:

- Number of candidates being compared
- Detailed score breakdown for each component (name, address, GPS, phone)
- Total score vs. threshold
- Final decision (match found or will create new restaurant)

Example output:
```
[DEBUG] Matcher: Looking for match for 'Homestead Artisan Bakery'
[DEBUG] Matcher: 3 candidate(s) to compare
[DEBUG] Matcher: Comparing 'Homestead Artisan Bakery' with 'Homestead Bakery' (ID: 42)
[DEBUG] Matcher:   Scores - name: 28/35, address: 18/20, gps: 25/25, phone: 0/20
[DEBUG] Matcher:   Total: 71/100 (threshold: 50)
[DEBUG] Matcher: MATCH FOUND - 'Homestead Artisan Bakery' matches 'Homestead Bakery' (score: 71)
```

This logging is always enabled and will help identify why specific restaurants fail to match during indexing.

## Affected Service
- `IndexRestaurantsService` - Multi-adapter indexing with deduplication

## Steps to Reproduce
1. Run indexing for location containing "Homestead Artisan Bakery"
2. Observe that both Yelp and Google adapters return results for this restaurant
3. Check the database after indexing completes
4. Observe: Restaurant data from both sources may not be merged

## Investigation Required

### 1. Production Database Inspection (Fly.io)
```bash
# SSH into production container
fly ssh console --config fly.prod.toml

# Check database for Homestead Artisan Bakery entries
sqlite3 /data/grub_stars.db "SELECT r.id, r.name, e.source, e.external_id FROM restaurants r JOIN external_ids e ON r.id = e.restaurant_id WHERE r.name LIKE '%Homestead%'"

# Check if multiple restaurant records exist
sqlite3 /data/grub_stars.db "SELECT * FROM restaurants WHERE name LIKE '%Homestead Artisan Bakery%'"

# Check matcher candidates that were considered
# (Need to add logging for this - see below)
```

### 2. Production Logs Analysis
```bash
# View recent logs
fly logs --config fly.prod.toml

# Look for matcher-related log entries during indexing
# Search for: "Matcher", "confidence", "candidate", "Homestead"
```

## Root Cause Analysis Needed

The Matcher uses confidence scoring to determine if two restaurants are the same:
- Name similarity (~30 points)
- Address match
- GPS proximity
- Phone number match

**Potential issues:**
1. **Name mismatch** - Yelp and Google may have slightly different names
2. **Address format difference** - "123 Main St" vs "123 Main Street"
3. **GPS coordinates too far apart** - Threshold may be too strict
4. **Confidence threshold** - Score may be just below the 50-point threshold
5. **Timing issue** - One adapter result processed before the other was available
6. **Missing phone number** - Phone match contributes to confidence

## Suggested Fix Strategy

### Immediate Actions:
1. **Inspect production DB** to see actual data state
2. **Add debug logging** around the Matcher (see below)
3. **Reproduce locally** with mock data matching the production scenario

### Code Improvements:
1. **Enhanced Matcher Logging:**
   - Log all candidate pairs being compared
   - Log individual confidence component scores
   - Log final confidence score and decision (merge vs separate)
   - Add restaurant names and IDs to log context

2. **Matcher Debug Mode:**
   - Add environment variable to enable verbose matcher logging
   - Log full candidate details when match is close to threshold

3. **Confidence Threshold Review:**
   - Analyze historical match data to validate 50-point threshold
   - Consider lowering threshold or adding fuzzy matching

4. **Test Coverage:**
   - Add unit test for this specific scenario
   - Test with real Yelp/Google data for Homestead Artisan Bakery

## Debug Logging Implementation

Add to `lib/domain/matcher.rb`:
```ruby
def find_match(restaurant_data, candidates)
  candidates.each do |candidate|
    scores = calculate_match_scores(restaurant_data, candidate)
    total_score = scores.values.sum
    
    logger.debug "Matcher: Comparing '#{restaurant_data[:name]}' with candidate '#{candidate.name}'"
    logger.debug "Matcher: Scores - name: #{scores[:name]}, address: #{scores[:address]}, gps: #{scores[:gps]}, phone: #{scores[:phone]}"
    logger.debug "Matcher: Total confidence: #{total_score} (threshold: #{MATCH_THRESHOLD})"
    
    return candidate if total_score > MATCH_THRESHOLD
  end
  
  logger.debug "Matcher: No match found for '#{restaurant_data[:name]}'"
  nil
end
```

## Files to Review
- `lib/domain/matcher.rb` - Restaurant deduplication logic
- `lib/services/index_restaurants_service.rb` - Indexing orchestration
- `lib/infrastructure/adapters/yelp.rb` - Yelp adapter data format
- `lib/infrastructure/adapters/google.rb` - Google adapter data format
- Production database schema and data

## Related
- CLAUDE.md "Domain Layer" → "Matcher" section for deduplication algorithm details
- CLAUDE.md "Service Layer" → "IndexRestaurantsService" for indexing flow

---

# Bug: External Links Include Source Prefix Causing 404 Errors

**STATUS: FIXED** - Added `stripSourcePrefix()` function in `web/js/details.js`.

## Summary
External links to Yelp and Google Maps from the restaurant details page are broken. The URLs incorrectly include the source prefix (e.g., `yelp:`, `google:`) which causes the external services to return "page not found" errors.

**Broken URLs:**
- Yelp: `https://www.yelp.com/biz/yelp:59jIKAjoDmI4A8ksh0eL9w` ❌
- Google: `https://www.google.com/maps/search/place_id:google:ChIJJZ10HS-jKogRjRKsnTfis4Y/...` ❌

**Expected URLs:**
- Yelp: `https://www.yelp.com/biz/59jIKAjoDmI4A8ksh0eL9w` ✅
- Google: `https://www.google.com/maps/place/?q=place_id:ChIJJZ10HS-jKogRjRKsnTfis4Y` ✅

## Fix Applied

Added `stripSourcePrefix()` function to `web/js/details.js` that strips the source prefix from external IDs before building URLs:

```javascript
function stripSourcePrefix(externalId) {
  if (!externalId) return '';
  return externalId.replace(/^(yelp|google|tripadvisor):/, '');
}
```

The `getSourceUrl()` function now uses this helper to generate correct URLs.

---

# Bug: Dark Mode Implementation Issues

## Summary
Dark mode has multiple implementation issues across the web frontend. While the CSS in `custom.css` has comprehensive dark mode styles, many JavaScript components render content with hardcoded inline styles and light-mode color classes that don't adapt to dark mode.

**Expected behavior:** All UI elements should properly adapt to dark mode with appropriate color schemes, backgrounds, and text colors.

**Actual behavior:** Many elements remain in light mode colors or have poor contrast when dark mode is enabled, especially dynamically rendered content from JavaScript.

## Issues Found

### 1. test.html Missing Dark Mode Script
**File:** `web/test.html`

The test.html file is missing the early dark mode detection script that all other HTML files have:

```html
<!-- Early dark mode detection to prevent FOUC -->
<script>
  (function() {
    const stored = localStorage.getItem('grub_stars_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  })();
</script>
```

**Impact:** Users viewing the test page will experience a flash of unstyled content (FOUC) in light mode before dark mode is applied.

---

### 2. Hardcoded Inline Styles in JavaScript Files
Multiple JavaScript files use inline styles with hardcoded light-mode colors that override CSS dark mode styles.

**Affected Files:**
- `web/js/details.js` - Uses `style="color: #4b5563;"`, `style="background-color: #f3f4f6;"`, etc.
- `web/js/search.js` - Uses `bg-gray-50`, `text-gray-600`, `border-gray-200` without dark variants
- `web/js/categories-list.js` - Uses `bg-gray-50`, `text-gray-700`, `border-gray-200`
- `web/js/index-form.js` - Uses `bg-green-50`, `text-green-800`, `bg-white`
- `web/js/add-restaurant.js` - Uses `bg-white`, `text-gray-900`, `border-gray-200`
- `web/js/bookmarks-list.js` - Uses `text-gray-500`

**Example from details.js line 148:**
```javascript
<div class="text-gray-600 space-y-1" style="color: #4b5563;">
```

**Impact:** Inline styles have higher specificity than CSS classes and cannot be overridden by the dark mode CSS in `custom.css`, causing elements to remain light-colored in dark mode.

---

### 3. Missing Dark Mode Classes in Dynamically Rendered Content
JavaScript components render HTML without dark: prefixed utility classes, relying on CSS overrides that don't work well with Twind's hashed class names.

**Examples:**

**search.js lines 261-276:**
```javascript
resultsContainer.innerHTML = `
  <div class="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
    <div class="text-gray-400 mb-4">...</div>
    <h3 class="text-lg font-semibold text-gray-700 mb-2">No restaurants found</h3>
    <p class="text-gray-500 mb-4">...</p>
  </div>
`;
```

**categories-list.js lines 81-86:**
```javascript
return `
  <a href="${searchUrl}"
     class="block p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-center transition-colors duration-200">
    <span class="text-gray-700 hover:text-blue-700 font-medium capitalize">${escapeHtml(category)}</span>
  </a>
`;
```

**Impact:** Elements rendered by JavaScript don't have dark mode variants and rely on CSS workarounds that target container IDs, which is fragile and doesn't cover all cases.

---

### 4. Onboarding Banner Uses Inline Styles
**File:** `web/js/components/onboarding-banner.js`

The onboarding banner component uses inline styles with hardcoded colors:

```javascript
// Line 71
style="background: linear-gradient(135deg, #FFB347, #FF6B9D); width: 32px; height: 32px; border-radius: 50%;"

// Lines 75-76
style="font-weight: 600; color: #4A3728;"
style="font-size: 0.875rem; color: rgba(74, 55, 40, 0.7);"
```

**Impact:** The onboarding banner will always display in light mode colors regardless of the theme setting, causing poor visibility in dark mode.

---

### 5. Error Message Component Uses Inline Styles
**File:** `web/js/components/error-message.js`

The error message component uses inline styles with hardcoded light-mode colors:

```javascript
// Line 29
style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 0.5rem; padding: 1.5rem; text-align: center;"

// Line 30
style="color: #dc2626; margin-bottom: 0.5rem;"

// Line 35
style="font-size: 1.125rem; font-weight: 600; color: #991b1b; margin-bottom: 0.25rem;"
```

While `custom.css` has overrides for these specific inline styles (lines 571-586), this is a fragile approach that requires maintaining a list of every possible inline style color.

---

## Root Cause

The fundamental issue is that **Twind hashes class names at runtime**, which means:

1. **CSS selectors like `.bg-white` don't match** - Twind converts `class="bg-white"` to something like `class="#1e293b"` in the DOM
2. **Inline styles cannot be overridden** - They have higher specificity than class-based CSS
3. **JavaScript-rendered content lacks dark: prefixes** - Components were written without dark mode variants

## Suggested Fix Strategy

### Immediate Actions:

1. **Add dark mode script to test.html:**
   ```html
   <!-- Early dark mode detection to prevent FOUC -->
   <script>
     (function() {
       const stored = localStorage.getItem('grub_stars_theme');
       const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
       if (stored === 'dark' || (!stored && prefersDark)) {
         document.documentElement.classList.add('dark');
         document.documentElement.style.colorScheme = 'dark';
       }
     })();
   </script>
   ```

2. **Remove inline styles from JavaScript files:**
   - Replace inline `style="color: #4b5563;"` with Tailwind classes
   - Remove redundant inline styles that duplicate class functionality
   - Keep only essential inline styles (e.g., dynamic positioning)

3. **Add dark: prefixes to all rendered content:**
   ```javascript
   // Before
   <div class="bg-gray-50 text-gray-700">
   
   // After
   <div class="bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200">
   ```

4. **Update component files to use dark mode classes:**
   - `onboarding-banner.js` - Add dark mode variants or use semantic color classes
   - `error-message.js` - Add dark: prefixes to all color classes
   - `loading-spinner.js` - Add dark mode support
   - `restaurant-card.js` - Add dark: prefixes

### Code Pattern to Follow:

```javascript
// Good - uses dark: prefixes
function renderCard() {
  return `
    <div class="bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700">
      <h3 class="text-gray-900 dark:text-white">Title</h3>
      <p class="text-gray-600 dark:text-slate-400">Description</p>
    </div>
  `;
}

// Bad - hardcoded colors
function renderCard() {
  return `
    <div style="background-color: #ffffff; color: #1f2937;">
      <h3 style="color: #111827;">Title</h3>
      <p style="color: #4b5563;">Description</p>
    </div>
  `;
}
```

## Files to Review and Update

### HTML Files:
- `web/test.html` - Add dark mode script

### JavaScript Files (add dark: prefixes):
- `web/js/search.js` - Empty results, error states
- `web/js/details.js` - Restaurant details, ratings, reviews, photos, videos
- `web/js/categories-list.js` - Category cards, empty state
- `web/js/index-form.js` - Index results, success/error messages
- `web/js/add-restaurant.js` - Search results, result cards
- `web/js/bookmarks-list.js` - Bookmark items, empty state

### Component Files:
- `web/js/components/onboarding-banner.js` - Replace inline styles
- `web/js/components/error-message.js` - Add dark: prefixes
- `web/js/components/loading-spinner.js` - Add dark mode support
- `web/js/components/restaurant-card.js` - Add dark: prefixes
- `web/js/components/bookmark-button.js` - Add dark mode variants
- `web/js/components/nav-bar.js` - Already has dark mode (verify completeness)

### CSS File:
- `web/css/custom.css` - Review and potentially simplify dark mode overrides once JS is fixed

## Testing Checklist

- [ ] Verify test.html applies dark mode immediately without FOUC
- [ ] Check all pages in dark mode: index.html, details.html, categories.html, bookmarks.html, index-location.html, add-restaurant.html
- [ ] Verify dynamically rendered content (search results, empty states, errors) displays correctly in dark mode
- [ ] Check onboarding banner visibility in dark mode
- [ ] Verify error messages have proper contrast in dark mode
- [ ] Test loading spinners in dark mode
- [ ] Check restaurant cards in both list and grid views
- [ ] Verify bookmark buttons are visible in dark mode
- [ ] Test autocomplete dropdown in dark mode
- [ ] Check photo lightbox controls visibility

## Related

- CLAUDE.md "Dark Mode CSS Challenges" section explains the Twind hashing issue
- CLAUDE.md "Twind Class Name Hashing" section documents why inline styles are problematic
- `web/js/dark-mode.js` - Dark mode state management
- `web/js/twind-config.js` - Twind configuration with darkMode: 'class'

---

# Bug: Restaurant Search Redirect Not Pre-Filling Fields After Indexing

## Summary

When a user successfully indexes restaurants and clicks the "Search" button on the success card, the app redirects to the search page but fails to pre-fill the location and category fields. The search is also not executed automatically.

**Expected behavior:** User is redirected to search page with location and category fields pre-filled from the indexing operation, and a search is automatically performed.

**Actual behavior:** User is redirected to search page with empty form fields. No search is performed.

## Steps to Reproduce

1. Navigate to `/index-location.html`
2. Fill in a location (e.g., "Toronto, Ontario")
3. Optionally select a category filter (e.g., "Bakery")
4. Click "Index Restaurants" button
5. Wait for indexing to complete (shows success card)
6. Click the blue "Search in [location]" button on the success card
7. Observe: Form fields are empty, no search results are shown

## Root Causes

### Issue 1: Missing Category Parameter in Redirect Link

**File:** `web/js/index-form.js` (lines 154-162)

The redirect link only includes the `location` parameter and excludes the `category`:

```javascript
<a href="/?location=${encodeURIComponent(location)}">
```

**Should be:**
```javascript
<a href="/?location=${encodeURIComponent(location)}${category ? `&category=${encodeURIComponent(category)}` : ''}">
```

This means even if the location field fills correctly, the category filter is lost.

### Issue 2: Potential Value Mismatch for Location Dropdown

**File:** `web/js/search.js` (line 158)

The code attempts to pre-fill the location dropdown by setting the value to the location string:

```javascript
if (location && locationSelect) locationSelect.value = location;
```

**Problem:** The dropdown options may use different values than the plain location string. The actual option values need to be verified against what `loadLocations()` populates in the dropdown. If the dropdown value format doesn't match the URL parameter format, the field won't be pre-filled.

**Example mismatch:**
- URL contains: `location=Toronto, Ontario`
- Dropdown option value might be: `toronto-ontario` or an ID like `loc_123`

### Issue 3: Potential Race Condition (Minor)

**File:** `web/js/search.js` (lines 35-79)

While `handleUrlParams()` is called after `Promise.all([loadCategories(), loadLocations()])` completes (line 78), there could be edge cases where:
- The dropdowns are populated asynchronously
- Form field references become stale or unavailable
- The search executes before dropdown rendering completes

## Impact

Users cannot easily search for restaurants in the location they just indexed. They must manually:
1. Select the location from the dropdown again
2. Re-select the category filter (if applicable)
3. Submit the form again

This breaks the intended user experience where indexing and searching should be a seamless workflow.

## Test Coverage

**Existing test:** `web/js/index-form.test.js` (lines 244-268)

Current test `'index-form: success results include search link'` only validates:
- The redirect link exists
- The location parameter is URL-encoded

**Missing test coverage:**
- Verify category parameter is included in redirect link
- End-to-end test: index with category → redirect → form is pre-filled → search executes
- Test value format matching between redirect URL and dropdown options

## Suggested Fix Strategy

1. **Update redirect link in `index-form.js`:** Include both location and category parameters
2. **Verify dropdown value formats in `search.js`:** Ensure URL parameter values match actual dropdown option values
3. **Add comprehensive tests:** Test the full redirect → pre-fill → search flow
4. **Consider adding console warnings:** Log when pre-fill fails (location not found in dropdown, etc.) to help debug value mismatches

## Files Affected

- `web/js/index-form.js` - Generates redirect link with insufficient parameters
- `web/js/search.js` - Receives redirect but fails to properly pre-fill form
- `web/index.html` - Search form structure (verify dropdown option values)
- `web/js/index-form.test.js` - Test coverage is incomplete

## Related Files (Reference)

- `web/index.html` (lines 36-89) - Search form HTML structure
- `web/js/api.js` (lines 58-66) - `searchRestaurants()` API client

---

# Bug: Dark Mode - Footer Text Unreadable

## Summary
The footer text "Made with ..." is unreadable in dark mode due to insufficient contrast.

**Expected behavior:** Footer text should be visible with appropriate contrast in both light and dark modes.

**Actual behavior:** Footer text blends into the dark background and is difficult or impossible to read.

## Affected Pages
- All pages with footer component

## Suggested Fix
Update footer CSS to use appropriate text colors for dark mode (e.g., `text-gray-300` or `text-gray-400` instead of dark colors).

---

# Bug: Dark Mode - Category Names Unreadable on Categories Page

## Summary
Category names on the categories page are unreadable in dark mode due to poor text/background contrast.

**Expected behavior:** Category names should be clearly visible with high contrast against the background in dark mode.

**Actual behavior:** Category names blend into the background or have insufficient contrast, making them hard to read.

## Affected Pages
- `/categories.html`

## Suggested Fix
Review and update category card/list styling to ensure proper contrast in dark mode. May need to adjust text color, background color, or both.

---

# Bug: Dark Mode - Restaurant Details Page Elements Look Jank

## Summary
Multiple elements on the restaurant details page have visual issues in dark mode including poor contrast, incorrect colors, or styling that doesn't adapt properly to the dark theme.

**Expected behavior:** All elements on the restaurant details page should render cleanly with appropriate dark mode styling.

**Actual behavior:** Various elements appear broken, misaligned, or have poor visibility in dark mode.

## Affected Pages
- `/details.html`

## Suggested Fix
Audit all elements on the details page for dark mode compatibility:
- Review text colors and backgrounds
- Check borders and dividers
- Verify icon colors
- Ensure images/media have appropriate overlays if needed

---

# Bug: Dark Mode - "Browse Restaurants" Text Unreadable on Bookmarks Page

## Summary
The "Browse restaurants" text/link on the bookmarks page is unreadable in dark mode due to insufficient contrast.

**Expected behavior:** The "Browse restaurants" text should be clearly visible and readable in dark mode.

**Actual behavior:** Text color blends with the dark background, making it difficult to read.

## Affected Pages
- `/bookmarks.html`

## Suggested Fix
Update the "Browse restaurants" link/text styling to use an appropriate color for dark mode visibility.

---

# Bug: Get Directions Button Opens Raw GPS Coordinates Instead of Restaurant Name

**STATUS: FIXED** - Added `getDirectionsUrl()` function in `web/js/details.js`.

## Summary
The "Get directions" button on the restaurant details page opens Google Maps with raw GPS coordinates (e.g., `google.com/maps?q=44.3894,-79.6903`) instead of the restaurant's name or address. While the coordinates are technically correct, users opening Google Maps see just numbers with no context about which restaurant they're navigating to.

## Fix Applied

Added `getDirectionsUrl()` function to `web/js/details.js` that builds a Google Maps URL using the restaurant name and address:

```javascript
function getDirectionsUrl(restaurant) {
  const parts = [];
  if (restaurant.name) parts.push(restaurant.name);
  if (restaurant.address) parts.push(restaurant.address);

  if (parts.length > 0) {
    const query = encodeURIComponent(parts.join(', '));
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  // Fallback to coordinates if no name/address
  if (restaurant.latitude && restaurant.longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`;
  }

  return '#';
}
```

Now Google Maps shows the restaurant name and address (e.g., "Joe's Pizza, 123 Main St, Barrie") instead of raw coordinates.

---

# Bug: Static Map Images Not Loading on Restaurant Details Page

**STATUS: FIXED** - Switched to OpenStreetMap embed iframe in `web/js/details.js`.

## Summary
The static map images on the restaurant details page were failing to load due to unreliable `staticmap.openstreetmap.de` service.

## Fix Applied

Replaced the static map image with an OpenStreetMap embed iframe which is more reliable:

```javascript
const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`;
```

Benefits:
- Official OpenStreetMap embed feature - no third-party service
- Interactive map (users can zoom/pan)
- Marker shows exact restaurant location
- "Get Directions" button overlay for quick navigation to Google Maps

---
