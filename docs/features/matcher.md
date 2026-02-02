# TripAdvisor GPS Coordinate Fix - Implementation Plan

## Problem Statement

**Issue:** TripAdvisor's search API endpoint does not return GPS coordinates in the basic search results, causing restaurants to fail merging with existing entries from Yelp and Google that do have GPS data.

**Real-world example:** "Off the Hook Poke Market" in Honolulu was indexed three times:
- ID 334: Yelp + Google (successfully merged, has GPS)
- ID 335: TripAdvisor (not merged, no GPS coordinates)

**Root Cause:** The matcher requires GPS coordinates to find candidate matches within a geographic bounding box. When TripAdvisor data lacks GPS, `find_candidates_for_matching` returns an empty array, so no matching occurs.

## Current Behavior

### Adapter Data Availability

| Adapter | Search Returns GPS | Details Returns GPS |
|---------|-------------------|---------------------|
| Yelp    | ✅ Yes            | ✅ Yes              |
| Google  | ✅ Yes            | ✅ Yes              |
| TripAdvisor | ❌ No         | ✅ Yes              |

### Code Flow

```ruby
# index_restaurants_service.rb:363-376
def find_match(data)
  candidates = if data[:latitude] && data[:longitude]
                 delta = 0.01 # ~1km bounding box
                 @restaurant_repo.find_candidates_for_matching(
                   data[:latitude], data[:longitude], delta
                 )
               else
                 [] # No GPS data, can't match - RETURNS EMPTY ARRAY!
               end

  @matcher.find_match(data, candidates)
end
```

When `candidates` is empty, the matcher has nothing to compare against, so a new restaurant is created instead of merging.

## Proposed Solution

Fetch detailed data from TripAdvisor during indexing to obtain GPS coordinates, phone numbers, and other missing fields.

### Implementation Details

#### 1. Modify `tripadvisor.rb` - `search_all_businesses` method

**Location:** `lib/infrastructure/adapters/tripadvisor.rb:123-155`

**Current Implementation:**
```ruby
def search_all_businesses(location:, categories: nil, limit: nil, &block)
  ensure_configured!
  track_request!

  query = build_search_query(location, categories)
  params = {
    searchQuery: query,
    key: @api_key,
    language: "en"
  }

  response = connection.get("location/search", params)
  handle_response(response)

  data = JSON.parse(response.body)
  locations = data["data"] || []

  # Apply limit if specified
  locations = locations.take(limit) if limit

  total = locations.length
  locations.each_with_index do |loc, index|
    normalized = normalize_location(loc)
    progress = {
      current: index + 1,
      total: total,
      percent: (((index + 1).to_f / total) * 100).round(1)
    }
    yield normalized, progress if block_given?
  end

  total
end
```

**Proposed Implementation:**
```ruby
def search_all_businesses(location:, categories: nil, limit: nil, &block)
  ensure_configured!
  track_request!

  query = build_search_query(location, categories)
  params = {
    searchQuery: query,
    key: @api_key,
    language: "en"
  }

  response = connection.get("location/search", params)
  handle_response(response)

  data = JSON.parse(response.body)
  locations = data["data"] || []

  # Apply limit if specified
  locations = locations.take(limit) if limit

  total = locations.length
  locations.each_with_index do |loc, index|
    # Get basic normalized data from search results
    normalized = normalize_location(loc)
    
    # Fetch detailed data to get GPS coordinates and phone
    begin
      detailed_data = get_business(normalized[:external_id])
      if detailed_data
        # Merge detailed data into normalized result
        normalized[:latitude] = detailed_data[:latitude] if detailed_data[:latitude]
        normalized[:longitude] = detailed_data[:longitude] if detailed_data[:longitude]
        normalized[:phone] = detailed_data[:phone] if detailed_data[:phone]
        # Also get categories if available
        normalized[:categories] = detailed_data[:categories] if detailed_data[:categories] && !detailed_data[:categories].empty?
      end
    rescue StandardError => e
      # Log warning but continue with basic data
      # This ensures indexing doesn't fail if one detail fetch fails
      warn("Failed to fetch details for #{normalized[:name]}: #{e.message}")
    end
    
    # Rate limiting: small delay between detail calls to be API-friendly
    sleep(0.1) if index < locations.length - 1
    
    progress = {
      current: index + 1,
      total: total,
      percent: (((index + 1).to_f / total) * 100).round(1)
    }
    yield normalized, progress if block_given?
  end

  total
end
```

#### 2. Error Handling Strategy

**Requirements:**
- If `get_business` fails for a location, log a warning but continue with basic data
- Don't fail the entire indexing operation if one detail fetch fails
- Ensure partial data (without GPS) can still be indexed if needed

**Implementation:**
```ruby
begin
  detailed_data = get_business(normalized[:external_id])
  # ... merge data ...
rescue APIError => e
  # TripAdvisor API error (rate limit, not found, etc.)
  warn("TripAdvisor API error fetching details for #{normalized[:name]}: #{e.message}")
rescue StandardError => e
  # Unexpected error
  warn("Unexpected error fetching details for #{normalized[:name]}: #{e.message}")
end
```

#### 3. Performance Considerations

**API Request Budget:**
- TripAdvisor free tier: 5000 requests/day
- Current usage per 100 restaurants: 1 search request
- New usage per 100 restaurants: 1 search + 100 detail requests = 101 requests
- Additional time: ~10 seconds (100 calls × 100ms delay)

**Trade-offs:**
- ✅ Accurate restaurant merging
- ✅ Complete data (GPS, phone, categories)
- ❌ Slower indexing (~10s additional for 100 restaurants)
- ❌ Higher API usage (2x requests)

**Mitigation:**
- The 100ms delay is conservative; could be reduced to 50ms if API allows
- Consider making detail fetching optional/configurable for users with strict API limits

#### 4. Alternative: Fetch Details Only When Needed

Instead of always fetching details, only fetch when GPS is missing:

```ruby
locations.each_with_index do |loc, index|
  normalized = normalize_location(loc)
  
  # Only fetch details if GPS coordinates are missing
  if normalized[:latitude].nil? || normalized[:longitude].nil?
    begin
      detailed_data = get_business(normalized[:external_id])
      if detailed_data
        normalized[:latitude] = detailed_data[:latitude] if detailed_data[:latitude]
        normalized[:longitude] = detailed_data[:longitude] if detailed_data[:longitude]
        normalized[:phone] = detailed_data[:phone] if detailed_data[:phone]
      end
    rescue StandardError => e
      warn("Failed to fetch details for #{normalized[:name]}: #{e.message}")
    end
    sleep(0.1) if index < locations.length - 1
  end
  
  # ... yield normalized ...
end
```

**Pros:**
- Maintains fast indexing when GPS is available
- Only uses extra API calls when necessary

**Cons:**
- More complex logic
- Still need to handle case where search never returns GPS (current TripAdvisor behavior)

**Recommendation:** Always fetch details for TripAdvisor since search never returns GPS. The consistency is worth the extra API calls.

## Testing Plan

### Unit Tests

**File:** `tests/unit/adapters/tripadvisor_test.rb`

1. **Test that `search_all_businesses` fetches details for each location:**
   ```ruby
   def test_search_all_businesses_fetches_detailed_data
     # Mock search response with 2 locations
     search_response = {
       "data" => [
         { "location_id" => "123", "name" => "Restaurant A", "rating" => "4.5" },
         { "location_id" => "456", "name" => "Restaurant B", "rating" => "4.0" }
       ]
     }
     
     # Mock detail responses with GPS
     detail_response_a = {
       "location_id" => "123",
       "name" => "Restaurant A",
       "phone" => "+1234567890",
       "address_obj" => {
         "latitude" => "21.309971",
         "longitude" => "-157.810226"
       }
     }
     
     # ... set up stubs ...
     
     results = []
     adapter.search_all_businesses(location: "Honolulu, HI") do |biz, progress|
       results << biz
     end
     
     # Assert that GPS coordinates are present
     assert_equal 21.309971, results[0][:latitude]
     assert_equal -157.810226, results[0][:longitude]
     assert_equal "+1234567890", results[0][:phone]
   end
   ```

2. **Test error handling when detail fetch fails:**
   ```ruby
   def test_search_all_businesses_handles_detail_fetch_failure
     # Mock search success
     # Mock detail fetch failure (404 or API error)
     
     # Assert that indexing continues with basic data
     # Assert warning is logged
   end
   ```

3. **Test rate limiting delays:**
   ```ruby
   def test_search_all_businesses_adds_rate_limiting_delays
     # Mock 3 locations
     # Measure time between detail calls
     # Assert minimum 100ms delay between calls
   end
   ```

### Integration Tests

**File:** `tests/integration/index_test.rb`

1. **Test end-to-end merging with TripAdvisor data:**
   ```ruby
   def test_tripadvisor_restaurant_merges_with_existing_yelp_entry
     # Index Yelp first (has GPS)
     # Index TripAdvisor second (should merge, not create duplicate)
     # Assert only one restaurant in database
     # Assert restaurant has both yelp and tripadvisor external IDs
   end
   ```

## Migration/Deployment

### For Existing Duplicates

After deploying this fix, existing duplicate restaurants (like ID 335) won't be automatically merged. Options:

1. **Manual cleanup:** Query for duplicates and delete/merge manually
2. **Re-indexing:** Clear database and re-index the location (cleanest solution)
3. **Background job:** Write a script to find potential duplicates and merge them

**Recommended approach:** Re-index the affected location(s) after deploying the fix.

```bash
# Clear specific location data (if needed)
# Then re-index
grst index --location "Honolulu, Hawaii"
```

### Rollback Plan

If issues arise:
1. Revert the change in `tripadvisor.rb`
2. Deploy previous version
3. Re-indexing will work as before (but with same merging issues)

## Success Metrics

After implementation:
- [ ] TripAdvisor restaurants have GPS coordinates
- [ ] TripAdvisor restaurants merge with existing Yelp/Google entries
- [ ] No duplicate restaurants created when indexing same location with multiple adapters
- [ ] Indexing time increase is acceptable (< 30 seconds for 100 restaurants)
- [ ] API usage stays within free tier limits (5000 requests/day)

## Future Improvements

1. **Caching:** Cache TripAdvisor detail responses to avoid re-fetching during re-indexing
2. **Batching:** If TripAdvisor adds batch API support, use it to reduce API calls
3. **Configuration:** Allow users to disable detail fetching if they have strict API limits
4. **Monitoring:** Add metrics to track how many detail fetches fail vs succeed

## Related Documentation

- [Production Debugging Guide](../../CLAUDE.md#production-debugging-on-flyio) - How to investigate merging issues
- [TripAdvisor Adapter](../../docs/adapters/trip_advisor.md) - TripAdvisor API documentation
- [Matcher Logic](../../lib/domain/matcher.rb) - Restaurant matching algorithm
