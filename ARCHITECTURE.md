# Layered Architecture Design

## Overview

This document describes the layered architecture for GrubStars, designed to separate concerns and enable future API/web app integration.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│                  (lib/cli.rb - Thor CLI)                    │
│  - User I/O and formatting                                  │
│  - Command routing                                          │
│  - Exception handling and display                           │
└────────────────────────┬────────────────────────────────────┘
                         │ calls
┌────────────────────────▼────────────────────────────────────┐
│                   Application/Service Layer                 │
│                     (lib/services/)                         │
│  - IndexRestaurantsService    - Orchestrates indexing       │
│  - SearchRestaurantsService   - Orchestrates searching      │
│  - RestaurantDetailsService   - Gets detailed info          │
│                                                              │
│  Services use repositories and domain logic                 │
└────────┬───────────────────────────────────┬────────────────┘
         │ uses                              │ uses
┌────────▼────────────────────┐    ┌─────────▼────────────────┐
│      Domain Layer           │    │  Infrastructure Layer    │
│    (lib/domain/)            │    │  (lib/infrastructure/)   │
│                             │    │                          │
│  Models (Plain Ruby):       │    │  Repositories:           │
│  - Restaurant               │    │  - RestaurantRepository  │
│  - Rating                   │    │  - RatingRepository      │
│  - Review                   │    │  - ReviewRepository      │
│  - Media                    │    │  - MediaRepository       │
│  - Category                 │    │  - CategoryRepository    │
│                             │    │  - ExternalIdRepository  │
│  Business Logic:            │    │                          │
│  - Matcher (pure)           │    │  Adapters:               │
│  - Adapter interface        │    │  - Yelp, Google, etc.    │
│                             │    │                          │
│                             │    │  Database:               │
│                             │    │  - Connection & schema   │
└─────────────────────────────┘    └──────────────────────────┘
```

## Layer Responsibilities

### 1. Presentation Layer (`lib/cli.rb`)
**Responsibilities:**
- Handle user input and command routing
- Format output for display
- Handle exceptions and show user-friendly errors
- **No business logic or database access**

**Dependencies:**
- Calls Application/Service layer only
- No direct access to repositories or database

**Example:**
```ruby
class CLI < Thor
  desc "index", "Index restaurants"
  def index
    service = IndexRestaurantsService.new
    stats = service.index(location: options[:city])
    puts "Indexed #{stats[:total]} restaurants"
  end
end
```

### 2. Application/Service Layer (`lib/services/`)
**Responsibilities:**
- Orchestrate business operations (use cases)
- Coordinate between repositories and domain logic
- Transaction management
- Return data transfer objects (DTOs) or domain models

**Dependencies:**
- Uses repositories for data access
- Uses domain models and business logic
- **No direct database or Sequel code**

**Services:**
- `IndexRestaurantsService` - Orchestrates multi-adapter indexing with deduplication
- `SearchRestaurantsService` - Orchestrates search operations
- `RestaurantDetailsService` - Retrieves detailed restaurant information
- `ListCategoriesService` - Lists available categories

**Example:**
```ruby
class IndexRestaurantsService
  def initialize(restaurant_repo: nil, matcher: nil)
    @restaurant_repo = restaurant_repo || RestaurantRepository.new
    @matcher = matcher || Matcher.new
  end

  def index(location:)
    # Orchestrate indexing across adapters
    # Use matcher for deduplication
    # Use repository for persistence
  end
end
```

### 3. Domain Layer (`lib/domain/`)
**Responsibilities:**
- Define core business entities (models)
- Implement business rules and logic
- **No infrastructure dependencies (database, HTTP, etc.)**

**Components:**

**Domain Models (Plain Ruby Objects):**
```ruby
# lib/domain/restaurant.rb
class Restaurant
  attr_accessor :id, :name, :address, :latitude, :longitude, :phone

  def initialize(attributes = {})
    # Pure Ruby object, no DB coupling
  end

  # Business logic methods
  def distance_to(other_restaurant)
    # Calculate distance
  end
end
```

**Business Logic:**
```ruby
# lib/domain/matcher.rb
class Matcher
  # Pure deduplication logic, no database access
  def find_match(restaurant, candidates)
    # Score candidates
    # Return best match or nil
  end

  def score_similarity(restaurant1, restaurant2)
    # Scoring algorithm
  end
end
```

### 4. Infrastructure Layer (`lib/infrastructure/`)
**Responsibilities:**
- Implement data access (repositories)
- Manage database connections and schema
- Implement external API integrations (adapters)
- Handle all persistence concerns

**Repositories (Data Access Layer):**
```ruby
# lib/infrastructure/repositories/restaurant_repository.rb
class RestaurantRepository
  def initialize(db = GrubStars.db)
    @db = db
  end

  def find_by_id(id)
    # SELECT and convert to Restaurant domain model
  end

  def find_by_external_id(source, external_id)
    # Query and return Restaurant
  end

  def save(restaurant)
    # INSERT/UPDATE restaurant
  end

  def find_candidates_for_matching(latitude, longitude, delta)
    # Query for nearby restaurants
    # Convert to Restaurant domain models
  end
end
```

**Database:**
```ruby
# lib/infrastructure/database.rb
# Schema definition and connection management
# No changes needed - stays in infrastructure
```

**Adapters:**
```ruby
# lib/infrastructure/adapters/
# Move existing adapters here
# No significant changes needed
```

## Directory Structure

```
lib/
├── grub_stars.rb                    # Main entry point
├── cli.rb                           # Presentation layer
├── services/                        # Application layer
│   ├── index_restaurants_service.rb
│   ├── search_restaurants_service.rb
│   ├── restaurant_details_service.rb
│   └── list_categories_service.rb
├── domain/                          # Domain layer
│   ├── models/
│   │   ├── restaurant.rb
│   │   ├── rating.rb
│   │   ├── review.rb
│   │   ├── media.rb
│   │   └── category.rb
│   └── matcher.rb                   # Pure business logic
└── infrastructure/                  # Infrastructure layer
    ├── repositories/
    │   ├── restaurant_repository.rb
    │   ├── rating_repository.rb
    │   ├── review_repository.rb
    │   ├── media_repository.rb
    │   ├── category_repository.rb
    │   └── external_id_repository.rb
    ├── database.rb                  # Database schema and connection
    └── adapters/                    # External APIs
        ├── base.rb
        ├── yelp.rb
        └── google.rb
```

## Data Flow Examples

### Index Command
```
CLI.index
  ↓
IndexRestaurantsService.index(location)
  ↓ (uses)
  ├─ Adapters (Yelp, Google) → fetch raw data
  ├─ Matcher → find duplicates (pure logic)
  └─ RestaurantRepository → persist
```

### Search Command
```
CLI.search
  ↓
SearchRestaurantsService.search(query)
  ↓ (uses)
  └─ RestaurantRepository → query database
      ↓ (returns)
      [Restaurant domain models]
```

### Info Command
```
CLI.info
  ↓
RestaurantDetailsService.get_details(id)
  ↓ (uses)
  ├─ RestaurantRepository → get restaurant
  ├─ RatingRepository → get ratings
  ├─ ReviewRepository → get reviews
  ├─ MediaRepository → get photos/videos
  └─ CategoryRepository → get categories
      ↓ (returns)
      Restaurant with all associations
```

## Dependency Rules

1. **Presentation depends on Application** (CLI → Services)
2. **Application depends on Domain and Infrastructure** (Services → Repositories + Domain Logic)
3. **Domain depends on nothing** (Pure business logic)
4. **Infrastructure depends on Domain** (Repositories convert DB rows to Domain models)

**Key Principle:** Dependencies flow inward toward the domain layer. Domain layer has zero external dependencies.

## Migration Strategy

1. ✅ Create domain models
2. ✅ Create repository layer
3. ✅ Refactor Matcher to remove DB dependencies
4. ✅ Create service layer
5. ✅ Update CLI to use services
6. ✅ Move adapters to infrastructure
7. ✅ Update tests
8. ✅ Remove old classes (indexer.rb, search.rb)

## Benefits

1. **Testability:** Each layer can be tested independently with mocks
2. **Reusability:** Services can be used by CLI, API, web app, etc.
3. **Maintainability:** Clear separation of concerns
4. **Flexibility:** Easy to swap implementations (e.g., different database)
5. **Future-proof:** Ready for API/web app integration
