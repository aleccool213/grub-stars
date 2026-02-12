# frozen_string_literal: true

require_relative "../../test_helper"

class SearchRestaurantsServiceTest < Minitest::Test
  def setup
    @db = create_test_db
    @restaurant_repo = Infrastructure::Repositories::RestaurantRepository.new(@db)
    @service = Services::SearchRestaurantsService.new(restaurant_repo: @restaurant_repo)

    # Create test restaurants
    @restaurant1_id = @db[:restaurants].insert(
      name: "Starbucks Coffee",
      address: "123 Main St",
      created_at: Time.now,
      updated_at: Time.now
    )

    @restaurant2_id = @db[:restaurants].insert(
      name: "Tim Hortons",
      address: "456 Oak Ave",
      created_at: Time.now,
      updated_at: Time.now
    )

    # Add categories
    bakery_id = @db[:categories].insert(name: "Bakery")
    cafe_id = @db[:categories].insert(name: "Cafe")

    @db[:restaurant_categories].insert(restaurant_id: @restaurant1_id, category_id: cafe_id)
    @db[:restaurant_categories].insert(restaurant_id: @restaurant2_id, category_id: bakery_id)
    @db[:restaurant_categories].insert(restaurant_id: @restaurant2_id, category_id: cafe_id)
  end

  def teardown
    @db.disconnect
  end

  def test_search_by_name_exact_match
    results = @service.search_by_name("Starbucks")

    assert_equal 1, results.length
    assert_equal "Starbucks Coffee", results.first.name
    assert_instance_of Domain::Models::Restaurant, results.first
  end

  def test_search_by_name_partial_match
    results = @service.search_by_name("Star")

    assert_equal 1, results.length
    assert_equal "Starbucks Coffee", results.first.name
  end

  def test_search_by_name_fuzzy_match
    # Should match with typo
    results = @service.search_by_name("Starboks")

    assert_equal 1, results.length
    assert_equal "Starbucks Coffee", results.first.name
  end

  def test_search_by_name_no_results
    results = @service.search_by_name("Nonexistent Restaurant")

    assert_empty results
  end

  def test_search_by_category_exact_match
    results = @service.search_by_category("Bakery")

    assert_equal 1, results.length
    assert_equal "Tim Hortons", results.first.name
  end

  def test_search_by_category_multiple_results
    results = @service.search_by_category("Cafe")

    assert_equal 2, results.length
    names = results.map(&:name)
    assert_includes names, "Starbucks Coffee"
    assert_includes names, "Tim Hortons"
  end

  def test_find_by_name
    restaurant = @service.find_by_name("Starbucks")

    assert restaurant
    assert_equal "Starbucks Coffee", restaurant.name
    assert_instance_of Domain::Models::Restaurant, restaurant
  end

  def test_find_by_name_returns_best_match
    # When there are multiple matches, return the first (best) one
    restaurant = @service.find_by_name("Tim")

    assert restaurant
    assert_equal "Tim Hortons", restaurant.name
  end

  def test_search_by_name_with_location_filter
    # Add location to existing restaurants
    @db[:restaurants].where(id: @restaurant1_id).update(location: "barrie, ontario")
    @db[:restaurants].where(id: @restaurant2_id).update(location: "toronto, ontario")

    results = @service.search_by_name("coffee", location: "barrie, ontario")

    assert_equal 1, results.length
    assert_equal "Starbucks Coffee", results.first.name
  end

  def test_search_by_category_with_location_filter
    # Add location to existing restaurants
    @db[:restaurants].where(id: @restaurant1_id).update(location: "barrie, ontario")
    @db[:restaurants].where(id: @restaurant2_id).update(location: "toronto, ontario")

    results = @service.search_by_category("Cafe", location: "barrie, ontario")

    assert_equal 1, results.length
    assert_equal "Starbucks Coffee", results.first.name
  end

  def test_search_with_invalid_location_raises_error
    # Try to search with a location that hasn't been indexed
    error = assert_raises(Services::SearchRestaurantsService::LocationNotIndexedError) do
      @service.search_by_name("Starbucks", location: "nonexistent, location")
    end

    assert_match(/Location 'nonexistent, location' has not been indexed/, error.message)
  end

  def test_all_indexed_locations
    @db[:restaurants].where(id: @restaurant1_id).update(location: "barrie, ontario")
    @db[:restaurants].where(id: @restaurant2_id).update(location: "toronto, ontario")

    locations = @service.all_indexed_locations

    assert_equal 2, locations.length
    assert_includes locations, "barrie, ontario"
    assert_includes locations, "toronto, ontario"
  end

  # Sort parameter tests

  def test_search_by_name_accepts_sort_parameter
    # Add ratings so sort has something to rank on
    @db[:ratings].insert(restaurant_id: @restaurant1_id, source: "yelp", score: 4.5, review_count: 100, fetched_at: Time.now)

    results = @service.search_by_name("Starbucks", sort: :overall_rank)

    assert_equal 1, results.length
    assert_equal "Starbucks Coffee", results.first.name
  end

  def test_search_by_category_accepts_sort_parameter
    # Add ratings
    @db[:ratings].insert(restaurant_id: @restaurant1_id, source: "yelp", score: 4.5, review_count: 100, fetched_at: Time.now)
    @db[:ratings].insert(restaurant_id: @restaurant2_id, source: "yelp", score: 3.0, review_count: 10, fetched_at: Time.now)

    # Both are cafes - with overall_rank, higher-rated one should come first
    results = @service.search_by_category("Cafe", sort: :overall_rank)

    assert_equal 2, results.length
    assert_equal "Starbucks Coffee", results.first.name
  end

  def test_search_by_name_accepts_string_sort_parameter
    results = @service.search_by_name("Starbucks", sort: "overall_rank")

    assert_equal 1, results.length
    assert_equal "Starbucks Coffee", results.first.name
  end

  def test_search_by_name_invalid_sort_falls_back_to_relevance
    results = @service.search_by_name("Starbucks", sort: :bogus_sort)

    assert_equal 1, results.length
    assert_equal "Starbucks Coffee", results.first.name
  end

  def test_search_by_name_defaults_to_relevance_sort
    # Without sort parameter, should use relevance (no error)
    results = @service.search_by_name("Starbucks")

    assert_equal 1, results.length
    assert_equal "Starbucks Coffee", results.first.name
  end

  def test_normalize_sort_with_valid_symbols
    assert_equal :relevance, @service.send(:normalize_sort, :relevance)
    assert_equal :overall_rank, @service.send(:normalize_sort, :overall_rank)
  end

  def test_normalize_sort_with_strings
    assert_equal :relevance, @service.send(:normalize_sort, "relevance")
    assert_equal :overall_rank, @service.send(:normalize_sort, "overall_rank")
  end

  def test_normalize_sort_with_invalid_value
    assert_equal :relevance, @service.send(:normalize_sort, :invalid)
    assert_equal :relevance, @service.send(:normalize_sort, "garbage")
  end

  private

  def create_test_db
    db = Sequel.sqlite
    GrubStars::Database.create_schema(db)
    GrubStars::Database.register_fuzzy_functions(db)
    db
  end
end
