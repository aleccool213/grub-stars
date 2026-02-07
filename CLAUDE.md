# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**grub stars** aggregates restaurant information (reviews, photos, videos, ratings) from multiple sources into a local SQLite database. Users index a geographic area once, then perform fast local searches without hitting multiple APIs repeatedly.

Interfaces: **CLI** (`grst`), **REST API** (Sinatra), **Web UI** (vanilla JS).

## Tech Stack

Ruby, Thor (CLI), Sinatra (API), Sequel + sqlite3 (DB), Faraday (HTTP), dotenv, Twind (CSS-in-JS), Playwright (JS tests).

## Development

### Setup

Requires **Ruby 4.0+** and **Bundler 2.5.23** (Bundler 4.0.3+ has CGI bugs).

```bash
gem install bundler -v 2.5.23
bundle _2.5.23_ install
```

### Running Tests

```bash
# Ruby tests (ALWAYS run before pushing Ruby changes)
ruby -I lib $(bundle _2.5.23_ show rake)/exe/rake test
ruby -I lib $(bundle _2.5.23_ show rake)/exe/rake TEST=tests/integration/cli_test.rb  # specific file

# JavaScript tests
npm test
npm run test:install  # first time only - install Playwright browsers
```

### Running the App

```bash
ruby -I lib bin/grst --help                    # CLI
bundle _2.5.23_ exec rackup                    # API server (port 9292)
```

### Commands That DO NOT Work

- `./bin/rake test` - binstubs may not exist
- `bundle exec rake test` - fails with "command not found: rake"
- `bundle _2.5.23_ exec rake test` - may fail if bundler not properly installed
- `bundle install` without version specifier - uses Bundler 4.0.3+ which has CGI bugs

## Configuration

```bash
cp .env.example .env
```

Environment variables: `YELP_API_KEY`, `GOOGLE_API_KEY`, `TRIPADVISOR_API_KEY`, `SENTRY_DSN`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/categories` | GET | List all categories |
| `/locations` | GET | List all indexed locations |
| `/restaurants/search?name=X` | GET | Search by name |
| `/restaurants/search?category=X` | GET | Search by category |
| `/restaurants/:id` | GET | Get restaurant details |
| `/index` | POST | Index restaurants (`{"location": "city", "category": "optional"}`) |

Response format: `{ "data": <result>, "meta": { "timestamp": "...", "count": 10 } }`

## Code Structure

```
lib/
├── grub_stars.rb              # Main entry
├── cli.rb                     # CLI (Thor)
├── api/server.rb              # REST API (Sinatra)
├── config.rb                  # Configuration
├── domain/                    # Pure business logic (models, matcher)
├── infrastructure/            # DB, adapters (yelp/google/tripadvisor), repositories
└── services/                  # Use cases (index, search, details, categories)

tests/
├── integration/               # CLI, API, index tests
└── unit/                      # Adapters, domain, repositories, services

web/                           # Web UI (vanilla JS)
├── js/api.js                  # REST API client
├── js/search.js               # Search page controller
├── js/components/             # UI components
└── css/custom.css             # Custom styles

dev/
├── mock_server.rb             # Mock API server for testing
└── fixtures/                  # Mock data
```

See [docs/architecture.md](docs/architecture.md) for detailed layer descriptions.

## Critical Gotchas

### Twind Class Name Hashing

Twind hashes CSS class names at runtime. `class="hidden"` becomes `class="#zkrgdo"` in the DOM.

**You cannot use `classList.toggle('hidden')`** - use inline styles instead:
```javascript
element.style.display = isVisible ? 'block' : 'none';
```

### Dark Mode CSS

Twind hashing means CSS selectors like `.bg-white` won't match DOM elements. Target elements by container ID and structure instead:
```css
html.dark #restaurant-details article { background-color: #1e293b !important; }
html.dark #search-results article { background-color: #1e293b !important; }
```

### Database Location

SQLite database is at `~/.grub_stars/grub_stars.db` (not in the project directory). Configurable via `GRUB_STARS_CONFIG_DIR` env var or `--db_path` CLI option.

### Frontend API Base URL

The JS API client (`web/js/api.js`) expects the backend on port 9292. Starting the server on a different port causes connection errors.

### Sentry + Ruby 4.0

Logger was moved out of stdlib in Ruby 4.0. The `config.ru` requires `logger` before loading Sentry. See [docs/sentry.md](docs/sentry.md) for details.

### Photo Indexing

Yelp/Google search endpoints don't return photos - only their business details endpoints do. The `IndexRestaurantsService` calls `get_business()` for each result to fetch photos. Mock fixtures may not reflect this accurately.

## JS Test Framework

The custom test framework (`web/js/test-framework.js`) provides:
- **Assertions:** `assert`, `assertEqual`, `assertTruthy`, `assertFalsy`, `assertIncludes`, `assertThrows`
- **DOM Interaction:** `click`, `dblclick`, `submit`, `type`, `clear`, `select`, `keyPress`, `focus`, `blur`
- **Async:** `waitFor`, `waitForElement`, `waitForText`
- **Isolation:** `createContainer`, `destroyContainer`
- **Mocking:** `createMockFn`

## Further Documentation

- [docs/architecture.md](docs/architecture.md) - Detailed architecture and layer descriptions
- [docs/deployment.md](docs/deployment.md) - Docker, Fly.io deployment, production debugging
- [docs/sentry.md](docs/sentry.md) - Sentry error tracking setup
- [docs/pr-screenshots.md](docs/pr-screenshots.md) - Screenshot tooling for PRs
- [docs/browser-automation.md](docs/browser-automation.md) - Agent Browser for headless automation
- [docs/testing.md](docs/testing.md) - Testing strategy and patterns
- [docs/IMPROVEMENTS_BACKLOG.md](docs/IMPROVEMENTS_BACKLOG.md) - Feature ideas and backlog
- [docs/web-frontend.md](docs/web-frontend.md) - Web UI documentation
