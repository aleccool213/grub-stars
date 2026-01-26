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

A restaurant reviews aggregator that brings together ratings, reviews, photos, and videos from multiple sources into a single, fast, local database. Access your aggregated data through a modern web UI, REST API, or command-line interface.

## Why grub-stars?

Stop switching between Yelp, Google Maps, TripAdvisor, Instagram, and TikTok to research restaurants. **grub-stars** indexes your area once, then lets you search locally without repeated API calls.

**Key Features:**
- 🏪 **Multi-source aggregation** - Combine data from Yelp, Google Maps, TripAdvisor, Instagram, and TikTok
- 🚀 **Fast local search** - Index once, search instantly from SQLite
- 🔑 **BYOK (Bring Your Own Key)** - Use your own API keys
- 📍 **Geographic indexing** - Index specific areas as needed
- 🔗 **Lightweight storage** - Store URLs to media, not the files themselves
- 🔄 **Smart deduplication** - Automatically merges the same restaurant from different sources

## Live Demo

**Try it now:** [https://grub-stars-test.fly.dev](https://grub-stars-test.fly.dev)

The test environment runs with a mock server that simulates responses from Yelp, Google Maps, and TripAdvisor. You can explore the full functionality without needing any API keys.

**Demo data available for:**
- Location: "Barrie, Ontario"
- Various restaurant categories (bakeries, cafes, etc.)

**Features to try:**
- 🔍 Search for restaurants by name or category
- 📍 Index the demo location to populate the database
- 🏷️ Browse restaurants by categories
- 📱 View detailed restaurant information with photos and reviews

The demo resets periodically, so feel free to experiment!

## Quick Start

### Installation

```bash
git clone https://github.com/aleccool213/grub-stars.git
cd grub-stars
gem install bundler -v 2.5.23
bundle _2.5.23_ install
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

### Running the Web Server

Start the web server to access the web UI and REST API:

```bash
bundle _2.5.23_ exec rackup
```

Then open your browser to `http://localhost:9292`

**Web UI Features:**
- 🔍 Search restaurants by name or category
- 📍 Index new geographic areas
- 🏷️ Browse by categories
- 📱 Responsive design for desktop and mobile

### Using the CLI (Optional)

If you prefer the command-line interface:

```bash
ruby -I lib bin/grst index --location "barrie, ontario"                    # Index all restaurants
ruby -I lib bin/grst index --location "barrie, ontario" --category bakery  # Index only bakeries
ruby -I lib bin/grst search --category bakery                              # Search locally
ruby -I lib bin/grst info --name "restaurant name"                         # Get detailed info
```

## Architecture

grub-stars uses a **clean layered architecture** that separates concerns and makes the codebase testable and extensible:

```
┌──────────────────────────────────────────────────────┐
│            Presentation Layer                        │
│  ┌─────────────────────┐  ┌──────────────────────┐   │
│  │   Web UI            │  │   REST API           │   │
│  │   (Browser)         │  │   (lib/api/server.rb)│   │
│  └─────────────────────┘  └──────────────────────┘   │
│                                                      │
│  CLI (optional)                                      │
│  (lib/cli.rb)                                        │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│   Services (lib/services/)                           │
│   Business operations & use cases                    │
└──────┬──────────────────────────────┬────────────────┘
       │                              │
┌──────▼──────────────┐    ┌─────────▼───────────────┐
│   Domain            │    │  Infrastructure         │
│   Pure logic        │    │  Repositories           │
│   Models            │    │  Database (SQLite)      │
│   Matcher           │    │  External API Adapters  │
└─────────────────────┘    └─────────────────────────┘
```

**Layers:**
- **Presentation** - Web UI (vanilla JavaScript), REST API (Sinatra), and CLI (Thor) - all thin wrappers that delegate to services
- **Services** (`lib/services/`) - Use cases: indexing, searching, getting details, listing categories
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

**Ruby tests (CLI, API, domain logic):**
```bash
ruby -I lib $(bundle _2.5.23_ show rake)/exe/rake test              # Run all tests
ruby -I lib $(bundle _2.5.23_ show rake)/exe/rake test:integration  # Run integration tests only
ruby -I lib $(bundle _2.5.23_ show rake)/exe/rake test:unit         # Run unit tests only
```

**JavaScript tests (Web UI):**
```bash
npm test                           # Run all JS tests
npm run test:install               # Install Playwright (first time only)
```

### Project Structure

```
lib/
├── domain/          # Pure business logic (zero dependencies)
├── infrastructure/  # Database, repositories, adapters
├── services/        # Application use cases
├── api/             # REST API (Sinatra)
└── cli.rb           # CLI interface (Thor)

web/                 # Web UI (vanilla JavaScript + HTML)
├── index.html       # Search page
├── details.html     # Restaurant details
├── index-location.html  # Indexing page
├── js/              # JavaScript components and tests
└── css/             # Styles

tests/
├── unit/           # Fast tests with mocks
└── integration/    # Full-stack tests
```

### Tech Stack

**Backend:**
- **Ruby** - Core language
- **Sinatra** - REST API framework
- **Thor** - CLI framework
- **Sequel** - Database ORM
- **SQLite3** - Local database
- **Faraday** - HTTP client for adapters
- **dotenv** - Environment management

**Frontend:**
- **Vanilla JavaScript** - No framework dependencies
- **HTML5 & CSS3** - Modern web standards
- **Playwright** - Headless testing

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
When you index a location (via Web UI or CLI), grub-stars:
1. Queries all configured adapters (Yelp, Google Maps, etc.) for restaurants in the area
2. Uses a **matcher** with confidence scoring to identify duplicate restaurants across sources
3. Stores everything in a local SQLite database

You can optionally filter by category during indexing to focus on specific restaurant types.

### 2. Deduplication
The matcher prevents duplicates by scoring similarity:
- Name similarity: ~30 points
- Address match: points based on similarity
- GPS proximity: points based on distance
- Phone number match: additional points

Restaurants scoring >50 are considered the same and their data is merged.

### 3. Searching
All searches happen locally against SQLite through the Web UI, REST API, or CLI, so they're instant. No API calls required after indexing.

## REST API

The REST API provides programmatic access to all functionality:

```bash
# Start the server
bundle _2.5.23_ exec rackup -p 3000
```

### Available Endpoints

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

For detailed API examples and integration guides, see [docs/api.md](docs/api.md).

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

- Add Instagram adapter (photos/videos only)
- Add TikTok adapter (videos only)
- Add caching layer for API responses
- Export functionality (CSV, JSON)
- Restaurant comparison features
- Mobile app for native iOS/Android access

---

**Built with ❤️ using Ruby and clean architecture principles**
