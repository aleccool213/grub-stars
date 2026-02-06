# frozen_string_literal: true

require_relative "../test_helper"
require "webmock/minitest"

class LocationSearchTest < GrubStars::IntegrationTest
  def setup
    super
    WebMock.disable_net_connect!
  end

  def teardown
    WebMock.allow_net_connect!
    super
  end

  def test_index_stores_location_and_search_filters_by_location
    # Index restaurants in Barrie
    stub_yelp_search_barrie
    stub_yelp_business("bakery-barrie")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    index_service = create_index_service(adapters: [yelp])

    stats = index_service.index(location: "barrie, ontario")
    assert_equal 1, stats[:created]

    # Verify location was stored
    restaurant = @db[:restaurants].first
    assert_equal "barrie, ontario", restaurant[:location]

    # Index restaurants in Toronto
    stub_yelp_search_toronto
    stub_yelp_business("bakery-toronto")

    stats = index_service.index(location: "toronto, ontario")
    assert_equal 1, stats[:created]
    assert_equal 2, @db[:restaurants].count

    # Search without location filter - returns both
    search_service = create_search_service
    results = search_service.search_by_name("Bakery")
    assert_equal 2, results.length

    # Search with Barrie location filter - returns only Barrie restaurant
    results = search_service.search_by_name("Bakery", location: "barrie, ontario")
    assert_equal 1, results.length
    assert_equal "Test Bakery - Barrie", results.first.name
    assert_equal "barrie, ontario", results.first.location

    # Search with Toronto location filter - returns only Toronto restaurant
    results = search_service.search_by_name("Bakery", location: "toronto, ontario")
    assert_equal 1, results.length
    assert_equal "Test Bakery - Toronto", results.first.name
    assert_equal "toronto, ontario", results.first.location
  end

  def test_search_by_category_with_location_filter
    # Index restaurants with categories
    stub_yelp_search_barrie_bakery
    stub_yelp_business("bakery-barrie")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    index_service = create_index_service(adapters: [yelp])

    index_service.index(location: "barrie, ontario")

    stub_yelp_search_toronto_bakery
    stub_yelp_business("bakery-toronto")
    index_service.index(location: "toronto, ontario")

    # Search by category with location filter
    search_service = create_search_service
    results = search_service.search_by_category("Bakery", location: "barrie, ontario")

    assert_equal 1, results.length
    assert_equal "Test Bakery - Barrie", results.first.name
    assert_equal "barrie, ontario", results.first.location
  end

  def test_search_with_invalid_location_raises_error
    # Index a restaurant in Barrie
    stub_yelp_search_barrie
    stub_yelp_business("bakery-barrie")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    index_service = create_index_service(adapters: [yelp])
    index_service.index(location: "barrie, ontario")

    # Try to search with a location that hasn't been indexed
    search_service = create_search_service
    error = assert_raises(Services::SearchRestaurantsService::LocationNotIndexedError) do
      search_service.search_by_name("Bakery", location: "montreal, quebec")
    end

    assert_match(/Location 'montreal, quebec' has not been indexed/, error.message)
    assert_match(/Available locations: barrie, ontario/, error.message)
  end

  def test_all_indexed_locations
    # Index restaurants in different locations
    stub_yelp_search_barrie
    stub_yelp_business("bakery-barrie")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    index_service = create_index_service(adapters: [yelp])

    index_service.index(location: "barrie, ontario")

    stub_yelp_search_toronto
    stub_yelp_business("bakery-toronto")
    index_service.index(location: "toronto, ontario")

    # Get all indexed locations
    search_service = create_search_service
    locations = search_service.all_indexed_locations

    assert_equal 2, locations.length
    assert_includes locations, "barrie, ontario"
    assert_includes locations, "toronto, ontario"
  end

  def test_index_stores_full_canonical_location_with_country
    # Index with canonical format including country (as autocomplete would provide)
    stub_yelp_search_barrie_canonical
    stub_yelp_business("bakery-barrie")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    index_service = create_index_service(adapters: [yelp])

    # Use canonical format with country and proper casing
    stats = index_service.index(location: "Barrie, Ontario, Canada")
    assert_equal 1, stats[:created]

    # Verify location was stored exactly as provided (with country)
    restaurant = @db[:restaurants].first
    assert_equal "Barrie, Ontario, Canada", restaurant[:location]
  end

  def test_search_with_full_canonical_location_format
    # Index with canonical format including country
    stub_yelp_search_barrie_canonical
    stub_yelp_business("bakery-barrie")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    index_service = create_index_service(adapters: [yelp])
    index_service.index(location: "Barrie, Ontario, Canada")

    # Search with the same canonical format
    search_service = create_search_service
    results = search_service.search_by_name("Bakery", location: "Barrie, Ontario, Canada")

    assert_equal 1, results.length
    assert_equal "Test Bakery - Barrie", results.first.name
    assert_equal "Barrie, Ontario, Canada", results.first.location
  end

  def test_search_by_category_with_full_canonical_location
    # Index with canonical format including country
    stub_yelp_search_barrie_bakery_canonical
    stub_yelp_business("bakery-barrie")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    index_service = create_index_service(adapters: [yelp])
    index_service.index(location: "Barrie, Ontario, Canada")

    # Search by category with the same canonical format
    search_service = create_search_service
    results = search_service.search_by_category("Bakery", location: "Barrie, Ontario, Canada")

    assert_equal 1, results.length
    assert_equal "Test Bakery - Barrie", results.first.name
  end

  def test_locations_stored_consistently_with_country
    # Test that locations are stored exactly as provided with country
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .with(query: hash_including(location: "Barrie, Ontario, Canada"))
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [yelp_business_data("bakery-barrie", "Test Bakery - Barrie", 44.3894, -79.6903)]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .with(query: hash_including(location: "Toronto, Ontario, Canada"))
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [yelp_business_data("bakery-toronto", "Test Bakery - Toronto", 43.6532, -79.3832)]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    stub_yelp_business("bakery-barrie")
    stub_yelp_business("bakery-toronto")

    yelp = GrubStars::Adapters::Yelp.new(api_key: "test_key")
    index_service = create_index_service(adapters: [yelp])

    # Index first location with country
    stats = index_service.index(location: "Barrie, Ontario, Canada")
    assert_equal 1, stats[:created]

    restaurant = @db[:restaurants].first
    assert_equal "Barrie, Ontario, Canada", restaurant[:location]

    # Index second location with country
    stats = index_service.index(location: "Toronto, Ontario, Canada")
    assert_equal 1, stats[:created]

    restaurant = @db[:restaurants].where(id: 2).first
    assert_equal "Toronto, Ontario, Canada", restaurant[:location]

    # Verify both locations are stored with their full format
    search_service = create_search_service
    locations = search_service.all_indexed_locations
    
    assert_equal 2, locations.length
    assert_includes locations, "barrie, ontario, canada"
    assert_includes locations, "toronto, ontario, canada"
  end

  private

  def create_index_service(adapters:)
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

  def create_search_service
    restaurant_repo = Infrastructure::Repositories::RestaurantRepository.new(@db)
    Services::SearchRestaurantsService.new(restaurant_repo: restaurant_repo)
  end

  def stub_yelp_search_barrie
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .with(query: hash_including(location: "barrie, ontario"))
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [yelp_business_data("bakery-barrie", "Test Bakery - Barrie", 44.3894, -79.6903)]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_yelp_search_barrie_canonical
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .with(query: hash_including(location: "Barrie, Ontario, Canada"))
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [yelp_business_data("bakery-barrie", "Test Bakery - Barrie", 44.3894, -79.6903)]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_yelp_search_barrie_bakery_canonical
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .with(query: hash_including(location: "Barrie, Ontario, Canada"))
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [
            yelp_business_data("bakery-barrie", "Test Bakery - Barrie", 44.3894, -79.6903,
                               categories: [{ "alias" => "bakeries", "title" => "Bakeries" }])
          ]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_yelp_search_toronto
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .with(query: hash_including(location: "toronto, ontario"))
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [yelp_business_data("bakery-toronto", "Test Bakery - Toronto", 43.6532, -79.3832)]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_yelp_search_barrie_bakery
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .with(query: hash_including(location: "barrie, ontario"))
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [
            yelp_business_data("bakery-barrie", "Test Bakery - Barrie", 44.3894, -79.6903,
                               categories: [{ "alias" => "bakeries", "title" => "Bakeries" }])
          ]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_yelp_search_toronto_bakery
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .with(query: hash_including(location: "toronto, ontario"))
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [
            yelp_business_data("bakery-toronto", "Test Bakery - Toronto", 43.6532, -79.3832,
                               categories: [{ "alias" => "bakeries", "title" => "Bakeries" }])
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

  def yelp_business_data(id, name, lat, lng, address: "123 Main St", phone: "+17055551234", categories: nil)
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
      "categories" => categories || [{ "alias" => "restaurants", "title" => "Restaurants" }],
      "photos" => ["https://example.com/photo1.jpg"],
      "phone" => phone
    }
  end
end
