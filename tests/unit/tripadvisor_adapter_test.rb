# frozen_string_literal: true

require_relative "../test_helper"
require "webmock/minitest"

class TripAdvisorAdapterTest < Minitest::Test
  def setup
    @adapter = GrubStars::Adapters::TripAdvisor.new(api_key: "test_tripadvisor_api_key")
    WebMock.disable_net_connect!
  end

  def teardown
    WebMock.allow_net_connect!
  end

  def test_source_name
    assert_equal "tripadvisor", @adapter.source_name
  end

  def test_configured_with_api_key
    assert @adapter.configured?
  end

  def test_not_configured_without_api_key
    adapter = GrubStars::Adapters::TripAdvisor.new(api_key: nil)
    refute adapter.configured?
  end

  def test_search_businesses
    stub_location_search_request

    results = @adapter.search_businesses(location: "barrie, ontario")

    assert_equal 1, results.length
    biz = results.first
    assert_equal "tripadvisor:123456", biz[:external_id]
    assert_equal "Test Bakery", biz[:name]
    assert_equal 4.5, biz[:rating]
    assert_equal 120, biz[:review_count]
    assert_equal 44.3894, biz[:latitude]
    assert_equal(-79.6903, biz[:longitude])
    assert_equal "123 Main St, Barrie, ON, L4M 1A1, Canada", biz[:address]
  end

  def test_search_businesses_with_categories
    stub_request(:get, "https://api.content.tripadvisor.com/api/v1/location/search")
      .with(query: hash_including(searchQuery: "bakeries in barrie"))
      .to_return(
        status: 200,
        body: { data: [] }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    @adapter.search_businesses(location: "barrie", categories: "bakeries")
    assert true
  end

  def test_search_by_name
    stub_request(:get, "https://api.content.tripadvisor.com/api/v1/location/search")
      .with(query: hash_including(searchQuery: "Joe's Pizza"))
      .to_return(
        status: 200,
        body: {
          data: [
            {
              location_id: "789012",
              name: "Joe's Pizza",
              address_obj: {
                street1: "456 Queen St",
                city: "Toronto",
                state: "ON",
                postalcode: "M5V 2A1",
                country: "Canada",
                latitude: "43.6532",
                longitude: "-79.3832"
              },
              rating: "4.0",
              num_reviews: "85",
              web_url: "https://tripadvisor.com/Restaurant_Review-joes-pizza"
            }
          ]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    results = @adapter.search_by_name(name: "Joe's Pizza")

    assert_equal 1, results.length
    biz = results.first
    assert_equal "tripadvisor:789012", biz[:external_id]
    assert_equal "Joe's Pizza", biz[:name]
    assert_equal 4.0, biz[:rating]
    assert_equal 85, biz[:review_count]
  end

  def test_search_by_name_with_location
    stub_request(:get, "https://api.content.tripadvisor.com/api/v1/location/search")
      .with(query: hash_including(searchQuery: "Joe's Pizza in Toronto, ON"))
      .to_return(
        status: 200,
        body: { data: [] }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    @adapter.search_by_name(name: "Joe's Pizza", location: "Toronto, ON")
    # Stub matching proves the query was correct
    assert true
  end

  def test_search_by_name_respects_limit
    stub_request(:get, "https://api.content.tripadvisor.com/api/v1/location/search")
      .with(query: hash_including(searchQuery: "Pizza"))
      .to_return(
        status: 200,
        body: {
          data: Array.new(15) do |i|
            { location_id: (700000 + i).to_s, name: "Restaurant #{i}" }
          end
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    results = @adapter.search_by_name(name: "Pizza", limit: 5)
    assert_equal 5, results.length
  end

  def test_search_businesses_with_offset_and_limit
    stub_request(:get, "https://api.content.tripadvisor.com/api/v1/location/search")
      .with(query: hash_including(key: "test_tripadvisor_api_key"))
      .to_return(
        status: 200,
        body: {
          data: Array.new(10) { |i| { location_id: i, name: "Restaurant #{i}" } }
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    results = @adapter.search_businesses(location: "toronto", limit: 5, offset: 2)
    assert_equal 5, results.length
  end

  def test_get_business
    stub_location_details_request("123456")

    biz = @adapter.get_business("123456")

    assert_equal "tripadvisor:123456", biz[:external_id]
    assert_equal "Test Bakery", biz[:name]
    assert_equal "+1 416-555-1234", biz[:phone]
    assert_equal 4.5, biz[:rating]
    assert_equal 120, biz[:review_count]
    assert_includes biz[:categories], "Bakery"
  end

  def test_get_business_handles_external_id_format
    stub_location_details_request("123456")

    # Should handle both raw ID and prefixed format
    biz1 = @adapter.get_business("123456")
    biz2 = @adapter.get_business("tripadvisor:123456")

    assert_equal "tripadvisor:123456", biz1[:external_id]
    assert_equal "tripadvisor:123456", biz2[:external_id]
  end

  def test_get_reviews
    stub_location_reviews_request("123456")

    reviews = @adapter.get_reviews("123456")

    assert_equal 2, reviews.length
    assert_equal "review123", reviews[0][:id]
    assert_equal 5, reviews[0][:rating]
    assert_equal "johndoe", reviews[0][:user_name]
    assert_match(/Amazing bakery/, reviews[0][:text])
  end

  def test_get_reviews_handles_external_id_format
    stub_location_reviews_request("123456")

    # Should handle both raw ID and prefixed format
    reviews1 = @adapter.get_reviews("123456")
    reviews2 = @adapter.get_reviews("tripadvisor:123456")

    assert_equal 2, reviews1.length
    assert_equal 2, reviews2.length
  end

  def test_get_photos
    stub_location_photos_request("123456")

    photos = @adapter.get_photos("123456")

    assert_equal 2, photos.length
    assert_includes photos[0], "photo1_large.jpg"
    assert_includes photos[1], "photo2_large.jpg"
  end

  def test_get_photos_handles_external_id_format
    stub_location_photos_request("123456")

    # Should handle both raw ID and prefixed format
    photos1 = @adapter.get_photos("123456")
    photos2 = @adapter.get_photos("tripadvisor:123456")

    assert_equal 2, photos1.length
    assert_equal 2, photos2.length
  end

  def test_get_photos_returns_empty_array_on_error
    stub_request(:get, "https://api.content.tripadvisor.com/api/v1/location/123456/photos")
      .with(query: hash_including(key: "test_tripadvisor_api_key"))
      .to_return(status: 404, body: { message: "Not found" }.to_json)

    photos = @adapter.get_photos("123456")

    assert_equal [], photos
  end

  def test_raises_configuration_error_without_api_key
    adapter = GrubStars::Adapters::TripAdvisor.new(api_key: nil)

    error = assert_raises(GrubStars::Adapters::Base::ConfigurationError) do
      adapter.search_businesses(location: "barrie")
    end

    assert_match(/TRIPADVISOR_API_KEY/, error.message)
  end

  def test_raises_api_error_on_failure
    stub_request(:get, /api\.content\.tripadvisor\.com\/api\/v1\/location\/search/)
      .to_return(
        status: 401,
        body: { message: "Invalid API key" }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    error = assert_raises(GrubStars::Adapters::Base::APIError) do
      @adapter.search_businesses(location: "barrie")
    end

    assert_equal 401, error.status
    assert_match(/Invalid API key/, error.message)
  end

  def test_custom_base_url
    adapter = GrubStars::Adapters::TripAdvisor.new(
      api_key: "test_key",
      base_url: "http://localhost:4567/api/v1"
    )

    stub_request(:get, "http://localhost:4567/api/v1/location/search")
      .with(query: hash_including(searchQuery: "restaurants in barrie"))
      .to_return(
        status: 200,
        body: { data: [] }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    adapter.search_businesses(location: "barrie")
    assert true
  end

  def test_search_all_businesses
    stub_location_search_request(count: 10)

    businesses = []
    progresses = []
    total = @adapter.search_all_businesses(location: "toronto") do |biz, progress|
      businesses << biz
      progresses << progress
    end

    assert_equal 10, total
    assert_equal 10, businesses.length
    assert_equal 10, progresses.length

    # Check first progress
    assert_equal 1, progresses[0][:current]
    assert_equal 10, progresses[0][:total]

    # Check last progress
    assert_equal 10, progresses[9][:current]
    assert_equal 100.0, progresses[9][:percent]
  end

  private

  def stub_location_search_request(count: 1)
    locations = if count == 1
      [{
        location_id: "123456",
        name: "Test Bakery",
        address_obj: {
          street1: "123 Main St",
          city: "Barrie",
          state: "ON",
          postalcode: "L4M 1A1",
          country: "Canada",
          latitude: "44.3894",
          longitude: "-79.6903"
        },
        rating: "4.5",
        num_reviews: "120",
        web_url: "https://tripadvisor.com/Restaurant_Review-test-bakery"
      }]
    else
      Array.new(count) do |i|
        {
          location_id: (123456 + i).to_s,
          name: "Restaurant #{i}",
          address_obj: {},
          rating: "4.0",
          num_reviews: "50"
        }
      end
    end

    stub_request(:get, "https://api.content.tripadvisor.com/api/v1/location/search")
      .with(query: hash_including(key: "test_tripadvisor_api_key"))
      .to_return(
        status: 200,
        body: { data: locations }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_location_details_request(location_id)
    stub_request(:get, "https://api.content.tripadvisor.com/api/v1/location/#{location_id}")
      .with(query: hash_including(key: "test_tripadvisor_api_key"))
      .to_return(
        status: 200,
        body: {
          location_id: location_id,
          name: "Test Bakery",
          phone: "+1 416-555-1234",
          address_obj: {
            street1: "123 Main St",
            city: "Barrie",
            state: "ON",
            postalcode: "L4M 1A1",
            country: "Canada",
            latitude: "44.3894",
            longitude: "-79.6903"
          },
          rating: "4.5",
          num_reviews: "120",
          category: { name: "Bakery" },
          subcategory: [
            { name: "Cafe" }
          ],
          web_url: "https://tripadvisor.com/Restaurant_Review-test-bakery",
          is_closed: false
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_location_reviews_request(location_id)
    stub_request(:get, "https://api.content.tripadvisor.com/api/v1/location/#{location_id}/reviews")
      .with(query: hash_including(key: "test_tripadvisor_api_key"))
      .to_return(
        status: 200,
        body: {
          data: [
            {
              id: "review123",
              rating: 5,
              text: "Amazing bakery! Best croissants in town.",
              published_date: "2024-01-15",
              url: "https://tripadvisor.com/review123",
              user: { username: "johndoe" }
            },
            {
              id: "review456",
              rating: 4,
              text: "Good pastries, friendly staff.",
              published_date: "2024-01-10",
              url: "https://tripadvisor.com/review456",
              user: { username: "janesmith" }
            }
          ]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_location_photos_request(location_id)
    stub_request(:get, "https://api.content.tripadvisor.com/api/v1/location/#{location_id}/photos")
      .with(query: hash_including(key: "test_tripadvisor_api_key"))
      .to_return(
        status: 200,
        body: {
          data: [
            {
              images: {
                large: { url: "https://tripadvisor.com/photo1_large.jpg" },
                medium: { url: "https://tripadvisor.com/photo1_medium.jpg" }
              }
            },
            {
              images: {
                large: { url: "https://tripadvisor.com/photo2_large.jpg" },
                original: { url: "https://tripadvisor.com/photo2_original.jpg" }
              }
            }
          ]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end
end
