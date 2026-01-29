# Improvements

## UI/UX Improvements

### Standardize Restaurant Result Cards

**Current State:**
The search restaurants page (`/search.html` or similar) displays restaurant results using a different card design than the main page search by category (`/index.html`). This inconsistency creates a fragmented user experience and makes the UI feel unpolished.

**Expected Behavior:**
Both pages should use the same restaurant card component with consistent:
- Layout and spacing
- Typography (font sizes, weights)
- Color scheme and styling
- Image handling and aspect ratios
- Information hierarchy (name, rating, category, address, etc.)
- Hover states and interactions
- Bookmark/favorite button placement

**Benefits:**
- Consistent user experience across the app
- Reduced maintenance (single component to update)
- Professional, polished appearance
- Easier for users to recognize and interact with restaurant listings

**Implementation Notes:**
- Identify which card design is more complete/feature-rich
- Extract the restaurant card into a reusable component
- Update both pages to use the shared component
- Ensure responsive behavior is consistent
- Verify dark mode styling works correctly on both implementations

**Files to Review:**
- Search results page template
- Main page/category search results
- Any existing card components in `web/js/components/`
- CSS/styling files for both pages

---

## Feature Improvements

### Restaurant Name Search with Autocomplete

**Problem:** The current search form has a "What are you craving?" field that searches by food type/category. Users may also want to search for a specific restaurant by name from the local database.

**Solution:** Add a dedicated restaurant name search with autocomplete/typeahead that queries the local DB.

**Implementation:**
- Add a separate input field or toggle for "Search by restaurant name"
- Implement client-side debounced autocomplete (300ms delay)
- New API endpoint: `GET /restaurants/autocomplete?q=<partial_name>&limit=10`
- Show dropdown with matching restaurant names as user types
- Clicking a result navigates directly to the restaurant details page

**UX Considerations:**
- Could combine with food type search using tabs or a toggle
- Show recent searches for quick access
- Display restaurant rating/location in autocomplete dropdown for disambiguation

---

### Onboarding Hints & Empty State Guidance

**Problem:** New users don't understand that search only works on previously indexed locations. The app doesn't support live searching external APIs from the search page, which can be confusing when no results are found.

**Solution:** Add clear onboarding hints and contextual guidance on the front page.

**Implementation:**
- Add a subtle info banner or tooltip explaining the local-first model
- Example text: "Search works on locations you've indexed. No locations yet? Start by adding an area!"
- Show empty state with CTA when no locations are indexed
- Add "How it works" section or expandable FAQ
- Consider a first-time user tour/walkthrough

**Copy Ideas:**
- "🗂️ This app searches your local collection, not live APIs"
- "Index a location first, then search lightning-fast offline"
- "Your data, your searches - no API calls needed after indexing"

---

### No Search Results Empty State with Index CTA

**Problem:** When a user searches for a restaurant name that has no results in the local database, they see an empty state with no clear next action. Users may not understand that they need to index a location first, or may not know how to add the restaurant they're looking for.

**Solution:** Display a helpful empty state message when search returns no results, with a clickable link to the location indexing page.

**Implementation:**

1. **Search Results Empty State Component:**
   - Detect when search returns 0 results
   - Display a friendly message explaining the situation
   - Example message: "No restaurants found for '[search term]'. Have you indexed this area yet?"
   - Include context about which location(s) are currently indexed
   - Show a prominent "Index a location" button/link

2. **UI Changes:**
   - Update `web/search.js` to detect empty results
   - Add conditional rendering in search results container
   - Display empty state instead of results grid when count is 0
   - Style empty state with icon, message, and CTA button

3. **Empty State Content Options:**
   - **If no locations indexed:** "No locations indexed yet. Start by indexing an area to search restaurants."
   - **If locations indexed but no results:** "No restaurants match '[term]'. Try a different location or search term."
   - **Link text:** "Index a location" or "Add more data"

4. **Link Target:**
   - Button/link navigates to `/index-location.html`
   - Optionally pre-fill the location field if one is already indexed (can retry searching there)
   - Use standard navigation: `window.location.href = '/index-location.html'`

**Benefits:**
- **Reduces friction** - Users understand what to do when search finds nothing
- **Guides user journey** - Clearly shows the local-first workflow (index → search → browse)
- **Improves engagement** - Users who see an empty state are directed to take action rather than leaving
- **Minimal implementation** - Only requires UI changes to empty state handling, no backend changes

---

### Display Photos at Top of Restaurant Details Page

**Current State:**
The restaurant details page (`/details.html`) likely displays restaurant information, ratings, reviews, and other details, but photos may be buried lower on the page or displayed in a less prominent way. Visual content is crucial for user engagement when browsing restaurants.

**Expected Behavior:**
Restaurant photos should be prominently displayed at the top of the details page, giving users immediate visual context about the restaurant before they scroll down for more information.

**Implementation:**
- Add a photo gallery/carousel at the top of the details page
- Display the primary/restaurant photo as a hero image
- Show additional photos in a grid or carousel below the hero image
- Include a photo count indicator (e.g., "12 photos")
- Make photos clickable to open a full-screen lightbox/gallery view
- Ensure responsive design for mobile (swipeable carousel)
- Lazy load additional photos for performance
- Handle missing photos gracefully with a placeholder

**Design Considerations:**
- Hero image should be large and eye-catching (e.g., 16:9 or 4:3 aspect ratio)
- Photo gallery should not push important info too far down the page
- Consider a collapsible/expandable gallery for restaurants with many photos
- Dark mode: ensure photo gallery controls are visible in dark theme
- Add subtle shadow/border to separate photos from content below

**Benefits:**
- Immediate visual appeal when landing on details page
- Users can quickly see restaurant ambiance, food, and interior
- Increases engagement and time spent on page
- Helps users make decisions about visiting the restaurant
- Consistent with modern restaurant app patterns (Yelp, Google Maps, etc.)

**Files to Review:**
- `web/details.html` - Details page template
- `web/js/details.js` - Details page controller
- `web/js/components/` - Check for existing photo/lightbox components
- `web/css/custom.css` - Styling for photo gallery
