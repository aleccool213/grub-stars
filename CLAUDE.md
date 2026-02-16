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

# JavaScript tests (run via Playwright headless Chromium)
npm test
```

### Playwright Setup for JS Tests

JS tests run in a real browser via Playwright. Setup requires two steps that **must use the pinned version** in `package.json`:

```bash
npm install                              # install playwright npm package
npm run test:install                     # download Chromium binary (requires network)
```

**Common failure:** `npm test` fails with "Executable doesn't exist at .../chromium_headless_shell-XXXX". This means the Playwright npm package version doesn't match the installed Chromium binary. Fix:

```bash
# Check which Chromium revisions are already downloaded
ls ~/.cache/ms-playwright/

# If chromium-XXXX exists but playwright expects a different revision,
# the npm package version is wrong. Re-install to match:
npm install                    # re-install from package.json pin
npm run test:install           # re-download matching Chromium
```

**If `npm run test:install` fails** (no network / air-gapped environment), you must match the npm package to the pre-installed browser. Find the installed revision (`ls ~/.cache/ms-playwright/`) and install the corresponding playwright version. The mapping is roughly:

| Chromium revision | Playwright version |
|-------------------|--------------------|
| 1194              | ~1.54.0            |
| 1169              | ~1.52.0            |
| 1148              | ~1.50.0            |

```bash
npm install playwright@1.54.0   # example: match chromium-1194
npm test                         # should work without re-downloading
```

**Do not** commit `package.json` / `package-lock.json` changes from local playwright version adjustments unless intentional.

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
- `npm test` without `npm install` first - fails with "Cannot find module 'playwright'"
- `npm test` after `npm install` but without browser binary - fails with "Executable doesn't exist" (see Playwright Setup above)

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

**Adding new test files:** New `.test.js` files must be imported in `web/test.html` to be included in the test suite. Add an import line like `import './js/your-file.test.js';` in the `<script type="module">` block.

**Test pattern:** Module-scoped functions (not exported) are tested by recreating the rendering logic in the test file and asserting on DOM output. See `index-form.test.js` `simulateUpdateProgressUI` for an example.

## Further Documentation

- [docs/architecture.md](docs/architecture.md) - Detailed architecture and layer descriptions
- [docs/deployment.md](docs/deployment.md) - Docker, Fly.io deployment, production debugging
- [docs/sentry.md](docs/sentry.md) - Sentry error tracking setup
- [docs/pr-screenshots.md](docs/pr-screenshots.md) - Screenshot tooling for PRs
- [docs/browser-automation.md](docs/browser-automation.md) - Agent Browser for headless automation
- [docs/testing.md](docs/testing.md) - Testing strategy and patterns
- [docs/IMPROVEMENTS_BACKLOG.md](docs/IMPROVEMENTS_BACKLOG.md) - Feature ideas and backlog
- [docs/web-frontend.md](docs/web-frontend.md) - Web UI documentation
