# Improvements Backlog

## Test Data Expansion

### Critical Priority

- [x] **Expand mock test data significantly**
  - ~~Current test data is minimal and insufficient for realistic feature testing~~
  - ~~Need hundreds of restaurants per location (not just a handful)~~
  - ~~Add comprehensive details for each restaurant: full reviews, varied rating distributions, multiple media items~~
  - ~~Include edge cases: restaurants with no photos, no reviews, single-star reviews, restaurants with incomplete data~~
  - ~~Add multiple categories per restaurant (e.g., a restaurant that's both "Italian" and "Fine Dining")~~
  - ~~Vary review content: long reviews, short reviews, reviews in different styles and tones~~
  - ~~Include restaurants from different price ranges ($ to $$$$)~~
  - ~~Add phone numbers, websites, hours of operation to more restaurants~~
  - ~~Create realistic geographic distribution (clustered downtown, sparse in suburbs)~~
  - **Implemented:** `dev/generate_test_data.rb` - generates small/medium/large datasets with realistic distributions

- [x] **Enhance mock server data generation**
  - ~~Mock server should generate detailed, realistic data for testing~~
  - ~~Add multiple locations worth of data (barrie, toronto, vancouver, etc.)~~
  - ~~Include varied photo counts (0 photos, 1-3 photos, 10+ photos)~~
  - ~~Add realistic review counts (10, 50, 200, 1000+)~~
  - ~~Ensure rating distributions are realistic (mostly 4-5 stars, some 2-3)~~
  - ~~Add temporal variety to review dates (old and recent)~~
  - **Implemented:** Generator creates Yelp, Google, and TripAdvisor fixture files

- [x] **Create distinct test datasets**
  - ~~Small dataset for quick unit/integration tests~~
  - ~~Medium dataset for UI testing and demonstration~~
  - ~~Large dataset (1000+ restaurants) for performance testing~~
  - ~~Each dataset should exercise different code paths and edge cases~~
  - **Implemented:** `ruby dev/generate_test_data.rb small|medium|large`

## UI/UX Improvements for Web Frontend

### High Priority

- [x] **Add onboarding explanation on front page**
  - ~~Explain how the app works: search is local-first, requires indexing a location first~~
  - ~~Show how the indexing process works~~
  - ~~Add "How it works" section or expandable FAQ~~
  - ~~Display clear messaging about the local-first model~~
  - **Implemented:** `web/js/components/onboarding-banner.js` - dismissible banner with 3-step guide, prominent CTA when no locations indexed

- [x] **Clarify form field requirements**
  - Indicate which fields are optional vs required on all forms
  - Improve form labels and placeholder text
  - Example: Location index form should clearly mark "Category" as optional

- [ ] **Add indexing progress indicator**
  - Show real-time progress while indexing restaurants
  - Display status messages (e.g., "Fetching restaurants from Yelp...", "Processing results...")
  - Show estimated time remaining or completion percentage
  - Allow cancellation of in-progress indexing operations

- [ ] **Improve first search input labeling**
  - Rename or clarify that first input is for "Location name" search, not food category
  - Currently confusing because there's a separate category input below it
  - Consider reorganizing form layout to reduce confusion
  - Add helper text: "Search your indexed locations" or similar

- [x] **Add dark mode support**
  - ~~Implement dark theme for the web UI~~
  - ~~Add theme toggle button in header (sun/moon icon)~~
  - ~~Persist user preference in localStorage~~
  - ~~Use Twind's theme system for consistent styling~~
  - ~~Ensure sufficient contrast for accessibility (WCAG AA)~~
  - ~~Apply theme to all pages: search, details, categories, index-location~~
  - **Implemented:** `web/js/dark-mode.js` - theme management module with localStorage persistence, sun/moon toggle in nav-bar

### Medium Priority

- [ ] **Add restaurant details and clickable actions**
  - Add external URLs/links on restaurant details pages
  - Link to restaurant on Yelp, Google Maps, TripAdvisor where available
  - Add "Visit website" button if available
  - Add "Call restaurant" button with phone number
  - Add "Directions" link to open in maps app
  - Show which sources have data for this restaurant (e.g., "From Yelp, Google Maps")

- [ ] **Create locations browse page**
  - Add dedicated page to browse all indexed locations (like categories.html)
  - Display list of all locations in the database
  - Show location name and number of restaurants indexed
  - Link to search results for each location
  - Allow quick re-indexing from location list

- [x] **Disable browser autofill on forms**
  - Add `autocomplete="off"` attributes to location and category form inputs
  - Prevents browser from suggesting previously entered values
  - Better UX for app-specific form fields

- [ ] **Add "last indexed at" timestamps**
  - Display when restaurant data was last updated on details pages
  - Shows data freshness and when re-indexing might be needed
  - Format: "Last updated 2 days ago" or "Last indexed Jan 23, 2026"
  - Helps users understand if they should re-index for fresh data

## Future Adapter Ideas

Potential data sources to add for more comprehensive restaurant information:

### High Potential

- **Foursquare/Swarm**
  - Ratings, reviews, tips from Foursquare users
  - Venue photos and venue metrics
  - Good alternative to Google Maps in some regions

- **OpenStreetMap (OSM)**
  - Free, community-maintained restaurant data
  - Basic info: name, address, cuisine type, opening hours
  - No API key required, fully open source
  - Good for supplementing missing data or areas with poor Yelp/Google coverage

- **Zomato**
  - Strong in India/Asia, growing globally
  - Ratings, reviews, photos, menus
  - Good for international restaurant discovery

### Medium Potential

- **OpenTable**
  - Reservation availability and pricing
  - Tasting menu info from upscale restaurants
  - Use case: fine dining and reservation-focused search

- **Booking.com**
  - Restaurant reservations and reviews
  - Hotel restaurant information
  - Good for travel-focused restaurant searches

- **DoorDash/UberEats/GrubHub**
  - Delivery restaurant listings and menus
  - Delivery availability and fees
  - Good for "what can I order right now" searches

### Low Priority (Data-only)

- **Instagram/TikTok Food Hashtags**
  - Already planned - photos and videos only
  - Extract food photos and restaurant ambiance videos
  - Hashtag-based restaurant discovery

- **Michelin Guide**
  - Starred restaurant data (premium, limited coverage)
  - Use case: high-end fine dining discovery

- **Local Food Blogs/Review Aggregators**
  - Requires web scraping or partnerships
  - More niche reviews and local expert opinions

## Feature Ideas

### Location Autocomplete with Geocoding

**Problem:** Users can create duplicate locations with different spellings (e.g., "barrie, on" vs "barrie, ontario" vs "Barrie, Ontario, Canada").

**Recommendation:** Start with **Photon** (photon.komoot.io) - free, fast, designed for typeahead.

**Implementation:**
- Replace free-text input with autocomplete dropdown
- Store normalized location data (lat/lng + formatted name)
- Use coordinates as canonical identifier to prevent duplicates

### Restaurant Name Search with Autocomplete

**Problem:** Users may want to search for a specific restaurant by name from the local database.

**Implementation:**
- Add a separate input field or toggle for "Search by restaurant name"
- Implement client-side debounced autocomplete (300ms delay)
- New API endpoint: `GET /restaurants/autocomplete?q=<partial_name>&limit=10`
- Show dropdown with matching restaurant names as user types

### No Search Results Empty State with Index CTA

**Problem:** When search returns no results, users see an empty state with no clear next action.

**Implementation:**
- Detect when search returns 0 results
- Display message: "No restaurants found for '[search term]'. Have you indexed this area yet?"
- Show prominent "Index a location" button linking to `/index-location.html`
- Different messages for "no locations indexed" vs "locations indexed but no match"

### Restaurant Bookmarks (Browser-based, Local Storage)

**Problem:** Users have no way to save favorite restaurants for easy access later.

**Implementation:**
- Store bookmarks as JSON in LocalStorage: `grub_stars_bookmarks`
- Add heart icon toggle on restaurant cards and details page
- New `web/bookmarks.html` page to view all saved bookmarks
- New modules: `web/js/bookmarks.js`, `web/js/components/bookmark-button.js`
- Sort options: by name, by date bookmarked, by rating

## Notes

These improvements focus on making the app more discoverable and user-friendly, especially for first-time users who may be unfamiliar with the local-first indexing model.
