# Testing

## Running Tests

```bash
bundle exec rake test              # Run all tests
bundle exec rake test:integration  # Run only integration tests
```

## Test Structure

```
tests/
├── test_helper.rb       # Shared setup, database helpers
└── integration/         # Integration tests
    └── cli_test.rb      # CLI command tests
```

## Integration Tests

Integration tests inherit from `GrubStars::IntegrationTest`, which:

1. Creates a fresh SQLite database at `tmp/test.db` before each test
2. Applies the full schema
3. Deletes the database after each test

```ruby
class MyTest < GrubStars::IntegrationTest
  def test_something
    # @db is a Sequel database connection
    @db[:restaurants].insert(name: "Test", external_id: "123", created_at: Time.now)
    assert_equal 1, @db[:restaurants].count
  end
end
```

## Database Schema

Schema is defined in `lib/grub_stars/database.rb`. Tables:

- `restaurants` - Core restaurant data (name, address, coordinates)
- `categories` - Category tags (bakery, cafe, etc.)
- `restaurant_categories` - Join table
- `ratings` - Scores from each source (yelp, google, tripadvisor)
- `reviews` - Review snippets with URLs
- `media` - Photo/video URLs

## Adding Tests

1. Create a file in `tests/integration/` ending in `_test.rb`
2. Require `test_helper`
3. Inherit from `GrubStars::IntegrationTest`
4. Use `@db` to interact with the database
