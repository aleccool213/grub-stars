# Improvements Backlog

## UI/UX Improvements for Web Frontend

### High Priority

- [ ] **Add onboarding explanation on front page**
  - Explain how the app works: search is local-first, requires indexing a location first
  - Show how the indexing process works
  - Add "How it works" section or expandable FAQ
  - Display clear messaging about the local-first model

- [ ] **Clarify form field requirements**
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

- [ ] **Disable browser autofill on forms**
  - Add `autocomplete="off"` attributes to location and category form inputs
  - Prevents browser from suggesting previously entered values
  - Better UX for app-specific form fields

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

## Notes

These improvements focus on making the app more discoverable and user-friendly, especially for first-time users who may be unfamiliar with the local-first indexing model.
