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

### Bundler Version Requirements

This project requires **Bundler 2.5.23** for compatibility with Ruby 3.3.6. Bundler 4.0.3+ has a known bug causing `uninitialized class variable @@accept_charset in CGI` errors.

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
Dockerfile                          # Container configuration for deployment
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
