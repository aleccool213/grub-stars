# frozen_string_literal: true

require_relative "../../test_helper"

class MergeDuplicatesServiceTest < Minitest::Test
  def setup
    @db = create_test_db
    @service = Services::MergeDuplicatesService.new(db: @db)
  end

  def teardown
    @db.disconnect
  end

  # --- find_tripadvisor_only_restaurants tests ---

  def test_find_tripadvisor_only_restaurants_returns_ta_only
    # Create a restaurant with only TripAdvisor source
    ta_only_id = create_restaurant("TripAdvisor Only Restaurant")
    @db[:external_ids].insert(restaurant_id: ta_only_id, source: "tripadvisor", external_id: "ta:123")

    # Create a restaurant with Yelp source
    yelp_id = create_restaurant("Yelp Restaurant")
    @db[:external_ids].insert(restaurant_id: yelp_id, source: "yelp", external_id: "yelp:456")

    # Create a restaurant with both TripAdvisor and Yelp
    both_id = create_restaurant("Both Sources Restaurant")
    @db[:external_ids].insert(restaurant_id: both_id, source: "tripadvisor", external_id: "ta:789")
    @db[:external_ids].insert(restaurant_id: both_id, source: "yelp", external_id: "yelp:789")

    results = @service.find_tripadvisor_only_restaurants

    assert_equal 1, results.length
    assert_equal ta_only_id, results.first[:id]
    assert_equal "TripAdvisor Only Restaurant", results.first[:name]
  end

  def test_find_tripadvisor_only_restaurants_empty_when_none
    # Create only Yelp restaurants
    yelp_id = create_restaurant("Yelp Restaurant")
    @db[:external_ids].insert(restaurant_id: yelp_id, source: "yelp", external_id: "yelp:123")

    results = @service.find_tripadvisor_only_restaurants

    assert_empty results
  end

  # --- calculate_name_similarity tests ---

  def test_calculate_name_similarity_identical_names
    similarity = @service.calculate_name_similarity("Test Restaurant", "Test Restaurant")
    assert_equal 1.0, similarity
  end

  def test_calculate_name_similarity_case_insensitive
    similarity = @service.calculate_name_similarity("TEST RESTAURANT", "test restaurant")
    assert_equal 1.0, similarity
  end

  def test_calculate_name_similarity_similar_names
    similarity = @service.calculate_name_similarity("Joe's Pizza", "Joes Pizza")
    assert similarity > 0.9, "Expected high similarity for 'Joe's Pizza' vs 'Joes Pizza'"
  end

  def test_calculate_name_similarity_different_names
    similarity = @service.calculate_name_similarity("Pizza Place", "Sushi Bar")
    assert similarity < 0.5, "Expected low similarity for completely different names"
  end

  def test_calculate_name_similarity_empty_strings
    similarity = @service.calculate_name_similarity("", "")
    assert_equal 1.0, similarity
  end

  # --- find_potential_matches tests ---

  def test_find_potential_matches_by_name_similarity
    # Create a Yelp restaurant
    yelp_id = create_restaurant("Off the Hook Poke Market", latitude: 21.309, longitude: -157.810)
    @db[:external_ids].insert(restaurant_id: yelp_id, source: "yelp", external_id: "yelp:123")

    # Create a TripAdvisor duplicate with similar name
    ta_id = create_restaurant("Off the Hook Poke Market", latitude: 21.309, longitude: -157.810)
    @db[:external_ids].insert(restaurant_id: ta_id, source: "tripadvisor", external_id: "ta:456")

    ta_restaurant = @db[:restaurants].where(id: ta_id).first

    matches = @service.find_potential_matches(ta_restaurant)

    assert_equal 1, matches.length
    assert_equal yelp_id, matches.first[:id]
    assert_equal 1.0, matches.first[:similarity]
  end

  def test_find_potential_matches_filters_by_gps_proximity
    # Create a Yelp restaurant at location A
    yelp_nearby_id = create_restaurant("Same Restaurant", latitude: 21.309, longitude: -157.810)
    @db[:external_ids].insert(restaurant_id: yelp_nearby_id, source: "yelp", external_id: "yelp:123")

    # Create a Yelp restaurant with same name but far away
    yelp_far_id = create_restaurant("Same Restaurant", latitude: 45.0, longitude: -75.0)
    @db[:external_ids].insert(restaurant_id: yelp_far_id, source: "yelp", external_id: "yelp:456")

    # TripAdvisor restaurant near location A
    ta_id = create_restaurant("Same Restaurant", latitude: 21.3091, longitude: -157.8101)
    @db[:external_ids].insert(restaurant_id: ta_id, source: "tripadvisor", external_id: "ta:789")

    ta_restaurant = @db[:restaurants].where(id: ta_id).first

    matches = @service.find_potential_matches(ta_restaurant)

    # Should only match the nearby one
    assert_equal 1, matches.length
    assert_equal yelp_nearby_id, matches.first[:id]
  end

  def test_find_potential_matches_no_gps_filtering_when_ta_has_no_gps
    # Create two Yelp restaurants with same name at different locations
    yelp1_id = create_restaurant("Test Restaurant", latitude: 21.309, longitude: -157.810)
    @db[:external_ids].insert(restaurant_id: yelp1_id, source: "yelp", external_id: "yelp:123")

    yelp2_id = create_restaurant("Test Restaurant", latitude: 45.0, longitude: -75.0)
    @db[:external_ids].insert(restaurant_id: yelp2_id, source: "yelp", external_id: "yelp:456")

    # TripAdvisor restaurant WITHOUT GPS
    ta_id = create_restaurant("Test Restaurant", latitude: nil, longitude: nil)
    @db[:external_ids].insert(restaurant_id: ta_id, source: "tripadvisor", external_id: "ta:789")

    ta_restaurant = @db[:restaurants].where(id: ta_id).first

    matches = @service.find_potential_matches(ta_restaurant)

    # Should match both since no GPS to filter
    assert_equal 2, matches.length
  end

  def test_find_potential_matches_excludes_low_similarity
    # Create Yelp restaurant with different name
    yelp_id = create_restaurant("Totally Different Name")
    @db[:external_ids].insert(restaurant_id: yelp_id, source: "yelp", external_id: "yelp:123")

    # TripAdvisor restaurant
    ta_id = create_restaurant("My Restaurant")
    @db[:external_ids].insert(restaurant_id: ta_id, source: "tripadvisor", external_id: "ta:456")

    ta_restaurant = @db[:restaurants].where(id: ta_id).first

    matches = @service.find_potential_matches(ta_restaurant)

    assert_empty matches
  end

  # --- merge_restaurants tests ---

  def test_merge_restaurants_moves_external_ids
    # Create target restaurant with Yelp
    target_id = create_restaurant("Target Restaurant")
    @db[:external_ids].insert(restaurant_id: target_id, source: "yelp", external_id: "yelp:123")

    # Create duplicate with TripAdvisor
    duplicate_id = create_restaurant("Duplicate Restaurant")
    @db[:external_ids].insert(restaurant_id: duplicate_id, source: "tripadvisor", external_id: "ta:456")

    duplicate = @db[:restaurants].where(id: duplicate_id).first
    target = @db[:restaurants].where(id: target_id).first

    result = @service.merge_restaurants(duplicate, target)

    assert result

    # Check external_ids moved
    external_ids = @db[:external_ids].where(restaurant_id: target_id).all
    assert_equal 2, external_ids.length
    sources = external_ids.map { |e| e[:source] }
    assert_includes sources, "yelp"
    assert_includes sources, "tripadvisor"

    # Check duplicate deleted
    assert_nil @db[:restaurants].where(id: duplicate_id).first
  end

  def test_merge_restaurants_moves_ratings
    target_id = create_restaurant("Target Restaurant")
    @db[:external_ids].insert(restaurant_id: target_id, source: "yelp", external_id: "yelp:123")
    @db[:ratings].insert(restaurant_id: target_id, source: "yelp", score: 4.5, review_count: 100)

    duplicate_id = create_restaurant("Duplicate Restaurant")
    @db[:external_ids].insert(restaurant_id: duplicate_id, source: "tripadvisor", external_id: "ta:456")
    @db[:ratings].insert(restaurant_id: duplicate_id, source: "tripadvisor", score: 4.2, review_count: 50)

    duplicate = @db[:restaurants].where(id: duplicate_id).first
    target = @db[:restaurants].where(id: target_id).first

    @service.merge_restaurants(duplicate, target)

    # Check ratings moved
    ratings = @db[:ratings].where(restaurant_id: target_id).all
    assert_equal 2, ratings.length
    sources = ratings.map { |r| r[:source] }
    assert_includes sources, "yelp"
    assert_includes sources, "tripadvisor"
  end

  def test_merge_restaurants_avoids_duplicate_ratings_from_same_source
    target_id = create_restaurant("Target Restaurant")
    @db[:external_ids].insert(restaurant_id: target_id, source: "yelp", external_id: "yelp:123")
    @db[:ratings].insert(restaurant_id: target_id, source: "yelp", score: 4.5, review_count: 100)

    duplicate_id = create_restaurant("Duplicate Restaurant")
    @db[:external_ids].insert(restaurant_id: duplicate_id, source: "tripadvisor", external_id: "ta:456")
    # Duplicate also has yelp rating (shouldn't happen but test the guard)
    @db[:ratings].insert(restaurant_id: duplicate_id, source: "yelp", score: 4.0, review_count: 80)

    duplicate = @db[:restaurants].where(id: duplicate_id).first
    target = @db[:restaurants].where(id: target_id).first

    @service.merge_restaurants(duplicate, target)

    # Should only have one Yelp rating (the target's original)
    yelp_ratings = @db[:ratings].where(restaurant_id: target_id, source: "yelp").all
    assert_equal 1, yelp_ratings.length
    assert_equal 4.5, yelp_ratings.first[:score]
  end

  def test_merge_restaurants_moves_reviews
    target_id = create_restaurant("Target Restaurant")
    @db[:external_ids].insert(restaurant_id: target_id, source: "yelp", external_id: "yelp:123")
    @db[:reviews].insert(restaurant_id: target_id, source: "yelp", snippet: "Great food!", url: "http://yelp.com/1")

    duplicate_id = create_restaurant("Duplicate Restaurant")
    @db[:external_ids].insert(restaurant_id: duplicate_id, source: "tripadvisor", external_id: "ta:456")
    @db[:reviews].insert(restaurant_id: duplicate_id, source: "tripadvisor", snippet: "Amazing!", url: "http://ta.com/1")

    duplicate = @db[:restaurants].where(id: duplicate_id).first
    target = @db[:restaurants].where(id: target_id).first

    @service.merge_restaurants(duplicate, target)

    reviews = @db[:reviews].where(restaurant_id: target_id).all
    assert_equal 2, reviews.length
  end

  def test_merge_restaurants_moves_media
    target_id = create_restaurant("Target Restaurant")
    @db[:external_ids].insert(restaurant_id: target_id, source: "yelp", external_id: "yelp:123")
    @db[:media].insert(restaurant_id: target_id, source: "yelp", media_type: "photo", url: "http://yelp.com/photo1.jpg")

    duplicate_id = create_restaurant("Duplicate Restaurant")
    @db[:external_ids].insert(restaurant_id: duplicate_id, source: "tripadvisor", external_id: "ta:456")
    @db[:media].insert(restaurant_id: duplicate_id, source: "tripadvisor", media_type: "photo", url: "http://ta.com/photo1.jpg")

    duplicate = @db[:restaurants].where(id: duplicate_id).first
    target = @db[:restaurants].where(id: target_id).first

    @service.merge_restaurants(duplicate, target)

    media = @db[:media].where(restaurant_id: target_id).all
    assert_equal 2, media.length
  end

  def test_merge_restaurants_updates_missing_gps
    target_id = create_restaurant("Target Restaurant", latitude: nil, longitude: nil)
    @db[:external_ids].insert(restaurant_id: target_id, source: "yelp", external_id: "yelp:123")

    duplicate_id = create_restaurant("Duplicate Restaurant", latitude: 21.309, longitude: -157.810)
    @db[:external_ids].insert(restaurant_id: duplicate_id, source: "tripadvisor", external_id: "ta:456")

    duplicate = @db[:restaurants].where(id: duplicate_id).first
    target = @db[:restaurants].where(id: target_id).first

    @service.merge_restaurants(duplicate, target)

    updated_target = @db[:restaurants].where(id: target_id).first
    assert_equal 21.309, updated_target[:latitude]
    assert_equal(-157.810, updated_target[:longitude])
  end

  def test_merge_restaurants_preserves_existing_gps
    target_id = create_restaurant("Target Restaurant", latitude: 40.0, longitude: -74.0)
    @db[:external_ids].insert(restaurant_id: target_id, source: "yelp", external_id: "yelp:123")

    duplicate_id = create_restaurant("Duplicate Restaurant", latitude: 21.309, longitude: -157.810)
    @db[:external_ids].insert(restaurant_id: duplicate_id, source: "tripadvisor", external_id: "ta:456")

    duplicate = @db[:restaurants].where(id: duplicate_id).first
    target = @db[:restaurants].where(id: target_id).first

    @service.merge_restaurants(duplicate, target)

    updated_target = @db[:restaurants].where(id: target_id).first
    # Should keep target's original GPS
    assert_equal 40.0, updated_target[:latitude]
    assert_equal(-74.0, updated_target[:longitude])
  end

  # --- merge_tripadvisor_duplicates tests ---

  def test_merge_tripadvisor_duplicates_dry_run
    # Create Yelp restaurant
    yelp_id = create_restaurant("Test Restaurant", latitude: 21.309, longitude: -157.810)
    @db[:external_ids].insert(restaurant_id: yelp_id, source: "yelp", external_id: "yelp:123")

    # Create TripAdvisor duplicate
    ta_id = create_restaurant("Test Restaurant", latitude: 21.309, longitude: -157.810)
    @db[:external_ids].insert(restaurant_id: ta_id, source: "tripadvisor", external_id: "ta:456")

    result = @service.merge_tripadvisor_duplicates(dry_run: true)

    assert_equal 1, result.merged_count
    assert_equal 0, result.skipped_count
    assert_equal 1, result.details.length

    detail = result.details.first
    assert_equal ta_id, detail.duplicate_id
    assert_equal yelp_id, detail.target_id
    refute detail.merged  # Dry run doesn't actually merge
    assert_match(/Dry run/, detail.reason)

    # Verify nothing was actually changed
    assert @db[:restaurants].where(id: ta_id).first  # Still exists
    assert_equal 1, @db[:external_ids].where(restaurant_id: yelp_id).count
  end

  def test_merge_tripadvisor_duplicates_execute
    # Create Yelp restaurant
    yelp_id = create_restaurant("Test Restaurant", latitude: 21.309, longitude: -157.810)
    @db[:external_ids].insert(restaurant_id: yelp_id, source: "yelp", external_id: "yelp:123")

    # Create TripAdvisor duplicate
    ta_id = create_restaurant("Test Restaurant", latitude: 21.309, longitude: -157.810)
    @db[:external_ids].insert(restaurant_id: ta_id, source: "tripadvisor", external_id: "ta:456")

    result = @service.merge_tripadvisor_duplicates(dry_run: false)

    assert_equal 1, result.merged_count
    assert_equal 0, result.skipped_count

    detail = result.details.first
    assert detail.merged
    assert_match(/Merged successfully/, detail.reason)

    # Verify merge happened
    refute @db[:restaurants].where(id: ta_id).first  # Deleted
    assert_equal 2, @db[:external_ids].where(restaurant_id: yelp_id).count
  end

  def test_merge_tripadvisor_duplicates_skips_unmatched
    # Create TripAdvisor restaurant with no matching Yelp/Google
    ta_id = create_restaurant("Unique TripAdvisor Restaurant")
    @db[:external_ids].insert(restaurant_id: ta_id, source: "tripadvisor", external_id: "ta:123")

    result = @service.merge_tripadvisor_duplicates(dry_run: true)

    assert_equal 0, result.merged_count
    assert_equal 1, result.skipped_count

    detail = result.details.first
    refute detail.merged
    assert_match(/No matching restaurant/, detail.reason)
  end

  # --- get_sources tests ---

  def test_get_sources
    restaurant_id = create_restaurant("Test Restaurant")
    @db[:external_ids].insert(restaurant_id: restaurant_id, source: "yelp", external_id: "yelp:123")
    @db[:external_ids].insert(restaurant_id: restaurant_id, source: "google", external_id: "google:456")

    sources = @service.get_sources(restaurant_id)

    assert_equal 2, sources.length
    assert_includes sources, "yelp"
    assert_includes sources, "google"
  end

  private

  def create_test_db
    db = Sequel.sqlite
    GrubStars::Database.create_schema(db)
    db
  end

  def create_restaurant(name, latitude: nil, longitude: nil, phone: nil, address: nil)
    @db[:restaurants].insert(
      name: name,
      address: address,
      latitude: latitude,
      longitude: longitude,
      phone: phone,
      created_at: Time.now,
      updated_at: Time.now
    )
  end
end
