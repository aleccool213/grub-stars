# Web Frontend Documentation

## Overview

The **grub stars** web frontend provides a browser-based interface for searching and indexing restaurant data. It follows the project's minimalist philosophy: zero build steps, zero frameworks, pure web standards.

## Tech Stack

### Core Technologies

| Technology | Version | Purpose | Delivery Method |
|------------|---------|---------|-----------------|
| **HTML5** | Standard | Semantic markup and structure | Static files |
| **Vanilla JavaScript** | ES6+ | Application logic and interactivity | Native ES modules |
| **Tailwind CSS** | 3.x | Utility-first styling | CDN (play mode) |
| **Fetch API** | Native | REST API communication | Browser native |

### Why This Stack?

1. **Zero Build Complexity**: No webpack, vite, npm, node_modules, or package.json
2. **Edit-Refresh Workflow**: Make changes and instantly see results in browser
3. **Minimal Dependencies**: Only external dependency is Tailwind CSS via CDN
4. **Standards-Based**: Uses web platform APIs (ES modules, Fetch, History API)
5. **Long-term Maintainability**: No framework churn or deprecation risk
6. **Ruby Philosophy Alignment**: Simple, explicit, minimal magic

### Browser Support

**Minimum Requirements:**
- ES6+ support (2015+)
- Native ES modules (`<script type="module">`)
- Fetch API
- CSS Grid and Flexbox

**Supported Browsers:**
- Chrome/Edge 61+
- Firefox 60+
- Safari 11+
- Mobile Safari (iOS 11+)
- Chrome for Android

## Architecture

### File Structure

```
web/
├── index.html                  # Main search page
├── details.html                # Restaurant details page
├── index-location.html         # Index new location form
├── categories.html             # Browse categories
├── js/
│   ├── api.js                 # REST API client wrapper
│   ├── search.js              # Search page controller
│   ├── details.js             # Details page controller
│   ├── index-form.js          # Index form controller
│   ├── categories-list.js     # Categories page controller
│   ├── components/            # Reusable UI components
│   │   ├── restaurant-card.js # Restaurant result card
│   │   ├── rating-display.js  # Multi-source rating display
│   │   ├── loading-spinner.js # Loading state component
│   │   ├── error-message.js   # Error display component
│   │   └── nav-bar.js         # Navigation component
│   └── utils/
│       ├── router.js          # URL routing and navigation
│       └── formatters.js      # Date, number, distance formatting
├── css/
│   └── custom.css             # Custom styles (minimal, Tailwind handles most)
└── README.md
```

### Design Patterns

**ES6 Modules:**
```javascript
// api.js exports functions
export async function searchRestaurants(query) { ... }

// search.js imports and uses them
import { searchRestaurants } from './api.js';
```

**Component Functions:**
```javascript
// Component = pure function that returns HTML string
export function restaurantCard(restaurant) {
  return `
    <div class="bg-white rounded-lg shadow p-4">
      <h3 class="text-xl font-bold">${restaurant.name}</h3>
      ...
    </div>
  `;
}

// Usage: inject into DOM
document.getElementById('results').innerHTML = restaurants.map(restaurantCard).join('');
```

**API Client Pattern:**
```javascript
// api.js - centralized error handling and response parsing
async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`http://localhost:9292${endpoint}`, options);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API request failed');
  }
  return response.json();
}
```

### State Management

**URL as State:**
- Use URL parameters for search queries, filters, pagination
- Example: `/search.html?name=pizza&location=barrie`
- Back button works naturally
- Shareable URLs

**No Global State:**
- Fetch data on page load based on URL params
- Re-render on user interaction
- Keep it simple - no complex state management needed

## Serving Strategy

### Option A: Sinatra Serves Static Files (Recommended)

**Advantages:**
- Single server for API and UI
- CORS not needed (same origin)
- Simple deployment
- Consistent port/host

**Implementation:**
Add to `lib/api/server.rb`:

```ruby
class Server < Sinatra::Base
  # Serve static files from web directory
  set :public_folder, File.expand_path('../../web', __dir__)

  # Serve index.html at root
  get '/' do
    send_file File.join(settings.public_folder, 'index.html')
  end

  # ... existing API routes ...
end
```

**Access:**
- Web UI: `http://localhost:9292/`
- API: `http://localhost:9292/restaurants/search?name=pizza`

### Option B: Separate Static Server

**For development:**
```bash
cd web
python3 -m http.server 8000
```

**Access:**
- Web UI: `http://localhost:8000/`
- API: `http://localhost:9292/` (requires CORS configuration)

**CORS Setup Required:**
```ruby
# In server.rb
before do
  headers 'Access-Control-Allow-Origin' => 'http://localhost:8000'
end
```

### Docker Deployment

Mount web directory as static assets:
```dockerfile
# Add to Dockerfile
COPY web /app/web
```

Sinatra automatically serves from public_folder.

## Responsive Design Strategy

### Mobile-First Approach

Use Tailwind's responsive prefixes:
```html
<!-- Stack on mobile, grid on desktop -->
<div class="flex flex-col md:grid md:grid-cols-3 gap-4">
  <!-- Restaurant cards -->
</div>

<!-- Small text on mobile, larger on desktop -->
<h1 class="text-2xl md:text-4xl font-bold">grub stars</h1>

<!-- Hide on mobile, show on desktop -->
<div class="hidden md:block">Desktop-only content</div>
```

### Breakpoints (Tailwind defaults)

| Prefix | Min Width | Target |
|--------|-----------|--------|
| `sm:` | 640px | Large phones (landscape) |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Laptops |
| `xl:` | 1280px | Desktops |

### Mobile Considerations

- Touch-friendly targets (min 44x44px)
- Thumb-zone navigation (bottom of screen)
- Swipe gestures for image galleries
- Minimal text input (use dropdowns/selects when possible)
- Fast load times (CDN Tailwind is ~100KB)

## Testing Strategy

### Manual Testing Checklist

**Cross-Browser:**
- [ ] Chrome (desktop + mobile)
- [ ] Firefox
- [ ] Safari (desktop + iOS)
- [ ] Edge

**Responsive Design:**
- [ ] iPhone SE (375px)
- [ ] iPad (768px)
- [ ] Desktop (1920px)

**User Flows:**
- [ ] Search by name → view details
- [ ] Search by category → view details
- [ ] Index new location
- [ ] Browse categories
- [ ] Navigate back/forward
- [ ] Share URL (test URL state)

### Automated Testing

**Option 1: Browser-Based Test Page**
Create `web/test.html` that runs tests using assertions:

```javascript
// Simple test runner
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Test API client
import { searchRestaurants } from './js/api.js';
const results = await searchRestaurants('pizza');
assert(Array.isArray(results.data), 'Results should be array');
```

**Option 2: Integration Tests in Ruby**
Add to `tests/integration/web_test.rb`:

```ruby
class WebTest < Minitest::Test
  def test_index_page_loads
    get '/'
    assert_equal 200, last_response.status
  end

  def test_search_page_renders
    get '/index.html'
    assert_includes last_response.body, '<title>grub stars</title>'
  end
end
```

### API Mocking for Development

Use existing mock server (`dev/mock_server.rb`) for frontend development without real API keys:

```bash
# Terminal 1: Start mock API
bundle _2.5.23_ exec ruby dev/mock_server.rb

# Terminal 2: Start frontend (if using separate server)
cd web && python3 -m http.server 8000
```

Update `js/api.js` base URL to point to mock server during development.

## Performance Considerations

### Initial Load

**Expected Load Time:**
- HTML: ~2KB
- JavaScript: ~20KB (all modules)
- Tailwind CDN: ~100KB (cached)
- **Total: ~122KB**

**Optimization Tips:**
- Use `defer` for non-critical scripts
- Lazy load images with `loading="lazy"`
- Cache API responses in `sessionStorage` for navigation

### Production Optimizations (Future)

If performance becomes an issue:
1. **Self-host Tailwind**: Build custom CSS with only used classes (~10KB)
2. **Add Service Worker**: Cache static assets offline
3. **Minify JS**: Simple minification saves 30-40%

**For now: Keep it simple. Optimize only if needed.**

## Accessibility

### Requirements

- [ ] Semantic HTML (`<nav>`, `<main>`, `<article>`)
- [ ] ARIA labels for interactive elements
- [ ] Keyboard navigation (tab order, enter to submit)
- [ ] Focus visible styles
- [ ] Alt text for images
- [ ] Color contrast (WCAG AA minimum)
- [ ] Screen reader testing

### Example

```html
<button
  class="bg-blue-500 hover:bg-blue-600 focus:ring-2 focus:ring-blue-300"
  aria-label="Search restaurants">
  Search
</button>
```

## Security Considerations

### Input Validation

- Sanitize user input before rendering (prevent XSS)
- Use `textContent` instead of `innerHTML` for user data
- Validate on both client and server

### API Security

- No authentication required (local database)
- Rate limiting at API level (future consideration)
- CORS policy (if serving separately)

## Development Workflow

### Getting Started

1. **Start API server:**
   ```bash
   bundle _2.5.23_ exec rackup
   ```

2. **Open in browser:**
   ```bash
   open http://localhost:9292/
   ```

3. **Edit files:**
   - Modify HTML/JS/CSS
   - Refresh browser (Cmd+R / F5)
   - No build step!

### Debugging

**Browser DevTools:**
- Console: `console.log()` debugging
- Network: Inspect API requests/responses
- Elements: Inspect/modify DOM and styles
- Sources: Set breakpoints in JS

**Common Issues:**
- **CORS errors**: Use Sinatra serving (Option A) or configure CORS
- **Module not found**: Check file paths in `import` statements
- **API errors**: Check API server is running on port 9292

## Future Enhancements

### Progressive Enhancement Ideas

1. **Offline Support**: Service Worker + IndexedDB cache
2. **Dark Mode**: Toggle with `localStorage` persistence
3. **Map View**: Embed Google Maps for restaurant locations
4. **Image Gallery**: Lightbox for photos/videos
5. **Favorites**: `localStorage`-based bookmarking
6. **Export**: Download search results as CSV
7. **Geolocation**: "Near me" search using browser location

### Migration Path (If Needed)

If the project grows and build tools become necessary:

**Phase 1:** Add Vite (preserves vanilla JS)
**Phase 2:** Add Tailwind CLI (custom builds)
**Phase 3:** Consider framework (Preact/Alpine) only if complexity demands it

**For now: Stay simple.**

---

## Implementation TODO List

### Phase 1: Core Pages & API Integration
- [ ] Create `web/` directory structure
- [ ] Build `js/api.js` - REST API client with error handling
- [ ] Create `index.html` - Main search page
  - [ ] Search by name input
  - [ ] Search by category dropdown
  - [ ] Location filter (optional)
  - [ ] Search button
  - [ ] Results display area
- [ ] Build `js/search.js` - Search page controller
  - [ ] Handle form submission
  - [ ] Call API via api.js
  - [ ] Render results
  - [ ] Handle loading states
  - [ ] Handle empty results
  - [ ] Handle errors
- [ ] Create `js/components/restaurant-card.js`
  - [ ] Display restaurant name, address, ratings
  - [ ] Show categories
  - [ ] Link to details page
  - [ ] Responsive design (mobile/desktop)
- [ ] Create `js/components/loading-spinner.js`
  - [ ] Animated loading indicator
  - [ ] Tailwind-based styling
- [ ] Create `js/components/error-message.js`
  - [ ] Display API errors gracefully
  - [ ] Retry button for failed requests

### Phase 2: Restaurant Details Page
- [ ] Create `details.html` - Restaurant details page
  - [ ] Header with restaurant name
  - [ ] Full address and map placeholder
  - [ ] Phone number (if available)
  - [ ] Multi-source ratings display
  - [ ] Categories list
  - [ ] Reviews section
  - [ ] Photos gallery
  - [ ] Videos gallery
  - [ ] Back to search button
- [ ] Build `js/details.js` - Details page controller
  - [ ] Parse restaurant ID from URL
  - [ ] Fetch restaurant details via API
  - [ ] Render all sections
  - [ ] Handle not found (404)
- [ ] Create `js/components/rating-display.js`
  - [ ] Show ratings from multiple sources (Yelp, Google, TripAdvisor)
  - [ ] Visual stars or score display
  - [ ] Review count per source
  - [ ] Color-coded by source
- [ ] Create responsive image gallery
  - [ ] Grid layout for photos
  - [ ] Lazy loading
  - [ ] Click to enlarge (optional lightbox)
- [ ] Create responsive video player
  - [ ] Embed TikTok/Instagram videos
  - [ ] Thumbnail previews

### Phase 3: Index Location Page
- [ ] Create `index-location.html` - Index new location form
  - [ ] Location input (city, state/province)
  - [ ] Category filter input (optional)
  - [ ] Submit button
  - [ ] Progress indicator during indexing
  - [ ] Success message with stats
  - [ ] Error handling
- [ ] Build `js/index-form.js` - Index form controller
  - [ ] Validate form inputs
  - [ ] POST to /index API
  - [ ] Show progress/loading state
  - [ ] Display indexing results (count by source)
  - [ ] Handle errors (no adapters, API failures)
- [ ] Add form validation
  - [ ] Required field indicators
  - [ ] Input format validation
  - [ ] Helpful error messages

### Phase 4: Categories & Navigation
- [ ] Create `categories.html` - Browse categories page
  - [ ] List all categories
  - [ ] Click category to search
  - [ ] Count of restaurants per category
- [ ] Build `js/categories-list.js` - Categories controller
  - [ ] Fetch categories from API
  - [ ] Render as grid/list
  - [ ] Link to search with category filter
- [ ] Create `js/components/nav-bar.js` - Navigation component
  - [ ] Logo/home link
  - [ ] Search link
  - [ ] Categories link
  - [ ] Index location link
  - [ ] Mobile hamburger menu
  - [ ] Active page indicator
- [ ] Add navigation to all pages
  - [ ] Include nav-bar component
  - [ ] Consistent styling
  - [ ] Mobile responsive

### Phase 5: Utility & Routing
- [ ] Build `js/utils/router.js` - URL routing helper
  - [ ] Parse query parameters
  - [ ] Update URL without reload
  - [ ] Handle browser back/forward
  - [ ] Shareable URLs
- [ ] Build `js/utils/formatters.js` - Formatting utilities
  - [ ] Format dates (review timestamps)
  - [ ] Format distances (if geolocation added)
  - [ ] Format phone numbers
  - [ ] Format ratings (round to 1 decimal)
- [ ] Add URL state management
  - [ ] Save search queries to URL
  - [ ] Restore search from URL on page load
  - [ ] Enable sharing search results

### Phase 6: Responsive Design (Mobile)
- [ ] Mobile layout for search page
  - [ ] Stack form elements vertically
  - [ ] Touch-friendly buttons (44x44px min)
  - [ ] Full-width cards
  - [ ] Thumb-zone navigation
- [ ] Mobile layout for details page
  - [ ] Single column layout
  - [ ] Collapsible sections for reviews
  - [ ] Mobile-optimized image gallery
  - [ ] Tap to call phone number
- [ ] Mobile layout for index form
  - [ ] Large input fields
  - [ ] Native keyboard optimization
  - [ ] Clear button visibility
- [ ] Mobile navigation
  - [ ] Hamburger menu
  - [ ] Slide-out drawer
  - [ ] Bottom nav bar option
- [ ] Test on real devices
  - [ ] iPhone (Safari)
  - [ ] Android (Chrome)
  - [ ] Tablet (iPad)

### Phase 7: Responsive Design (Desktop)
- [ ] Desktop layout for search page
  - [ ] Multi-column result grid (2-3 columns)
  - [ ] Sidebar filters (future)
  - [ ] Hover states for cards
- [ ] Desktop layout for details page
  - [ ] Two-column layout (info left, media right)
  - [ ] Larger images
  - [ ] Desktop-optimized gallery
- [ ] Desktop navigation
  - [ ] Full horizontal nav bar
  - [ ] Hover effects
  - [ ] Dropdown menus (future)

### Phase 8: Polish & UX Improvements
- [ ] Add loading skeletons
  - [ ] Placeholder cards while loading
  - [ ] Shimmer animation
- [ ] Add empty states
  - [ ] No results found message
  - [ ] Suggestions for new search
  - [ ] Link to index new location
- [ ] Add success messages
  - [ ] Toast notifications
  - [ ] Confirmation messages
- [ ] Add smooth transitions
  - [ ] Fade in/out
  - [ ] Slide animations
  - [ ] Smooth scrolling
- [ ] Improve error messages
  - [ ] User-friendly language
  - [ ] Actionable suggestions
  - [ ] Contact/help info
- [ ] Add keyboard shortcuts
  - [ ] Focus search on '/'
  - [ ] Escape to clear/close
  - [ ] Enter to submit

### Phase 9: Sinatra Integration
- [ ] Configure Sinatra to serve static files
  - [ ] Set `public_folder` to `web/`
  - [ ] Serve `index.html` at root `/`
  - [ ] Test API + UI on same origin
- [ ] Update `config.ru` if needed
  - [ ] Mount static file serving
- [ ] Test integration
  - [ ] Start Sinatra: `bundle _2.5.23_ exec rackup`
  - [ ] Access UI: `http://localhost:9292/`
  - [ ] Verify API calls work (no CORS issues)
- [ ] Update documentation
  - [ ] Add web UI access to README
  - [ ] Update user guide

### Phase 10: Testing
- [ ] Create manual testing checklist
  - [ ] Document all user flows
  - [ ] Cross-browser test matrix
  - [ ] Responsive breakpoints to test
- [ ] Test all user flows
  - [ ] Search by name → details → back
  - [ ] Search by category → details → back
  - [ ] Index new location → success → search
  - [ ] Browse categories → search by category
  - [ ] Browser back/forward navigation
  - [ ] URL sharing and direct access
- [ ] Cross-browser testing
  - [ ] Chrome (desktop)
  - [ ] Firefox (desktop)
  - [ ] Safari (desktop)
  - [ ] Chrome (mobile)
  - [ ] Safari (iOS)
- [ ] Responsive testing
  - [ ] iPhone SE (375px width)
  - [ ] iPhone 12 Pro (390px width)
  - [ ] iPad (768px width)
  - [ ] Desktop (1920px width)
- [ ] Error scenario testing
  - [ ] API server down
  - [ ] Invalid restaurant ID
  - [ ] Empty search results
  - [ ] Network timeout
  - [ ] Invalid form inputs
- [ ] Create integration tests (optional)
  - [ ] Add `tests/integration/web_test.rb`
  - [ ] Test page loads (200 status)
  - [ ] Test API endpoints from web context
  - [ ] Test error pages

### Phase 11: Accessibility
- [ ] Semantic HTML audit
  - [ ] Use `<nav>`, `<main>`, `<article>`, `<section>`
  - [ ] Proper heading hierarchy (h1 → h2 → h3)
  - [ ] `<button>` for actions, `<a>` for navigation
- [ ] ARIA labels
  - [ ] Add `aria-label` to icon buttons
  - [ ] Add `aria-describedby` for form hints
  - [ ] Add `role` attributes where needed
- [ ] Keyboard navigation
  - [ ] Tab through all interactive elements
  - [ ] Enter to submit forms
  - [ ] Escape to close modals/menus
  - [ ] Skip to content link
- [ ] Focus management
  - [ ] Visible focus indicators (ring)
  - [ ] Focus trap in modals
  - [ ] Focus restoration after actions
- [ ] Screen reader testing
  - [ ] Test with VoiceOver (macOS/iOS)
  - [ ] Test with NVDA (Windows)
  - [ ] Ensure all content is readable
- [ ] Color contrast audit
  - [ ] Use WebAIM contrast checker
  - [ ] Ensure WCAG AA compliance (4.5:1 ratio)
  - [ ] Test with color blindness simulators
- [ ] Alt text for images
  - [ ] Descriptive alt text for photos
  - [ ] Empty alt for decorative images
  - [ ] Logo alt text

### Phase 12: Performance
- [ ] Measure initial load time
  - [ ] Use Chrome DevTools Lighthouse
  - [ ] Target: <2 seconds on 3G
- [ ] Optimize images
  - [ ] Use responsive images (`srcset`)
  - [ ] Lazy load offscreen images
  - [ ] Consider WebP format (future)
- [ ] Optimize JavaScript
  - [ ] Remove unused code
  - [ ] Defer non-critical scripts
  - [ ] Code split by page (already done with modules)
- [ ] Optimize API calls
  - [ ] Cache responses in `sessionStorage`
  - [ ] Debounce search input (future)
  - [ ] Prefetch linked pages (future)
- [ ] Measure and document
  - [ ] Lighthouse score (aim for >90)
  - [ ] Bundle size report
  - [ ] Performance budget

### Phase 13: Documentation & Deployment
- [ ] Create `web/README.md`
  - [ ] Quick start guide
  - [ ] File structure explanation
  - [ ] Development workflow
  - [ ] Deployment instructions
- [ ] Add screenshots to docs
  - [ ] Search page (mobile + desktop)
  - [ ] Details page
  - [ ] Index form
- [ ] Update main `README.md`
  - [ ] Add web UI section
  - [ ] Link to web docs
  - [ ] Update getting started
- [ ] Update `CLAUDE.md`
  - [ ] Add web UI to architecture
  - [ ] Update implementation status
- [ ] Docker support
  - [ ] Ensure `web/` is copied in Dockerfile
  - [ ] Test Docker deployment
  - [ ] Update Docker instructions
- [ ] Write user guide
  - [ ] How to access web UI
  - [ ] Screenshots/walkthrough
  - [ ] Common tasks

### Phase 14: Future Enhancements (Optional)
- [ ] Dark mode toggle
  - [ ] Use Tailwind dark mode classes
  - [ ] Persist preference in `localStorage`
  - [ ] Toggle button in nav
- [ ] Favorites/bookmarks
  - [ ] Save favorites to `localStorage`
  - [ ] Display favorites page
  - [ ] Export favorites as JSON
- [ ] Map integration
  - [ ] Embed Google Maps on details page
  - [ ] Show restaurant marker
  - [ ] Directions link
- [ ] Advanced search filters
  - [ ] Rating threshold
  - [ ] Price range
  - [ ] Open now
- [ ] Sort options
  - [ ] By rating
  - [ ] By distance (if geolocation added)
  - [ ] By name (alphabetical)
- [ ] Geolocation "Near me"
  - [ ] Request browser location
  - [ ] Calculate distances
  - [ ] Sort by proximity
- [ ] Export results
  - [ ] Download as CSV
  - [ ] Download as JSON
  - [ ] Print-friendly view
- [ ] Service Worker (offline support)
  - [ ] Cache static assets
  - [ ] Cache API responses
  - [ ] Offline indicator

---

## Notes

- **Start Simple**: Build Phase 1-3 first (core functionality)
- **Iterate**: Test each phase before moving to next
- **No Premature Optimization**: Add performance/polish only when needed
- **User Feedback**: Share early prototypes with users
- **Document As You Go**: Update this doc with decisions and learnings

**Philosophy**: Keep it simple, keep it working, keep it maintainable.
