# Photo Indexing Fix - Implementation Plan

## Problem Statement

**Issue:** Photos are not being properly indexed from any adapter:
- **Yelp**: 0 photos in database (expects `photos` array, but search API returns `image_url`)
- **Google**: Only 1 photo per restaurant (textsearch returns 1, details returns up to 10)
- **TripAdvisor**: 0 photos in database (requires separate API call)

**Current Database State (Production):**
```sql
SELECT source, COUNT(*) as count FROM media GROUP BY source;
-- google: 59
-- yelp: 0
-- tripadvisor: 0
```

## Root Cause Analysis

### Yelp

**Current Code (`yelp.rb:188`):**
```ruby
photos: data["photos"] || [],
```

**Problem:** Yelp Search API returns `image_url` (single string), not `photos` (array).

**API Response Structure:**
```json
{
  "id": "business-id",
  "name": "Restaurant Name",
  "image_url": "https://yelpcdn.com/photo1.jpg",  // ← Single photo
  "photos": [  // ← This is ONLY in Business Details endpoint
    "https://yelpcdn.com/photo1.jpg",
    "https://yelpcdn.com/photo2.jpg",
    "https://yelpcdn.com/photo3.jpg"
  ]
}
```

### Google

**Current Code (`google.rb:195`):**
```ruby
photos: extract_photos(spot),
```

**Problem:** Google Text Search returns only 1 photo per result. Place Details returns up to 10.

**API Behavior:**
- `textsearch/json`: Returns `photos` array with 1 item
- `details/json`: Returns `photos` array with up to 10 items when requested

### TripAdvisor

**Current Code (`tripadvisor.rb:229`):**
```ruby
photos: [],  # Photos require separate API call
```

**Problem:** Search endpoint returns no photos. Must call separate `get_photos` endpoint.

**API Behavior:**
- `location/search`: No photos in response
- `location/{id}/photos`: Returns up to 5 photos

## Proposed Solution

Fetch detailed data for each restaurant during indexing to get complete photo sets from all adapters.

### Implementation Details

#### 1. Fix Yelp Adapter

**Location:** `lib/infrastructure/adapters/yelp.rb:173-191`

**Option A: Use `image_url` as fallback (Quick Fix)**
```ruby
def normalize_business(data)
  photos = if data["photos"] && !data["photos"].empty?
             data["photos"]
           elsif data["image_url"]
             [data["image_url"]]  # Wrap single URL in array
           else
             []
           end

  {
    external_id: "yelp:#{data["id"]}",
    name: data["name"],
    # ... other fields ...
    photos: photos,
    # ...
  }
end
```

**Option B: Fetch details for photos (Recommended)**
Call `get_business` during indexing to get the full `photos` array (up to 3 photos).

**Recommended Implementation:**
```ruby
def search_all_businesses(location:, categories: nil, limit: nil, &block)
  # ... existing search code ...
  
  businesses.each do |biz|
    break if processed >= max_results

    # Fetch details to get full photo array
    begin
      detailed_data = get_business(biz[:external_id].sub(/^yelp:/, ''))
      if detailed_data && detailed_data[:photos] && !detailed_data[:photos].empty?
        biz[:photos] = detailed_data[:photos]
      elsif biz[:photos].empty? && detailed_data
        # Use image_url from search if no photos in details
        # (This shouldn't happen, but as fallback)
      end
    rescue StandardError => e
      warn("Failed to fetch Yelp details for #{biz[:name]}: #{e.message}")
    end
    
    sleep(0.05)  # Rate limiting between detail calls

    processed += 1
    progress = {
      current: processed,
      total: total,
      percent: ((processed.to_f / total) * 100).round(1)
    }
    yield biz, progress if block_given?
  end
  
  # ...
end
```

#### 2. Fix Google Adapter

**Location:** `lib/infrastructure/adapters/google.rb:97-145`

**Implementation:**
```ruby
def search_all_businesses(location:, categories: nil, limit: nil, &block)
  # ... existing search code to get all_spots ...
  
  total = all_spots.length
  all_spots.each_with_index do |spot, index|
    normalized = normalize_spot(spot)
    
    # Fetch details to get up to 10 photos
    begin
      detailed_data = get_business(spot["place_id"])
      if detailed_data && detailed_data[:photos] && detailed_data[:photos].length > normalized[:photos].length
        normalized[:photos] = detailed_data[:photos]
      end
    rescue StandardError => e
      warn("Failed to fetch Google details for #{normalized[:name]}: #{e.message}")
    end
    
    sleep(0.1)  # Rate limiting
    
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

#### 3. Fix TripAdvisor Adapter

**Location:** `lib/infrastructure/adapters/tripadvisor.rb:123-155`

**Implementation:**
```ruby
def search_all_businesses(location:, categories: nil, limit: nil, &block)
  # ... existing search code ...
  
  total = locations.length
  locations.each_with_index do |loc, index|
    normalized = normalize_location(loc)
    
    # Fetch photos separately
    begin
      photos = get_photos(normalized[:external_id])
      normalized[:photos] = photos unless photos.empty?
    rescue StandardError => e
      warn("Failed to fetch TripAdvisor photos for #{normalized[:name]}: #{e.message}")
    end
    
    # Also fetch details for GPS (from previous fix) and other data
    begin
      detailed_data = get_business(normalized[:external_id])
      if detailed_data
        normalized[:latitude] = detailed_data[:latitude] if detailed_data[:latitude]
        normalized[:longitude] = detailed_data[:longitude] if detailed_data[:longitude]
        normalized[:phone] = detailed_data[:phone] if detailed_data[:phone]
        normalized[:categories] = detailed_data[:categories] if detailed_data[:categories] && !detailed_data[:categories].empty?
      end
    rescue StandardError => e
      warn("Failed to fetch TripAdvisor details for #{normalized[:name]}: #{e.message}")
    end
    
    sleep(0.1)  # Rate limiting between API calls
    
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

## API Request Budget Analysis

### Current Usage (per 100 restaurants)

| Adapter | Current Requests | Photos per Restaurant |
|---------|-----------------|----------------------|
| Yelp | 2-3 search requests | 0 (broken) |
| Google | 1-2 search requests | 1 |
| TripAdvisor | 1 search request | 0 (not fetched) |

### New Usage (per 100 restaurants)

| Adapter | New Requests | Photos per Restaurant |
|---------|-------------|----------------------|
| Yelp | 2-3 search + 100 detail | 3 |
| Google | 1-2 search + 100 detail | 10 |
| TripAdvisor | 1 search + 100 detail + 100 photos | 5 |

**Total Increase:**
- Yelp: ~100 extra requests
- Google: ~100 extra requests  
- TripAdvisor: ~200 extra requests (details + photos)

**API Limits:**
- Yelp: 5,000 requests/day → Can index ~50 restaurants/day with photos
- Google: 10,000 requests/day → Can index ~100 restaurants/day with photos
- TripAdvisor: 5,000 requests/day → Can index ~25 restaurants/day with photos

## Performance Considerations

### Indexing Time Impact

**Current:**
- 100 restaurants: ~30 seconds

**With Photo Fetching:**
- 100 restaurants: ~30s + (100 × 0.1s × 3 adapters) = ~60 seconds
- Additional ~30 seconds for photo fetching

**Mitigation Strategies:**

1. **Parallel Requests (Advanced):**
   ```ruby
   # Use concurrent requests for detail fetching
   # Requires thread-safe HTTP client
   ```

2. **Batch Processing:**
   - Process photos in background jobs
   - Index basic data first, enrich with photos asynchronously

3. **Caching:**
   - Cache photo URLs to avoid re-fetching during re-indexing
   - Photos rarely change, so cache TTL can be long (7+ days)

4. **Selective Photo Fetching:**
   - Only fetch photos for new restaurants
   - Skip photo fetching during re-index unless explicitly requested

## Testing Plan

### Unit Tests

**Yelp Adapter Tests:**
```ruby
def test_normalize_business_uses_image_url_when_photos_missing
  data = {
    "id" => "test-id",
    "name" => "Test Restaurant",
    "image_url" => "https://yelp.com/photo1.jpg"
    # No "photos" field
  }
  
  result = adapter.normalize_business(data)
  
  assert_equal ["https://yelp.com/photo1.jpg"], result[:photos]
end

def test_search_all_businesses_fetches_details_for_photos
  # Mock search returning businesses with image_url
  # Mock get_business returning photos array
  # Assert that yielded businesses have full photos array
end
```

**Google Adapter Tests:**
```ruby
def test_search_all_businesses_fetches_details_for_more_photos
  # Mock textsearch returning 1 photo
  # Mock details returning 5 photos
  # Assert that yielded business has 5 photos
end
```

**TripAdvisor Adapter Tests:**
```ruby
def test_search_all_businesses_fetches_photos
  # Mock search returning location without photos
  # Mock get_photos returning 3 photo URLs
  # Assert that yielded business has 3 photos
end
```

### Integration Tests

```ruby
def test_indexing_creates_restaurant_with_photos_from_all_sources
  # Index location with all 3 adapters enabled
  # Assert restaurant has photos from yelp, google, and tripadvisor
  # Assert photo count > 1 per source
end
```

## Migration/Deployment

### For Existing Restaurants

Existing restaurants have incomplete photo data. Options:

1. **Re-index affected locations:**
   ```bash
   grst index --location "Honolulu, Hawaii"
   ```

2. **Background enrichment job:**
   ```ruby
   # Find restaurants with < 3 photos and re-fetch
   Restaurant.where("id IN (SELECT restaurant_id FROM media GROUP BY restaurant_id HAVING COUNT(*) < 3)")
   ```

### Rollback Plan

If issues arise:
1. Revert adapter changes
2. Deploy previous version
3. Photos will revert to previous behavior (incomplete but functional)

## Success Metrics

After implementation:
- [ ] Yelp restaurants have 1-3 photos each
- [ ] Google restaurants have 5-10 photos each
- [ ] TripAdvisor restaurants have 3-5 photos each
- [ ] Total photos in database increases by 5-10x
- [ ] Indexing time remains under 2 minutes for 100 restaurants
- [ ] No API rate limit errors during normal indexing

## Related Documentation

- [TripAdvisor GPS Fix](./matcher.md) - Similar implementation pattern
- [Production Debugging](../../CLAUDE.md#production-debugging-on-flyio) - How to verify photo counts

## Implementation Priority

1. **Phase 1: Yelp Quick Fix** (1-2 hours)
   - Use `image_url` as fallback in `normalize_business`
   - Gets at least 1 photo working immediately

2. **Phase 2: Google Photos** (2-3 hours)
   - Call `get_business` during indexing
   - Gets up to 10 photos per restaurant

3. **Phase 3: TripAdvisor Photos** (2-3 hours)
   - Call `get_photos` during indexing
   - Combine with GPS fix from matcher.md

4. **Phase 4: Yelp Full Fix** (2-3 hours)
   - Call `get_business` to get up to 3 photos
   - Replace `image_url` fallback with full array

**Total Estimated Time:** 7-11 hours
