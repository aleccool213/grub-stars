# frozen_string_literal: true

require_relative "../../test_helper"

class IndexRestaurantsServiceTest < Minitest::Test
  def setup
    @db = create_test_db
    @restaurant_repo = Infrastructure::Repositories::RestaurantRepository.new(@db)
    @rating_repo = Infrastructure::Repositories::RatingRepository.new(@db)
    @media_repo = Infrastructure::Repositories::MediaRepository.new(@db)
    @category_repo = Infrastructure::Repositories::CategoryRepository.new(@db)
    @external_id_repo = Infrastructure::Repositories::ExternalIdRepository.new(@db)
    @matcher = Domain::Matcher.new

    @service = Services::IndexRestaurantsService.new(
      restaurant_repo: @restaurant_repo,
      rating_repo: @rating_repo,
      media_repo: @media_repo,
      category_repo: @category_repo,
      external_id_repo: @external_id_repo,
      matcher: @matcher,
      adapters: [],
      logger: GrubStars::Logger.new
    )
  end

  def teardown
    @db.disconnect
  end

  def test_raises_error_when_no_adapters_configured
    error = assert_raises(Services::IndexRestaurantsService::NoAdaptersConfiguredError) do
      @service.index(location: "Test City")
    end

    assert_match(/No adapters configured/, error.message)
  end

  def test_creates_new_restaurant
    business_data = {
      external_id: "test-123",
      name: "New Restaurant",
      address: "123 Main St",
      latitude: 44.5,
      longitude: -79.5,
      phone: "555-1234",
      rating: 4.5,
      review_count: 100,
      categories: ["Restaurant", "Italian"],
      photos: ["photo1.jpg", "photo2.jpg"]
    }

    result = @service.send(:store_business, business_data, "test")

    assert_equal :created, result

    # Verify restaurant was created
    restaurant = @restaurant_repo.find_by_external_id("test", "test-123")
    assert restaurant
    assert_equal "New Restaurant", restaurant.name
    assert_equal "123 Main St", restaurant.address

    # Verify rating was stored
    ratings = @rating_repo.find_by_restaurant_id(restaurant.id)
    assert_equal 1, ratings.length
    assert_equal 4.5, ratings.first.score

    # Verify categories were stored
    categories = @category_repo.find_by_restaurant_id(restaurant.id)
    category_names = categories.map(&:name)
    assert_includes category_names, "Restaurant"
    assert_includes category_names, "Italian"

    # Verify photos were stored
    photos = @media_repo.find_photos(restaurant.id)
    assert_equal 2, photos.length
  end

  def test_updates_existing_restaurant_by_external_id
    # Create existing restaurant
    restaurant = Domain::Models::Restaurant.new(
      name: "Old Name",
      address: "Old Address"
    )
    @restaurant_repo.create(restaurant)

    # Add external ID
    ext_id = Domain::Models::ExternalId.new(
      restaurant_id: restaurant.id,
      source: "test",
      external_id: "test-123"
    )
    @external_id_repo.save(ext_id)

    # Update with new data
    business_data = {
      external_id: "test-123",
      name: "New Name",
      address: "New Address",
      rating: 4.0,
      categories: ["Updated"]
    }

    result = @service.send(:store_business, business_data, "test")

    assert_equal :updated, result

    # Verify restaurant was updated
    updated = @restaurant_repo.find_by_id(restaurant.id)
    assert_equal "New Name", updated.name
    assert_equal "New Address", updated.address
  end

  def test_merges_restaurant_when_match_found
    # Create existing restaurant (from yelp)
    existing = Domain::Models::Restaurant.new(
      name: "Flying Monkeys Brewery",
      address: "107 Dunlop St E",
      latitude: 44.389356,
      longitude: -79.690331,
      phone: "7057078020"
    )
    @restaurant_repo.create(existing)

    # Add yelp external ID
    @external_id_repo.save(Domain::Models::ExternalId.new(
      restaurant_id: existing.id,
      source: "yelp",
      external_id: "yelp-123"
    ))

    # Index from google with very similar data
    business_data = {
      external_id: "google-456",
      name: "Flying Monkeys Brewery",
      address: "107 Dunlop Street East",
      latitude: 44.389360,
      longitude: -79.690335,
      phone: "7057078020",
      rating: 4.5,
      categories: ["Brewery"]
    }

    result = @service.send(:store_business, business_data, "google")

    assert_equal :merged, result

    # Verify google external ID was added
    ext_ids = @external_id_repo.find_by_restaurant_id(existing.id)
    sources = ext_ids.map(&:source)
    assert_includes sources, "yelp"
    assert_includes sources, "google"

    # Verify only one restaurant exists
    assert_equal 1, @db[:restaurants].count
  end

  def test_passes_categories_to_adapter
    # Create a mock adapter that captures the categories parameter
    captured_categories = nil
    captured_limit = nil
    mock_adapter = Minitest::Mock.new
    mock_adapter.expect(:configured?, true)
    # source_name is called multiple times for adapter_phase logging and progress tracking
    mock_adapter.expect(:source_name, "mock")  # for adapter_phase :starting
    mock_adapter.expect(:source_name, "mock")  # for index_with_adapter
    mock_adapter.expect(:source_name, "mock")  # for adapter_phase :completed
    mock_adapter.expect(:source_name, "mock")  # for adapters hash key
    mock_adapter.expect(:source_name, "mock")  # for reverse_lookup adapter filter
    mock_adapter.expect(:search_all_businesses, nil) do |location:, categories:, limit:|
      captured_categories = categories
      captured_limit = limit
      # Don't yield any businesses
      0
    end

    service = Services::IndexRestaurantsService.new(
      restaurant_repo: @restaurant_repo,
      rating_repo: @rating_repo,
      media_repo: @media_repo,
      category_repo: @category_repo,
      external_id_repo: @external_id_repo,
      matcher: @matcher,
      adapters: [mock_adapter],
      logger: GrubStars::Logger.silent
    )

    service.index(location: "Test City", categories: "bakery")

    assert_equal "bakery", captured_categories
    assert_equal 50, captured_limit  # Default limit
    mock_adapter.verify
  end

  def test_index_restaurant_creates_single_restaurant
    business_data = {
      external_id: "yelp-789",
      name: "Single Restaurant",
      address: "789 King St",
      latitude: 43.6,
      longitude: -79.4,
      rating: 4.2,
      review_count: 50,
      categories: ["Pizza"],
      photos: ["photo.jpg"]
    }

    result = @service.index_restaurant(business_data: business_data, source: "yelp")

    assert_equal :created, result

    # Verify restaurant was created
    restaurant = @restaurant_repo.find_by_external_id("yelp", "yelp-789")
    assert restaurant
    assert_equal "Single Restaurant", restaurant.name
    assert_equal "789 King St", restaurant.address

    # Verify rating was stored
    ratings = @rating_repo.find_by_restaurant_id(restaurant.id)
    assert_equal 1, ratings.length
    assert_equal 4.2, ratings.first.score
  end

  def test_index_restaurant_updates_existing_restaurant
    # Create existing restaurant
    restaurant = Domain::Models::Restaurant.new(
      name: "Old Restaurant Name",
      address: "Old Address"
    )
    @restaurant_repo.create(restaurant)

    # Add external ID
    @external_id_repo.save(Domain::Models::ExternalId.new(
      restaurant_id: restaurant.id,
      source: "yelp",
      external_id: "yelp-789"
    ))

    # Update with new data via index_restaurant
    business_data = {
      external_id: "yelp-789",
      name: "Updated Restaurant Name",
      address: "Updated Address",
      rating: 4.8,
      categories: ["Updated"]
    }

    result = @service.index_restaurant(business_data: business_data, source: "yelp")

    assert_equal :updated, result

    # Verify restaurant was updated
    updated = @restaurant_repo.find_by_id(restaurant.id)
    assert_equal "Updated Restaurant Name", updated.name
    assert_equal "Updated Address", updated.address
  end

  def test_index_restaurant_merges_matching_restaurant
    # Create existing restaurant from yelp
    existing = Domain::Models::Restaurant.new(
      name: "Pizza Palace",
      address: "100 Main St",
      latitude: 44.5,
      longitude: -79.5,
      phone: "5551234567"
    )
    @restaurant_repo.create(existing)

    @external_id_repo.save(Domain::Models::ExternalId.new(
      restaurant_id: existing.id,
      source: "yelp",
      external_id: "yelp-100"
    ))

    # Index similar restaurant from google
    business_data = {
      external_id: "google-200",
      name: "Pizza Palace",
      address: "100 Main Street",
      latitude: 44.500002,
      longitude: -79.500003,
      phone: "5551234567",
      rating: 4.3,
      categories: ["Pizza"]
    }

    result = @service.index_restaurant(business_data: business_data, source: "google")

    assert_equal :merged, result

    # Verify external IDs were merged
    ext_ids = @external_id_repo.find_by_restaurant_id(existing.id)
    sources = ext_ids.map(&:source)
    assert_includes sources, "yelp"
    assert_includes sources, "google"

    # Verify only one restaurant exists
    assert_equal 1, @db[:restaurants].count
  end

  def test_fetch_business_details_merges_photos_from_details
    # Mock adapter that returns empty photos from search, but photos from get_business
    mock_adapter = Object.new
    def mock_adapter.source_name; "test"; end
    def mock_adapter.get_business(id)
      {
        external_id: "test:#{id}",
        name: "Test Restaurant",
        photos: ["detail_photo1.jpg", "detail_photo2.jpg"],
        phone: "555-9999"
      }
    end

    # Search data has no photos
    search_data = {
      external_id: "test:123",
      name: "Test Restaurant",
      address: "123 Test St",
      photos: []
    }

    result = @service.send(:fetch_business_details, mock_adapter, search_data)

    # Photos should be fetched from details
    assert_equal ["detail_photo1.jpg", "detail_photo2.jpg"], result[:photos]
    # Original search data fields should be preserved
    assert_equal "123 Test St", result[:address]
    # Phone from details should fill in missing value
    assert_equal "555-9999", result[:phone]
  end

  def test_fetch_business_details_handles_api_errors_gracefully
    # Mock adapter that raises an error
    mock_adapter = Object.new
    def mock_adapter.source_name; "test"; end
    def mock_adapter.get_business(_id)
      raise StandardError, "API error"
    end

    search_data = {
      external_id: "test:123",
      name: "Test Restaurant",
      photos: []
    }

    # Should return original search data on error
    result = @service.send(:fetch_business_details, mock_adapter, search_data)

    assert_equal search_data, result
  end

  def test_index_fetches_details_for_photos
    # Create a mock adapter that tracks whether get_business was called
    mock_adapter = Minitest::Mock.new
    mock_adapter.expect(:configured?, true)
    # source_name is called multiple times for logging and progress tracking
    mock_adapter.expect(:source_name, "mock")  # for adapter_phase :starting
    mock_adapter.expect(:source_name, "mock")  # for index_with_adapter

    # search_all_businesses yields one business without photos
    mock_adapter.expect(:search_all_businesses, 1) do |location:, categories:, limit:, &block|
      block.call(
        { external_id: "mock:123", name: "Test Place", photos: [], latitude: 44.5, longitude: -79.5 },
        { current: 1, total: 1, percent: 100 }
      )
      1
    end

    # get_business should be called to fetch details with photos
    mock_adapter.expect(:source_name, "mock")  # for fetch_business_details
    mock_adapter.expect(:get_business, {
      external_id: "mock:123",
      name: "Test Place",
      photos: ["photo1.jpg", "photo2.jpg"],
      latitude: 44.5,
      longitude: -79.5
    }, ["123"])
    mock_adapter.expect(:source_name, "mock")  # for adapter_phase :completed
    mock_adapter.expect(:source_name, "mock")  # for adapters hash key
    mock_adapter.expect(:source_name, "mock")  # for reverse_lookup adapter filter

    service = Services::IndexRestaurantsService.new(
      restaurant_repo: @restaurant_repo,
      rating_repo: @rating_repo,
      media_repo: @media_repo,
      category_repo: @category_repo,
      external_id_repo: @external_id_repo,
      matcher: @matcher,
      adapters: [mock_adapter],
      logger: GrubStars::Logger.silent
    )

    stats = service.index(location: "Test City")

    assert_equal 1, stats[:total]

    # Verify photos were stored
    restaurant = @restaurant_repo.find_by_external_id("mock", "mock:123")
    photos = @media_repo.find_photos(restaurant.id)
    assert_equal 2, photos.length

    mock_adapter.verify
  end

  def test_limit_applies_per_adapter_not_shared
    # This test verifies that each adapter gets its own limit of 100
    # rather than sharing a single pool of 100 across all adapters

    # Track what limit each adapter receives
    captured_limits = {}

    # Create mock adapter class that properly handles blocks
    mock_adapter1 = MockAdapter.new("adapter1", 60, captured_limits)
    mock_adapter2 = MockAdapter.new("adapter2", 50, captured_limits)

    service = Services::IndexRestaurantsService.new(
      restaurant_repo: @restaurant_repo,
      rating_repo: @rating_repo,
      media_repo: @media_repo,
      category_repo: @category_repo,
      external_id_repo: @external_id_repo,
      matcher: @matcher,
      adapters: [mock_adapter1, mock_adapter2],
      logger: GrubStars::Logger.new
    )

    stats = service.index(location: "Test City", limit: 100)

    # Each adapter should receive the full limit of 100
    assert_equal 100, captured_limits["adapter1"], "Adapter 1 should receive limit of 100"
    assert_equal 100, captured_limits["adapter2"], "Adapter 2 should receive limit of 100 (per adapter, not shared)"

    # Total should be 110 (60 from adapter1 + 50 from adapter2)
    assert_equal 110, stats[:total], "Total should include all restaurants from both adapters"
  end

  def test_reverse_lookup_merges_missing_sources
    # Simulate: adapter1 (yelp) indexes 3 restaurants via forward search.
    # adapter2 (tripadvisor) indexes only 1 via forward search.
    # Reverse lookup should search adapter2 by name for the 2 remaining restaurants.

    # adapter1 yields 3 restaurants (forward search)
    adapter1 = ReverseLookupForwardAdapter.new("yelp", [
      { external_id: "yelp:r1", name: "Pizza Palace", address: "100 Main St", latitude: 44.5, longitude: -79.5, phone: "5551111111", rating: 4.0, categories: ["Pizza"] },
      { external_id: "yelp:r2", name: "Burger Barn", address: "200 Main St", latitude: 44.51, longitude: -79.51, phone: "5552222222", rating: 4.2, categories: ["Burgers"] },
      { external_id: "yelp:r3", name: "Sushi Spot", address: "300 Main St", latitude: 44.52, longitude: -79.52, phone: "5553333333", rating: 4.5, categories: ["Sushi"] }
    ])

    # adapter2 yields 1 restaurant (forward search) that matches r1, but has search_by_name for r2/r3
    adapter2 = ReverseLookupTripadvisorAdapter.new("tripadvisor",
      # Forward results (only Pizza Palace)
      [{ external_id: "ta:r1", name: "Pizza Palace", address: "100 Main St", latitude: 44.5, longitude: -79.5, phone: "5551111111", rating: 3.9, categories: ["Pizza"] }],
      # Reverse lookup search_by_name results keyed by restaurant name
      {
        "Burger Barn" => [
          { external_id: "ta:r2", name: "Burger Barn", address: "200 Main St", latitude: 44.51, longitude: -79.51, phone: "5552222222", rating: 4.0, categories: ["Burgers"] }
        ],
        "Sushi Spot" => [
          { external_id: "ta:r3", name: "Sushi Spot", address: "300 Main St", latitude: 44.52, longitude: -79.52, phone: "5553333333", rating: 4.3, categories: ["Sushi"] }
        ]
      }
    )

    service = Services::IndexRestaurantsService.new(
      restaurant_repo: @restaurant_repo,
      rating_repo: @rating_repo,
      media_repo: @media_repo,
      category_repo: @category_repo,
      external_id_repo: @external_id_repo,
      matcher: @matcher,
      adapters: [adapter1, adapter2],
      logger: GrubStars::Logger.silent
    )

    stats = service.index(location: "Test City", limit: 50)

    # Should still only have 3 restaurants (no duplicates)
    assert_equal 3, @db[:restaurants].count

    # All 3 should now have tripadvisor external IDs (1 from forward, 2 from reverse)
    ta_ext_ids = @db[:external_ids].where(source: "tripadvisor").count
    assert_equal 3, ta_ext_ids, "All 3 restaurants should have tripadvisor data after reverse lookup"

    # Verify merged count includes reverse-lookup merges
    assert_operator stats[:merged], :>=, 2, "At least 2 merges should come from reverse lookup"
  end

  def test_reverse_lookup_skips_restaurants_already_matched
    # adapter1 yields 1 restaurant
    adapter1 = ReverseLookupForwardAdapter.new("yelp", [
      { external_id: "yelp:r1", name: "Pizza Palace", address: "100 Main St", latitude: 44.5, longitude: -79.5, phone: "5551111111", rating: 4.0, categories: ["Pizza"] }
    ])

    # adapter2 also matched this restaurant in forward search
    adapter2 = ReverseLookupTripadvisorAdapter.new("tripadvisor",
      [{ external_id: "ta:r1", name: "Pizza Palace", address: "100 Main St", latitude: 44.5, longitude: -79.5, phone: "5551111111", rating: 3.9, categories: ["Pizza"] }],
      {}  # No reverse lookup needed
    )

    service = Services::IndexRestaurantsService.new(
      restaurant_repo: @restaurant_repo,
      rating_repo: @rating_repo,
      media_repo: @media_repo,
      category_repo: @category_repo,
      external_id_repo: @external_id_repo,
      matcher: @matcher,
      adapters: [adapter1, adapter2],
      logger: GrubStars::Logger.silent
    )

    stats = service.index(location: "Test City", limit: 50)

    # Only 1 restaurant should exist
    assert_equal 1, @db[:restaurants].count

    # Both sources should be present
    ext_ids = @db[:external_ids].where(restaurant_id: @db[:restaurants].first[:id]).all
    sources = ext_ids.map { |e| e[:source] }
    assert_includes sources, "yelp"
    assert_includes sources, "tripadvisor"
  end

  def test_reverse_lookup_does_not_match_wrong_restaurant
    # adapter1 yields a restaurant
    adapter1 = ReverseLookupForwardAdapter.new("yelp", [
      { external_id: "yelp:r1", name: "Pizza Palace", address: "100 Main St", latitude: 44.5, longitude: -79.5, phone: "5551111111", rating: 4.0, categories: ["Pizza"] }
    ])

    # adapter2 returns a different restaurant in reverse lookup
    adapter2 = ReverseLookupTripadvisorAdapter.new("tripadvisor", [],
      {
        "Pizza Palace" => [
          { external_id: "ta:other", name: "Pizza Paradise Supreme", address: "999 Other Rd", latitude: 45.0, longitude: -80.0, phone: "5559999999", rating: 3.5, categories: ["Pizza"] }
        ]
      }
    )

    service = Services::IndexRestaurantsService.new(
      restaurant_repo: @restaurant_repo,
      rating_repo: @rating_repo,
      media_repo: @media_repo,
      category_repo: @category_repo,
      external_id_repo: @external_id_repo,
      matcher: @matcher,
      adapters: [adapter1, adapter2],
      logger: GrubStars::Logger.silent
    )

    stats = service.index(location: "Test City", limit: 50)

    # Restaurant should still only have yelp source (no false match)
    ext_ids = @db[:external_ids].where(restaurant_id: @db[:restaurants].first[:id]).all
    sources = ext_ids.map { |e| e[:source] }
    assert_includes sources, "yelp"
    refute_includes sources, "tripadvisor"
  end

  # Mock adapter for forward-only search (like Yelp/Google)
  class ReverseLookupForwardAdapter
    attr_reader :source_name

    def initialize(name, forward_results)
      @source_name = name
      @forward_results = forward_results
    end

    def configured? = true

    def search_all_businesses(location:, categories:, limit:)
      @forward_results.each_with_index do |biz, i|
        yield(biz, { current: i + 1, total: @forward_results.length, percent: ((i + 1).to_f / @forward_results.length * 100).round })
      end
      @forward_results.length
    end

    def get_business(id)
      result = @forward_results.find { |b| b[:external_id].end_with?(id) || b[:external_id] == "#{@source_name}:#{id}" }
      result || { external_id: "#{@source_name}:#{id}", name: "Unknown", photos: [] }
    end

    def search_by_name(name:, location:, limit:) = []
    def get_reviews(_id) = []
  end

  # Mock adapter for TripAdvisor-like behavior (few forward results, search_by_name for reverse)
  class ReverseLookupTripadvisorAdapter
    attr_reader :source_name

    def initialize(name, forward_results, reverse_lookup_map)
      @source_name = name
      @forward_results = forward_results
      @reverse_lookup_map = reverse_lookup_map
    end

    def configured? = true

    def search_all_businesses(location:, categories:, limit:)
      @forward_results.each_with_index do |biz, i|
        yield(biz, { current: i + 1, total: @forward_results.length, percent: ((i + 1).to_f / @forward_results.length * 100).round })
      end
      @forward_results.length
    end

    def get_business(id)
      all = @forward_results + @reverse_lookup_map.values.flatten
      result = all.find { |b| b[:external_id].end_with?(id) || b[:external_id] == "#{@source_name}:#{id}" }
      result || { external_id: "#{@source_name}:#{id}", name: "Unknown", photos: [] }
    end

    def search_by_name(name:, location:, limit:)
      @reverse_lookup_map[name] || []
    end

    def get_reviews(_id) = []
  end

  # Helper class for testing adapter behavior
  class MockAdapter
    attr_reader :source_name

    def initialize(name, num_results, captured_limits)
      @source_name = name
      @num_results = num_results
      @captured_limits = captured_limits
    end

    def configured?
      true
    end

    def search_all_businesses(location:, categories:, limit:)
      @captured_limits[@source_name] = limit

      @num_results.times do |i|
        yield(
          {
            external_id: "#{@source_name}-#{i}",
            name: "Restaurant #{@source_name} #{i}",
            address: "#{i} Main St",
            latitude: 44.0 + (i * 0.01),
            longitude: -79.0 + (i * 0.01),
            rating: 4.0,
            categories: ["Restaurant"]
          },
          { current: i + 1, total: @num_results, percent: ((i + 1).to_f / @num_results * 100).to_i }
        )
      end
    end

    # Returns details with photos (simulates real API behavior where photos come from details endpoint)
    def get_business(id)
      {
        external_id: "#{@source_name}:#{id}",
        name: "Restaurant #{id}",
        photos: ["https://example.com/#{id}/photo1.jpg", "https://example.com/#{id}/photo2.jpg"],
        latitude: 44.0,
        longitude: -79.0
      }
    end
  end

  private

  def create_test_db
    db = Sequel.sqlite
    GrubStars::Database.create_schema(db)
    db
  end
end
