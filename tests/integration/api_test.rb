# frozen_string_literal: true

require_relative "../test_helper"
require "rack/test"
require "webmock/minitest"
require_relative "../../lib/api/server"

class APITest < GrubStars::IntegrationTest
  include Rack::Test::Methods

  def app
    GrubStars::API::Server
  end

  def setup
    super
    WebMock.disable_net_connect!
    @original_db_path = GrubStars::Config.get("db_path")
    GrubStars::Config.set("db_path", GrubStars::TestHelper::TEST_DB_PATH)
    GrubStars.reset_db!
  end

  def teardown
    WebMock.allow_net_connect!
    if @original_db_path
      GrubStars::Config.set("db_path", @original_db_path)
    end
    GrubStars.reset_db!
    super
  end

  # Health endpoint tests
  def test_health_returns_ok
    get "/health"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal "ok", body["data"]["status"]
    assert body["meta"]["timestamp"]
  end

  # Categories endpoint tests
  def test_categories_empty_database
    get "/categories"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal [], body["data"]
    assert_equal 0, body["meta"]["count"]
  end

  def test_categories_with_data
    seed_restaurant

    get "/categories"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_includes body["data"], "bakeries"
    assert_equal 1, body["meta"]["count"]
  end

  # Locations endpoint tests
  def test_locations_empty_database
    get "/locations"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal [], body["data"]
    assert_equal 0, body["meta"]["count"]
  end

  def test_locations_with_data
    seed_restaurant_with_location

    get "/locations"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_includes body["data"], "barrie, ontario"
  end

  # Search endpoint tests
  def test_search_requires_parameter
    get "/restaurants/search"

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_REQUEST", body["error"]["code"]
    assert_match(/name.*category/i, body["error"]["message"])
  end

  def test_search_by_name_no_results
    get "/restaurants/search", name: "nonexistent"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal [], body["data"]
    assert_equal 0, body["meta"]["count"]
  end

  def test_search_by_name_with_results
    seed_restaurant

    get "/restaurants/search", name: "bakery"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal 1, body["data"].length
    assert_equal "Test Bakery", body["data"][0]["name"]
    assert_equal "123 Main St", body["data"][0]["address"]
    assert body["data"][0]["ratings"].is_a?(Array)
    assert body["data"][0]["categories"].is_a?(Array)
  end

  def test_search_by_category
    seed_restaurant

    get "/restaurants/search", category: "bakeries"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal 1, body["data"].length
    assert_equal "Test Bakery", body["data"][0]["name"]
  end

  def test_search_with_location_filter
    seed_restaurant_with_location

    get "/restaurants/search", name: "bakery", location: "barrie, ontario"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal 1, body["data"].length
  end

  def test_search_with_unindexed_location
    seed_restaurant_with_location

    get "/restaurants/search", name: "test", location: "toronto"

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "LOCATION_NOT_INDEXED", body["error"]["code"]
  end

  # Autocomplete endpoint tests
  def test_autocomplete_requires_query_parameter
    get "/restaurants/autocomplete"

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_REQUEST", body["error"]["code"]
    assert_match(/2 characters/i, body["error"]["message"])
  end

  def test_autocomplete_requires_minimum_length
    get "/restaurants/autocomplete", q: "a"

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_REQUEST", body["error"]["code"]
    assert_match(/2 characters/i, body["error"]["message"])
  end

  def test_autocomplete_empty_database
    get "/restaurants/autocomplete", q: "test"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal [], body["data"]
    assert_equal 0, body["meta"]["count"]
  end

  def test_autocomplete_returns_matching_restaurants
    seed_restaurant_with_location

    get "/restaurants/autocomplete", q: "test"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal 1, body["data"].length
    assert_equal "Test Bakery", body["data"][0]["name"]
    assert_equal "123 Main St", body["data"][0]["address"]
    assert_equal "barrie, ontario", body["data"][0]["location"]
    assert_equal "bakeries", body["data"][0]["primary_category"]
  end

  def test_autocomplete_case_insensitive
    seed_restaurant_with_location

    get "/restaurants/autocomplete", q: "TEST"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal 1, body["data"].length
    assert_equal "Test Bakery", body["data"][0]["name"]
  end

  def test_autocomplete_partial_match
    seed_restaurant_with_location

    get "/restaurants/autocomplete", q: "bake"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal 1, body["data"].length
    assert_equal "Test Bakery", body["data"][0]["name"]
  end

  def test_autocomplete_respects_limit
    seed_multiple_restaurants

    get "/restaurants/autocomplete", q: "rest", limit: "2"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal 2, body["data"].length
    assert_equal 2, body["meta"]["count"]
  end

  def test_autocomplete_prioritizes_prefix_matches
    seed_multiple_restaurants

    get "/restaurants/autocomplete", q: "rest"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    # "Restaurant A" should come before "Best Restaurant" (prefix match first)
    first_name = body["data"][0]["name"]
    assert first_name.downcase.start_with?("rest"), "Expected prefix match first, got: #{first_name}"
  end

  def test_autocomplete_no_match
    seed_restaurant_with_location

    get "/restaurants/autocomplete", q: "pizza"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal [], body["data"]
    assert_equal 0, body["meta"]["count"]
  end

  # Restaurant detail endpoint tests
  def test_restaurant_not_found
    get "/restaurants/999"

    assert_equal 404, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "NOT_FOUND", body["error"]["code"]
    assert_match(/999/, body["error"]["message"])
  end

  def test_restaurant_found
    seed_restaurant

    get "/restaurants/1"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal "Test Bakery", body["data"]["name"]
    assert_equal "123 Main St", body["data"]["address"]
    assert_equal 44.389, body["data"]["latitude"]
    assert_equal(-79.690, body["data"]["longitude"])
    assert body["data"]["ratings"].is_a?(Array)
    assert body["data"]["categories"].is_a?(Array)
  end

  # Index endpoint tests
  def test_index_requires_location
    post "/index", {}.to_json, { "CONTENT_TYPE" => "application/json" }

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_REQUEST", body["error"]["code"]
    assert_match(/location/i, body["error"]["message"])
  end

  def test_index_no_adapters_configured
    post "/index", { location: "barrie" }.to_json, { "CONTENT_TYPE" => "application/json" }

    assert_equal 503, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "NO_ADAPTERS", body["error"]["code"]
  end

  def test_index_invalid_json
    post "/index", "not valid json", { "CONTENT_TYPE" => "application/json" }

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_JSON", body["error"]["code"]
  end

  def test_index_success_with_configured_adapter
    stub_yelp_search
    stub_yelp_business("bakery-barrie")

    with_env("YELP_API_KEY" => "test_key") do
      post "/index", { location: "barrie, ontario" }.to_json, { "CONTENT_TYPE" => "application/json" }
    end

    assert last_response.ok?, "Expected 200 OK but got #{last_response.status}: #{last_response.body}"
    body = JSON.parse(last_response.body)

    assert_equal 1, body["data"]["total"]
    assert_equal 1, body["data"]["created"]
    assert_equal 0, body["data"]["merged"]
    assert_equal "barrie, ontario", body["meta"]["location"]

    # Verify restaurant was actually created in database
    assert_equal 1, GrubStars.db[:restaurants].count
  end

  def test_index_success_with_category_filter
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .with(query: hash_including(categories: "bakery"))
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [yelp_business_data("bakery-barrie", "Test Bakery")]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
    stub_yelp_business("bakery-barrie")

    with_env("YELP_API_KEY" => "test_key") do
      post "/index",
           { location: "barrie, ontario", category: "bakery" }.to_json,
           { "CONTENT_TYPE" => "application/json" }
    end

    assert last_response.ok?
    body = JSON.parse(last_response.body)

    assert_equal 1, body["data"]["total"]
    assert_equal "bakery", body["meta"]["category"]
  end

  # JSON content type tests
  def test_responses_are_json
    get "/health"

    assert_equal "application/json", last_response.content_type
  end

  # Adapters endpoint tests
  def test_adapters_returns_list
    get "/adapters"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert body["data"].is_a?(Array)
    assert body["meta"]["count"].is_a?(Integer)

    # Each adapter should have name and configured fields
    body["data"].each do |adapter|
      assert adapter.key?("name"), "Adapter should have name"
      assert [true, false].include?(adapter["configured"]), "Adapter should have configured boolean"
    end
  end

  def test_adapters_includes_all_sources
    get "/adapters"

    body = JSON.parse(last_response.body)
    names = body["data"].map { |a| a["name"] }

    assert_includes names, "yelp"
    assert_includes names, "google"
    assert_includes names, "tripadvisor"
  end

  # Search external API endpoint tests
  def test_search_external_requires_name
    get "/restaurants/search-external", adapter: "yelp"

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_REQUEST", body["error"]["code"]
    assert_match(/name.*2 characters/i, body["error"]["message"])
  end

  def test_search_external_requires_adapter
    get "/restaurants/search-external", name: "pizza"

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_REQUEST", body["error"]["code"]
    assert_match(/adapter.*required/i, body["error"]["message"])
  end

  def test_search_external_rejects_short_name
    get "/restaurants/search-external", name: "a", adapter: "yelp"

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_REQUEST", body["error"]["code"]
    assert_match(/2 characters/i, body["error"]["message"])
  end

  def test_search_external_rejects_unknown_adapter
    get "/restaurants/search-external", name: "pizza", adapter: "unknown"

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_ADAPTER", body["error"]["code"]
    assert_match(/unknown/i, body["error"]["message"])
  end

  def test_search_external_returns_503_when_adapter_not_configured
    # Without setting YELP_API_KEY, the adapter is not configured
    get "/restaurants/search-external", name: "pizza", adapter: "yelp"

    assert_equal 503, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "ADAPTER_NOT_CONFIGURED", body["error"]["code"]
    assert_match(/yelp.*not configured/i, body["error"]["message"])
  end

  def test_search_external_success
    stub_yelp_search_by_name("pizza")

    with_env("YELP_API_KEY" => "test_key") do
      get "/restaurants/search-external", name: "pizza", adapter: "yelp"
    end

    assert last_response.ok?
    body = JSON.parse(last_response.body)

    assert body["data"].is_a?(Array)
    assert_equal 1, body["data"].length
    assert_equal "yelp:pizza-place-123", body["data"][0]["external_id"]
    assert_equal "yelp", body["data"][0]["source"]
    assert_equal "Pizza Palace", body["data"][0]["name"]
    assert_equal "123 Main St, Barrie, ON", body["data"][0]["address"]
    assert_equal 4.5, body["data"][0]["rating"]
    assert_equal 100, body["data"][0]["review_count"]
    assert_equal "yelp", body["meta"]["adapter"]
    assert_equal "pizza", body["meta"]["query"]
  end

  def test_search_external_with_location
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .with(query: hash_including(term: "pizza", location: "barrie, ontario"))
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [yelp_business_data("pizza-place-123", "Pizza Palace")]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    with_env("YELP_API_KEY" => "test_key") do
      get "/restaurants/search-external", name: "pizza", adapter: "yelp", location: "barrie, ontario"
    end

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal 1, body["data"].length
  end

  def test_search_external_handles_api_error
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .to_return(status: 500, body: { error: { code: "INTERNAL_ERROR" } }.to_json)

    with_env("YELP_API_KEY" => "test_key") do
      get "/restaurants/search-external", name: "pizza", adapter: "yelp"
    end

    assert_equal 502, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "API_ERROR", body["error"]["code"]
  end

  # Index single restaurant endpoint tests
  def test_index_single_requires_business_data
    post "/restaurants/index-single",
         { source: "yelp" }.to_json,
         { "CONTENT_TYPE" => "application/json" }

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_REQUEST", body["error"]["code"]
    assert_match(/business_data.*required/i, body["error"]["message"])
  end

  def test_index_single_requires_source
    post "/restaurants/index-single",
         { business_data: { name: "Test" } }.to_json,
         { "CONTENT_TYPE" => "application/json" }

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_REQUEST", body["error"]["code"]
    assert_match(/source.*required/i, body["error"]["message"])
  end

  def test_index_single_success
    business_data = {
      "external_id" => "test-restaurant-123",
      "name" => "Test Restaurant",
      "address" => "456 Oak St",
      "latitude" => 44.389,
      "longitude" => -79.690,
      "phone" => "+15559876543",
      "rating" => 4.2,
      "review_count" => 50,
      "categories" => ["italian", "pizza"],
      "photos" => ["https://example.com/photo.jpg"]
    }

    post "/restaurants/index-single",
         { business_data: business_data, source: "yelp" }.to_json,
         { "CONTENT_TYPE" => "application/json" }

    assert last_response.ok?, "Expected 200 OK but got #{last_response.status}: #{last_response.body}"
    body = JSON.parse(last_response.body)

    assert body["data"]["restaurant_id"], "Should return restaurant_id"
    assert_includes body["data"]["sources_indexed"], "yelp"
    assert_match(/indexed.*1 source/i, body["data"]["message"])

    # Verify restaurant was created in database
    assert_equal 1, GrubStars.db[:restaurants].count
    restaurant = GrubStars.db[:restaurants].first
    assert_equal "Test Restaurant", restaurant[:name]
    assert_equal "456 Oak St", restaurant[:address]
    assert_in_delta 44.389, restaurant[:latitude], 0.001
    assert_in_delta(-79.690, restaurant[:longitude], 0.001)
  end

  def test_index_single_with_location
    business_data = {
      "external_id" => "test-restaurant-456",
      "name" => "Another Restaurant",
      "address" => "789 Pine St",
      "latitude" => 44.400,
      "longitude" => -79.700,
      "rating" => 4.0,
      "review_count" => 30
    }

    post "/restaurants/index-single",
         { business_data: business_data, source: "google", location: "barrie, ontario" }.to_json,
         { "CONTENT_TYPE" => "application/json" }

    assert last_response.ok?
    body = JSON.parse(last_response.body)

    assert body["data"]["restaurant_id"]

    # Verify location was stored
    restaurant = GrubStars.db[:restaurants].first
    assert_equal "barrie, ontario", restaurant[:location]
  end

  def test_index_single_creates_external_id
    business_data = {
      "external_id" => "ext-id-789",
      "name" => "External ID Test",
      "address" => "123 Test St",
      "latitude" => 44.389,
      "longitude" => -79.690
    }

    post "/restaurants/index-single",
         { business_data: business_data, source: "tripadvisor" }.to_json,
         { "CONTENT_TYPE" => "application/json" }

    assert last_response.ok?

    # Verify external_id was created
    external_id = GrubStars.db[:external_ids].first
    assert_equal "tripadvisor", external_id[:source]
    assert_equal "ext-id-789", external_id[:external_id]
  end

  def test_index_single_creates_rating
    business_data = {
      "external_id" => "rating-test-123",
      "name" => "Rating Test Restaurant",
      "address" => "123 Rating St",
      "latitude" => 44.389,
      "longitude" => -79.690,
      "rating" => 4.7,
      "review_count" => 200
    }

    post "/restaurants/index-single",
         { business_data: business_data, source: "yelp" }.to_json,
         { "CONTENT_TYPE" => "application/json" }

    assert last_response.ok?

    # Verify rating was created
    rating = GrubStars.db[:ratings].first
    assert_equal "yelp", rating[:source]
    assert_in_delta 4.7, rating[:score], 0.01
    assert_equal 200, rating[:review_count]
  end

  def test_index_single_creates_categories
    business_data = {
      "external_id" => "category-test-123",
      "name" => "Category Test Restaurant",
      "address" => "123 Category St",
      "latitude" => 44.389,
      "longitude" => -79.690,
      "categories" => ["mexican", "tacos", "burritos"]
    }

    post "/restaurants/index-single",
         { business_data: business_data, source: "yelp" }.to_json,
         { "CONTENT_TYPE" => "application/json" }

    assert last_response.ok?

    # Verify categories were created and linked
    categories = GrubStars.db[:categories].select_map(:name)
    assert_includes categories, "mexican"
    assert_includes categories, "tacos"
    assert_includes categories, "burritos"

    # Verify links
    assert_equal 3, GrubStars.db[:restaurant_categories].count
  end

  def test_index_single_searches_other_adapters
    # First, set up stubs for other adapters to return matching results
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [yelp_business_data("yelp-match-123", "Multi Source Restaurant")]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
    stub_yelp_business("yelp-match-123")

    # Original business data from google
    business_data = {
      "external_id" => "google-123",
      "name" => "Multi Source Restaurant",
      "address" => "100 Multi St",
      "latitude" => 44.3894,
      "longitude" => -79.6903,
      "rating" => 4.0,
      "review_count" => 50
    }

    with_env("YELP_API_KEY" => "test_key") do
      post "/restaurants/index-single",
           { business_data: business_data, source: "google", location: "barrie" }.to_json,
           { "CONTENT_TYPE" => "application/json" }
    end

    assert last_response.ok?
    body = JSON.parse(last_response.body)

    # Should have indexed from google and found match in yelp
    assert_includes body["data"]["sources_indexed"], "google"
    assert_includes body["data"]["sources_indexed"], "yelp"
  end

  def test_index_single_updates_existing_restaurant
    # First index a restaurant
    business_data = {
      "external_id" => "existing-123",
      "name" => "Existing Restaurant",
      "address" => "Original Address",
      "latitude" => 44.389,
      "longitude" => -79.690,
      "rating" => 4.0,
      "review_count" => 50
    }

    post "/restaurants/index-single",
         { business_data: business_data, source: "yelp" }.to_json,
         { "CONTENT_TYPE" => "application/json" }

    assert last_response.ok?
    first_response = JSON.parse(last_response.body)
    first_id = first_response["data"]["restaurant_id"]

    # Index again with updated data (same external_id)
    updated_data = {
      "external_id" => "existing-123",
      "name" => "Existing Restaurant Updated",
      "address" => "Updated Address",
      "latitude" => 44.389,
      "longitude" => -79.690,
      "rating" => 4.5,
      "review_count" => 75
    }

    post "/restaurants/index-single",
         { business_data: updated_data, source: "yelp" }.to_json,
         { "CONTENT_TYPE" => "application/json" }

    assert last_response.ok?
    second_response = JSON.parse(last_response.body)

    # Should be the same restaurant (updated, not created new)
    assert_equal first_id, second_response["data"]["restaurant_id"]
    assert_equal 1, GrubStars.db[:restaurants].count

    # Verify data was updated
    restaurant = GrubStars.db[:restaurants].first
    assert_equal "Existing Restaurant Updated", restaurant[:name]
    assert_equal "Updated Address", restaurant[:address]
  end

  # Reindex endpoint tests
  def test_reindex_returns_404_for_nonexistent_restaurant
    post "/restaurants/999/reindex"

    assert_equal 404, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "NOT_FOUND", body["error"]["code"]
    assert_match(/999/, body["error"]["message"])
  end

  def test_reindex_returns_success_with_no_external_sources
    # Seed a restaurant without external IDs
    db = GrubStars.db
    restaurant_id = db[:restaurants].insert(
      name: "No External Sources",
      address: "123 Main St",
      latitude: 44.389,
      longitude: -79.690,
      created_at: Time.now,
      updated_at: Time.now
    )

    post "/restaurants/#{restaurant_id}/reindex"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal [], body["data"]["result"]["sources_updated"]
    assert_match(/No external sources/i, body["data"]["result"]["message"])
  end

  def test_reindex_fetches_fresh_data_from_yelp
    # Seed a restaurant with yelp external ID
    seed_restaurant_with_external_id("yelp", "test-bakery-yelp-123")

    # Stub the Yelp API to return updated data
    stub_request(:get, /api\.yelp\.com.*businesses\/test-bakery-yelp-123/)
      .to_return(
        status: 200,
        body: {
          "id" => "test-bakery-yelp-123",
          "name" => "Test Bakery Updated",
          "rating" => 4.8,
          "review_count" => 150,
          "coordinates" => { "latitude" => 44.3894, "longitude" => -79.6903 },
          "location" => {
            "address1" => "123 Main St Updated",
            "city" => "Barrie",
            "state" => "ON"
          },
          "categories" => [{ "alias" => "bakeries", "title" => "Bakeries" }],
          "photos" => ["https://example.com/new-photo.jpg"],
          "phone" => "+17055551234"
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    with_env("YELP_API_KEY" => "test_key") do
      post "/restaurants/1/reindex"
    end

    assert last_response.ok?, "Expected 200 OK but got #{last_response.status}: #{last_response.body}"
    body = JSON.parse(last_response.body)

    # Check result structure
    assert body["data"]["result"]["sources_updated"].include?("yelp")
    assert_equal [], body["data"]["result"]["sources_failed"]
    assert body["data"]["result"]["message"]

    # Check that updated restaurant is returned
    assert body["data"]["restaurant"]
    assert_equal "Test Bakery Updated", body["data"]["restaurant"]["name"]
    assert_equal "123 Main St Updated, Barrie, ON", body["data"]["restaurant"]["address"]

    # Verify database was updated
    restaurant = GrubStars.db[:restaurants].first
    assert_equal "Test Bakery Updated", restaurant[:name]

    # Verify rating was updated
    rating = GrubStars.db[:ratings].where(source: "yelp").first
    assert_in_delta 4.8, rating[:score], 0.01
    assert_equal 150, rating[:review_count]
  end

  def test_reindex_does_not_create_new_restaurant
    seed_restaurant_with_external_id("yelp", "test-bakery-yelp-456")

    initial_count = GrubStars.db[:restaurants].count

    # Stub the Yelp API
    stub_request(:get, /api\.yelp\.com.*businesses\/test-bakery-yelp-456/)
      .to_return(
        status: 200,
        body: yelp_business_data("test-bakery-yelp-456", "Updated Name").to_json,
        headers: { "Content-Type" => "application/json" }
      )

    with_env("YELP_API_KEY" => "test_key") do
      post "/restaurants/1/reindex"
    end

    assert last_response.ok?

    # Should NOT create a new restaurant
    assert_equal initial_count, GrubStars.db[:restaurants].count
  end

  def test_reindex_handles_api_failure_gracefully
    seed_restaurant_with_external_id("yelp", "test-bakery-yelp-789")

    # Stub the Yelp API to return an error
    stub_request(:get, /api\.yelp\.com.*businesses\/test-bakery-yelp-789/)
      .to_return(status: 500, body: { error: { code: "INTERNAL_ERROR" } }.to_json)

    with_env("YELP_API_KEY" => "test_key") do
      post "/restaurants/1/reindex"
    end

    # Should still succeed, but report the failure
    assert last_response.ok?
    body = JSON.parse(last_response.body)

    assert_equal [], body["data"]["result"]["sources_updated"]
    assert_equal 1, body["data"]["result"]["sources_failed"].length
    assert_equal "yelp", body["data"]["result"]["sources_failed"][0]["source"]
  end

  def test_reindex_reports_changes_in_result
    seed_restaurant_with_external_id("yelp", "changes-test-123")

    # Update rating from 4.5 to 4.8
    stub_request(:get, /api\.yelp\.com.*businesses\/changes-test-123/)
      .to_return(
        status: 200,
        body: {
          "id" => "changes-test-123",
          "name" => "Test Bakery",
          "rating" => 4.8,
          "review_count" => 200,
          "coordinates" => { "latitude" => 44.389, "longitude" => -79.690 },
          "location" => { "address1" => "123 Main St", "city" => "Barrie", "state" => "ON" },
          "categories" => [{ "alias" => "bakeries", "title" => "Bakeries" }],
          "photos" => ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    with_env("YELP_API_KEY" => "test_key") do
      post "/restaurants/1/reindex"
    end

    assert last_response.ok?
    body = JSON.parse(last_response.body)

    # Check that changes are reported
    changes = body["data"]["result"]["changes"]
    assert changes["yelp_rating"], "Expected rating change to be reported"
    assert_in_delta 4.5, changes["yelp_rating"]["old"], 0.01
    assert_in_delta 4.8, changes["yelp_rating"]["new"], 0.01
  end

  def test_reindex_with_multiple_sources
    GrubStars.reset_db!
    # Seed a restaurant with both yelp and google external IDs
    db = GrubStars.db
    restaurant_id = db[:restaurants].insert(
      name: "Multi Source Restaurant",
      address: "123 Main St",
      latitude: 44.389,
      longitude: -79.690,
      location: "barrie, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )

    # Store external_ids with source prefix (as adapters return them)
    db[:external_ids].insert(restaurant_id: restaurant_id, source: "yelp", external_id: "yelp:multi-yelp-123")
    db[:external_ids].insert(restaurant_id: restaurant_id, source: "google", external_id: "google:multi-google-456")
    db[:ratings].insert(restaurant_id: restaurant_id, source: "yelp", score: 4.0, review_count: 50, fetched_at: Time.now)
    db[:ratings].insert(restaurant_id: restaurant_id, source: "google", score: 4.2, review_count: 30, fetched_at: Time.now)

    # Stub both APIs
    stub_request(:get, /api\.yelp\.com.*businesses\/multi-yelp-123/)
      .to_return(
        status: 200,
        body: yelp_business_data("multi-yelp-123", "Multi Source Restaurant").to_json,
        headers: { "Content-Type" => "application/json" }
      )

    stub_request(:get, /maps\.googleapis\.com.*place\/details/)
      .to_return(
        status: 200,
        body: {
          result: {
            place_id: "multi-google-456",
            name: "Multi Source Restaurant",
            rating: 4.5,
            user_ratings_total: 100,
            geometry: { location: { lat: 44.389, lng: -79.690 } },
            formatted_address: "123 Main St, Barrie, ON",
            formatted_phone_number: "+1 705-555-1234"
          },
          status: "OK"
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    with_env("YELP_API_KEY" => "test_key", "GOOGLE_API_KEY" => "test_key") do
      post "/restaurants/#{restaurant_id}/reindex"
    end

    assert last_response.ok?
    body = JSON.parse(last_response.body)

    # Both sources should be updated
    sources_updated = body["data"]["result"]["sources_updated"]
    assert_includes sources_updated, "yelp"
    assert_includes sources_updated, "google"
  end

  private

  def seed_restaurant
    GrubStars.reset_db!
    db = GrubStars.db

    restaurant_id = db[:restaurants].insert(
      name: "Test Bakery",
      address: "123 Main St",
      latitude: 44.389,
      longitude: -79.690,
      phone: "+15551234567",
      created_at: Time.now,
      updated_at: Time.now
    )

    db[:external_ids].insert(
      restaurant_id: restaurant_id,
      source: "yelp",
      external_id: "test-bakery-123"
    )

    category_id = db[:categories].insert(name: "bakeries")
    db[:restaurant_categories].insert(
      restaurant_id: restaurant_id,
      category_id: category_id
    )

    db[:ratings].insert(
      restaurant_id: restaurant_id,
      source: "yelp",
      score: 4.5,
      review_count: 100,
      fetched_at: Time.now
    )
  end

  def seed_restaurant_with_location
    GrubStars.reset_db!
    db = GrubStars.db

    restaurant_id = db[:restaurants].insert(
      name: "Test Bakery",
      address: "123 Main St",
      latitude: 44.389,
      longitude: -79.690,
      phone: "+15551234567",
      location: "barrie, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )

    db[:external_ids].insert(
      restaurant_id: restaurant_id,
      source: "yelp",
      external_id: "test-bakery-123"
    )

    category_id = db[:categories].insert(name: "bakeries")
    db[:restaurant_categories].insert(
      restaurant_id: restaurant_id,
      category_id: category_id
    )
  end

  def seed_restaurant_with_external_id(source, external_id)
    GrubStars.reset_db!
    db = GrubStars.db

    restaurant_id = db[:restaurants].insert(
      name: "Test Bakery",
      address: "123 Main St",
      latitude: 44.389,
      longitude: -79.690,
      phone: "+15551234567",
      location: "barrie, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )

    # Store the external_id with the source prefix (as adapters return it)
    prefixed_external_id = external_id.start_with?("#{source}:") ? external_id : "#{source}:#{external_id}"

    db[:external_ids].insert(
      restaurant_id: restaurant_id,
      source: source,
      external_id: prefixed_external_id
    )

    category_id = db[:categories].insert(name: "bakeries")
    db[:restaurant_categories].insert(
      restaurant_id: restaurant_id,
      category_id: category_id
    )

    db[:ratings].insert(
      restaurant_id: restaurant_id,
      source: source,
      score: 4.5,
      review_count: 100,
      fetched_at: Time.now
    )

    db[:media].insert(
      restaurant_id: restaurant_id,
      source: source,
      media_type: "photo",
      url: "https://example.com/original-photo.jpg",
      fetched_at: Time.now
    )

    restaurant_id
  end

  def seed_multiple_restaurants
    GrubStars.reset_db!
    db = GrubStars.db

    # Create category
    category_id = db[:categories].insert(name: "restaurants")

    # Restaurant A - prefix match for "rest"
    r1_id = db[:restaurants].insert(
      name: "Restaurant A",
      address: "100 First St",
      latitude: 44.389,
      longitude: -79.690,
      location: "barrie, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )
    db[:restaurant_categories].insert(restaurant_id: r1_id, category_id: category_id)

    # Restaurant B - prefix match for "rest"
    r2_id = db[:restaurants].insert(
      name: "Restaurant B",
      address: "200 Second St",
      latitude: 44.390,
      longitude: -79.691,
      location: "barrie, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )
    db[:restaurant_categories].insert(restaurant_id: r2_id, category_id: category_id)

    # Best Restaurant - contains "rest" but not prefix
    r3_id = db[:restaurants].insert(
      name: "Best Restaurant",
      address: "300 Third St",
      latitude: 44.391,
      longitude: -79.692,
      location: "barrie, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )
    db[:restaurant_categories].insert(restaurant_id: r3_id, category_id: category_id)

    # Another Place - no match
    r4_id = db[:restaurants].insert(
      name: "Another Place",
      address: "400 Fourth St",
      latitude: 44.392,
      longitude: -79.693,
      location: "barrie, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )
    db[:restaurant_categories].insert(restaurant_id: r4_id, category_id: category_id)
  end

  def with_env(env_vars)
    original_values = {}
    env_vars.each do |key, value|
      original_values[key] = ENV[key]
      ENV[key] = value
    end
    yield
  ensure
    original_values.each do |key, value|
      if value.nil?
        ENV.delete(key)
      else
        ENV[key] = value
      end
    end
  end

  def stub_yelp_search
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [yelp_business_data("bakery-barrie", "Test Bakery")]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_yelp_business(id)
    stub_request(:get, /api\.yelp\.com.*businesses\/#{id}/)
      .to_return(
        status: 200,
        body: yelp_business_data(id, "Test Business").to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def yelp_business_data(id, name)
    {
      "id" => id,
      "name" => name,
      "rating" => 4.5,
      "review_count" => 100,
      "coordinates" => { "latitude" => 44.3894, "longitude" => -79.6903 },
      "location" => {
        "address1" => "123 Main St",
        "city" => "Barrie",
        "state" => "ON",
        "zip_code" => "L4M 1A6",
        "country" => "CA"
      },
      "categories" => [{ "alias" => "bakeries", "title" => "Bakeries" }],
      "photos" => ["https://example.com/photo1.jpg"],
      "phone" => "+17055551234"
    }
  end

  def stub_yelp_search_by_name(term)
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .with(query: hash_including(term: term))
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [{
            "id" => "pizza-place-123",
            "name" => "Pizza Palace",
            "rating" => 4.5,
            "review_count" => 100,
            "coordinates" => { "latitude" => 44.3894, "longitude" => -79.6903 },
            "location" => {
              "address1" => "123 Main St",
              "city" => "Barrie",
              "state" => "ON"
            },
            "categories" => [{ "alias" => "pizza", "title" => "Pizza" }],
            "photos" => ["https://example.com/pizza.jpg"],
            "phone" => "+17055551234",
            "url" => "https://yelp.com/biz/pizza-palace"
          }]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end
end
