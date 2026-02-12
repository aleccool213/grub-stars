# Indexing Improvements

Suggestions for improving multi-source restaurant coverage, especially TripAdvisor.

## Problem

Restaurants rarely have data from all 3 sources (Yelp, Google, TripAdvisor). The root cause is an asymmetry in how many results each adapter returns during forward indexing:

| Adapter | Max results per index |
|---|---|
| Yelp | 240 (paginated, 50/page) |
| Google | 60 (paginated, 20/page) |
| TripAdvisor | ~10 (single search, no pagination) |

After Yelp/Google populate 100+ restaurants, TripAdvisor's ~10 results can only match a small fraction.

## Implemented: Reverse-Lookup Pass

After all adapters finish their forward indexing, the service runs a reverse-lookup pass. For each adapter, it finds restaurants in the database that are missing an external ID for that source and calls `search_by_name` to try to find them. This is most impactful for TripAdvisor since its forward search returns so few results.

The reverse lookup uses the same strict matching thresholds as `reindex_restaurant` (90% name similarity, 80 overall score) to avoid false matches.

## Future Improvements

### 1. Multiple Category-Specific Searches (High Impact, Low Effort)

Instead of a single "restaurants in {location}" TripAdvisor query, issue separate searches for common categories: "pizza in {location}", "sushi in {location}", "cafe in {location}", etc. Each returns ~10 different results, multiplying coverage 5-10x.

### 2. Name-Based Fallback Matching (High Impact, Medium Effort)

When GPS is nil (TripAdvisor detail fetch fails), `find_match()` returns no candidates and creates a duplicate. Add a fallback: query the repository by normalized name similarity when GPS is missing. A name-only match scoring name (35) + address (20) + phone (20) = 75 possible points, enough to clear the 50-point threshold.

### 3. Strip Restaurant Suffixes from Names (Medium Impact, Low Effort)

LCS similarity penalizes cross-platform naming differences. "Starbucks" vs "Starbucks Coffee" = 53% similarity, only 19/35 name points. Strip common suffixes like "restaurant", "bar", "grill", "cafe", "coffee", "pub", "bistro", "kitchen" before comparing, similar to how `normalize_address` strips "street", "avenue", etc.

### 4. Better Address Normalization (Medium Impact, Low Effort)

TripAdvisor includes country and full state name ("Ontario" vs "ON") in addresses. Strip country, normalize state abbreviations, and postal codes before comparing. Only compare street number + street name + city.

### 5. Country Code Phone Normalization (Low-Medium Impact, Low Effort)

Phone matching is binary (20 or 0 points). Strip leading country code (e.g., "1" for North America) before comparison. Consider partial matching (last 7 digits) for a reduced score.
