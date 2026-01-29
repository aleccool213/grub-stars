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

## Summary
The "Get directions" button on the restaurant details page opens Google Maps with raw GPS coordinates (e.g., `google.com/maps?q=44.3894,-79.6903`) instead of the restaurant's name or address. While the coordinates are technically correct, users opening Google Maps see just numbers with no context about which restaurant they're navigating to.

**Expected behavior:** Google Maps should open showing the restaurant's name and address, making it clear to users where they're navigating. Users should see a recognizable location name in Google Maps.

**Actual behavior:** Google Maps opens with raw latitude/longitude coordinates. Users see "44.3894,-79.6903" or similar instead of "Joe's Pizza - 123 Main St".

## Affected Pages
- `/details.html`

## Steps to Reproduce
1. Navigate to any restaurant details page
2. Click the "Get directions" button
3. Observe: Google Maps opens with coordinates in the URL/search bar
4. User sees raw numbers instead of restaurant name

## Root Cause
The directions link is likely constructed using only GPS coordinates:
```
https://www.google.com/maps?q=44.3894,-79.6903
```

## Suggested Fix
Update the directions link to include the restaurant name and address for better UX:

**Option 1 - Use restaurant name + address:**
```
https://www.google.com/maps/search/?api=1&query=Joe's+Pizza+123+Main+Street+Barrie+Ontario
```

**Option 2 - Use coordinates with query parameter:**
```
https://www.google.com/maps/search/?api=1&query=44.3894,-79.6903&query=Joe's+Pizza
```

**Option 3 - Use address as primary query:**
```
https://www.google.com/maps/dir/?api=1&destination=Joe's+Pizza,123+Main+St,Barrie,ON
```

**Implementation notes:**
- URL-encode the restaurant name and address properly
- Include full address (street, city, province/state) when available
- Fall back to coordinates if address is unavailable
- Test that Google Maps correctly geocodes the address

## Files to Review
- `web/js/details.js` - Likely where directions link is generated
- `web/details.html` - Restaurant details page template
- Any utility functions for generating external map URLs

---

# Bug: Static Map Images Not Loading on Restaurant Details Page

## Summary
The static map images on the restaurant details page are failing to load. Network tab inspection shows `NS_ERROR_UNKNOWN` errors for requests to `staticmap.openstreetmap.de`. The map container appears empty or broken instead of showing the restaurant location.

**Expected behavior:** A static map image should display showing the restaurant's location with a marker.

**Actual behavior:** Map image fails to load with network errors. Users see an empty space or broken image icon where the map should be.

## Affected Pages
- `/details.html`

## Steps to Reproduce
1. Navigate to any restaurant details page
2. Scroll to the map section (usually near address/location info)
3. Observe: Map image does not load
4. Open browser DevTools → Network tab
5. See failed requests to `staticmap.openstreetmap.de` with `NS_ERROR_UNKNOWN`

## Root Cause
The OpenStreetMap static map service (`staticmap.openstreetmap.de`) may be:
- Temporarily unavailable or down
- Rate limiting requests
- Blocked by network restrictions or CORS policies
- Deprecated or changed their API endpoint

**Current implementation likely uses:**
```
https://staticmap.openstreetmap.de/staticmap.php?center=44.3894,-79.6903&zoom=15&size=600x400&markers=44.3894,-79.6903
```

## Suggested Fix

**Option 1 - Switch to alternative static map provider:**
- **Mapbox Static Images API** - Requires API key but reliable
- **Google Maps Static API** - Requires API key, generous free tier
- **OpenStreetMap via different endpoint** - Check if alternative OSM static map services exist

**Option 2 - Implement interactive map fallback:**
- Use Leaflet.js or MapLibre GL JS for an interactive map
- Embed OpenStreetMap tiles directly (no static image service needed)
- More flexible but requires more JavaScript

**Option 3 - Graceful degradation:**
- Detect when static map fails to load
- Show a placeholder with the address text
- Provide a "View on Google Maps" link as primary action
- Hide the broken map container entirely

**Option 4 - Self-hosted tiles (advanced):**
- Host own map tile server
- Eliminates dependency on external services
- Higher infrastructure cost

**Immediate workaround:**
```javascript
// Add error handling to map image
<img src="staticmap-url" onerror="this.style.display='none'; document.getElementById('map-fallback').style.display='block';">
<div id="map-fallback" style="display:none;">
  <p>Map unavailable</p>
  <a href="google-maps-directions-link">Get directions</a>
</div>
```

## Files to Review
- `web/js/details.js` - Map image generation/rendering
- `web/details.html` - Map container HTML
- `web/css/custom.css` - Map container styling
- Any map utility functions

## Related
- See CLAUDE.md "Development Friction & Lessons Learned" → "Static Map Service" section for known issues

---

# Bug: Restaurant Deduplication Failed for Homestead Artisan Bakery

## Summary
When indexing "Homestead Artisan Bakery", the system failed to merge/duplicate the restaurant data from Yelp and Google sources. Instead of creating a single merged restaurant record with data from both sources, it appears to have created separate entries or failed to match them entirely.

**Expected behavior:** The Matcher should identify that the Yelp and Google results refer to the same restaurant and merge them into a single restaurant record with combined data (ratings, reviews, photos from both sources).

**Actual behavior:** The restaurant appears to have been indexed as separate entries or the match confidence was too low to trigger merging. Data from one source may be missing from the final restaurant record.

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

## Summary
External links to Yelp and Google Maps from the restaurant details page are broken. The URLs incorrectly include the source prefix (e.g., `yelp:`, `google:`) which causes the external services to return "page not found" errors.

**Broken URLs:**
- Yelp: `https://www.yelp.com/biz/yelp:59jIKAjoDmI4A8ksh0eL9w` ❌
- Google: `https://www.google.com/maps/search/place_id:google:ChIJJZ10HS-jKogRjRKsnTfis4Y/...` ❌

**Expected URLs:**
- Yelp: `https://www.yelp.com/biz/59jIKAjoDmI4A8ksh0eL9w` ✅
- Google: `https://www.google.com/maps/place/?q=place_id:ChIJJZ10HS-jKogRjRKsnTfis4Y` ✅

**Expected behavior:** Clicking external links should navigate to the correct restaurant page on Yelp or Google Maps.

**Actual behavior:** External services show "Sorry, page not found" or similar errors because the URL contains invalid source prefixes.

## Affected Pages
- `/details.html` - Restaurant details page
- Any other pages displaying external links

## Root Cause
The `external_id` field in the database stores values with source prefixes like:
- `yelp:59jIKAjoDmI4A8ksh0eL9w`
- `google:ChIJJZ10HS-jKogRjRKsnTfis4Y`

When generating external URLs, the code is using the full `external_id` value including the prefix instead of extracting just the ID portion.

## Suggested Fix

**Option 1 - Strip prefix when generating URLs (recommended):**
```javascript
// In JavaScript/frontend
function getYelpUrl(externalId) {
  const id = externalId.replace(/^yelp:/, '');
  return `https://www.yelp.com/biz/${id}`;
}

function getGoogleMapsUrl(externalId) {
  const id = externalId.replace(/^google:/, '');
  return `https://www.google.com/maps/place/?q=place_id:${id}`;
}
```

**Option 2 - Store clean IDs in database:**
- Modify the adapters to store only the ID without the prefix
- Update the `external_ids` table schema
- Migration needed to clean existing data
- More invasive but cleaner long-term

**Option 3 - Add URL generation methods to domain model:**
```ruby
# In Restaurant or ExternalId model
def yelp_url
  return nil unless yelp_id
  "https://www.yelp.com/biz/#{yelp_id.sub(/^yelp:/, '')}"
end

def google_maps_url
  return nil unless google_id
  "https://www.google.com/maps/place/?q=place_id:#{google_id.sub(/^google:/, '')}"
end
```

## Files to Review
- `web/js/details.js` - Where external links are generated
- `lib/domain/models/restaurant.rb` - Restaurant domain model
- `lib/domain/models/external_id.rb` - External ID domain model
- `lib/infrastructure/repositories/external_id_repository.rb` - Data access
- Any utility functions for URL generation

## Test Coverage Needed
- Unit tests for URL generation with prefixed IDs
- Integration tests verifying links work correctly
- Test with real external IDs from production database

## Related
- External ID storage format in database
- Adapter implementations that create external_ids

---
