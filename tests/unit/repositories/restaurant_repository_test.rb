# frozen_string_literal: true

require_relative "../../test_helper"

class RestaurantRepositoryTest < Minitest::Test
  def setup
    @db = create_test_db
    @repo = Infrastructure::Repositories::RestaurantRepository.new(@db)
  end

  def teardown
    @db.disconnect
  end

  def test_create_restaurant
    restaurant = Domain::Models::Restaurant.new(
      name: "Test Restaurant",
      address: "123 Main St",
      latitude: 44.5,
      longitude: -79.5,
      phone: "555-1234"
    )

    result = @repo.create(restaurant)

    assert result.id
    assert_equal "Test Restaurant", result.name
    assert_equal "123 Main St", result.address

    # Verify in database
    row = @db[:restaurants].where(id: result.id).first
    assert row
    assert_equal "Test Restaurant", row[:name]
  end

  def test_find_by_id
    # Create a restaurant directly in DB
    id = @db[:restaurants].insert(
      name: "Find Me",
      address: "456 Oak St",
      latitude: 44.5,
      longitude: -79.5,
      created_at: Time.now,
      updated_at: Time.now
    )

    restaurant = @repo.find_by_id(id)

    assert restaurant
    assert_equal id, restaurant.id
    assert_equal "Find Me", restaurant.name
    assert_equal "456 Oak St", restaurant.address
  end

  def test_find_by_id_returns_nil_when_not_found
    restaurant = @repo.find_by_id(99999)
    assert_nil restaurant
  end

  def test_find_by_external_id
    # Create restaurant
    restaurant_id = @db[:restaurants].insert(
      name: "External ID Test",
      created_at: Time.now,
      updated_at: Time.now
    )

    # Add external ID
    @db[:external_ids].insert(
      restaurant_id: restaurant_id,
      source: "yelp",
      external_id: "yelp-123"
    )

    restaurant = @repo.find_by_external_id("yelp", "yelp-123")

    assert restaurant
    assert_equal restaurant_id, restaurant.id
    assert_equal "External ID Test", restaurant.name
  end

  def test_update_restaurant
    restaurant = Domain::Models::Restaurant.new(
      name: "Original Name",
      address: "123 Main St"
    )
    @repo.create(restaurant)

    restaurant.name = "Updated Name"
    restaurant.address = "456 Oak St"
    @repo.update(restaurant)

    updated = @repo.find_by_id(restaurant.id)
    assert_equal "Updated Name", updated.name
    assert_equal "456 Oak St", updated.address
  end

  def test_search_by_name_exact_match
    @db[:restaurants].insert(
      name: "Starbucks Coffee",
      created_at: Time.now,
      updated_at: Time.now
    )

    results = @repo.search_by_name("Starbucks")

    assert_equal 1, results.length
    assert_equal "Starbucks Coffee", results.first.name
  end

  def test_search_by_name_fuzzy_match
    @db[:restaurants].insert(
      name: "Tim Hortons",
      created_at: Time.now,
      updated_at: Time.now
    )

    # Should match with slight typo
    results = @repo.search_by_name("Tim Horton's")

    assert_equal 1, results.length
    assert_equal "Tim Hortons", results.first.name
  end

  def test_find_candidates_for_matching
    # Create restaurants in different locations
    @db[:restaurants].insert(
      name: "Nearby 1",
      latitude: 44.5,
      longitude: -79.5,
      created_at: Time.now,
      updated_at: Time.now
    )

    @db[:restaurants].insert(
      name: "Nearby 2",
      latitude: 44.501,
      longitude: -79.501,
      created_at: Time.now,
      updated_at: Time.now
    )

    @db[:restaurants].insert(
      name: "Far Away",
      latitude: 45.0,
      longitude: -80.0,
      created_at: Time.now,
      updated_at: Time.now
    )

    candidates = @repo.find_candidates_for_matching(44.5, -79.5, 0.01)

    assert_equal 2, candidates.length
    names = candidates.map(&:name)
    assert_includes names, "Nearby 1"
    assert_includes names, "Nearby 2"
    refute_includes names, "Far Away"
  end

  def test_search_by_name_with_location_filter
    @db[:restaurants].insert(
      name: "Tim Hortons",
      location: "Barrie, ON",
      created_at: Time.now,
      updated_at: Time.now
    )

    @db[:restaurants].insert(
      name: "Tim Hortons",
      location: "Toronto, ON",
      created_at: Time.now,
      updated_at: Time.now
    )

    results = @repo.search_by_name("Tim Hortons", location: "Barrie, ON")

    assert_equal 1, results.length
    assert_equal "Barrie, ON", results.first.location
  end

  def test_search_by_name_without_location_filter
    @db[:restaurants].insert(
      name: "Starbucks",
      location: "Barrie, ON",
      created_at: Time.now,
      updated_at: Time.now
    )

    @db[:restaurants].insert(
      name: "Starbucks",
      location: "Toronto, ON",
      created_at: Time.now,
      updated_at: Time.now
    )

    results = @repo.search_by_name("Starbucks")

    assert_equal 2, results.length
  end

  def test_search_by_category_with_location_filter
    # Create categories
    bakery_id = @db[:categories].insert(name: "bakery")

    # Create restaurants
    barrie_restaurant_id = @db[:restaurants].insert(
      name: "Barrie Bakery",
      location: "Barrie, ON",
      created_at: Time.now,
      updated_at: Time.now
    )

    toronto_restaurant_id = @db[:restaurants].insert(
      name: "Toronto Bakery",
      location: "Toronto, ON",
      created_at: Time.now,
      updated_at: Time.now
    )

    # Link categories
    @db[:restaurant_categories].insert(restaurant_id: barrie_restaurant_id, category_id: bakery_id)
    @db[:restaurant_categories].insert(restaurant_id: toronto_restaurant_id, category_id: bakery_id)

    results = @repo.search_by_category("bakery", location: "Barrie, ON")

    assert_equal 1, results.length
    assert_equal "Barrie Bakery", results.first.name
    assert_equal "Barrie, ON", results.first.location
  end

  def test_search_by_category_without_location_filter
    # Create categories
    cafe_id = @db[:categories].insert(name: "cafe")

    # Create restaurants
    barrie_restaurant_id = @db[:restaurants].insert(
      name: "Barrie Cafe",
      location: "Barrie, ON",
      created_at: Time.now,
      updated_at: Time.now
    )

    toronto_restaurant_id = @db[:restaurants].insert(
      name: "Toronto Cafe",
      location: "Toronto, ON",
      created_at: Time.now,
      updated_at: Time.now
    )

    # Link categories
    @db[:restaurant_categories].insert(restaurant_id: barrie_restaurant_id, category_id: cafe_id)
    @db[:restaurant_categories].insert(restaurant_id: toronto_restaurant_id, category_id: cafe_id)

    results = @repo.search_by_category("cafe")

    assert_equal 2, results.length
  end

  def test_search_by_name_with_fuzzy_location_match
    @db[:restaurants].insert(
      name: "Pizza Place",
      location: "Barrie, ON",
      created_at: Time.now,
      updated_at: Time.now
    )

    # Should match with variations of location name
    results = @repo.search_by_name("Pizza", location: "barrie on")
    assert_equal 1, results.length
    assert_equal "Pizza Place", results.first.name

    # Should match with partial location
    results = @repo.search_by_name("Pizza", location: "Barrie")
    assert_equal 1, results.length
  end

  def test_search_by_category_with_fuzzy_location_match
    pizza_id = @db[:categories].insert(name: "pizza")

    restaurant_id = @db[:restaurants].insert(
      name: "Pizza Hut",
      location: "Toronto, Ontario",
      created_at: Time.now,
      updated_at: Time.now
    )

    @db[:restaurant_categories].insert(restaurant_id: restaurant_id, category_id: pizza_id)

    # Should match with variations
    results = @repo.search_by_category("pizza", location: "toronto on")
    assert_equal 1, results.length

    # Should match with partial
    results = @repo.search_by_category("pizza", location: "Toronto")
    assert_equal 1, results.length
  end

  private

  def create_test_db
    db = Sequel.sqlite
    GrubStars::Database.create_schema(db)
    GrubStars::Database.register_fuzzy_functions(db)
    db
  end
end
