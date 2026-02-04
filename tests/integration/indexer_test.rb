# frozen_string_literal: true

require_relative "../test_helper"
require "webmock/minitest"

class IndexerTest < GrubStars::IntegrationTest
  def setup
    super
    WebMock.reset!
    WebMock.disable_net_connect!
    # Stub all reviews endpoints to return empty reviews by default
    stub_all_reviews_endpoints
    # Stub business details endpoints (for fetch_business_details)
    stub_business_details_endpoints
  end

  def stub_all_reviews_endpoints
    # Stub Yelp reviews endpoint
    stub_request(:get, /api\.yelp\.com.*\/reviews/)
      .to_return(
        status: 200,
        body: { reviews: [] }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Stub Google reviews endpoint
    stub_request(:get, /maps\.googleapis\.com.*details.*fields=reviews/)
      .to_return(
        status: 200,
        body: { status: "OK", result: { reviews: [] } }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Stub TripAdvisor reviews endpoint
    stub_request(:get, /api\.content\.tripadvisor\.com.*\/reviews/)
      .to_return(
        status: 200,
        body: { data: [] }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_business_details_endpoints
    # Stub Yelp business details endpoint (for fetch_business_details)
    stub_request(:get, /api\.yelp\.com.*businesses\/[^\/]+$/)
      .to_return(
        status: 200,
        body: {
          "id" => "test-business",
          "name" => "Test Business",
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
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Stub Google place details endpoint (for fetch_business_details)
    stub_request(:get, /maps\.googleapis\.com.*details\/json/)
      .to_return(
        status: 200,
        body: {
          status: "OK",
          result: google_details_data("test-place")
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
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
    stub_google_details("ChIJtest123")

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
    stub_google_details("ChIJdifferent")

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

  def test_index_with_category_filter
    # Stub request that includes category parameter
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .with(query: hash_including(categories: "bakery"))
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [yelp_business_data("bakery-barrie", "Test Bakery", 44.3894, -79.6903)]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
    stub_yelp_business("bakery-barrie")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    service = create_service(adapters: [yelp])

    stats = service.index(location: "barrie, ontario", categories: "bakery")

    assert_equal 1, stats[:total]
    assert_equal 1, stats[:created]

    # Verify the request was made with category parameter
    assert_requested :get, /api\.yelp\.com.*businesses\/search/,
                     query: hash_including(categories: "bakery"),
                     times: 1
  end

  def test_index_stores_reviews_and_generates_description
    stub_yelp_search
    stub_yelp_business("bakery-barrie")
    stub_yelp_reviews_with_content("bakery-barrie")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    service = create_service(adapters: [yelp])

    stats = service.index(location: "barrie, ontario")

    assert_equal 1, stats[:created]

    # Verify reviews are stored
    restaurant = @db[:restaurants].first
    reviews = @db[:reviews].where(restaurant_id: restaurant[:id]).all
    assert_equal 2, reviews.length
    assert_equal "yelp", reviews.first[:source]
    assert_includes reviews.first[:snippet], "Amazing bakery"

    # Verify description is generated from first review
    refute_nil restaurant[:description]
    assert_includes restaurant[:description], "Amazing bakery"
  end

  def test_index_stores_reviews_from_multiple_sources
    stub_yelp_search
    stub_google_search
    stub_yelp_business("bakery-barrie")
    stub_yelp_reviews_with_content("bakery-barrie")
    stub_google_reviews_with_content("ChIJtest123")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    google = GrubStars::Adapters::Google.new(api_key: "test_key")
    service = create_service(adapters: [yelp, google])

    stats = service.index(location: "barrie, ontario")

    # Restaurant should be merged (same location)
    assert_equal 1, @db[:restaurants].count

    # Should have reviews from both sources
    restaurant = @db[:restaurants].first
    reviews = @db[:reviews].where(restaurant_id: restaurant[:id]).all

    yelp_reviews = reviews.select { |r| r[:source] == "yelp" }
    google_reviews = reviews.select { |r| r[:source] == "google" }

    assert_equal 2, yelp_reviews.length
    assert_equal 2, google_reviews.length
  end

  def test_description_truncates_long_reviews
    stub_yelp_search
    stub_yelp_business("bakery-barrie")
    stub_yelp_reviews_with_long_content("bakery-barrie")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    service = create_service(adapters: [yelp])

    service.index(location: "barrie, ontario")

    restaurant = @db[:restaurants].first
    refute_nil restaurant[:description]
    # Description should be truncated to ~200 chars
    assert restaurant[:description].length <= 210
    assert restaurant[:description].end_with?("...")
  end

  private

  def create_service(adapters:)
    # Create repositories with test database
    restaurant_repo = Infrastructure::Repositories::RestaurantRepository.new(@db)
    rating_repo = Infrastructure::Repositories::RatingRepository.new(@db)
    review_repo = Infrastructure::Repositories::ReviewRepository.new(@db)
    media_repo = Infrastructure::Repositories::MediaRepository.new(@db)
    category_repo = Infrastructure::Repositories::CategoryRepository.new(@db)
    external_id_repo = Infrastructure::Repositories::ExternalIdRepository.new(@db)

    Services::IndexRestaurantsService.new(
      restaurant_repo: restaurant_repo,
      rating_repo: rating_repo,
      review_repo: review_repo,
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

  def stub_google_details(place_id)
    stub_request(:get, /maps\.googleapis\.com.*details/)
      .with(query: hash_including(placeid: place_id))
      .to_return(
        status: 200,
        body: {
          status: "OK",
          result: google_details_data(place_id)
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

  def stub_yelp_reviews_with_content(business_id)
    stub_request(:get, /api\.yelp\.com.*businesses\/#{business_id}\/reviews/)
      .to_return(
        status: 200,
        body: {
          reviews: [
            {
              "id" => "review1",
              "rating" => 5,
              "text" => "Amazing bakery! The croissants are to die for. Best in town.",
              "url" => "https://www.yelp.com/biz/test?hrid=review1",
              "time_created" => "2024-01-15 10:30:00"
            },
            {
              "id" => "review2",
              "rating" => 4,
              "text" => "Great selection of breads and pastries. Friendly staff.",
              "url" => "https://www.yelp.com/biz/test?hrid=review2",
              "time_created" => "2024-01-10 14:20:00"
            }
          ],
          total: 2
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_yelp_reviews_with_long_content(business_id)
    long_review = "This bakery is absolutely incredible! " * 10 # ~380 chars
    stub_request(:get, /api\.yelp\.com.*businesses\/#{business_id}\/reviews/)
      .to_return(
        status: 200,
        body: {
          reviews: [
            {
              "id" => "review1",
              "rating" => 5,
              "text" => long_review,
              "url" => "https://www.yelp.com/biz/test?hrid=review1",
              "time_created" => "2024-01-15 10:30:00"
            }
          ],
          total: 1
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_google_reviews_with_content(place_id)
    # Match Google details API with reviews field
    stub_request(:get, /maps\.googleapis\.com.*details\/json/)
      .with(query: hash_including(placeid: place_id, fields: "reviews"))
      .to_return(
        status: 200,
        body: {
          status: "OK",
          result: {
            reviews: [
              {
                "author_name" => "John D.",
                "rating" => 5,
                "text" => "Wonderful place! Fresh bread every morning.",
                "time" => 1705312800,
                "relative_time_description" => "a month ago"
              },
              {
                "author_name" => "Jane S.",
                "rating" => 4,
                "text" => "Good pastries, nice atmosphere.",
                "time" => 1704708000,
                "relative_time_description" => "2 months ago"
              }
            ]
          }
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def google_details_data(place_id)
    {
      "place_id" => place_id,
      "name" => "Test Place",
      "rating" => 4.6,
      "user_ratings_total" => 150,
      "geometry" => { "location" => { "lat" => 44.3894, "lng" => -79.6903 } },
      "formatted_address" => "123 Main St, Barrie, ON L4M 1A6, Canada",
      "formatted_phone_number" => "(705) 555-1234",
      "types" => %w[bakery food establishment],
      "photos" => [
        { "photo_reference" => "photo1", "url" => "https://example.com/photo1.jpg" },
        { "photo_reference" => "photo2", "url" => "https://example.com/photo2.jpg" }
      ]
    }
  end
end
