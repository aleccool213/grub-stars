# Instagram Adapter

## Overview

Instagram is a **supplemental photo source**, not a primary indexing adapter. Unlike Yelp, Google, and TripAdvisor — which are business directories returning structured restaurant data (address, phone, rating, reviews, categories) — Instagram returns **photos and videos tagged at locations or with hashtags**.

The Instagram adapter enriches existing restaurant records with additional media. It does not discover new restaurants or provide business metadata.

## Why a New Adapter Contract

The existing `Adapters::Base` contract (`lib/infrastructure/adapters/base.rb`) requires:

- `search_businesses(location:, categories:, limit:, offset:)` — find restaurants by area
- `search_by_name(name:, location:, limit:)` — find restaurants by name
- `get_business(id)` — get structured business details
- `get_reviews(id)` — get review excerpts

Instagram cannot implement any of these. It has no concept of "businesses" with addresses, ratings, or reviews. Forcing it into `Base` would mean every method raises `NotImplementedError`, which is a code smell.

Instead, introduce a **`PhotoSourceBase`** contract — a separate adapter interface for sources that provide media but not business data. This keeps the existing adapter contract clean while allowing new photo-only sources (Instagram, TikTok, Flickr, etc.) to share a common interface.

## API Options

### Option 1: Instagram Graph API (Official)

**Endpoints available:**

| Endpoint | What it does | Limitations |
|----------|-------------|-------------|
| `GET /ig_hashtag_search?q={tag}` | Find hashtag ID by name | 30 unique hashtags per 7-day rolling window |
| `GET /{hashtag_id}/recent_media` | Get recent public posts for a hashtag | 50 results per page |
| `GET /{hashtag_id}/top_media` | Get top posts for a hashtag | 50 results per page |
| `GET /{ig_user_id}?fields=business_discovery.fields(media)&username={target}` | Get media from another Business/Creator account | Target must be Business/Creator |

**What's NOT available:**
- No location-based media search (the old v1 `/locations/{id}/media` was deprecated with the Platform API in 2020)
- No keyword/text search
- No personal account media access
- No geo-search by coordinates

**Requirements:**
- Meta Developer App with `instagram_basic`, `instagram_manage_comments` permissions
- Facebook Page linked to an Instagram Business/Creator account
- App Review for production use

**Rate limits:** 200 API calls per user per hour. 30 unique hashtag lookups per 7-day window per user.

**Env var:** `INSTAGRAM_ACCESS_TOKEN`

### Option 2: Third-Party Scraping APIs (SaaS)

Services like Bright Data, Apify, SociaVault, and HikerAPI offer REST APIs that scrape public Instagram data:

- Location-based media search (the killer feature missing from the official API)
- Hashtag-based media search
- Public profile media retrieval
- Proxy rotation and anti-bot evasion handled by the service

**Legal status:** Scraping publicly available data without login was upheld as legal in hiQ v. LinkedIn (2022) and Meta/X v. Bright Data (2026). GDPR/CCPA compliance is still required for handling personal data (usernames, profile photos).

**Pricing:** Pay-per-request. Typically $1-5 per 1,000 requests.

**Env var:** `INSTAGRAM_SCRAPER_API_KEY` + `INSTAGRAM_SCRAPER_BASE_URL`

### Option 3: `instagrapi` Private API (Unofficial)

The Python `instagrapi` library reverse-engineers Instagram's mobile API:

- `location_search(lat, lng)` — find Instagram location IDs near coordinates
- `location_medias_top(location_pk)` / `location_medias_recent(location_pk)` — media at a location
- `hashtag_medias_top(tag)` / `hashtag_medias_recent(tag)` — media by hashtag

Available as a REST sidecar via `instagrapi-rest` (Docker container).

**Risks:** Requires real Instagram login credentials, triggers account bans under heavy use, breaks when Instagram changes internal APIs, violates Instagram ToS.

**Not recommended for production.** Useful for development/prototyping.

### Recommendation

Start with **Option 1 (Graph API)** for stability and legality. The main limitation — no location search — can be partially worked around by deriving hashtags from restaurant names. Add **Option 2 (SaaS scraper)** later if location-based search proves essential.

## Architecture

### PhotoSourceBase Contract

```ruby
# lib/infrastructure/adapters/photo_source_base.rb
module GrubStars
  module Adapters
    class PhotoSourceBase < Base
      # Search for photos related to a specific restaurant.
      # Uses restaurant name, location text, and/or coordinates to find relevant media.
      #
      # Returns: Array of hashes with keys:
      #   { url:, caption:, posted_at:, author:, external_id: }
      def search_photos(restaurant_name:, location:, latitude: nil, longitude: nil, limit: 20)
        raise NotImplementedError
      end

      # Search for photos by hashtag.
      #
      # Returns: Array of hashes (same shape as search_photos)
      def search_by_hashtag(hashtag:, limit: 20)
        raise NotImplementedError
      end

      # Get recent media from a specific business account.
      #
      # Returns: Array of hashes (same shape as search_photos)
      def get_business_media(username:, limit: 20)
        raise NotImplementedError
      end

      # --- Base contract methods that don't apply ---
      # These raise NotImplementedError from Base, which is correct.
      # PhotoSourceBase adapters are NOT registered in the default adapter list
      # and are NOT called by IndexRestaurantsService's main indexing loop.
    end
  end
end
```

`PhotoSourceBase` extends `Base` to inherit rate limiting (`track_request!`, `request_count`, `remaining_requests`) and error classes (`APIError`, `RateLimitError`). It does NOT override `search_businesses` or `get_business` — those remain unimplemented because photo sources don't provide business data.

### Instagram Adapter

```ruby
# lib/infrastructure/adapters/instagram.rb
module GrubStars
  module Adapters
    class Instagram < PhotoSourceBase
      REQUEST_LIMIT = 5000  # Monthly request budget

      def source_name
        "instagram"
      end

      def configured?
        !access_token.nil? && !access_token.empty?
      end

      def search_photos(restaurant_name:, location:, latitude: nil, longitude: nil, limit: 20)
        # Derive hashtags from restaurant name: "Flying Monkeys" -> "flyingmonkeys"
        hashtag = derive_hashtag(restaurant_name)
        search_by_hashtag(hashtag: hashtag, limit: limit)
      end

      def search_by_hashtag(hashtag:, limit: 20)
        track_request!
        hashtag_id = lookup_hashtag_id(hashtag)
        return [] if hashtag_id.nil?

        track_request!
        fetch_hashtag_media(hashtag_id, type: :recent, limit: limit)
      end

      def get_business_media(username:, limit: 20)
        track_request!
        fetch_business_discovery_media(username, limit: limit)
      end

      private

      def access_token
        ENV["INSTAGRAM_ACCESS_TOKEN"]
      end
    end
  end
end
```

### Provider Abstraction (Phase 3)

When multiple Instagram data sources are needed, add a provider layer:

```
InstagramAdapter
  ├── provider (selected via INSTAGRAM_PROVIDER env var)
  │   ├── GraphApiProvider      (official — hashtag + business discovery)
  │   ├── ScraperApiProvider    (SaaS — location + hashtag + profile)
  │   └── InstagrapiProvider    (unofficial — location + hashtag via sidecar)
```

The adapter delegates all HTTP calls to the configured provider. This keeps the adapter's public interface stable while allowing the underlying data source to be swapped.

## Integration

### How Photos Reach the Database

Instagram photos follow the same storage path as all other media:

```
InstagramAdapter.search_photos(name, location, lat, lng)
  → returns [{ url: "https://...", caption: "...", ... }]
    → EnrichPhotosService extracts URLs
      → MediaRepository.replace_media(restaurant_id, "instagram", "photo", urls)
        → DELETE FROM media WHERE restaurant_id=X AND source="instagram" AND media_type="photo"
        → INSERT INTO media (restaurant_id, source, media_type, url, fetched_at) ...
```

No schema migration is required. The existing `media` table (`lib/infrastructure/database.rb:162-169`) already supports arbitrary sources:

```sql
media: id | restaurant_id | source ("instagram") | media_type ("photo") | url | fetched_at
```

### EnrichPhotosService (New)

A new service (`lib/services/enrich_photos_service.rb`) orchestrates Instagram photo enrichment:

```ruby
# Pseudocode
class EnrichPhotosService
  def enrich(location: nil, restaurant_id: nil)
    restaurants = find_restaurants(location: location, restaurant_id: restaurant_id)

    restaurants.each do |restaurant|
      # Strategy 1: Hashtag search from restaurant name
      photos = @instagram.search_photos(
        restaurant_name: restaurant.name,
        location: restaurant.location,
        latitude: restaurant.latitude,
        longitude: restaurant.longitude
      )

      # Strategy 2: If restaurant has a known Instagram handle, fetch business media
      if (handle = lookup_instagram_handle(restaurant))
        photos += @instagram.get_business_media(username: handle)
      end

      # Store (replaces previous Instagram photos for this restaurant)
      @media_repo.replace_media(restaurant.id, "instagram", "photo", photos.map { |p| p[:url] })
    end
  end
end
```

### Where It Fits in the Indexing Flow

```
IndexRestaurantsService.index(location:)
  Phase 1: Forward Index ← Yelp/Google/TripAdvisor (existing, unchanged)
  Phase 2: Reverse Lookup ← TripAdvisor cross-reference (existing, unchanged)
  Phase 3: Photo Enrichment ← Instagram (NEW, optional)
    └── EnrichPhotosService.enrich(location: location)
```

Phase 3 is **opt-in** — it only runs when the Instagram adapter is configured (`INSTAGRAM_ACCESS_TOKEN` is set). The primary indexing flow is completely unaffected.

### CLI Integration

```bash
# Enrich all restaurants in a location with Instagram photos
grst enrich-photos --location "barrie, ontario"

# Enrich a specific restaurant
grst enrich-photos --restaurant-id 42

# Search a specific hashtag and show results
grst enrich-photos --hashtag "barriefood"
```

### REST API Integration

```
POST /enrich    {"location": "barrie, ontario"}
POST /enrich    {"restaurant_id": 42}
```

## Restaurant-to-Instagram Matching

The hardest problem: linking an Instagram post to the correct restaurant in our database.

### Strategy: Combined Scoring

| Signal | How | Weight |
|--------|-----|--------|
| **Hashtag derivation** | Strip spaces/punctuation from restaurant name, lowercase → `#flyingmonkeys` | Primary search mechanism |
| **Location proximity** | Compare post geotag (lat/lng) to restaurant coordinates; match if <100m | High confidence (when available) |
| **Name fuzzy match** | Use existing `Matcher` name similarity against Instagram location name | Medium confidence |
| **Manual mapping** | User associates an Instagram username with a restaurant ID | Highest confidence |

For Phase 1 (Graph API only), hashtag derivation is the only viable automated approach since the Graph API doesn't return geotags. Location proximity becomes available in Phase 3 with a SaaS scraper.

### Hashtag Derivation Examples

| Restaurant Name | Derived Hashtags |
|----------------|-----------------|
| Flying Monkeys Brewery | `#flyingmonkeysbrewery`, `#flyingmonkeys` |
| The Farmhouse Restaurant | `#thefarmhouserestaurant`, `#farmhouserestaurant` |
| Joe's Pizza | `#joespizza` |

Append city for disambiguation: `#flyingmonkeysbarrie`, `#joespizzatoronto`

## Schema Considerations

### Phase 1: No Migration

The existing `media` table works as-is with `source: "instagram"`.

### Future Enhancement: Richer Metadata

If we want to store Instagram-specific metadata (caption text, author, deduplication ID):

```ruby
db.alter_table :media do
  add_column :caption, String, text: true    # Post caption
  add_column :external_id, String            # Instagram media ID (dedup)
  add_column :author, String                 # Instagram username
  add_column :width, Integer                 # Image dimensions
  add_column :height, Integer
end
```

This migration is **optional** and only needed if we want to display captions or deduplicate across enrichment runs. Deferred to Phase 2+.

## Rate Limiting

| Constraint | Graph API | SaaS Scraper |
|-----------|-----------|-------------|
| **Per-request tracking** | Reuse existing `ApiRequestRepository` with adapter name `"instagram"` | Same |
| **Monthly budget** | 5,000 requests (configurable via `REQUEST_LIMIT`) | Depends on plan |
| **API-specific limits** | 200 calls/hour, 30 hashtags/7-day window | Varies by provider |
| **Per-restaurant cost** | ~2 requests (1 hashtag lookup + 1 media fetch) | ~1 request |
| **Budget for 100 restaurants** | ~200 requests | ~100 requests |

## UGC vs Official Photos

Instagram photos come from two distinct sources with different trust levels:

| Type | Source | Trust | Display |
|------|--------|-------|---------|
| **Official** | Restaurant's own Business account (`get_business_media`) | High — curated by the restaurant | Show prominently, label as "From @restaurant" |
| **UGC** | Hashtag/location search (`search_photos`, `search_by_hashtag`) | Lower — posted by random users | Show in separate section, label as "Community photos" |

For Phase 1, all photos are stored the same way in the `media` table. Differentiating UGC from official can be deferred — when needed, add a `media.subtype` column (`"official"` vs `"ugc"`).

## Implementation Phases

### Phase 1: Foundation + Graph API

**Files to create:**
- `lib/infrastructure/adapters/photo_source_base.rb` — new contract
- `lib/infrastructure/adapters/instagram.rb` — Graph API implementation
- `tests/unit/adapters/instagram_test.rb` — unit tests with mock fixtures
- `dev/fixtures/instagram/` — mock response data

**Config:**
- `INSTAGRAM_ACCESS_TOKEN` in `.env`

**Scope:** Hashtag search + business discovery. No enrichment service yet — just the adapter with its own tests.

### Phase 2: Enrichment Service + CLI

**Files to create:**
- `lib/services/enrich_photos_service.rb` — orchestration service
- `tests/unit/services/enrich_photos_service_test.rb`
- `tests/integration/enrich_photos_test.rb`

**Files to modify:**
- `lib/cli.rb` — add `enrich-photos` command
- `lib/api/server.rb` — add `POST /enrich` endpoint
- `lib/services/index_restaurants_service.rb` — optional Phase 3 hook
- `lib/grub_stars.rb` — require new files

**Scope:** Wire adapter into the app. Restaurant matching via hashtag derivation.

### Phase 3: SaaS Scraper Provider

**Files to create:**
- `lib/infrastructure/adapters/instagram/graph_api_provider.rb`
- `lib/infrastructure/adapters/instagram/scraper_api_provider.rb`

**Files to modify:**
- `lib/infrastructure/adapters/instagram.rb` — delegate to provider

**Config:**
- `INSTAGRAM_PROVIDER=graph_api|scraper_api`
- `INSTAGRAM_SCRAPER_API_KEY`, `INSTAGRAM_SCRAPER_BASE_URL`

**Scope:** Location-based photo search becomes available. Provider pattern enables swapping without changing the adapter interface.

### Phase 4: UGC Display + Attribution

**Files to modify:**
- `lib/api/server.rb` — include Instagram photos in restaurant detail responses
- `web/js/components/` — display Instagram photo section on detail page
- `lib/infrastructure/database.rb` — optional schema migration for caption/author

**Scope:** Surface Instagram photos in the UI. Distinguish official from UGC.

## Open Questions

1. **Graph API app review timeline** — Meta's app review can take weeks. Should we start with a SaaS scraper instead for faster iteration?
2. **Hashtag derivation accuracy** — How often will `#restaurantname` actually match? Need to test with real restaurants to calibrate.
3. **Photo relevance filtering** — Not every post tagged `#joespizza` is a food photo. Do we need any content filtering, or is showing all results acceptable for v1?
4. **Instagram handle storage** — Where to store the mapping of restaurant ID → Instagram username? New column on `restaurants` table, or a separate mapping table?
5. **Enrichment frequency** — How often should we re-enrich? Instagram content changes daily, but our rate limits are tight.

## Related Documentation

- [Architecture](../architecture.md) — Layered architecture and adapter contract
- [Photo Indexing](../features/photo-indexing.md) — How existing adapters handle photos
- [Testing](../testing.md) — Test patterns and framework
