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
    assert_equal 100, captured_limit  # Default limit
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
  end

  private

  def create_test_db
    db = Sequel.sqlite
    GrubStars::Database.create_schema(db)
    db
  end
end
