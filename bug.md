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
