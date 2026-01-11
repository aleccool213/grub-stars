# Testing

## Running Tests

```bash
bundle exec rake test              # Run all tests
bundle exec rake test:integration  # Run integration tests only
bundle exec rake test:unit         # Run unit tests only
```

## Test Structure

The test suite is organized into **unit tests** (fast, isolated, with mocks) and **integration tests** (full-stack, with real database):

```
tests/
├── test_helper.rb                      # Shared setup, database helpers
├── unit/                               # Unit tests (fast, isolated)
│   ├── domain/
│   │   ├── restaurant_test.rb          # Domain model tests
│   │   └── matcher_test.rb             # Pure matcher logic tests
│   ├── repositories/
│   │   └── restaurant_repository_test.rb  # Data access tests
│   ├── services/
│   │   ├── index_restaurants_service_test.rb
│   │   ├── search_restaurants_service_test.rb
│   │   └── restaurant_details_service_test.rb
│   └── adapters/
│       ├── yelp_test.rb                # Adapter tests (mocked HTTP)
│       └── google_test.rb
└── integration/                        # Integration tests (full-stack)
    ├── cli_test.rb                     # CLI command tests
    └── index_test.rb                   # Indexing workflow tests
```

## Unit Tests

Unit tests are **fast and isolated**. They use mocks and don't touch the database or make real HTTP calls.

### Domain Tests

Test pure business logic with zero dependencies:

```ruby
class RestaurantTest < Minitest::Test
  def test_distance_calculation
    restaurant1 = Domain::Models::Restaurant.new(
      latitude: 44.3894,
      longitude: -79.6903
    )
    restaurant2 = Domain::Models::Restaurant.new(
      latitude: 44.3900,
      longitude: -79.6910
    )

    distance = restaurant1.distance_to(restaurant2)
    assert distance < 0.1  # Less than 0.1 km
  end
end
```

### Service Tests

Test business operations with mocked dependencies:

```ruby
class SearchRestaurantsServiceTest < Minitest::Test
  def test_search_by_name
    # Create mock repository
    mock_repo = Minitest::Mock.new
    mock_repo.expect(:search_by_name, [mock_restaurant], ["pizza"])

    # Test service
    service = Services::SearchRestaurantsService.new(
      restaurant_repo: mock_repo
    )
    results = service.search_by_name("pizza")

    assert_equal 1, results.count
    mock_repo.verify
  end
end
```

### Repository Tests

Test data access with an in-memory test database:

```ruby
class RestaurantRepositoryTest < GrubStars::IntegrationTest
  def test_find_by_id
    # Setup test data
    restaurant_id = @db[:restaurants].insert(
      name: "Test Restaurant",
      latitude: 44.3894,
      longitude: -79.6903,
      created_at: Time.now
    )

    # Test repository
    repo = Infrastructure::Repositories::RestaurantRepository.new(@db)
    restaurant = repo.find_by_id(restaurant_id)

    assert_equal "Test Restaurant", restaurant.name
    assert_instance_of Domain::Models::Restaurant, restaurant
  end
end
```

### Adapter Tests

Test external API integrations with mocked HTTP responses:

```ruby
class YelpAdapterTest < Minitest::Test
  def test_search_businesses
    # Mock HTTP client
    mock_http = Minitest::Mock.new
    mock_http.expect(:get, mock_response, [String, Hash])

    adapter = Infrastructure::Adapters::Yelp.new(http_client: mock_http)
    results = adapter.search_businesses(location: "Barrie, ON")

    assert_equal 3, results.count
    mock_http.verify
  end
end
```

## Integration Tests

Integration tests use **real components** including database, services, and repositories. They test the full stack end-to-end.

### Base Class

Integration tests inherit from `GrubStars::IntegrationTest`, which:

1. Creates a fresh SQLite database at `tmp/test.db` before each test
2. Applies the full schema
3. Deletes the database after each test

```ruby
class MyIntegrationTest < GrubStars::IntegrationTest
  def test_full_workflow
    # @db is a Sequel database connection with full schema
    service = Services::IndexRestaurantsService.new
    stats = service.index(location: "Barrie, ON", adapters: [mock_adapter])

    assert stats[:total] > 0
  end
end
```

### CLI Tests

Test Thor CLI commands:

```ruby
class CLITest < GrubStars::IntegrationTest
  def test_search_command
    # Setup test data
    setup_test_restaurants

    # Run CLI command
    cli = GrubStars::CLI.new
    output = capture_io { cli.search(name: "pizza") }.join

    assert_match /Pizza Place/, output
  end
end
```

## Database Schema

Schema is defined in `lib/infrastructure/database.rb`. Tables:

- `restaurants` - Core restaurant data (name, address, coordinates)
- `categories` - Category tags (bakery, cafe, etc.)
- `restaurant_categories` - Join table linking restaurants to categories
- `ratings` - Scores from each source (yelp, google, tripadvisor)
- `reviews` - Review snippets with URLs
- `media` - Photo/video URLs
- `external_ids` - Links restaurants to their IDs in external systems

## Writing Tests

### Adding Unit Tests

1. Create a file in `tests/unit/<layer>/` ending in `_test.rb`
2. Require `test_helper`
3. Use mocks/stubs for dependencies
4. Test one component in isolation
5. Keep tests fast (no I/O)

### Adding Integration Tests

1. Create a file in `tests/integration/` ending in `_test.rb`
2. Require `test_helper`
3. Inherit from `GrubStars::IntegrationTest`
4. Use `@db` to interact with the database
5. Test complete workflows

## Test Philosophy

**Unit Tests:**
- Fast (milliseconds)
- Isolated (no database, no HTTP)
- Test single units (one class/method)
- Use mocks for dependencies
- High coverage of business logic

**Integration Tests:**
- Slower (seconds)
- Use real components
- Test workflows and interactions
- Verify system works end-to-end
- Cover happy paths and critical flows

## Running Specific Tests

```bash
# Run a specific file
bundle exec ruby tests/unit/domain/restaurant_test.rb

# Run a specific test
bundle exec ruby tests/unit/domain/restaurant_test.rb -n test_distance_calculation

# Run all unit tests
bundle exec rake test:unit

# Run all integration tests
bundle exec rake test:integration

# Run all tests
bundle exec rake test
```
