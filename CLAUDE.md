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
grst index --city "barrie, ontario"   # Index all restaurants in area
grst search --category bakery         # Search locally by category/name
grst info --name "restaurant name"    # Show detailed restaurant info
```

## Code Structure

```
lib/
├── grub_stars.rb      # Main entry, requires all modules
├── cli.rb             # Thor CLI commands
├── database.rb        # Sequel schema and connection
├── indexer.rb         # Multi-adapter indexing with matcher
├── matcher.rb         # Restaurant deduplication
├── search.rb          # Local database search
└── adapters/
    ├── base.rb        # Abstract adapter interface
    ├── yelp.rb        # Yelp Fusion API adapter
    └── google.rb      # Google Places API adapter

tests/
├── test_helper.rb
├── integration/       # CLI and indexer tests
└── unit/              # Adapter tests (mocked HTTP)

dev/
├── mock_server.rb     # Sinatra mock API server
└── fixtures/          # Mock data for Yelp and Google
```

## Architecture

### Adapters

All adapters inherit from `Adapters::Base` and implement:
- `search_businesses(location:, categories:, limit:, offset:)` - Search by location
- `get_business(id)` - Get detailed business info
- `get_reviews(id)` - Get review excerpts
- `source_name` - Adapter identifier (e.g., "yelp")
- `configured?` - Check if API key is set

Adapters normalize responses to a common format with fields: `external_id`, `name`, `address`, `latitude`, `longitude`, `rating`, `review_count`, `categories`, `photos`.

**Implemented:**
- **Yelp** (`YELP_API_KEY`) - ratings, reviews (enhanced plan), photos
- **Google Maps** (`GOOGLE_API_KEY`) - ratings, reviews (up to 5), photos

**Planned:**
- **Trip Advisor** - ratings, reviews, photos, videos
- **Instagram** - photos, videos only
- **TikTok** - videos only

### Indexer
1. Queries first adapter (e.g., Yelp) for all restaurants in specified geographic area (5km x 5km)
2. Stores restaurant data (name, address, GPS coordinates, category tags) in SQLite
3. For subsequent adapters, runs the **Matcher** to merge duplicate restaurants

### Matcher (Restaurant Deduplication)
Critical component that merges same restaurant from different sources:
- Uses confidence scoring system: name similarity (~30 points), address match, GPS proximity, phone number
- Threshold: score >50 = same restaurant, merge data
- Prevents duplicate entries when restaurant appears across multiple adapters

### Database Schema
SQLite database storing:
- Restaurant core data (id, name, address, coordinates, categories)
- Adapter-specific data (ratings, review snippets with URLs, photo/video URLs)
- Relationships between restaurants and their data sources

## Implementation Stages

1. **API Research**: Verify data access from each adapter, document available features
2. **CLI Layer**: Basic command structure with no business logic
3. **Database**: Design schema and initialize SQLite on boot
4. **Adapters**: Build API integrations (look for existing Ruby gems/SDKs)
5. **Indexer**: Single-adapter indexing (error if multiple configured initially)
6. **Matcher**: Multi-adapter support with deduplication
7. **Search Command**: Query local DB by category or name
8. **Info Command**: Display formatted restaurant details from all sources

## Key Design Considerations

- **Local-first**: Data stored locally for fast queries, reducing API calls
- **BYOK (Bring Your Own Key)**: Users provide their own API keys
- **Selective indexing**: User indexes specific geographic areas as needed
- **Lightweight storage**: Store URLs to media, not the media itself
- **Flexible refresh**: Users can re-index areas as frequently as needed
