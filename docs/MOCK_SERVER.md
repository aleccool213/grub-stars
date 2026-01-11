# Mock API Server

A local Sinatra-based mock server that mimics both the Yelp Fusion API and Google Places API for development and testing without needing real API credentials or making actual HTTP requests to external services.

## Why Use the Mock Server?

- **No API Keys Required** - Develop and test without registering for real API keys
- **No Rate Limits** - Make unlimited requests during development
- **Predictable Data** - Consistent fixture data for reliable testing
- **Fast Iteration** - No network latency, instant responses
- **Offline Development** - Work without internet connectivity
- **Matcher Testing** - Pre-configured data designed to test restaurant deduplication
- **Cost-Free** - No API usage charges during development

## Quick Start

1. **Start the mock server** (in a separate terminal):
   ```bash
   bundle exec ruby dev/mock_server.rb
   ```

2. **Configure `.env`** to use the mock server:
   ```bash
   YELP_API_KEY=mock_api_key
   YELP_API_BASE_URL=http://localhost:4567
   GOOGLE_API_KEY=mock_api_key
   GOOGLE_API_BASE_URL=http://localhost:4567
   ```

3. **Run CLI commands** as normal:
   ```bash
   ./bin/grst index --city "barrie, ontario"
   ./bin/grst search --category bakeries
   ./bin/grst info --name "Squares"
   ```

## How It Works

The mock server is a lightweight Sinatra application that:
- Listens on `http://localhost:4567` (configurable)
- Serves fixture data from `dev/fixtures/` (JSON files)
- Implements authentication validation (mimics real API behavior)
- Supports the same endpoints and response formats as real APIs
- Returns JSON responses matching the exact structure of Yelp and Google APIs

### Architecture Integration

In grub-stars' layered architecture, the mock server sits outside the application as a test fixture:

```
┌─────────────────────────────────────┐
│   grub-stars Application            │
│   ├── CLI                           │
│   ├── Services                      │
│   ├── Domain                        │
│   └── Infrastructure                │
│       └── Adapters (Yelp, Google)   │
│           ↓ HTTP requests           │
└─────────────────────────────────────┘
                ↓
┌───────────────────────────────────────┐
│   Mock Server (dev/mock_server.rb)   │
│   ↓ reads                            │
│   Fixtures (dev/fixtures/*.json)     │
└───────────────────────────────────────┘
```

**Key Points:**
- Adapters in `lib/infrastructure/adapters/` don't know if they're talking to the real API or mock server
- Base URL is configurable via environment variables (`YELP_API_BASE_URL`, `GOOGLE_API_BASE_URL`)
- Same code paths execute whether using mock or real APIs
- Perfect for integration tests that need full HTTP request/response cycles

### Endpoints

#### Yelp API

| Endpoint | Description |
|----------|-------------|
| `GET /businesses/search?location=...` | Search businesses by location |
| `GET /businesses/:id` | Get business details |
| `GET /businesses/:id/reviews` | Get business reviews |

#### Google Places API

| Endpoint | Description |
|----------|-------------|
| `GET /textsearch/json?query=...&key=...` | Text search for places |
| `GET /details/json?placeid=...&key=...` | Get place details |
| `GET /photo?photoreference=...&key=...` | Get place photo |

## Fixture Data

Sample data is stored in `dev/fixtures/`:

### Yelp Fixtures
- **`yelp_businesses.json`** - 8 sample restaurants in Barrie, Ontario
- **`yelp_reviews.json`** - Sample reviews for select businesses

### Google Fixtures
- **`google_businesses.json`** - 8 sample places in Barrie, Ontario
- **`google_details.json`** - Detailed place information
- **`google_reviews.json`** - Sample reviews for select places

### Sample Businesses

All fixture data is set in Barrie, Ontario for consistency.

| Name (Yelp) | Name (Google) | Yelp Rating | Google Rating | Category |
|-------------|---------------|-------------|---------------|----------|
| Squares & Circles Craft Bakery | Squares and Circles Bakery | 4.5 | 4.6 | Bakery |
| Flying Monkeys Craft Brewery | Flying Monkeys Brewery | 4.0 | 4.2 | Brewery |
| TJ's Restaurant & Sports Bar | TJs Sports Bar | 3.5 | 3.4 | Bar |
| Lakeside Sushi | Lakeside Sushi Bar | 4.5 | 4.4 | Japanese |
| Rustic Harvest Kitchen | Rustic Harvest | 4.0 | 4.1 | Restaurant |
| Pho Saigon | Pho Saigon Restaurant | 4.0 | 4.0 | Vietnamese |
| Bella Notte Ristorante | Bella Notte | 4.5 | 4.5 | Italian |
| North Coffee Co. | North Coffee Company | 4.5 | 4.7 | Cafe |

**Note:** Names are intentionally slightly different between sources to test the matcher's name similarity scoring.

## Testing the Matcher

The fixture data is designed to test the matcher functionality. Both Yelp and Google contain the same 8 restaurants with:
- Slightly different names (e.g., "Squares & Circles Craft Bakery" vs "Squares and Circles Bakery")
- Different ratings
- GPS coordinates within meters of each other

When indexing with both adapters, the matcher should merge these into 8 unique restaurants, each with ratings from both sources.

## Adding More Data

To add more businesses or reviews, edit the JSON files in `dev/fixtures/`:

1. Add businesses to `yelp_businesses.json` and `google_businesses.json`
2. Add reviews to `yelp_reviews.json` and `google_reviews.json`
3. Add place details to `google_details.json`

## Switching to Real APIs

To use the real APIs:

1. Get API keys:
   - Yelp: [Yelp Developers](https://www.yelp.com/developers/v3/manage_app)
   - Google: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

2. Update your `.env`:
   ```bash
   YELP_API_KEY=your_real_yelp_key
   GOOGLE_API_KEY=your_real_google_key
   # Comment out or remove:
   # YELP_API_BASE_URL=http://localhost:4567
   # GOOGLE_API_BASE_URL=http://localhost:4567
   ```

## Troubleshooting

### "Connection refused" error
Make sure the mock server is running in a separate terminal.

### "UNAUTHORIZED" error (Yelp)
The mock server validates the `Authorization` header. Make sure `YELP_API_KEY` is set (any non-empty value works with the mock).

### "REQUEST_DENIED" error (Google)
The mock server validates the `key` query parameter. Make sure `GOOGLE_API_KEY` is set.

### Changes not reflected
Restart the mock server after modifying fixture files.

## Implementation Details

### Server Structure

The mock server (`dev/mock_server.rb`) consists of:

1. **Fixture Loading** - Loads JSON files from `dev/fixtures/` at startup
2. **Lookup Hashes** - Builds in-memory indexes for fast business/place lookups by ID
3. **Authentication Middleware** - Validates API keys/tokens before processing requests
4. **Route Handlers** - Implements each API endpoint with proper error handling
5. **Response Formatting** - Returns JSON matching real API response structures

### Supported Features

#### Yelp API Emulation
- ✅ Business search with location and category filtering
- ✅ Business details by ID
- ✅ Review retrieval
- ✅ Bearer token authentication
- ✅ Pagination (offset/limit)
- ✅ Error responses (401, 404, 400)

#### Google Places API Emulation
- ✅ Text search with query filtering
- ✅ Place details by place_id
- ✅ Review retrieval via fields parameter
- ✅ API key validation
- ✅ Photo reference redirects
- ✅ Error responses (REQUEST_DENIED, NOT_FOUND, INVALID_REQUEST)

### Fixture File Format

#### Yelp Format (`yelp_businesses.json`)
```json
{
  "businesses": [
    {
      "id": "squares-and-circles-barrie",
      "name": "Squares & Circles Craft Bakery",
      "rating": 4.5,
      "review_count": 142,
      "coordinates": {
        "latitude": 44.3894,
        "longitude": -79.6903
      },
      "categories": [
        { "alias": "bakeries", "title": "Bakeries" }
      ],
      "phone": "+17057285555",
      "location": { ... },
      "photos": [ ... ]
    }
  ],
  "total": 8,
  "region": { ... }
}
```

#### Google Format (`google_businesses.json`)
```json
{
  "results": [
    {
      "place_id": "ChIJ...",
      "name": "Squares and Circles Bakery",
      "rating": 4.6,
      "user_ratings_total": 156,
      "geometry": {
        "location": {
          "lat": 44.3895,
          "lng": -79.6904
        }
      },
      "types": ["bakery", "cafe", "food"],
      "formatted_address": "...",
      "photos": [ ... ]
    }
  ],
  "status": "OK"
}
```

## Use Cases

### 1. Local Development
Start the mock server to develop new features without real API keys:
```bash
bundle exec ruby dev/mock_server.rb
```

### 2. Integration Testing
Integration tests can use the mock server for full HTTP request/response testing:
```ruby
class IndexTest < GrubStars::IntegrationTest
  def test_indexing_with_multiple_adapters
    # Mock server already configured via test environment
    service = Services::IndexRestaurantsService.new
    stats = service.index(location: "Barrie, ON")

    assert_equal 8, stats[:total]  # From fixture data
  end
end
```

### 3. Matcher Validation
Test restaurant deduplication with controlled data:
```bash
# Both adapters configured to use mock server
./bin/grst index --city "barrie, ontario"

# Should index 8 unique restaurants (not 16)
# Each restaurant should have ratings from both Yelp and Google
```

### 4. Demo Mode
Show the application to stakeholders without API costs:
```bash
# Start mock server
bundle exec ruby dev/mock_server.rb

# Demo all commands
./bin/grst index --city "barrie, ontario"
./bin/grst search --category bakeries
./bin/grst info --name "Squares"
```

## Extending the Mock Server

### Adding New Restaurants

1. Edit `dev/fixtures/yelp_businesses.json`:
   ```json
   {
     "businesses": [
       // ... existing businesses
       {
         "id": "new-restaurant-id",
         "name": "New Restaurant",
         // ... other fields
       }
     ]
   }
   ```

2. Edit `dev/fixtures/google_businesses.json`:
   ```json
   {
     "results": [
       // ... existing places
       {
         "place_id": "ChIJnew...",
         "name": "New Restaurant",
         // ... other fields matching Yelp data
       }
     ]
   }
   ```

3. Restart the mock server

### Adding Reviews

Edit `dev/fixtures/yelp_reviews.json` or `google_reviews.json`:
```json
{
  "business-id-or-place-id": {
    "reviews": [
      {
        "rating": 5,
        "text": "Great food!",
        "time_created": "2024-01-15 12:00:00"
      }
    ],
    "total": 1
  }
}
```

## Testing Strategy

The mock server supports multiple testing approaches:

### Unit Tests
Use mocked HTTP clients - don't need the mock server:
```ruby
class YelpAdapterTest < Minitest::Test
  def test_search
    mock_http = Minitest::Mock.new
    # ... mock response
  end
end
```

### Integration Tests
Use real HTTP with mock server:
```ruby
class CLITest < GrubStars::IntegrationTest
  # Mock server running on localhost:4567
  # Configured via test environment

  def test_full_indexing_workflow
    # Makes real HTTP requests to mock server
    # Tests full stack: CLI → Services → Repositories → Adapters → HTTP
  end
end
```

### Manual Testing
Run mock server in terminal, use CLI interactively:
```bash
# Terminal 1
bundle exec ruby dev/mock_server.rb

# Terminal 2
./bin/grst index --city "barrie, ontario"
./bin/grst search --name "pizza"
```

## Comparison: Mock Server vs Unit Test Mocks

| Aspect | Mock Server | Unit Test Mocks |
|--------|-------------|-----------------|
| **HTTP requests** | Real HTTP calls to localhost | No HTTP, mocked in memory |
| **Speed** | Slower (HTTP overhead) | Faster (no I/O) |
| **Realism** | High (full request/response cycle) | Low (mocked responses) |
| **Setup complexity** | Need to start server | Simple mock objects |
| **Use case** | Integration tests, manual testing | Unit tests, fast feedback |
| **Data consistency** | Shared fixtures across tests | Per-test data setup |

**Recommendation:** Use both! Unit tests with mocks for fast feedback, integration tests with mock server for confidence.
