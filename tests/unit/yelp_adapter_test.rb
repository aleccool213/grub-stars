# frozen_string_literal: true

require_relative "../test_helper"
require "webmock/minitest"

class YelpAdapterTest < Minitest::Test
  def setup
    @adapter = GrubStars::Adapters::Yelp.new(api_key: "test_api_key")
  end

  def test_source_name
    assert_equal "yelp", @adapter.source_name
  end

  def test_configured_with_api_key
    assert @adapter.configured?
  end

  def test_not_configured_without_api_key
    adapter = GrubStars::Adapters::Yelp.new(api_key: nil)
    refute adapter.configured?
  end

  def test_search_businesses
    stub_request(:get, "https://api.yelp.com/v3/businesses/search")
      .with(
        query: { location: "barrie, ontario", limit: 50, offset: 0 },
        headers: { "Authorization" => "Bearer test_api_key" }
      )
      .to_return(
        status: 200,
        body: {
          total: 100,
          businesses: [
            {
              id: "abc123",
              name: "Test Bakery",
              alias: "test-bakery",
              phone: "+14165551234",
              display_phone: "(416) 555-1234",
              rating: 4.5,
              review_count: 120,
              coordinates: { latitude: 44.3894, longitude: -79.6903 },
              location: {
                address1: "123 Main St",
                city: "Barrie",
                state: "ON",
                zip_code: "L4M 1A1",
                country: "CA"
              },
              categories: [
                { alias: "bakeries", title: "Bakeries" },
                { alias: "cafes", title: "Cafes" }
              ],
              photos: ["https://example.com/photo1.jpg"],
              url: "https://yelp.com/biz/test-bakery",
              is_closed: false
            }
          ]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    results = @adapter.search_businesses(location: "barrie, ontario")

    assert_equal 1, results.length
    biz = results.first
    assert_equal "yelp:abc123", biz[:external_id]
    assert_equal "Test Bakery", biz[:name]
    assert_equal 4.5, biz[:rating]
    assert_equal 120, biz[:review_count]
    assert_equal 44.3894, biz[:latitude]
    assert_equal(-79.6903, biz[:longitude])
    assert_includes biz[:categories], "bakeries"
    assert_includes biz[:categories], "cafes"
    assert_equal "123 Main St, Barrie, ON, L4M 1A1, CA", biz[:address]
  end

  def test_search_businesses_with_categories
    stub_request(:get, "https://api.yelp.com/v3/businesses/search")
      .with(query: hash_including(categories: "bakeries"))
      .to_return(
        status: 200,
        body: { total: 0, businesses: [] }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    @adapter.search_businesses(location: "barrie", categories: "bakeries")
    assert_requested :get, "https://api.yelp.com/v3/businesses/search",
                     query: hash_including(categories: "bakeries")
  end

  def test_get_business
    stub_request(:get, "https://api.yelp.com/v3/businesses/abc123")
      .with(headers: { "Authorization" => "Bearer test_api_key" })
      .to_return(
        status: 200,
        body: {
          id: "abc123",
          name: "Test Bakery",
          alias: "test-bakery",
          rating: 4.5,
          review_count: 120,
          coordinates: { latitude: 44.3894, longitude: -79.6903 },
          location: { address1: "123 Main St", city: "Barrie", state: "ON" },
          categories: [{ alias: "bakeries", title: "Bakeries" }],
          photos: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
          url: "https://yelp.com/biz/test-bakery"
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    biz = @adapter.get_business("abc123")

    assert_equal "yelp:abc123", biz[:external_id]
    assert_equal "Test Bakery", biz[:name]
    assert_equal 2, biz[:photos].length
  end

  def test_get_reviews
    stub_request(:get, "https://api.yelp.com/v3/businesses/abc123/reviews")
      .with(headers: { "Authorization" => "Bearer test_api_key" })
      .to_return(
        status: 200,
        body: {
          reviews: [
            {
              id: "review1",
              rating: 5,
              text: "Amazing bakery! Best croissants in town.",
              url: "https://yelp.com/biz/test-bakery?hrid=review1",
              time_created: "2024-01-15 10:30:00",
              user: { name: "John D." }
            },
            {
              id: "review2",
              rating: 4,
              text: "Good pastries, friendly staff.",
              url: "https://yelp.com/biz/test-bakery?hrid=review2",
              time_created: "2024-01-10 14:00:00",
              user: { name: "Jane S." }
            }
          ]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    reviews = @adapter.get_reviews("abc123")

    assert_equal 2, reviews.length
    assert_equal "review1", reviews[0][:id]
    assert_equal 5, reviews[0][:rating]
    assert_equal "John D.", reviews[0][:user_name]
    assert_match(/Amazing bakery/, reviews[0][:text])
  end

  def test_raises_configuration_error_without_api_key
    adapter = GrubStars::Adapters::Yelp.new(api_key: nil)

    error = assert_raises(GrubStars::Adapters::Base::ConfigurationError) do
      adapter.search_businesses(location: "barrie")
    end

    assert_match(/YELP_API_KEY/, error.message)
  end

  def test_raises_api_error_on_failure
    stub_request(:get, /api\.yelp\.com\/v3\/businesses\/search/)
      .to_return(
        status: 401,
        body: { error: { code: "UNAUTHORIZED", description: "Invalid API key" } }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    error = assert_raises(GrubStars::Adapters::Base::APIError) do
      @adapter.search_businesses(location: "barrie")
    end

    assert_equal 401, error.status
    assert_match(/Invalid API key/, error.message)
  end

  def test_search_all_businesses_paginates
    # First page
    stub_request(:get, /api\.yelp\.com\/v3\/businesses\/search.*offset=0/)
      .to_return(
        status: 200,
        body: {
          total: 75,
          businesses: Array.new(50) { |i| { id: "biz#{i}", name: "Business #{i}" } }
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Second page
    stub_request(:get, /api\.yelp\.com\/v3\/businesses\/search.*offset=50/)
      .to_return(
        status: 200,
        body: {
          total: 75,
          businesses: Array.new(25) { |i| { id: "biz#{i + 50}", name: "Business #{i + 50}" } }
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    businesses = []
    progresses = []
    total = @adapter.search_all_businesses(location: "toronto") do |biz, progress|
      businesses << biz
      progresses << progress
    end

    assert_equal 75, total
    assert_equal 75, businesses.length
    assert_equal 75, progresses.length

    # Check first progress
    assert_equal 1, progresses[0][:current]
    assert_equal 75, progresses[0][:total]

    # Check last progress
    assert_equal 75, progresses[74][:current]
    assert_equal 100.0, progresses[74][:percent]
  end
end
