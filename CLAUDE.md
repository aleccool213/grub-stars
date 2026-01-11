# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**grub stars** (`grst`) is a command-line application that aggregates restaurant information (reviews, photos, videos, ratings) from multiple sources into a local SQLite database. Users index a geographic area once, then perform fast local searches without hitting multiple APIs repeatedly.

## Tech Stack

- **Ruby**
- **Thor** - CLI framework
- **Sequel + sqlite3** - Database ORM and driver
- **Faraday** - HTTP client for all adapters
- **dotenv** - Environment variable management

## Development

```bash
bundle install                     # Install dependencies
bundle exec rake test              # Run all tests
bundle exec rake test:integration  # Run integration tests only
./bin/grst --help                  # Run CLI locally
```

## Configuration

API keys are configured via environment variables. Copy the template and add your keys:

```bash
cp .env.example .env
```

Environment variables: `YELP_API_KEY`, `GOOGLE_API_KEY`, `TRIPADVISOR_API_KEY`, `INSTAGRAM_API_KEY`, `TIKTOK_API_KEY`

## CLI Commands

```bash
grst index --city "barrie, ontario"                    # Index all restaurants in area
grst index --city "barrie, ontario" --category bakery  # Index only bakeries in area
grst search --category bakery                          # Search locally by category/name
grst info --name "restaurant name"                     # Show detailed restaurant info
```

## Code Structure

The codebase follows a **layered architecture** with clear separation of concerns:

```
lib/
├── grub_stars.rb                    # Main entry, requires all layers
├── cli.rb                           # Presentation layer (Thor CLI)
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
```

## Architecture

### Layered Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              Presentation Layer                     │
│              (lib/cli.rb)                           │
│  - User I/O and formatting only                     │
└────────────────────┬────────────────────────────────┘
                     │ calls
┌────────────────────▼────────────────────────────────┐
│              Service Layer                          │
│              (lib/services/)                        │
│  - Orchestrates business operations                 │
│  - Uses repositories and domain logic               │
└──────┬─────────────────────────────────┬───────────┘
       │ uses                            │ uses
┌──────▼────────────────┐    ┌───────────▼────────────┐
│   Domain Layer        │    │  Infrastructure Layer  │
│   (lib/domain/)       │    │  (lib/infrastructure/) │
│  - Pure business      │    │  - Repositories        │
│    logic & models     │    │  - Database            │
│  - Zero dependencies  │    │  - Adapters            │
└───────────────────────┘    └────────────────────────┘
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
- `get_business(id)` - Get detailed business info
- `get_reviews(id)` - Get review excerpts
- `source_name` - Adapter identifier (e.g., "yelp")
- `configured?` - Check if API key is set

Adapters normalize responses to a common format with fields: `external_id`, `name`, `address`, `latitude`, `longitude`, `rating`, `review_count`, `categories`, `photos`.

**Category Filtering:**
All adapters support optional category filtering during indexing:
- Users can index a location with a category filter (e.g., only bakeries)
- This allows multiple indexing passes with different categories for targeted data collection
- Example: `grst index --city "barrie, ontario" --category bakery`

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
  - Queries adapters for restaurants in specified geographic area
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

### 4. Presentation Layer (`lib/cli.rb`)

**Thor CLI commands for user interaction.**

- Handles user I/O and output formatting only
- Calls services to perform business operations
- **No business logic or database access**
- Commands: `index`, `search`, `info`, `categories`

## Implementation Status

✅ **Completed:**
1. **API Research**: Verified data access from Yelp, Google Maps, and TripAdvisor
2. **CLI Layer**: Thor-based commands with service-based architecture
3. **Database**: SQLite schema with full relationship modeling
4. **Adapters**: Yelp, Google Maps, and TripAdvisor adapters implemented
5. **Domain Models**: Pure Ruby models (Restaurant, Rating, Review, Media, Category, ExternalId)
6. **Repositories**: Full data access layer with repository pattern
7. **Services**: All core services implemented (Index, Search, Details, Categories)
8. **Matcher**: Pure deduplication logic with confidence scoring
9. **Layered Architecture**: Complete refactoring to clean architecture
10. **Test Coverage**: Comprehensive unit and integration tests

🚧 **Planned:**
- Instagram adapter (photos/videos only)
- TikTok adapter (videos only)

## Key Design Considerations

- **Local-first**: Data stored locally for fast queries, reducing API calls
- **BYOK (Bring Your Own Key)**: Users provide their own API keys
- **Selective indexing**: User indexes specific geographic areas as needed
- **Lightweight storage**: Store URLs to media, not the media itself
- **Flexible refresh**: Users can re-index areas as frequently as needed
