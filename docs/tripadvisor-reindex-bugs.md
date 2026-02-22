# TripAdvisor Reindex Bugs

When a user manually reindexes a restaurant from the details page, TripAdvisor data is never meaningfully added. The external ID may get stored, but categories, photos, and reviews are all missing. This document describes the three bugs responsible and how they interact.

## The Reindex Flow

`reindex_restaurant` in `lib/services/index_restaurants_service.rb:172` has two steps:

1. **Step 1 (line 186-208):** Refresh data from adapters the restaurant already has an external ID for. Calls `adapter.get_business()` then `refresh_restaurant_data()`.
2. **Step 2 (line 210-237):** Search for the restaurant on adapters where it doesn't have an external ID yet. Calls `adapter.search_by_name()`, finds a strict match, then calls `merge_restaurant()`.

TripAdvisor problems are in Step 2 — the path for adding a *new* source to an existing restaurant.

## Bug 1: `adapter` Not Passed to `merge_restaurant`

**File:** `lib/services/index_restaurants_service.rb:231`

The reindex Step 2 call:

```ruby
merge_restaurant(restaurant, best_match, adapter.source_name, restaurant.location)
```

The method signature:

```ruby
def merge_restaurant(existing, data, source, location = nil, adapter: nil)
```

The `adapter:` keyword argument is never provided, so it defaults to `nil`. Inside `merge_restaurant` (line 704), `fetch_reviews(adapter, data[:external_id])` is called with `nil`, which returns `[]` immediately (line 782: `return [] unless adapter && external_id`).

**Impact:** Reviews are never fetched for any newly discovered source during reindex.

**Contrast with the backfill path** (`backfill_from_adapters`, line 557) which correctly passes the adapter:

```ruby
merge_restaurant(restaurant, best_match, source, location, adapter: adapter)
```

**Fix:** Pass `adapter:` at line 231:

```ruby
merge_restaurant(restaurant, best_match, adapter.source_name, restaurant.location, adapter: adapter)
```

## Bug 2: No `fetch_business_details` Call During Reindex

**File:** `lib/services/index_restaurants_service.rb:227-231`

During initial indexing, `index_with_adapter` calls `fetch_business_details(adapter, biz)` (line 491) to enrich search results with data from the details endpoint (photos, phone, etc.). The backfill path also does this (line 555).

During reindex Step 2, this call is missing entirely. The raw `search_by_name` result is passed directly to `merge_restaurant`.

For TripAdvisor, `search_by_name` returns data normalized by `normalize_location` (line 245), which has:

```ruby
categories: [],  # Categories not available in search results
photos: [],      # Photos require separate API call
```

Without calling `fetch_business_details`, TripAdvisor's `get_business` / `normalize_location_details` is never invoked, so categories from the details endpoint are lost.

**Impact:** TripAdvisor categories are never stored during reindex (always empty array). Phone and other detail-only fields are also missing.

**Fix:** Call `fetch_business_details` before `merge_restaurant` at line 231:

```ruby
best_match = fetch_business_details(adapter, best_match)
merge_restaurant(restaurant, best_match, adapter.source_name, restaurant.location, adapter: adapter)
```

## Bug 3: `get_photos` Is Never Called

**File:** `lib/infrastructure/adapters/tripadvisor.rb:187-208`

TripAdvisor's API requires a separate endpoint (`location/{id}/photos`) to fetch photos. The adapter has a `get_photos` method for this, but it is never called anywhere in the service layer.

Both `normalize_location` (search, line 257) and `normalize_location_details` (details, line 277) return `photos: []`. This means even with Bug 2 fixed, TripAdvisor photos will still be empty — `fetch_business_details` merges photos from `get_business`, but `get_business` itself returns no photos.

**Impact:** TripAdvisor photos are never stored, regardless of whether the restaurant is initially indexed or reindexed.

**Fix:** Call `get_photos` inside `fetch_business_details` (or a TripAdvisor-specific hook) when the details response has empty photos. For example, in `fetch_business_details`:

```ruby
# After merging details, if photos still empty and adapter supports get_photos, try that
if (merged[:photos].nil? || merged[:photos].empty?) && adapter.respond_to?(:get_photos)
  raw_id = strip_source_prefix(merged[:external_id], adapter.source_name)
  photos = adapter.get_photos(raw_id)
  merged[:photos] = photos if photos && !photos.empty?
end
```

## Summary

| Bug | What's missing | Affects reindex? | Affects initial index? |
|-----|---------------|-----------------|----------------------|
| 1. `adapter` not passed | Reviews | Yes | No |
| 2. No `fetch_business_details` | Categories, phone | Yes | No |
| 3. `get_photos` never called | Photos | Yes | Yes |

All three bugs compound during reindex: TripAdvisor gets an external ID and a rating score, but nothing else. The restaurant appears unchanged to the user.
