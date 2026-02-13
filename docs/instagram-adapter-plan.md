# Instagram Adapter Plan

## Why Instagram Is Different

The existing adapters (Yelp, Google, TripAdvisor) all implement the same contract defined in `Base` (`lib/infrastructure/adapters/base.rb:39-61`):

- `search_businesses(location:, ...)` — find restaurants by area
- `search_by_name(name:, ...)` — find restaurants by name
- `get_business(id)` — get full business details
- `get_reviews(id)` — get reviews
- `source_name` / `configured?`

Instagram fundamentally **cannot** implement `search_businesses` or `get_business` because it is not a business directory. It doesn't have structured restaurant data (address, phone, rating, review_count, categories, is_closed). Instead, it has **photos/videos tagged at locations or with hashtags**.

This means the Instagram adapter is a **supplemental photo source**, not a primary indexing adapter. It enriches existing restaurant records with additional media rather than discovering new restaurants.

---

## Instagram API Landscape (as of 2026)

### Official: Instagram Graph API

**What it offers:**
- **Hashtag Search** — `GET /ig_hashtag_search` + `GET /{id}/recent_media` — find public posts tagged with a specific hashtag (e.g., `#restaurantname`, `#barriefood`)
- **Business Discovery** — retrieve metadata/media from other Business/Creator accounts by username
- **Mentions** — find posts mentioning a specific Business account

**What it does NOT offer:**
- No location-based media search (the old v1 `/locations/search` was deprecated years ago)
- No general keyword search
- No access to personal/private account data
- Limited to Business/Creator accounts for discovery

**Rate limits:**
- 200 API calls per user per hour
- 30 unique hashtag searches per 7-day rolling window per account
- 50 results per page

**Requirements:**
- Meta Developer App with Instagram Graph API permissions
- Facebook Page linked to an Instagram Business/Creator account
- App Review for most permissions

### Unofficial: Private API Libraries

**`instagrapi` (Python)** — reverse-engineers Instagram's mobile API:
- `location_search(lat, lng)` — find Instagram location IDs near coordinates
- `location_medias_top(location_pk)` / `location_medias_recent(location_pk)` — get media at a location
- `hashtag_medias_top(hashtag)` / `hashtag_medias_recent(hashtag)` — get media by hashtag
- Full media metadata including image URLs, captions, timestamps, like counts

**`instagrapi-rest`** — RESTful wrapper around instagrapi (useful since grub-stars is Ruby, not Python)

**Risks:** Requires Instagram login credentials, can trigger account bans, API changes without notice, ToS violation, not recommended for production by the authors themselves.

### Third-Party Scraping APIs (SaaS)

Services like **Bright Data**, **Apify**, **SociaVault**, **HikerAPI** offer REST APIs that handle proxy rotation, anti-bot evasion, and rate limiting:
- Location-based media search
- Hashtag-based media search
- Public profile media retrieval
- Pay-per-request pricing

**Legal status:** Scraping public data without login was upheld as legal in 2022 (hiQ v. LinkedIn) and reinforced in 2026 (Meta/X v. Bright Data), but GDPR/CCPA compliance is still required.

---

## Recommended Architecture

### Strategy: Multi-Provider Instagram Adapter

Since there's no single Instagram API that covers all use cases well, build the adapter with a **provider abstraction** so the underlying data source can be swapped:

```
InstagramAdapter
  ├── GraphApiProvider    (official — hashtag + business discovery)
  ├── InstagrapiProvider  (unofficial — location + hashtag via instagrapi-rest sidecar)
  └── ScraperApiProvider  (third-party SaaS — Bright Data, Apify, etc.)
```

The user configures which provider(s) to use via env vars. The adapter delegates to the configured provider.

### New Adapter Contract: `PhotoSourceAdapter`

Since Instagram doesn't fit the existing `Base` contract, introduce a new lightweight interface:

```ruby
# lib/infrastructure/adapters/photo_source_base.rb
module GrubStars
  module Adapters
    class PhotoSourceBase
      # Find photos near a geographic point for a restaurant name
      # Returns: Array of { url:, caption:, source:, posted_at:, width:, height: }
      def search_photos(restaurant_name:, location:, latitude: nil, longitude: nil, limit: 20)
        raise NotImplementedError
      end

      # Find photos by hashtag
      # Returns: Array of { url:, caption:, source:, posted_at:, width:, height: }
      def search_by_hashtag(hashtag:, limit: 20)
        raise NotImplementedError
      end

      # Find photos from a specific business account
      # Returns: Array of { url:, caption:, source:, posted_at:, width:, height: }
      def get_business_media(username:, limit: 20)
        raise NotImplementedError
      end

      def source_name
        raise NotImplementedError
      end

      def configured?
        raise NotImplementedError
      end
    end
  end
end
```

### Integration Points

#### 1. Enrich During Indexing (post-index phase)

After `IndexRestaurantsService` indexes restaurants from primary adapters, add an optional **photo enrichment phase**:

```
Phase 1: Forward Index (existing — Yelp/Google/TripAdvisor)
Phase 2: Reverse Lookup (existing — TripAdvisor cross-reference)
Phase 3: Photo Enrichment (NEW — Instagram)
   For each indexed restaurant:
     - Search by restaurant name + location coordinates
     - Search by likely hashtags (#restaurantname, #restaurantnamecity)
     - If restaurant has a known Instagram handle, fetch business media
     - Store results via media_repo.replace_media(restaurant_id, "instagram", "photo", urls)
```

This fits naturally into the existing flow without modifying the primary adapter contract.

#### 2. Standalone CLI Command

Add a new CLI command for on-demand enrichment:

```bash
grst enrich-photos --location "barrie, ontario"        # enrich all restaurants in location
grst enrich-photos --restaurant-id 42                   # enrich specific restaurant
grst enrich-photos --hashtag "#barriefood"              # search by hashtag
```

#### 3. Restaurant Matching

The hardest problem: linking Instagram content to the correct restaurant. Strategies:

- **Location proximity** — Instagram posts geotagged within ~50m of the restaurant's coordinates
- **Name matching** — use existing `RestaurantMatcher` (lib/domain/matcher.rb) to fuzzy-match Instagram location names to indexed restaurant names
- **Hashtag derivation** — generate likely hashtags from restaurant name (strip spaces, lowercase, append city)
- **Manual mapping** — allow users to associate an Instagram username with a restaurant ID

### Schema Changes

The existing `media` table already supports this — just use `source: "instagram"`:

```ruby
# No schema migration needed. Existing table:
# media: id, restaurant_id, source, media_type, url, fetched_at
```

Optional enhancement — add columns for richer Instagram metadata:

```ruby
db.alter_table :media do
  add_column :caption, String, text: true    # Instagram caption text
  add_column :external_id, String            # Instagram media ID (for dedup)
  add_column :width, Integer
  add_column :height, Integer
end
```

---

## Implementation Plan (Phased)

### Phase 1: Foundation

1. Create `PhotoSourceBase` contract in `lib/infrastructure/adapters/photo_source_base.rb`
2. Create `InstagramAdapter` in `lib/infrastructure/adapters/instagram.rb` implementing `PhotoSourceBase`
3. Start with the **Graph API provider** (official, most stable):
   - Hashtag search: find posts tagged with restaurant-derived hashtags
   - Business Discovery: fetch media from known restaurant Instagram accounts
4. Add `INSTAGRAM_ACCESS_TOKEN` to config
5. Add rate limiting (reuse existing `ApiRequestRepository` pattern)
6. Unit tests with mock fixtures

### Phase 2: Enrichment Service

1. Create `EnrichPhotosService` in `lib/services/enrich_photos_service.rb`
   - Takes a list of restaurants (or a location filter)
   - For each restaurant, calls Instagram adapter methods
   - Matches results to restaurants using coordinates + name fuzzy matching
   - Stores via `MediaRepository.replace_media`
2. Wire into `IndexRestaurantsService` as optional Phase 3
3. Add CLI command `grst enrich-photos`
4. Integration tests

### Phase 3: Unofficial/SaaS Provider (Optional)

1. Add `InstagrapiProvider` that calls an `instagrapi-rest` sidecar service
   - Location-based media search (the killer feature missing from official API)
   - Requires running a separate Python service
2. Or add `ScraperApiProvider` for a SaaS like Bright Data / Apify
   - Simpler integration (just HTTP calls)
   - Pay-per-request costs
3. Provider selection via env var: `INSTAGRAM_PROVIDER=graph_api|instagrapi|bright_data`

### Phase 4: UGC (User-Generated Content) Integration

1. Surface Instagram photos in restaurant detail views (API + Web UI)
2. Distinguish between "official" (from business account) and "UGC" (from hashtag/location search) photos
3. Add photo attribution (Instagram username, link back to original post)
4. Consider adding a `media.attribution` or `media.author` column

---

## Key Decisions to Make

| Decision | Options | Recommendation |
|----------|---------|----------------|
| **Start with which provider?** | Graph API, instagrapi, SaaS scraper | **Graph API** — most stable, legal, no sidecar needed |
| **Fit into existing Base contract?** | Extend Base, new PhotoSourceBase, or duck-typing | **New PhotoSourceBase** — cleaner separation of concerns |
| **When to enrich?** | During index, on-demand CLI, background job | **Both** — optional during index + standalone CLI command |
| **Restaurant matching** | Location only, name only, combined | **Combined** — coordinates + fuzzy name match |
| **Schema migration?** | Reuse media table as-is, or add columns | **Add columns** — caption and external_id are valuable for dedup |

---

## Sources

- [Instagram Graph API Developer Guide 2026](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/)
- [Instagram API Guide for Businesses 2026](https://tagembed.com/blog/instagram-api/)
- [Official vs Alternative API vs Scraping](https://datastreamer.io/instagram-data-guide-official-vs-alternative-api-vs-scraping/)
- [instagrapi — Python Instagram Private API](https://github.com/subzeroid/instagrapi)
- [instagrapi Location Guide](https://subzeroid.github.io/instagrapi/usage-guide/location.html)
- [bellingcat/instagram-location-search](https://github.com/bellingcat/instagram-location-search)
- [Instagram API Deprecated Alternatives 2026](https://sociavault.com/blog/instagram-api-deprecated-alternative-2026)
- [Best Instagram Scrapers 2026](https://proxyway.com/best/instagram-scrapers)
- [Best Social Media Scraping APIs 2026](https://sociavault.com/blog/best-social-media-scraping-apis-2026)
