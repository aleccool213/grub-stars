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
