# E2E Test Scenarios

This document outlines end-to-end test scenarios for the grub stars web application. These scenarios are designed to be run against the mock server.

## Prerequisites

Before running E2E tests:
1. Start the mock server: `ruby dev/mock_server.rb`
2. Start the main server: `bundle _2.5.23_ exec rackup`

---

## Search Page (`/`)

### Page Load
- [ ] Page displays search form with name input, category dropdown, and location dropdown
- [ ] Category dropdown loads options from `/categories` API
- [ ] Location dropdown loads options from `/locations` API
- [ ] Results area is empty on initial load

### Search by Name
- [ ] Entering a name and submitting shows loading state
- [ ] Results display matching restaurants with name, address, and ratings
- [ ] No results shows "no restaurants found" message with link to index a location
- [ ] URL updates with `?name=...` parameter

### Search by Category
- [ ] Selecting a category and submitting returns filtered results
- [ ] URL updates with `?category=...` parameter

### Search by Location
- [ ] Selecting a location filters results to that area
- [ ] URL updates with `?location=...` parameter

### URL Parameters (Deep Linking)
- [ ] Loading page with `?name=pizza` pre-fills input and auto-searches
- [ ] Loading page with `?category=Italian` pre-selects dropdown and auto-searches
- [ ] Combined parameters work together

### Error Handling
- [ ] API error shows error message with retry button
- [ ] Clicking retry re-attempts the search

---

## Restaurant Details Page (`/details.html`)

### Page Load
- [ ] Loading with `?id=1` fetches and displays restaurant details
- [ ] Loading without `?id` shows "no restaurant ID provided" error
- [ ] Loading with invalid ID shows "not found" message

### Content Display
- [ ] Shows restaurant name as page title
- [ ] Shows address and phone number
- [ ] Shows location
- [ ] Categories display as clickable links to search
- [ ] Ratings section shows scores from each source (Yelp, Google, etc.)
- [ ] Review snippets display with "Read more" links
- [ ] Photos display in a gallery
- [ ] Videos section shows video links (if any)
- [ ] Data sources badge shows which APIs provided data

### Navigation
- [ ] "Back to Search" link returns to search page
- [ ] Clicking a category link navigates to search filtered by that category

### Error Handling
- [ ] API error shows error message with retry button
- [ ] 404 response shows "restaurant not found" with back button

---

## Categories Page (`/categories.html`)

### Page Load
- [ ] Page displays "Restaurant Categories" header
- [ ] Categories load from `/categories` API
- [ ] Shows category count (e.g., "5 categories")

### Categories Display
- [ ] Categories display in a grid layout
- [ ] Each category is a clickable card/link
- [ ] Clicking a category navigates to search with `?category=...`

### Empty State
- [ ] When no categories exist, shows "No categories yet" message
- [ ] Shows explanation that categories appear after indexing
- [ ] Shows link to "Index a Location" page

### Error Handling
- [ ] API error shows error message with retry button
- [ ] Retry button reloads categories

---

## Index Location Page (`/index-location.html`)

### Page Load
- [ ] Page displays "Index New Location" header
- [ ] Form shows location input (required) and category input (optional)
- [ ] Submit button says "Start Exploring!"

### Form Validation
- [ ] Submitting without location shows validation error
- [ ] Category field is optional (can submit without it)

### Indexing Process
- [ ] Submitting shows loading state with "Indexing..." message
- [ ] Form inputs are disabled during indexing
- [ ] Submit button is disabled during indexing

### Success State
- [ ] Shows "Indexing Complete" message
- [ ] Shows statistics: total restaurants, created, merged, updated
- [ ] Shows the indexed location name
- [ ] Shows category filter (if provided)
- [ ] Shows "Search in [location]" link
- [ ] Shows "Index Another Location" button

### Reset
- [ ] Clicking "Index Another Location" clears form and results
- [ ] Form is ready for new submission

### Error Handling
- [ ] `NO_ADAPTERS` error shows message about configuring API keys
- [ ] `API_ERROR` shows message about external API failure
- [ ] Generic error shows retry button
- [ ] Form re-enables after error

---

## Navigation Bar

### Presence
- [ ] Navigation bar appears on all pages (search, categories, details, index-location)
- [ ] Logo "grub stars" is visible with star emoji

### Links
- [ ] "Search" link navigates to `/`
- [ ] "Categories" link navigates to `/categories.html`
- [ ] "Add Area" link navigates to `/index-location.html`

### Active State
- [ ] Current page link is highlighted (has `aria-current="page"`)
- [ ] Other links are not highlighted

### Logo
- [ ] Clicking logo navigates to home (`/`)

### Mobile Menu (viewport < 768px)
- [ ] Hamburger menu button is visible
- [ ] Desktop nav links are hidden
- [ ] Clicking hamburger opens mobile menu
- [ ] Mobile menu shows all navigation links
- [ ] Clicking hamburger again closes menu
- [ ] `aria-expanded` attribute updates correctly

---

## User Flows

### New User Onboarding
1. User lands on search page, sees empty state
2. User clicks "Add Area" in navigation
3. User enters "barrie, ontario" and submits
4. User sees success with restaurant count
5. User clicks "Search in barrie, ontario"
6. User sees search results

### Restaurant Discovery via Categories
1. User goes to Categories page
2. User sees list of available categories
3. User clicks "Italian"
4. User sees Italian restaurants in search results
5. User clicks on a restaurant card
6. User sees full restaurant details

### Search and View Details
1. User searches for "pizza" on home page
2. User sees search results
3. User clicks on "Pizza Palace"
4. User sees restaurant details with ratings, photos, reviews
5. User clicks "Back to Search"
6. User returns to search results

### Category Navigation from Details
1. User views restaurant details
2. User clicks on "Japanese" category tag
3. User sees all Japanese restaurants

### Error Recovery
1. User tries to index a location
2. Server returns error
3. User sees error message with retry button
4. User clicks retry
5. Indexing succeeds

### Deep Linking / Sharing
1. User shares URL `/?name=tacos&location=toronto`
2. Recipient opens URL
3. Search form is pre-filled
4. Results are automatically displayed

---

## API Health Checks

- [ ] `GET /health` returns `{"data": {"status": "ok"}}`
- [ ] `GET /categories` returns array of category names
- [ ] `GET /locations` returns array of indexed locations
- [ ] `GET /restaurants/search?name=test` returns search results
- [ ] `GET /restaurants/search` without params returns 400 error
- [ ] `GET /restaurants/:id` with invalid ID returns 404
- [ ] `POST /index` without location returns 400 error
- [ ] Static files (HTML, JS, CSS) are served correctly
