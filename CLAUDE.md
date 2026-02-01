# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**grub stars** aggregates restaurant information (reviews, photos, videos, ratings) from multiple sources into a local SQLite database. Users index a geographic area once, then perform fast local searches without hitting multiple APIs repeatedly.

The project provides multiple interfaces:
- **CLI** (`grst`) - Command-line interface for terminal users
- **REST API** - Sinatra-based HTTP API for programmatic access
- **Web UI** (planned) - Browser-based interface

## Tech Stack

- **Ruby**
- **Thor** - CLI framework
- **Sinatra** - REST API framework
- **Sequel + sqlite3** - Database ORM and driver
- **Faraday** - HTTP client for all adapters
- **dotenv** - Environment variable management

## Development

### Ruby Version

This project uses **Ruby 4.0+**. The Gemfile includes compatibility gems (`ostruct`, `minitest-mock`) that were moved out of Ruby's standard library in version 4.0.

### Bundler Version Requirements

This project requires **Bundler 2.5.23**. Bundler 4.0.3+ has a known bug causing `uninitialized class variable @@accept_charset in CGI` errors.

**Setup:**
```bash
gem install bundler -v 2.5.23      # Install correct bundler version
bundle _2.5.23_ install            # Install dependencies with specific version
```

**Running Tests:**
```bash
# Use ruby with the rake gem's executable directly (most reliable)
ruby -I lib $(bundle _2.5.23_ show rake)/exe/rake test              # Run all tests
ruby -I lib $(bundle _2.5.23_ show rake)/exe/rake TEST=tests/integration/cli_test.rb  # Run specific test file

# Alternative: Run specific test file directly with ruby
ruby -I lib -I tests tests/integration/cli_test.rb
```

**Running CLI:**
```bash
ruby -I lib bin/grst --help        # Run CLI locally
```

**IMPORTANT - Commands that DO NOT work (avoid these):**
- `./bin/rake test` - binstubs may not exist
- `bundle exec rake test` - fails with "command not found: rake"
- `bundle _2.5.23_ exec rake test` - may fail if bundler not properly installed
- `bundle install` without version specifier - uses Bundler 4.0.3+ which has CGI bugs

### JavaScript/Web UI Testing

The Web UI uses a zero-dependency, browser-based test framework with Playwright for headless execution.

**Running JavaScript Tests:**
```bash
npm test                           # Run all JS tests in headless Chromium
npm run test:install               # Install Playwright browsers (first time only)
```

**Test Framework Features:**

The custom test framework (`web/js/test-framework.js`) provides:

- **Assertions:** `assert`, `assertEqual`, `assertTruthy`, `assertFalsy`, `assertIncludes`, `assertThrows`
- **DOM Interaction:** `click`, `dblclick`, `submit`, `type`, `clear`, `select`, `keyPress`, `focus`, `blur`
- **Async Utilities:** `waitFor`, `waitForElement`, `waitForText`
- **Test Isolation:** `createContainer`, `destroyContainer`
- **Mocking:** `createMockFn`

**Writing Interaction Tests:**

```javascript
import {
  test, assert, assertEqual,
  createContainer, destroyContainer,
  click, type, submit, waitFor
} from './test-framework.js';

test('form submission captures input', async () => {
  const container = createContainer();
  let submitted = null;

  container.innerHTML = `
    <form id="search-form">
      <input name="query" id="query" />
      <button type="submit">Search</button>
    </form>
  `;

  const form = container.querySelector('#search-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitted = new FormData(form).get('query');
  });

  type(container.querySelector('#query'), 'Pizza');
  submit(form);

  assertEqual(submitted, 'Pizza', 'Form should capture input');
  destroyContainer(container);
});
```

**Test Files:**
- `web/js/api.test.js` - API client tests
- `web/js/components/*.test.js` - Component rendering tests
- `web/js/interactions.test.js` - Click, form, and async interaction tests

### PR Screenshots (for Claude Code)

Use the Playwright-based screenshot tools to capture UI changes for PR descriptions. This helps demonstrate features, bug fixes, or design changes visually.

**Setup (one-time):**
```bash
npm install                          # Install Playwright
npx playwright install chromium      # Install browser
```

**Taking Screenshots:**

1. **Quick single screenshot:**
```bash
# Start the server first
bundle _2.5.23_ exec rackup &

# Take a screenshot
node scripts/screenshot.js --url http://localhost:9292 --name homepage
```

2. **Run a scenario file (for complex interactions):**
```bash
node scripts/screenshot.js --scenario scripts/scenarios/search-flow.json
```

3. **Dynamic scenario with custom actions:**
```bash
node scripts/screenshot.js --url http://localhost:9292 \
  --actions '[{"action":"click","selector":"#search"},{"action":"wait","ms":500}]' \
  --name after-click
```

**Posting to PR:**
```bash
# After taking screenshots, post them to a PR
node scripts/post-screenshots-to-pr.js <PR_NUMBER>

# With custom section name
node scripts/post-screenshots-to-pr.js 42 --section "UI Changes"

# Preview without making changes
node scripts/post-screenshots-to-pr.js 42 --dry-run
```

**Creating Custom Scenarios:**

Create JSON files in `scripts/scenarios/` with this structure:
```json
{
  "name": "feature-demo",
  "baseUrl": "http://localhost:9292",
  "viewport": { "width": 1280, "height": 720 },
  "steps": [
    { "action": "goto", "path": "/" },
    { "action": "screenshot", "name": "before", "description": "Initial state" },
    { "action": "click", "selector": "#my-button" },
    { "action": "wait", "ms": 500 },
    { "action": "screenshot", "name": "after", "description": "After clicking" }
  ]
}
```

**Supported Actions:**
- `goto` - Navigate to path/URL
- `click` - Click an element
- `type` - Type text into input
- `hover` - Hover over element
- `scroll` - Scroll to element or position
- `wait` - Wait for ms, selector, or state
- `screenshot` - Capture screenshot
- `select` - Select dropdown option
- `press` - Press keyboard key

**Best Practices for PR Screenshots:**

When capturing screenshots for pull requests, always capture **both empty and filled states** to demonstrate the full user experience:

1. **Empty state** - Shows what users see before any data exists (e.g., "No categories yet" message)
2. **Filled state** - Shows the UI with real data populated

To capture filled states, use the mock server to populate test data:
```bash
# Terminal 1: Start mock server
ruby dev/mock_server.rb

# Terminal 2: Start main server (with .env pointing to mock)
ruby -I lib $(bundle _2.5.23_ show rack)/bin/rackup config.ru

# Index test data
curl -X POST http://localhost:9292/index \
  -H "Content-Type: application/json" \
  -d '{"location": "barrie, ontario"}'

# Take screenshots
node scripts/screenshot.js --url http://localhost:9292/categories.html --name categories-filled
```

This ensures reviewers can see both the graceful handling of empty data and the fully functional UI.

### CSS Framework (Twind)

The Web UI uses **Twind** (~58KB), a lightweight Tailwind-in-JS runtime that generates CSS on the fly without a build step.

**How it works:**
- `web/js/vendor/twind.min.js` - Bundled Twind runtime (downloaded from jsdelivr)
- `web/js/twind-config.js` - Custom theme configuration (colors, fonts, animations)
- No external CDN dependency - works fully offline

**Custom theme includes:**
- Colors: `mango`, `hotpink`, `electric`, `mint`, `sunny`, `coral`, `cream`, `cocoa`, `latte`
- Fonts: `display` (Fredoka), `body` (Nunito)
- Animations: `wiggle`, `float`, `pop-in`, `bounce-in`, `pulse-glow`, `rainbow`, `sparkle`

**Note:** Google Fonts are still loaded externally via `custom.css`. For fully offline operation, consider bundling the fonts locally.

**IMPORTANT - Twind Class Name Hashing:**

Twind hashes CSS class names at runtime for optimization. For example, `class="hidden md:hidden px-4"` becomes something like `class="#zkrgdo #17u01q8 #1r5hoj3"` in the actual DOM.

This means **you cannot use `classList.toggle('hidden')` or `classList.contains('hidden')`** - these will add/check for a literal `"hidden"` string, not Twind's hashed class.

**Solutions for dynamic visibility toggling:**

1. **Use inline styles (recommended):**
   ```javascript
   // Instead of: element.classList.toggle('hidden')
   element.style.display = isVisible ? 'block' : 'none';
   ```

2. **Use data attributes with CSS:**
   ```html
   <div data-visible="false">...</div>
   ```
   ```css
   [data-visible="false"] { display: none; }
   ```

**Debugging tip:** When inspecting elements in DevTools, you'll see hashed class names. To understand what styles are applied, check the computed styles panel rather than trying to decode the class names.

**IMPORTANT - Dark Mode CSS Challenges:**

Because Twind hashes class names, CSS selectors like `.bg-white` or `.text-gray-600` in `custom.css` **will not match** elements in the DOM. This creates significant friction when implementing dark mode.

**What doesn't work:**
```css
/* These selectors won't match because Twind hashes the class names */
html.dark .bg-white { background-color: #1e293b !important; }
html.dark .text-gray-600 { color: #cbd5e1 !important; }
```

**Solutions for dark mode styling:**

1. **Target elements by container ID and structure (recommended):**
   ```css
   /* Target specific containers and their children */
   html.dark #restaurant-details article { background-color: #1e293b !important; }
   html.dark #search-results article { background-color: #1e293b !important; }
   html.dark #categories-list a { background-color: #334155 !important; }
   ```

2. **Target semantic HTML elements:**
   ```css
   /* article, blockquote, etc. work regardless of class hashing */
   html.dark article { background-color: #1e293b !important; }
   html.dark blockquote { background-color: #334155 !important; }
   ```

3. **Use Twind's dark: prefix in JavaScript components:**
   ```javascript
   // In JS components, use Twind's dark mode utilities
   `<div class="bg-white dark:bg-slate-800">...</div>`
   ```

4. **For inline styles in JS components, use CSS attribute selectors:**
   ```css
   /* Match elements with specific inline style values */
   html.dark [style*="color: #4b5563"] { color: #cbd5e1 !important; }
   ```

**Key insight:** When adding dark mode support, you must identify the container IDs (`#restaurant-details`, `#search-results`, `#categories-list`, etc.) and target elements through DOM structure rather than relying on Tailwind class selectors.

## Configuration

API keys are configured via environment variables. Copy the template and add your keys:

```bash
cp .env.example .env
```

Environment variables: `YELP_API_KEY`, `GOOGLE_API_KEY`, `TRIPADVISOR_API_KEY`, `INSTAGRAM_API_KEY`, `TIKTOK_API_KEY`

## CLI Commands

```bash
grst index --location "barrie, ontario"                    # Index all restaurants in area
grst index --location "barrie, ontario" --category bakery  # Index only bakeries in area
grst search --category bakery                              # Search locally by category/name
grst info --name "restaurant name"                         # Show detailed restaurant info
```

## REST API

Start the API server:

```bash
bundle _2.5.23_ exec rackup                            # Start on default port 9292
bundle _2.5.23_ exec rackup -p 3000                    # Start on custom port
```

**Note:** With Sentry integration and Ruby 4.0, if you encounter `uninitialized constant Logger` errors, see the "Sentry Integration with Ruby 4.0" section in Development Friction below.

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/categories` | GET | List all categories |
| `/locations` | GET | List all indexed locations |
| `/restaurants/search?name=X` | GET | Search by name |
| `/restaurants/search?category=X` | GET | Search by category |
| `/restaurants/:id` | GET | Get restaurant details |
| `/index` | POST | Index restaurants (body: `{"location": "city", "category": "optional"}`) |

### Response Format

```json
{
  "data": <result>,
  "meta": { "timestamp": "...", "count": 10 }
}
```

### Docker Deployment

```bash
docker build -t grub-stars-api .
docker run -p 9292:9292 \
  -e YELP_API_KEY=xxx \
  -e GOOGLE_API_KEY=xxx \
  -v grub_stars_data:/data \
  grub-stars-api
```

### Fly.io Cloud Deployment

The project includes Fly.io configuration for two environments:

| Environment | Config File | Description |
|-------------|-------------|-------------|
| **Test** | `fly.test.toml` | Uses mock API server (no real keys needed) |
| **Prod** | `fly.prod.toml` | Uses real API keys (set as secrets) |

**Prerequisites:**
```bash
# Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
fly auth login
```

**Deploy Test Environment:**
```bash
./scripts/deploy-test.sh
# Or manually:
fly deploy --config fly.test.toml
```

**Deploy Production Environment:**
```bash
# First, set your API secrets
fly secrets set YELP_API_KEY=your_key --config fly.prod.toml
fly secrets set GOOGLE_API_KEY=your_key --config fly.prod.toml
fly secrets set TRIPADVISOR_API_KEY=your_key --config fly.prod.toml

# Then deploy
./scripts/deploy-prod.sh
# Or manually:
fly deploy --config fly.prod.toml
```

**Useful Commands:**
```bash
fly logs --config fly.test.toml         # View logs
fly ssh console --config fly.test.toml  # SSH into container
fly status --config fly.test.toml       # Check status
fly apps open --config fly.test.toml    # Open in browser
```

**Cost:** Free tier includes 3 shared VMs (256MB RAM each) - enough for both test and prod.

## Code Structure

The codebase follows a **layered architecture** with clear separation of concerns:

```
lib/
├── grub_stars.rb                    # Main entry, requires all layers
├── cli.rb                           # Presentation layer (Thor CLI)
├── api/
│   └── server.rb                    # Presentation layer (Sinatra REST API)
├── config.rb                        # Configuration management
├── logger.rb                        # Logging utility
├── domain/                          # Domain layer (pure business logic)
│   ├── models/
│   │   ├── restaurant.rb
│   │   ├── rating.rb
│   │   ├── review.rb
│   │   ├── media.rb
│   │   ├── category.rb
│   │   └── external_id.rb
│   └── matcher.rb                   # Restaurant deduplication logic
├── infrastructure/                  # Infrastructure layer
│   ├── database.rb                  # Sequel schema and connection
│   ├── adapters/                    # External API integrations
│   │   ├── base.rb
│   │   ├── yelp.rb
│   │   ├── google.rb
│   │   └── tripadvisor.rb
│   └── repositories/                # Data access layer
│       ├── restaurant_repository.rb
│       ├── rating_repository.rb
│       ├── review_repository.rb
│       ├── media_repository.rb
│       ├── category_repository.rb
│       └── external_id_repository.rb
└── services/                        # Service layer (use cases)
    ├── index_restaurants_service.rb
    ├── search_restaurants_service.rb
    ├── restaurant_details_service.rb
    └── list_categories_service.rb

tests/
├── test_helper.rb
├── integration/                     # Full-stack integration tests
│   ├── api_test.rb                 # REST API tests
│   ├── cli_test.rb
│   └── index_test.rb
└── unit/                           # Unit tests (with mocks)
    ├── adapters/                   # Adapter tests (mocked HTTP)
    ├── domain/                     # Domain model & matcher tests
    ├── repositories/               # Repository tests
    └── services/                   # Service tests

dev/
├── mock_server.rb                  # Sinatra mock API server
└── fixtures/                       # Mock data for Yelp and Google

scripts/
├── deploy-test.sh                  # Deploy test env to Fly.io
├── deploy-prod.sh                  # Deploy prod env to Fly.io
└── start-test.sh                   # Start script for test container

web/                                # Web UI (vanilla JavaScript)
├── index.html                      # Main search page
├── details.html                    # Restaurant details page
├── categories.html                 # Browse categories
├── index-location.html             # Location indexing page
├── test.html                       # Test runner page
├── js/
│   ├── api.js                      # REST API client
│   ├── api.test.js                 # API client tests
│   ├── search.js                   # Search page controller
│   ├── test-framework.js           # Custom test framework
│   ├── interactions.test.js        # DOM interaction tests
│   └── components/
│       ├── restaurant-card.js      # Restaurant card component
│       ├── restaurant-card.test.js
│       ├── loading-spinner.js      # Loading spinner component
│       ├── loading-spinner.test.js
│       ├── error-message.js        # Error message component
│       └── error-message.test.js
└── css/
    └── custom.css                  # Custom styles

config.ru                           # Rack configuration for API server
Dockerfile                          # Container configuration for production
Dockerfile.test                     # Container for test (includes mock server)
fly.test.toml                       # Fly.io config for test environment
fly.prod.toml                       # Fly.io config for prod environment
run-tests.js                        # Playwright test runner for JS tests
```

## Architecture

### Layered Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                            │
│  ┌─────────────────────┐    ┌─────────────────────┐                │
│  │   CLI (lib/cli.rb)  │    │ REST API            │    (Web UI)    │
│  │   Thor commands     │    │ (lib/api/server.rb) │    (planned)   │
│  └─────────────────────┘    └─────────────────────┘                │
└────────────────────────────────┬───────────────────────────────────┘
                                 │ calls
┌────────────────────────────────▼───────────────────────────────────┐
│                        Service Layer                               │
│                        (lib/services/)                             │
│  - Orchestrates business operations                                │
│  - Uses repositories and domain logic                              │
└──────┬───────────────────────────────────────────────┬─────────────┘
       │ uses                                          │ uses
┌──────▼────────────────┐              ┌───────────────▼─────────────┐
│   Domain Layer        │              │  Infrastructure Layer       │
│   (lib/domain/)       │              │  (lib/infrastructure/)      │
│  - Pure business      │              │  - Repositories             │
│    logic & models     │              │  - Database                 │
│  - Zero dependencies  │              │  - Adapters                 │
└───────────────────────┘              └─────────────────────────────┘
```

**Key Principle:** Dependencies flow inward toward the domain layer. The domain has zero external dependencies.

### 1. Domain Layer (`lib/domain/`)

**Pure business logic with zero infrastructure dependencies.**

**Models (Plain Old Ruby Objects):**
- `Restaurant`, `Rating`, `Review`, `Media`, `Category`, `ExternalId`
- Include business methods like `distance_to()`, `photos()`, `videos()`
- No database coupling - just pure Ruby objects

**Business Logic:**
- `Matcher` - Restaurant deduplication algorithm
  - Pure function: takes candidates as parameter, no database access
  - Uses confidence scoring: name similarity (~30 points), address match, GPS proximity, phone number
  - Threshold: score >50 = same restaurant, merge data

### 2. Infrastructure Layer (`lib/infrastructure/`)

**External dependencies and data access.**

**Repositories (Data Access Layer):**
- Encapsulate all database operations using the Repository pattern
- Convert database rows (Sequel datasets) to domain models
- Provide methods: `find_by_id()`, `search_by_name()`, `find_candidates_for_matching()`, `save()`, etc.
- All SQL/Sequel logic contained here - services never touch the database directly

**Database:**
- SQLite schema definition and connection management (`lib/infrastructure/database.rb`)
- Tables: restaurants, ratings, reviews, media, categories, restaurant_categories, external_ids

**Adapters:**
All adapters inherit from `Infrastructure::Adapters::Base` and implement:
- `search_businesses(location:, categories:, limit:, offset:)` - Search by location
- `search_by_name(name:, location:, limit:)` - Search by restaurant name with optional location
- `get_business(id)` - Get detailed business info
- `get_reviews(id)` - Get review excerpts
- `source_name` - Adapter identifier (e.g., "yelp")
- `configured?` - Check if API key is set

Adapters normalize responses to a common format with fields: `external_id`, `name`, `address`, `latitude`, `longitude`, `rating`, `review_count`, `categories`, `photos`.

**Fallback Search:**
When a local search returns no results, the CLI offers a fallback to search external APIs directly:
1. User searches for a restaurant that's not in the local database
2. CLI prompts: "Would you like to search for this restaurant using an external API?"
3. User selects which adapter to use (Yelp, Google, TripAdvisor)
4. Adapter performs live API search using `search_by_name()`
5. Results are displayed to user
6. User can select a restaurant to index it into the local database
7. Selected restaurant is indexed using `index_restaurant()` for future local queries

This provides a seamless experience where unindexed restaurants can be discovered and added on-demand.

**Category Filtering:**
All adapters support optional category filtering during indexing:
- Users can index a location with a category filter (e.g., only bakeries)
- This allows multiple indexing passes with different categories for targeted data collection
- Example: `grst index --location "barrie, ontario" --category bakery`

**Implemented:**
- **Yelp** (`YELP_API_KEY`) - ratings, reviews (enhanced plan), photos
- **Google Maps** (`GOOGLE_API_KEY`) - ratings, reviews (up to 5), photos
- **TripAdvisor** (`TRIPADVISOR_API_KEY`) - ratings, reviews, photos

**Planned:**
- **Instagram** - photos, videos only
- **TikTok** - videos only

### 3. Service Layer (`lib/services/`)

**Application use cases that orchestrate business operations.**

Services use dependency injection for testability and accept repositories/domain logic as constructor parameters.

- `IndexRestaurantsService` - Multi-adapter indexing with deduplication
  - `index(location:, categories:)` - Queries adapters for restaurants in specified geographic area
  - `index_restaurant(business_data:, source:)` - Indexes a single restaurant from adapter data
  - Supports optional category filtering (e.g., only index bakeries)
  - Uses Matcher for deduplication across sources
  - Uses repositories for persistence
  - Replaces old `Indexer` class

- `SearchRestaurantsService` - Search by name or category
  - Delegates to RestaurantRepository
  - Returns domain models
  - Replaces search methods from old `Search` class

- `RestaurantDetailsService` - Get detailed restaurant info
  - Loads restaurant with all associations (ratings, reviews, media, categories)
  - Returns fully-populated domain model
  - Replaces info methods from old `Search` class

- `ListCategoriesService` - List available categories

### 4. Presentation Layer

**Multiple interfaces for different use cases.**

**CLI (`lib/cli.rb`)** - Thor-based command-line interface:
- Handles terminal I/O and formatting
- Calls services to perform business operations
- Commands: `index`, `search`, `info`, `categories`

**REST API (`lib/api/server.rb`)** - Sinatra-based HTTP API:
- JSON request/response format
- Mirrors CLI functionality via HTTP endpoints
- Suitable for programmatic access and web frontends
- Endpoints: `/health`, `/categories`, `/locations`, `/restaurants/search`, `/restaurants/:id`, `/index`

**Web UI** (planned) - Browser-based interface:
- Will consume the REST API
- Interactive restaurant search and browsing

**Key Principle:** All presentation layers are thin - they only handle I/O formatting and delegate to the service layer.

## Implementation Status

✅ **Completed:**
1. **API Research**: Verified data access from Yelp, Google Maps, and TripAdvisor
2. **CLI Layer**: Thor-based commands with service-based architecture
3. **REST API Layer**: Sinatra-based HTTP API with JSON responses
4. **Docker Support**: Dockerfile for containerized deployment
5. **Database**: SQLite schema with full relationship modeling
6. **Adapters**: Yelp, Google Maps, and TripAdvisor adapters implemented
7. **Domain Models**: Pure Ruby models (Restaurant, Rating, Review, Media, Category, ExternalId)
8. **Repositories**: Full data access layer with repository pattern
9. **Services**: All core services implemented (Index, Search, Details, Categories)
10. **Matcher**: Pure deduplication logic with confidence scoring
11. **Layered Architecture**: Complete refactoring to clean architecture
12. **Test Coverage**: Comprehensive unit and integration tests (CLI + API)
13. **Fallback Search**: When local search fails, fallback to live API search with on-demand indexing
14. **Fly.io Deployment**: Test env (with mock server) and prod env configurations

🚧 **Planned:**
- Web UI (browser-based interface consuming REST API)
- Instagram adapter (photos/videos only)
- TikTok adapter (videos only)

## Key Design Considerations

- **Local-first**: Data stored locally for fast queries, reducing API calls
- **BYOK (Bring Your Own Key)**: Users provide their own API keys
- **Selective indexing**: User indexes specific geographic areas as needed
- **Lightweight storage**: Store URLs to media, not the media itself
- **Flexible refresh**: Users can re-index areas as frequently as needed

## Future Ideas

### Location Autocomplete with Geocoding

**Problem:** Users can create duplicate locations with different spellings (e.g., "barrie, on" vs "barrie, ontario" vs "Barrie, Ontario, Canada"). The current free-text input has poor UX and leads to data fragmentation.

**Solution:** Integrate a geocoding/autocomplete service for the location input field.

**Open Source Options:**

| Service | Pros | Cons |
|---------|------|------|
| **Photon** (photon.komoot.io) | Free API, fast autocomplete, OSM data, no API key | Rate limited, best for low-medium traffic |
| **Nominatim** (OSM) | Free, comprehensive, no API key for low volume | Strict usage policy, slower than Photon |
| **Pelias** | Self-hosted, full control, OSM/other data sources | Requires infrastructure to host |
| **OpenCage** | Clean API, good free tier (2,500/day) | Requires API key, commercial |

**Recommendation:** Start with **Photon** - free, fast, designed for typeahead. Example:
```
https://photon.komoot.io/api/?q=barrie&limit=5
```

**Implementation:**
- Replace free-text input with autocomplete dropdown
- Store normalized location data (lat/lng + formatted name)
- Use coordinates as canonical identifier to prevent duplicates
- Display formatted address from geocoder response

---

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

**Related to existing improvements:**
- Works alongside "Onboarding Hints & Empty State Guidance" for the initial experience
- Complements "Restaurant Name Search with Autocomplete" once that feature is implemented
- Part of the overall empty state strategy across the application

---

### Restaurant Bookmarks (Browser-based, Local Storage)

**Problem:** Users discover and browse restaurants in grub stars, but have no way to save their favorites for easy access later. Currently, there's no mechanism to maintain a personal collection of bookmarked restaurants across sessions.

**Solution:** Implement browser-based bookmarks using HTML5 LocalStorage. Users can mark restaurants as "bookmarked" from any page, and access all bookmarks from a dedicated bookmarks page. Since bookmarks are stored locally in the browser, they persist across sessions without requiring a server-side database or authentication.

**Implementation:**

1. **Data Storage (Browser LocalStorage):**
   - Store bookmarks as JSON array in LocalStorage: `grub_stars_bookmarks`
   - Each bookmark entry: `{ restaurantId: <id>, name: <name>, bookmarkedAt: <timestamp> }`
   - No server-side storage needed - fully client-side and device-local

2. **Bookmark UI Components:**
   - Add bookmark button to restaurant cards and details page
   - Use a heart icon (filled when bookmarked, outline when not)
   - Implement toggle: clicking button adds/removes from bookmarks
   - Show visual feedback (animation, state change) when bookmarking/unbookmarking
   - Display bookmark count or "Bookmarked!" indicator on toggle

3. **Bookmarks Page (`web/bookmarks.html`):**
   - New dedicated page to view all saved bookmarks
   - Display bookmarked restaurants in a grid/list layout
   - Show "No bookmarks yet" message when empty
   - Link in navigation header for easy access
   - Ability to remove bookmarks from this page
   - Sort options: by name, by date bookmarked, by rating

4. **REST API Endpoints (Optional for future sync):**
   - For now, bookmarks are client-only via LocalStorage
   - Future: `GET /bookmarks` and `POST /bookmarks/:id` endpoints if server-side sync is desired

5. **JavaScript Implementation:**
   - New module: `web/js/bookmarks.js` - Core bookmark logic (add, remove, list, persist)
   - Component: `web/js/components/bookmark-button.js` - Reusable bookmark toggle button
   - Tests: `web/js/bookmarks.test.js` - Unit tests for bookmark operations
   - Tests: `web/js/components/bookmark-button.test.js` - Component interaction tests

**Features:**

- **Persistent storage** - Bookmarks survive page refreshes and browser restarts (LocalStorage)
- **Device-local** - Each device maintains its own bookmark list (no sync across devices)
- **Fast access** - No API calls needed to retrieve bookmarks
- **One-click toggle** - Heart icon on every restaurant card for quick bookmarking
- **Visual feedback** - Animated state transitions when bookmarking/unbookmarking
- **Dedicated page** - Browse all bookmarks with filtering/sorting options
- **Export potential** - Future: export bookmarks as JSON or shareable list

**Benefits:**

- Improves user engagement - users want to save favorites
- Simple implementation - uses browser APIs only, no new backend complexity
- Privacy-friendly - bookmarks stay on user's device
- Works offline - once bookmarks are saved, they're always accessible
- Can evolve: future versions could add cloud sync, sharing, or export features

**User Workflow:**

1. User searches for restaurants and discovers favorites
2. Clicks heart icon on restaurant card to bookmark
3. Heart fills in, showing bookmark was saved
4. User can access bookmarks anytime via "My Bookmarks" link in navigation
5. On bookmarks page, user sees all saved restaurants with easy removal
6. Future: could share bookmark lists via URL or export as file

**Storage Considerations:**

- LocalStorage has ~5-10MB limit in most browsers - plenty for thousands of restaurant references
- Consider cleanup if bookmarks grow very large (pagination, archiving old bookmarks)
- Future: migrate to IndexedDB for more storage if needed

---

## Development Friction & Lessons Learned

This section documents friction points encountered during development to help future contributors.

### Ruby Environment Setup

**Issue:** The project requires Bundler 2.5.23, but it may not be installed by default.

**Solution:** Always run `gem install bundler -v 2.5.23` before `bundle _2.5.23_ install`.

**Workaround for rackup:** If `bundle exec rackup` fails, use:
```bash
ruby -I lib -r bundler/setup -e "require 'rack'; Rack::Server.start(config: 'config.ru', Port: 9292, Host: '0.0.0.0')"
```

### Database Location

**Issue:** The SQLite database is stored in `~/.grub_stars/grub_stars.db` by default (not in the project directory). This can cause confusion when creating test data or debugging.

**Solution:** Check `GrubStars::Config.db_path` to find the actual database location. The path is configurable via `GRUB_STARS_CONFIG_DIR` environment variable or `--db_path` CLI option.

### Frontend API Base URL

**Issue:** The JavaScript API client (`web/js/api.js`) expects the backend on port 9292. Starting the server on a different port causes "Unable to connect to API server" errors.

**Solution:** Always start the server on port 9292, or modify `API_BASE_URL` in `api.js` for development.

### Playwright Screenshot Limitations

**Issue:** Playwright crashes when using very tall viewports (e.g., `height: 2000`) for full-page screenshots.

**Solution:** Use scroll-based screenshots instead:
```bash
node scripts/screenshot.js --url "http://localhost:9292/page" --name "section" --actions '[{"action":"scroll","y":600}]'
```

### Static Map Service

**Issue:** The OpenStreetMap static map service (`staticmap.openstreetmap.de`) may be unavailable or blocked in some environments.

**Fallback:** The details page gracefully shows "Map unavailable" when the static map fails to load. Users can still click "Get directions" to open Google Maps directly.

### External Image Loading

**Issue:** Restaurant photos from external URLs (Unsplash, Yelp CDN, etc.) may fail to load due to network restrictions or CORS policies in development/CI environments.

**Solution:** Photo thumbnails include a fallback placeholder icon that displays when image loading fails. The lightbox also handles missing images gracefully.

### Sentry Integration with Ruby 4.0

**Issue:** When using Sentry with Ruby 4.0, you may encounter `uninitialized constant Logger (NameError)` because Logger was moved out of Ruby's standard library in Ruby 4.0 and is now a bundled gem.

**Solution:** The `config.ru` file has been updated to require `logger` before loading Sentry. If you still encounter issues, use this workaround:

```bash
# Start server with explicit logger loading
ruby -I lib -r logger -r bundler/setup -e "require 'dotenv'; Dotenv.load; require_relative 'lib/api/server'; require 'rack'; Rack::Server.start(app: GrubStars::API::Server, Port: 9292, Host: '0.0.0.0')"
```

Or use the provided startup script approach that ensures proper loading order.

---

### Browser Automation with Agent Browser

**Tool:** [agent-browser](https://agent-browser.dev) - Headless browser automation CLI by Vercel Labs designed for AI agents.

**Installation:**
```bash
npm install -g agent-browser
```

**Key Features:**
- Works with any AI agent (Claude Code, Cursor, Codex, Copilot, Gemini, opencode, etc.)
- AI-first design - returns accessibility tree with refs for deterministic element selection
- Fast Rust CLI with Node.js fallback
- 50+ commands for navigation, forms, screenshots, network, storage
- Multiple isolated browser sessions

**Common Commands:**
```bash
# Navigate and get page snapshot
agent-browser open http://localhost:9292
agent-browser snapshot --json

# Interact with elements using refs
agent-browser click @e1
agent-browser type @e2 "search query"
agent-browser submit @e3

# Screenshots
agent-browser screenshot --full-page

# Form handling
agent-browser select @e4 "option-value"
agent-browser check @e5
agent-browser upload @e6 /path/to/file

# Session management
agent-browser new-session my-session
agent-browser list-sessions
agent-browser close-session my-session
```

**Usage with opencode:**
The `--json` flag provides machine-readable output perfect for AI agents:
```bash
agent-browser snapshot --json
# Returns: {"success":true,"data":{"snapshot":"...","refs":{...}}}
```

**Benefits:**
- Saves ~93% of context window compared to traditional browser automation
- Returns structured accessibility trees instead of raw HTML
- Deterministic element selection via refs (not fragile CSS selectors)
- Perfect for automated testing, screenshots, and UI validation

**Example Workflow:**
```bash
# Start the server
bundle _2.5.23_ exec rackup &

# Navigate and capture state
agent-browser open http://localhost:9292/categories.html
agent-browser snapshot --json

# Interact with UI
agent-browser click @e3  # Click a category link
agent-browser wait --selector "#search-results"
agent-browser screenshot --name "categories-clicked"
```

---

## Error Tracking with Sentry

Sentry is configured for both the Ruby API server and the JavaScript Web UI.

**Sentry CLI** is installed for managing releases and source maps.

**Installation:**
```bash
# Sentry CLI (already installed)
curl -sL https://sentry.io/get-cli/ | bash
```

### Ruby API Server Setup

The API server uses the `sentry-ruby` gem with Rack middleware integration.

**Configuration:**
- Config file: `lib/config/sentry.rb`
- Environment variables in `.env`:
  - `SENTRY_DSN` - Your Sentry project DSN
  - `SENTRY_ENVIRONMENT` - Environment name (development, production)
  - `SENTRY_TRACES_SAMPLE_RATE` - Performance tracing sample rate (0.0-1.0)
  - `SENTRY_PROFILES_SAMPLE_RATE` - Profiling sample rate (0.0-1.0)

**Features:**
- Automatic error capturing via `Sentry::Rack::CaptureExceptions` middleware
- Breadcrumbs from HTTP requests and logs
- Performance tracing with configurable sample rates
- Release tracking with git commit SHA
- Environment-specific filtering

**Manual Error Capturing:**
```ruby
# Capture an exception
Sentry.capture_exception(error)

# Capture a message
Sentry.capture_message("Something went wrong")

# Capture with extra context
Sentry.capture_exception(error, extra: { restaurant_id: 123 })
```

### JavaScript SDK Setup

To add Sentry error tracking to the Web UI:

1. Add the Sentry JavaScript SDK to your HTML:
```html
<script src="https://browser.sentry-cdn.com/7.100.1/bundle.min.js" crossorigin="anonymous"></script>
```

2. Initialize Sentry in your JavaScript:
```javascript
Sentry.init({
  dsn: "https://43c2083e3a9d93430e19b51fec5a98f6@o4510802574835712.ingest.us.sentry.io/4510802575163392",
  release: "grub-stars@0.1.0",
  environment: "production"
});
```

### Sentry CLI Commands

```bash
# Create a new release
sentry-cli releases new VERSION

# Associate commits with release
sentry-cli releases set-commits VERSION --auto

# Deploy release
sentry-cli releases deploys VERSION new -e production

# Upload source maps (for JavaScript)
sentry-cli releases files VERSION upload-sourcemaps ./web/js
```

**Release Management Script:**
```bash
# Create and deploy a release
./scripts/sentry-release.sh [version]

# Uses git commit SHA as version if not specified
./scripts/sentry-release.sh
```

**Production Setup:**
1. Set `SENTRY_DSN` in your environment
2. Configure `SENTRY_ENVIRONMENT` as "production"
3. Run `./scripts/sentry-release.sh` after deployment
4. For JavaScript: Upload source maps with Sentry CLI
