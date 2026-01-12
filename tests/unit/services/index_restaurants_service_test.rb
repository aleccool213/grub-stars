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

    result = @service.send(:store_business, business_data, "test", nil)

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

    result = @service.send(:store_business, business_data, "test", nil)

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

    result = @service.send(:store_business, business_data, "google", nil)

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
    mock_adapter = Minitest::Mock.new
    mock_adapter.expect(:configured?, true)
    mock_adapter.expect(:source_name, "mock")
    mock_adapter.expect(:search_all_businesses, nil) do |location:, categories:|
      captured_categories = categories
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
      logger: GrubStars::Logger.new
    )

    service.index(location: "Test City", categories: "bakery")

    assert_equal "bakery", captured_categories
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

  def test_index_restaurant_stores_location_when_provided
    business_data = {
      external_id: "test-location-123",
      name: "Location Test Restaurant",
      address: "123 Main St",
      latitude: 44.5,
      longitude: -79.5,
      rating: 4.5,
      categories: ["Restaurant"]
    }

    result = @service.index_restaurant(
      business_data: business_data,
      source: "test",
      location: "Barrie, ON"
    )

    assert_equal :created, result

    # Verify location was stored
    restaurant = @restaurant_repo.find_by_external_id("test", "test-location-123")
    assert restaurant
    assert_equal "Barrie, ON", restaurant.location
  end

  private

  def create_test_db
    db = Sequel.sqlite
    GrubStars::Database.create_schema(db)
    db
  end
end
