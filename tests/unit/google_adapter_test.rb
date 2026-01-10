# frozen_string_literal: true

require_relative "../test_helper"
require "webmock/minitest"

class GoogleAdapterTest < Minitest::Test
  def setup
    @adapter = GrubStars::Adapters::Google.new(api_key: "test_google_api_key")
    WebMock.disable_net_connect!
  end

  def teardown
    WebMock.allow_net_connect!
  end

  def test_source_name
    assert_equal "google", @adapter.source_name
  end

  def test_configured_with_api_key
    assert @adapter.configured?
  end

  def test_not_configured_without_api_key
    adapter = GrubStars::Adapters::Google.new(api_key: nil)
    refute adapter.configured?
  end

  def test_search_businesses
    stub_text_search_request

    results = @adapter.search_businesses(location: "barrie, ontario")

    assert_equal 1, results.length
    biz = results.first
    assert_equal "google:ChIJtest123", biz[:external_id]
    assert_equal "Test Bakery", biz[:name]
    assert_equal 4.5, biz[:rating]
    assert_equal 120, biz[:review_count]
    assert_equal 44.3894, biz[:latitude]
    assert_equal(-79.6903, biz[:longitude])
    assert_includes biz[:categories], "bakery"
    assert_equal "123 Main St, Barrie, ON", biz[:address]
  end

  def test_search_businesses_with_categories
    stub_request(:get, /maps\.googleapis\.com\/maps\/api\/place\/textsearch/)
      .with(query: hash_including(query: "bakeries in barrie"))
      .to_return(
        status: 200,
        body: { results: [], status: "OK" }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    @adapter.search_businesses(location: "barrie", categories: "bakeries")
    # Just verify it doesn't raise - the stub matching proves the query was correct
    assert true
  end

  def test_get_business
    stub_place_details_request("ChIJtest123")

    biz = @adapter.get_business("ChIJtest123")

    assert_equal "google:ChIJtest123", biz[:external_id]
    assert_equal "Test Bakery", biz[:name]
    assert_equal "+1 416-555-1234", biz[:phone]
    assert_equal 4.5, biz[:rating]
  end

  def test_get_reviews
    stub_place_details_request("ChIJtest123", with_reviews: true)

    reviews = @adapter.get_reviews("ChIJtest123")

    assert_equal 2, reviews.length
    assert_equal 5, reviews[0][:rating]
    assert_equal "John D.", reviews[0][:user_name]
    assert_match(/Amazing bakery/, reviews[0][:text])
  end

  def test_raises_configuration_error_without_api_key
    adapter = GrubStars::Adapters::Google.new(api_key: nil)

    error = assert_raises(GrubStars::Adapters::Base::ConfigurationError) do
      adapter.search_businesses(location: "barrie")
    end

    assert_match(/GOOGLE_API_KEY/, error.message)
  end

  def test_custom_base_url
    adapter = GrubStars::Adapters::Google.new(
      api_key: "test_key",
      base_url: "http://localhost:4567"
    )

    stub_request(:get, "http://localhost:4567/textsearch/json")
      .with(query: hash_including(query: "restaurants in barrie"))
      .to_return(
        status: 200,
        body: { results: [], status: "OK" }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    adapter.search_businesses(location: "barrie")
    assert true
  end

  private

  def stub_text_search_request
    stub_request(:get, /maps\.googleapis\.com\/maps\/api\/place\/textsearch/)
      .to_return(
        status: 200,
        body: {
          results: [
            {
              place_id: "ChIJtest123",
              name: "Test Bakery",
              formatted_address: "123 Main St, Barrie, ON",
              geometry: {
                location: { lat: 44.3894, lng: -79.6903 }
              },
              rating: 4.5,
              user_ratings_total: 120,
              types: %w[bakery food point_of_interest establishment],
              photos: [{ photo_reference: "photo123" }]
            }
          ],
          status: "OK"
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_place_details_request(place_id, with_reviews: false)
    response = {
      result: {
        place_id: place_id,
        name: "Test Bakery",
        formatted_address: "123 Main St, Barrie, ON",
        formatted_phone_number: "+1 416-555-1234",
        geometry: {
          location: { lat: 44.3894, lng: -79.6903 }
        },
        rating: 4.5,
        user_ratings_total: 120,
        types: %w[bakery food establishment],
        url: "https://maps.google.com/?cid=123",
        photos: []
      },
      status: "OK"
    }

    if with_reviews
      response[:result][:reviews] = [
        {
          rating: 5,
          text: "Amazing bakery! Best croissants in town.",
          time: 1_705_315_800,
          author_name: "John D."
        },
        {
          rating: 4,
          text: "Good pastries, friendly staff.",
          time: 1_704_883_800,
          author_name: "Jane S."
        }
      ]
    end

    stub_request(:get, /maps\.googleapis\.com\/maps\/api\/place\/details/)
      .with(query: hash_including(placeid: place_id))
      .to_return(
        status: 200,
        body: response.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end
end
