# frozen_string_literal: true

require_relative "../test_helper"
require "webmock/minitest"

class IndexerTest < GrubStars::IntegrationTest
  def setup
    super
    WebMock.disable_net_connect!
  end

  def teardown
    WebMock.allow_net_connect!
    super
  end

  def test_index_with_single_adapter
    stub_yelp_search
    stub_yelp_business("bakery-barrie")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    service = create_service(adapters: [yelp])

    stats = service.index(location: "barrie, ontario")

    assert_equal 1, stats[:total]
    assert_equal 1, stats[:created]
    assert_equal 0, stats[:merged]
    assert_equal 1, @db[:restaurants].count
  end

  def test_index_with_multiple_adapters_merges_matches
    stub_yelp_search
    stub_google_search
    stub_yelp_business("bakery-barrie")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    google = GrubStars::Adapters::Google.new(api_key: "test_key")
    service = create_service(adapters: [yelp, google])

    stats = service.index(location: "barrie, ontario")

    # Yelp creates 1, Google merges 1 (same restaurant)
    assert_equal 2, stats[:total]
    assert_equal 1, stats[:created]
    assert_equal 1, stats[:merged]

    # Only 1 restaurant in DB (merged)
    assert_equal 1, @db[:restaurants].count

    # Restaurant has both external IDs
    restaurant = @db[:restaurants].first
    external_ids = @db[:external_ids].where(restaurant_id: restaurant[:id]).all
    assert_equal 2, external_ids.length
    assert_includes external_ids.map { |e| e[:source] }, "yelp"
    assert_includes external_ids.map { |e| e[:source] }, "google"

    # Restaurant has ratings from both sources
    ratings = @db[:ratings].where(restaurant_id: restaurant[:id]).all
    assert_equal 2, ratings.length
    yelp_rating = ratings.find { |r| r[:source] == "yelp" }
    google_rating = ratings.find { |r| r[:source] == "google" }
    assert_equal 4.5, yelp_rating[:score]
    assert_equal 4.6, google_rating[:score]
  end

  def test_index_creates_separate_restaurants_for_different_businesses
    stub_yelp_search_multiple
    stub_google_search_different
    stub_yelp_business("bakery-barrie")
    stub_yelp_business("coffee-barrie")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    google = GrubStars::Adapters::Google.new(api_key: "test_key")
    service = create_service(adapters: [yelp, google])

    stats = service.index(location: "barrie, ontario")

    # 2 from Yelp created, 1 from Google creates new (different business)
    assert_equal 3, stats[:total]
    assert_equal 3, stats[:created]
    assert_equal 0, stats[:merged]
    assert_equal 3, @db[:restaurants].count
  end

  def test_index_raises_error_without_configured_adapters
    yelp = GrubStars::Adapters::Yelp.new(api_key: nil)
    google = GrubStars::Adapters::Google.new(api_key: nil)
    service = create_service(adapters: [yelp, google])

    error = assert_raises(Services::IndexRestaurantsService::NoAdaptersConfiguredError) do
      service.index(location: "barrie")
    end

    assert_match(/No adapters configured/, error.message)
  end

  private

  def create_service(adapters:)
    # Create repositories with test database
    restaurant_repo = Infrastructure::Repositories::RestaurantRepository.new(@db)
    rating_repo = Infrastructure::Repositories::RatingRepository.new(@db)
    media_repo = Infrastructure::Repositories::MediaRepository.new(@db)
    category_repo = Infrastructure::Repositories::CategoryRepository.new(@db)
    external_id_repo = Infrastructure::Repositories::ExternalIdRepository.new(@db)

    Services::IndexRestaurantsService.new(
      restaurant_repo: restaurant_repo,
      rating_repo: rating_repo,
      media_repo: media_repo,
      category_repo: category_repo,
      external_id_repo: external_id_repo,
      adapters: adapters
    )
  end

  def stub_yelp_search
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [yelp_business_data("bakery-barrie", "Test Bakery", 44.3894, -79.6903)]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_yelp_search_multiple
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .to_return(
        status: 200,
        body: {
          total: 2,
          businesses: [
            yelp_business_data("bakery-barrie", "Test Bakery", 44.3894, -79.6903,
                               address: "123 Main St", phone: "+17055551234"),
            yelp_business_data("coffee-barrie", "Test Coffee", 44.3920, -79.6850,
                               address: "456 Other St", phone: "+17055559999")
          ]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_yelp_business(id)
    stub_request(:get, /api\.yelp\.com.*businesses\/#{id}/)
      .to_return(
        status: 200,
        body: yelp_business_data(id, "Test Business", 44.3894, -79.6903).to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_google_search
    stub_request(:get, /maps\.googleapis\.com.*textsearch/)
      .to_return(
        status: 200,
        body: {
          status: "OK",
          results: [google_place_data("ChIJtest123", "Test Bakery", 44.3895, -79.6902)]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_google_search_different
    # Use coordinates far away from the Yelp businesses to ensure no matching
    stub_request(:get, /maps\.googleapis\.com.*textsearch/)
      .to_return(
        status: 200,
        body: {
          status: "OK",
          results: [google_place_data("ChIJdifferent", "Totally Different Place", 43.6532, -79.3832)]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def yelp_business_data(id, name, lat, lng, address: "123 Main St", phone: "+17055551234")
    {
      "id" => id,
      "name" => name,
      "rating" => 4.5,
      "review_count" => 100,
      "coordinates" => { "latitude" => lat, "longitude" => lng },
      "location" => {
        "address1" => address,
        "city" => "Barrie",
        "state" => "ON",
        "zip_code" => "L4M 1A6",
        "country" => "CA"
      },
      "categories" => [{ "alias" => "bakeries", "title" => "Bakeries" }],
      "photos" => ["https://example.com/photo1.jpg"],
      "phone" => phone
    }
  end

  def google_place_data(place_id, name, lat, lng)
    {
      "place_id" => place_id,
      "name" => name,
      "rating" => 4.6,
      "user_ratings_total" => 150,
      "geometry" => { "location" => { "lat" => lat, "lng" => lng } },
      "formatted_address" => "123 Main St, Barrie, ON L4M 1A6, Canada",
      "types" => %w[bakery food establishment],
      "photos" => [{ "photo_reference" => "photo123" }]
    }
  end
end
