# Architecture

## Layered Architecture Overview

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

## 1. Domain Layer (`lib/domain/`)

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

## 2. Infrastructure Layer (`lib/infrastructure/`)

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
When a local search returns no results, the CLI offers a fallback to search external APIs directly. The user selects an adapter, the adapter performs a live API search, and the user can select a restaurant to index into the local database.

**Category Filtering:**
All adapters support optional category filtering during indexing (e.g., only bakeries).

**Implemented Adapters:**
- **Yelp** (`YELP_API_KEY`) - ratings, reviews (enhanced plan), photos
- **Google Maps** (`GOOGLE_API_KEY`) - ratings, reviews (up to 5), photos
- **TripAdvisor** (`TRIPADVISOR_API_KEY`) - ratings, reviews, photos

## 3. Service Layer (`lib/services/`)

**Application use cases that orchestrate business operations.**

Services use dependency injection for testability and accept repositories/domain logic as constructor parameters.

- `IndexRestaurantsService` - Multi-adapter indexing with deduplication
  - `index(location:, categories:)` - Queries adapters for restaurants in specified geographic area
  - `index_restaurant(business_data:, source:)` - Indexes a single restaurant from adapter data
  - Uses Matcher for deduplication across sources

- `SearchRestaurantsService` - Search by name or category (delegates to RestaurantRepository)

- `RestaurantDetailsService` - Get detailed restaurant info with all associations

- `ListCategoriesService` - List available categories

## 4. Presentation Layer

**Multiple interfaces for different use cases.**

**CLI (`lib/cli.rb`)** - Thor-based command-line interface
**REST API (`lib/api/server.rb`)** - Sinatra-based HTTP API
**Web UI** (planned) - Browser-based interface consuming the REST API

All presentation layers are thin - they only handle I/O formatting and delegate to the service layer.
