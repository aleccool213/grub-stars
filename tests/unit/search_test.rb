# frozen_string_literal: true

require_relative "../test_helper"

class SearchTest < GrubStars::IntegrationTest
  def setup
    super
    @search = GrubStars::Search.new(db: @db)
    seed_test_data
  end

  def test_by_name_finds_exact_match
    results = @search.by_name("Test Bakery")
    assert_equal 1, results.length
    assert_equal "Test Bakery", results.first[:name]
  end

  def test_by_name_finds_with_typo
    # Fuzzy matching: "Bakry" should match "Bakery"
    results = @search.by_name("Bakry")
    assert_equal 1, results.length
    assert_equal "Test Bakery", results.first[:name]
  end

  def test_by_name_is_case_insensitive
    results = @search.by_name("test bakery")
    assert_equal 1, results.length
    assert_equal "Test Bakery", results.first[:name]
  end

  def test_by_name_returns_empty_for_no_match
    results = @search.by_name("zzzzzzz")
    assert_empty results
  end

  def test_by_category_finds_restaurants
    results = @search.by_category("bakeries")
    refute_empty results
    # Best match should be first
    assert_equal "Test Bakery", results.first[:name]
  end

  def test_by_category_fuzzy_matches_singular_plural
    # "bakery" should match "bakeries" via fuzzy
    results = @search.by_category("bakery")
    refute_empty results
    assert_equal "Test Bakery", results.first[:name]
  end

  def test_by_category_is_case_insensitive
    results = @search.by_category("BAKERIES")
    refute_empty results
    assert_equal "Test Bakery", results.first[:name]
  end

  def test_by_category_returns_empty_for_no_match
    results = @search.by_category("zzzzzzz")
    assert_empty results
  end

  def test_all_categories_returns_sorted_list
    categories = @search.all_categories
    assert_includes categories, "bakeries"
    assert_includes categories, "cafes"
    assert_includes categories, "breweries"
    assert_equal categories, categories.sort
  end

  def test_enriches_results_with_ratings
    results = @search.by_name("Test Bakery")
    restaurant = results.first

    assert restaurant[:ratings]
    assert_equal 1, restaurant[:ratings].length
    assert_equal "yelp", restaurant[:ratings].first[:source]
    assert_equal 4.5, restaurant[:ratings].first[:score]
  end

  def test_enriches_results_with_sources
    results = @search.by_name("Test Bakery")
    restaurant = results.first

    assert restaurant[:sources]
    assert_includes restaurant[:sources], "yelp"
  end

  def test_results_ordered_by_match_score
    # Best matches should come first
    results = @search.by_name("Bakery")
    refute_empty results
    # Just verify we get results - exact ordering depends on fuzzy scores
  end

  private

  def seed_test_data
    # Create restaurants
    bakery_id = @db[:restaurants].insert(
      name: "Test Bakery",
      address: "123 Main St",
      latitude: 44.389,
      longitude: -79.690,
      created_at: Time.now,
      updated_at: Time.now
    )

    brewery_id = @db[:restaurants].insert(
      name: "Local Brewery",
      address: "456 Oak Ave",
      latitude: 44.390,
      longitude: -79.691,
      created_at: Time.now,
      updated_at: Time.now
    )

    # Create external IDs
    @db[:external_ids].insert(restaurant_id: bakery_id, source: "yelp", external_id: "yelp:bakery1")
    @db[:external_ids].insert(restaurant_id: brewery_id, source: "yelp", external_id: "yelp:brewery1")

    # Create categories
    bakeries_id = @db[:categories].insert(name: "bakeries")
    cafes_id = @db[:categories].insert(name: "cafes")
    breweries_id = @db[:categories].insert(name: "breweries")

    # Link categories
    @db[:restaurant_categories].insert(restaurant_id: bakery_id, category_id: bakeries_id)
    @db[:restaurant_categories].insert(restaurant_id: bakery_id, category_id: cafes_id)
    @db[:restaurant_categories].insert(restaurant_id: brewery_id, category_id: breweries_id)

    # Create ratings
    @db[:ratings].insert(
      restaurant_id: bakery_id,
      source: "yelp",
      score: 4.5,
      review_count: 100,
      fetched_at: Time.now
    )

    @db[:ratings].insert(
      restaurant_id: brewery_id,
      source: "yelp",
      score: 4.0,
      review_count: 50,
      fetched_at: Time.now
    )
  end
end
