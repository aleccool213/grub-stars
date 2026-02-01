# frozen_string_literal: true

require_relative "../test_helper"
require "rack/test"
require_relative "../../lib/api/server"

class StatsAPITest < GrubStars::IntegrationTest
  include Rack::Test::Methods

  def app
    GrubStars::API::Server
  end

  def setup
    super
    @original_db_path = GrubStars::Config.get("db_path")
    GrubStars::Config.set("db_path", GrubStars::TestHelper::TEST_DB_PATH)
    GrubStars.reset_db!
  end

  def teardown
    if @original_db_path
      GrubStars::Config.set("db_path", @original_db_path)
    end
    GrubStars.reset_db!
    super
  end

  # Stats endpoint tests
  def test_stats_returns_empty_data_for_empty_database
    get "/stats"

    assert last_response.ok?
    body = JSON.parse(last_response.body)

    # Verify structure
    assert body["data"]["restaurants"]
    assert body["data"]["provider_coverage"]
    assert body["data"]["api_usage"]
    assert body["data"]["locations"]
    assert body["meta"]["timestamp"]

    # Verify empty values
    assert_equal 0, body["data"]["restaurants"]["total"]
    assert_equal 0, body["data"]["restaurants"]["with_photos"]
    assert_equal 0, body["data"]["restaurants"]["with_reviews"]
    assert_equal 0, body["data"]["restaurants"]["with_ratings"]
    assert_equal 0, body["data"]["restaurants"]["with_external_ids"]
    assert_equal 0, body["data"]["restaurants"]["single_source_only"]
    assert_equal 0, body["data"]["restaurants"]["multi_source"]
    assert_equal [], body["data"]["locations"]
    assert_equal({}, body["data"]["provider_coverage"])
  end

  def test_stats_returns_correct_restaurant_counts
    seed_restaurant_with_full_data

    get "/stats"

    assert last_response.ok?
    body = JSON.parse(last_response.body)

    assert_equal 1, body["data"]["restaurants"]["total"]
    assert_equal 1, body["data"]["restaurants"]["with_photos"]
    assert_equal 1, body["data"]["restaurants"]["with_reviews"]
    assert_equal 1, body["data"]["restaurants"]["with_ratings"]
    assert_equal 1, body["data"]["restaurants"]["with_external_ids"]
  end

  def test_stats_returns_provider_coverage
    seed_restaurant_with_multiple_sources

    get "/stats"

    assert last_response.ok?
    body = JSON.parse(last_response.body)

    coverage = body["data"]["provider_coverage"]
    assert_equal 1, coverage["yelp"]
    assert_equal 1, coverage["google"]
    assert_equal 1, coverage["tripadvisor"]
  end

  def test_stats_returns_single_and_multi_source_counts
    # Create restaurant with single source
    seed_restaurant_with_source("yelp")
    
    # Create restaurant with multiple sources
    seed_restaurant_with_multiple_sources(name: "Multi Source Restaurant")

    get "/stats"

    assert last_response.ok?
    body = JSON.parse(last_response.body)

    assert_equal 2, body["data"]["restaurants"]["total"]
    assert_equal 2, body["data"]["restaurants"]["with_external_ids"]
    assert_equal 1, body["data"]["restaurants"]["single_source_only"]
    assert_equal 1, body["data"]["restaurants"]["multi_source"]
  end

  def test_stats_returns_api_usage_for_configured_adapters
    # Track some API requests
    api_repo = Infrastructure::Repositories::ApiRequestRepository.new
    api_repo.increment("yelp", 100)
    api_repo.increment("google", 50)

    get "/stats"

    assert last_response.ok?
    body = JSON.parse(last_response.body)

    api_usage = body["data"]["api_usage"]
    assert_equal 3, api_usage.length

    yelp_stats = api_usage.find { |a| a["name"] == "yelp" }
    google_stats = api_usage.find { |a| a["name"] == "google" }
    tripadvisor_stats = api_usage.find { |a| a["name"] == "tripadvisor" }

    assert yelp_stats
    assert google_stats
    assert tripadvisor_stats

    # Verify Yelp stats (100 requests, limit 5000)
    assert_equal 100, yelp_stats["request_count"]
    assert_equal 5000, yelp_stats["request_limit"]
    assert_equal 4900, yelp_stats["remaining"]
    assert_equal 2.0, yelp_stats["usage_percent"]
    assert_equal false, yelp_stats["configured"]  # No API key in test

    # Verify Google stats (50 requests, limit 10000)
    assert_equal 50, google_stats["request_count"]
    assert_equal 10000, google_stats["request_limit"]
    assert_equal 9950, google_stats["remaining"]
    assert_equal 0.5, google_stats["usage_percent"]

    # Verify TripAdvisor stats (0 requests, limit 5000)
    assert_equal 0, tripadvisor_stats["request_count"]
    assert_equal 5000, tripadvisor_stats["request_limit"]
    assert_equal 5000, tripadvisor_stats["remaining"]
    assert_equal 0.0, tripadvisor_stats["usage_percent"]

    # Adapters that have been used should have reset dates
    assert yelp_stats["reset_at"]
    assert google_stats["reset_at"]
    # TripAdvisor hasn't been used, so no reset date yet
    assert_nil tripadvisor_stats["reset_at"]

    # Adapters that have been used should have days until reset
    assert yelp_stats["days_until_reset"].is_a?(Integer)
    assert google_stats["days_until_reset"].is_a?(Integer)
    # TripAdvisor hasn't been used, so no days until reset
    assert_nil tripadvisor_stats["days_until_reset"]
  end

  def test_stats_returns_indexed_locations
    seed_restaurant_with_location("barrie, ontario")
    seed_restaurant_with_location("toronto, ontario")

    get "/stats"

    assert last_response.ok?
    body = JSON.parse(last_response.body)

    locations = body["data"]["locations"]
    assert_equal 2, locations.length
    assert_includes locations, "barrie, ontario"
    assert_includes locations, "toronto, ontario"
  end

  def test_stats_returns_unique_locations_only
    seed_restaurant_with_location("barrie, ontario")
    seed_restaurant_with_location("barrie, ontario")  # Duplicate location
    seed_restaurant_with_location("Barrie, Ontario")  # Different case, same location

    get "/stats"

    assert last_response.ok?
    body = JSON.parse(last_response.body)

    locations = body["data"]["locations"]
    assert_equal 1, locations.length
    assert_includes locations, "barrie, ontario"
  end

  private

  def seed_restaurant_with_full_data
    db = GrubStars.db
    
    restaurant_id = db[:restaurants].insert(
      name: "Test Restaurant",
      address: "123 Test St",
      latitude: 44.389,
      longitude: -79.690,
      location: "barrie, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )

    # Add external ID
    db[:external_ids].insert(
      restaurant_id: restaurant_id,
      source: "yelp",
      external_id: "yelp-test-123"
    )

    # Add rating
    db[:ratings].insert(
      restaurant_id: restaurant_id,
      source: "yelp",
      score: 4.5,
      review_count: 100,
      fetched_at: Time.now
    )

    # Add review
    db[:reviews].insert(
      restaurant_id: restaurant_id,
      source: "yelp",
      snippet: "Great food!",
      url: "https://yelp.com/review/1",
      fetched_at: Time.now
    )

    # Add media
    db[:media].insert(
      restaurant_id: restaurant_id,
      source: "yelp",
      media_type: "photo",
      url: "https://example.com/photo.jpg",
      fetched_at: Time.now
    )

    restaurant_id
  end

  def seed_restaurant_with_source(source, name: "Test Restaurant")
    db = GrubStars.db
    
    restaurant_id = db[:restaurants].insert(
      name: name,
      address: "123 Test St",
      latitude: 44.389,
      longitude: -79.690,
      location: "barrie, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )

    db[:external_ids].insert(
      restaurant_id: restaurant_id,
      source: source,
      external_id: "#{source}-test-123"
    )

    restaurant_id
  end

  def seed_restaurant_with_multiple_sources(name: "Multi Source Restaurant")
    db = GrubStars.db
    
    restaurant_id = db[:restaurants].insert(
      name: name,
      address: "123 Multi St",
      latitude: 44.389,
      longitude: -79.690,
      location: "barrie, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )

    # Add external IDs from multiple sources
    %w[yelp google tripadvisor].each do |source|
      db[:external_ids].insert(
        restaurant_id: restaurant_id,
        source: source,
        external_id: "#{source}-multi-123"
      )
    end

    restaurant_id
  end

  def seed_restaurant_with_location(location)
    db = GrubStars.db
    
    db[:restaurants].insert(
      name: "Restaurant in #{location}",
      address: "123 Test St",
      latitude: 44.389,
      longitude: -79.690,
      location: location,
      created_at: Time.now,
      updated_at: Time.now
    )
  end
end
