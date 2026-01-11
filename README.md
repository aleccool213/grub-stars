```
   ____            _         ____  _
  / ___|_ __ _   _| |__     / ___|| |_ __ _ _ __ ___
 | |  _| '__| | | | '_ \    \___ \| __/ _` | '__/ __|
 | |_| | |  | |_| | |_) |    ___) | || (_| | |  \__ \
  \____|_|   \__,_|_.__/    |____/ \__\__,_|_|  |___/

```

<div align="center">

### 🍽️ Your All-in-One Restaurant Intelligence Tool 🍽️

[![Ruby](https://img.shields.io/badge/Ruby-3.0+-red.svg)](https://www.ruby-lang.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

A command-line restaurant reviews aggregator that brings together ratings, reviews, photos, and videos from multiple sources into a single, fast, local database.

## Why grub-stars?

Stop switching between Yelp, Google Maps, TripAdvisor, Instagram, and TikTok to research restaurants. **grub-stars** indexes your area once, then lets you search locally without repeated API calls.

**Key Features:**
- 🏪 **Multi-source aggregation** - Combine data from Yelp, Google Maps, TripAdvisor, Instagram, and TikTok
- 🚀 **Fast local search** - Index once, search instantly from SQLite
- 🔑 **BYOK (Bring Your Own Key)** - Use your own API keys
- 📍 **Geographic indexing** - Index specific areas as needed
- 🔗 **Lightweight storage** - Store URLs to media, not the files themselves
- 🔄 **Smart deduplication** - Automatically merges the same restaurant from different sources

## Quick Start

### Installation

```bash
git clone https://github.com/aleccool213/grub-stars.git
cd grub-stars
bundle install
```

### Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Add your API keys to `.env`:
   ```
   YELP_API_KEY=your_yelp_key_here
   GOOGLE_API_KEY=your_google_key_here
   TRIPADVISOR_API_KEY=your_tripadvisor_key_here
   ```

   Configure at least one adapter to get started.

### Usage

**Index an area:**
```bash
./bin/grst index --city "barrie, ontario"                    # Index all restaurants
./bin/grst index --city "barrie, ontario" --category bakery  # Index only bakeries
```

**Search for restaurants:**
```bash
./bin/grst search --category bakery
./bin/grst search --name "corner cafe"
```

**View detailed info:**
```bash
./bin/grst info --name "squares and circles"
```

**List categories:**
```bash
./bin/grst categories
```

## Architecture

grub-stars uses a **clean layered architecture** that separates concerns and makes the codebase testable and extensible:

```
┌─────────────────────────────┐
│   Presentation (CLI)        │  User interaction
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│   Services                  │  Business operations
└──────┬─────────────┬────────┘
       │             │
┌──────▼─────┐  ┌───▼──────────┐
│   Domain   │  │Infrastructure│
│   Models   │  │ Repositories │
│   Matcher  │  │ Adapters     │
└────────────┘  │ Database     │
                └──────────────┘
```

**Layers:**
- **Presentation** (`lib/cli.rb`) - Thor CLI commands
- **Services** (`lib/services/`) - Use cases like indexing, searching, getting details
- **Domain** (`lib/domain/`) - Pure business logic and models (Restaurant, Rating, Review, etc.)
- **Infrastructure** (`lib/infrastructure/`) - Repositories, database, and external API adapters

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed design documentation.

## Data Sources

### Implemented
- ✅ **Yelp** - Ratings, reviews, photos
- ✅ **Google Maps** - Ratings, reviews (up to 5), photos
- ✅ **TripAdvisor** - Ratings, reviews, photos

### Planned
- 🚧 **Instagram** - Photos and videos only
- 🚧 **TikTok** - Videos only

## Development

### Running Tests

```bash
bundle exec rake test              # Run all tests
bundle exec rake test:integration  # Run integration tests only
bundle exec rake test:unit         # Run unit tests only
```

### Project Structure

```
lib/
├── domain/          # Pure business logic (zero dependencies)
├── infrastructure/  # Database, repositories, adapters
├── services/        # Application use cases
└── cli.rb          # User interface

tests/
├── unit/           # Fast tests with mocks
└── integration/    # Full-stack tests
```

### Tech Stack

- **Ruby** - Core language
- **Thor** - CLI framework
- **Sequel** - Database ORM
- **SQLite3** - Local database
- **Faraday** - HTTP client for adapters
- **dotenv** - Environment management

## Getting API Keys

- **Yelp**: https://www.yelp.com/developers/v3/manage_app
- **Google Places**: https://console.cloud.google.com/apis/credentials
- **TripAdvisor**: https://www.tripadvisor.com/developers

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed architecture and design patterns
- [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md) - Recent refactoring to layered architecture
- [CLAUDE.md](CLAUDE.md) - Project guidance for Claude Code
- [docs/testing.md](docs/testing.md) - Testing guide
- [docs/user-guide.md](docs/user-guide.md) - Detailed user guide
- [docs/cli.md](docs/cli.md) - CLI architecture details

## How It Works

### 1. Indexing
When you run `grst index --city "barrie, ontario"`, grub-stars:
1. Queries all configured adapters (Yelp, Google Maps, etc.) for restaurants in the area
2. Uses a **matcher** with confidence scoring to identify duplicate restaurants across sources
3. Stores everything in a local SQLite database

You can optionally filter by category during indexing:
- `grst index --city "barrie, ontario" --category bakery` - only indexes bakeries
- This allows for targeted data collection and multiple indexing passes with different categories

### 2. Deduplication
The matcher prevents duplicates by scoring similarity:
- Name similarity: ~30 points
- Address match: points based on similarity
- GPS proximity: points based on distance
- Phone number match: additional points

Restaurants scoring >50 are considered the same and merged.

### 3. Searching
All searches happen locally against SQLite, so they're instant. No API calls required after indexing.

## Design Principles

- **Local-first**: Fast queries without repeated API calls
- **Selective indexing**: Index only areas you care about, optionally filtered by category
- **Flexible refresh**: Re-index anytime to get fresh data
- **Bring Your Own Key**: You control your API usage and costs
- **Lightweight**: Store media URLs, not files

## Contributing

This is a personal project, but contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Future Plans

- Add web UI using the same service layer
- Build REST API for programmatic access
- Add caching layer for API responses
- Support for additional data sources
- Export functionality (CSV, JSON)
- Restaurant comparison features

---

**Built with ❤️ using Ruby and clean architecture principles**
