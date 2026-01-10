# Mock API Server

A local mock server that mimics both the Yelp Fusion API and Google Places API for development and testing without needing real API credentials.

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

The mock server is a Sinatra application that:
- Listens on `http://localhost:4567`
- Serves fixture data from `dev/fixtures/`
- Mimics both Yelp and Google API authentication
- Implements the same endpoints as the real APIs

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

| Name | Yelp Rating | Google Rating |
|------|-------------|---------------|
| Squares & Circles Craft Bakery | 4.5 | 4.6 |
| Flying Monkeys Craft Brewery | 4.0 | 4.2 |
| TJ's Restaurant & Sports Bar | 3.5 | 3.4 |
| Lakeside Sushi | 4.5 | 4.4 |
| Rustic Harvest Kitchen | 4.0 | 4.1 |
| Pho Saigon | 4.0 | 4.0 |
| Bella Notte Ristorante | 4.5 | 4.5 |
| North Coffee Co. | 4.5 | 4.7 |

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
