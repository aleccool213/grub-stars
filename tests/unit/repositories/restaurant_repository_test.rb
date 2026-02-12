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
      phone: "555-1234",
      location: "barrie, ontario"
    )

    result = @repo.create(restaurant)

    assert result.id
    assert_equal "Test Restaurant", result.name
    assert_equal "123 Main St", result.address
    assert_equal "barrie, ontario", result.location

    # Verify in database
    row = @db[:restaurants].where(id: result.id).first
    assert row
    assert_equal "Test Restaurant", row[:name]
    assert_equal "barrie, ontario", row[:location]
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
      name: "Starbucks",
      location: "barrie, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )

    @db[:restaurants].insert(
      name: "Starbucks",
      location: "toronto, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )

    results = @repo.search_by_name("Starbucks", location: "barrie, ontario")

    assert_equal 1, results.length
    assert_equal "barrie, ontario", results.first.location
  end

  def test_search_by_category_with_location_filter
    bakery_id = @db[:categories].insert(name: "Bakery")

    barrie_id = @db[:restaurants].insert(
      name: "Barrie Bakery",
      location: "barrie, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )

    toronto_id = @db[:restaurants].insert(
      name: "Toronto Bakery",
      location: "toronto, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )

    @db[:restaurant_categories].insert(restaurant_id: barrie_id, category_id: bakery_id)
    @db[:restaurant_categories].insert(restaurant_id: toronto_id, category_id: bakery_id)

    results = @repo.search_by_category("Bakery", location: "barrie, ontario")

    assert_equal 1, results.length
    assert_equal "Barrie Bakery", results.first.name
    assert_equal "barrie, ontario", results.first.location
  end

  # Sort by overall rank tests

  def test_search_by_name_with_overall_rank_sort
    # Restaurant with high rating and many reviews
    r1_id = @db[:restaurants].insert(
      name: "Great Starbucks",
      created_at: Time.now,
      updated_at: Time.now
    )
    @db[:ratings].insert(restaurant_id: r1_id, source: "yelp", score: 4.8, review_count: 500, fetched_at: Time.now)

    # Restaurant with lower rating and fewer reviews
    r2_id = @db[:restaurants].insert(
      name: "Okay Starbucks",
      created_at: Time.now,
      updated_at: Time.now
    )
    @db[:ratings].insert(restaurant_id: r2_id, source: "yelp", score: 3.0, review_count: 10, fetched_at: Time.now)

    results = @repo.search_by_name("Starbucks", sort: :overall_rank)

    assert_equal 2, results.length
    assert_equal "Great Starbucks", results.first.name
    assert_equal "Okay Starbucks", results.last.name
  end

  def test_search_by_name_with_relevance_sort_ignores_ratings
    # Restaurant with lower rating but better name match
    r1_id = @db[:restaurants].insert(
      name: "Starbucks",
      created_at: Time.now,
      updated_at: Time.now
    )
    @db[:ratings].insert(restaurant_id: r1_id, source: "yelp", score: 3.0, review_count: 10, fetched_at: Time.now)

    # Restaurant with higher rating but weaker name match
    r2_id = @db[:restaurants].insert(
      name: "Starboks Place",
      created_at: Time.now,
      updated_at: Time.now
    )
    @db[:ratings].insert(restaurant_id: r2_id, source: "yelp", score: 5.0, review_count: 1000, fetched_at: Time.now)

    results = @repo.search_by_name("Starbucks", sort: :relevance)

    assert_equal 2, results.length
    # "Starbucks" is a better name match than "Starboks Place"
    assert_equal "Starbucks", results.first.name
  end

  def test_search_by_name_overall_rank_with_no_ratings
    # Restaurant with no ratings
    @db[:restaurants].insert(
      name: "Starbucks New",
      created_at: Time.now,
      updated_at: Time.now
    )

    # Restaurant with ratings
    r2_id = @db[:restaurants].insert(
      name: "Starbucks Classic",
      created_at: Time.now,
      updated_at: Time.now
    )
    @db[:ratings].insert(restaurant_id: r2_id, source: "yelp", score: 4.0, review_count: 50, fetched_at: Time.now)

    results = @repo.search_by_name("Starbucks", sort: :overall_rank)

    assert_equal 2, results.length
    # Restaurant with ratings should come first
    assert_equal "Starbucks Classic", results.first.name
    assert_equal "Starbucks New", results.last.name
  end

  def test_search_by_name_overall_rank_with_multiple_rating_sources
    # Restaurant with ratings from multiple sources
    r1_id = @db[:restaurants].insert(
      name: "Starbucks Multi",
      created_at: Time.now,
      updated_at: Time.now
    )
    @db[:ratings].insert(restaurant_id: r1_id, source: "yelp", score: 4.5, review_count: 200, fetched_at: Time.now)
    @db[:ratings].insert(restaurant_id: r1_id, source: "google", score: 4.3, review_count: 300, fetched_at: Time.now)

    # Restaurant with single lower rating
    r2_id = @db[:restaurants].insert(
      name: "Starbucks Single",
      created_at: Time.now,
      updated_at: Time.now
    )
    @db[:ratings].insert(restaurant_id: r2_id, source: "yelp", score: 3.5, review_count: 20, fetched_at: Time.now)

    results = @repo.search_by_name("Starbucks", sort: :overall_rank)

    assert_equal 2, results.length
    # Multi-source restaurant with higher avg and more reviews should rank first
    assert_equal "Starbucks Multi", results.first.name
  end

  def test_search_by_category_with_overall_rank_sort
    bakery_id = @db[:categories].insert(name: "Bakery")

    # High-ranked bakery
    r1_id = @db[:restaurants].insert(
      name: "Best Bakery",
      created_at: Time.now,
      updated_at: Time.now
    )
    @db[:restaurant_categories].insert(restaurant_id: r1_id, category_id: bakery_id)
    @db[:ratings].insert(restaurant_id: r1_id, source: "yelp", score: 4.9, review_count: 800, fetched_at: Time.now)

    # Low-ranked bakery
    r2_id = @db[:restaurants].insert(
      name: "Meh Bakery",
      created_at: Time.now,
      updated_at: Time.now
    )
    @db[:restaurant_categories].insert(restaurant_id: r2_id, category_id: bakery_id)
    @db[:ratings].insert(restaurant_id: r2_id, source: "yelp", score: 2.5, review_count: 5, fetched_at: Time.now)

    results = @repo.search_by_category("Bakery", sort: :overall_rank)

    assert_equal 2, results.length
    assert_equal "Best Bakery", results.first.name
    assert_equal "Meh Bakery", results.last.name
  end

  def test_search_by_category_with_relevance_sort_default
    bakery_id = @db[:categories].insert(name: "Bakery")

    r1_id = @db[:restaurants].insert(
      name: "Alpha Bakery",
      created_at: Time.now,
      updated_at: Time.now
    )
    @db[:restaurant_categories].insert(restaurant_id: r1_id, category_id: bakery_id)

    r2_id = @db[:restaurants].insert(
      name: "Beta Bakery",
      created_at: Time.now,
      updated_at: Time.now
    )
    @db[:restaurant_categories].insert(restaurant_id: r2_id, category_id: bakery_id)

    # Default sort (relevance) - both match "Bakery" equally, so alphabetical
    results = @repo.search_by_category("Bakery")

    assert_equal 2, results.length
    assert_equal "Alpha Bakery", results.first.name
    assert_equal "Beta Bakery", results.last.name
  end

  def test_search_by_name_overall_rank_reviews_boost_equal_ratings
    # Two restaurants with same average rating but different review counts
    r1_id = @db[:restaurants].insert(
      name: "Starbucks Popular",
      created_at: Time.now,
      updated_at: Time.now
    )
    @db[:ratings].insert(restaurant_id: r1_id, source: "yelp", score: 4.0, review_count: 500, fetched_at: Time.now)

    r2_id = @db[:restaurants].insert(
      name: "Starbucks Quiet",
      created_at: Time.now,
      updated_at: Time.now
    )
    @db[:ratings].insert(restaurant_id: r2_id, source: "yelp", score: 4.0, review_count: 5, fetched_at: Time.now)

    results = @repo.search_by_name("Starbucks", sort: :overall_rank)

    assert_equal 2, results.length
    # More reviews should boost ranking when ratings are equal
    assert_equal "Starbucks Popular", results.first.name
    assert_equal "Starbucks Quiet", results.last.name
  end

  def test_all_indexed_locations
    @db[:restaurants].insert(
      name: "Restaurant 1",
      location: "barrie, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )

    @db[:restaurants].insert(
      name: "Restaurant 2",
      location: "Barrie, Ontario",  # Different case
      created_at: Time.now,
      updated_at: Time.now
    )

    @db[:restaurants].insert(
      name: "Restaurant 3",
      location: "toronto, ontario",
      created_at: Time.now,
      updated_at: Time.now
    )

    @db[:restaurants].insert(
      name: "Restaurant 4",
      location: nil,  # No location
      created_at: Time.now,
      updated_at: Time.now
    )

    locations = @repo.all_indexed_locations

    assert_equal 2, locations.length
    assert_includes locations, "barrie, ontario"
    assert_includes locations, "toronto, ontario"
  end

  private

  def create_test_db
    db = Sequel.sqlite
    GrubStars::Database.create_schema(db)
    GrubStars::Database.register_fuzzy_functions(db)
    db
  end
end
