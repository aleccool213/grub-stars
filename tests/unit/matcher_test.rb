# frozen_string_literal: true

require_relative "../test_helper"

class MatcherTest < GrubStars::IntegrationTest
  def setup
    super
    @matcher = GrubStars::Matcher.new(db: @db)
  end

  def test_no_match_when_database_empty
    business = make_business(name: "Test Restaurant")
    result = @matcher.find_match(business)
    assert_nil result
  end

  def test_exact_name_match_high_score
    insert_restaurant(name: "Squares & Circles", latitude: 44.389, longitude: -79.690)

    business = make_business(
      name: "Squares & Circles",
      latitude: 44.389,
      longitude: -79.690
    )

    result = @matcher.find_match(business)
    refute_nil result
    assert result[:score] >= 50
    assert_equal "Squares & Circles", result[:restaurant][:name]
  end

  def test_similar_name_match
    # Same name with minor variations + same location + same phone = strong match
    insert_restaurant(
      name: "Squares and Circles Bakery",
      latitude: 44.389,
      longitude: -79.690,
      phone: "+17055551234"
    )

    business = make_business(
      name: "Squares & Circles Bakery",
      latitude: 44.389,
      longitude: -79.690,
      phone: "+17055551234"
    )

    result = @matcher.find_match(business)
    refute_nil result
    assert result[:score] >= 50
  end

  def test_no_match_different_name_far_location
    insert_restaurant(name: "Pizza Palace", latitude: 45.0, longitude: -80.0)

    business = make_business(
      name: "Sushi Express",
      latitude: 44.0,
      longitude: -79.0
    )

    result = @matcher.find_match(business)
    assert_nil result
  end

  def test_phone_match_increases_score
    insert_restaurant(
      name: "Test Place",
      phone: "+14165551234",
      latitude: 44.389,
      longitude: -79.690
    )

    business = make_business(
      name: "Test Place",
      phone: "+14165551234",
      latitude: 44.389,
      longitude: -79.690
    )

    result = @matcher.find_match(business)
    refute_nil result
    # Should have high score due to name + phone + GPS
    assert result[:score] >= 70
  end

  def test_gps_proximity_affects_score
    restaurant = {
      name: "Nearby Cafe",
      address: nil,
      latitude: 44.3890,
      longitude: -79.6900,
      phone: nil
    }

    # Very close location
    close_business = make_business(
      name: "Nearby Cafe",
      latitude: 44.3891,
      longitude: -79.6901
    )

    # Further away location
    far_business = make_business(
      name: "Nearby Cafe",
      latitude: 44.3900,
      longitude: -79.6920
    )

    close_score = @matcher.calculate_score(close_business, restaurant)
    far_score = @matcher.calculate_score(far_business, restaurant)

    assert close_score > far_score, "Closer restaurant should have higher score (#{close_score} vs #{far_score})"
  end

  def test_address_similarity_affects_score
    insert_restaurant(
      name: "Downtown Diner",
      address: "123 Main Street, Barrie, ON",
      latitude: 44.389,
      longitude: -79.690
    )

    business = make_business(
      name: "Downtown Diner",
      address: "123 Main St, Barrie, Ontario",
      latitude: 44.389,
      longitude: -79.690
    )

    result = @matcher.find_match(business)
    refute_nil result
    assert result[:score] >= 50
  end

  def test_returns_best_match_among_multiple
    insert_restaurant(name: "Good Match Cafe", latitude: 44.389, longitude: -79.690)
    insert_restaurant(name: "Bad Match Place", latitude: 44.5, longitude: -79.8)

    business = make_business(
      name: "Good Match Cafe",
      latitude: 44.389,
      longitude: -79.690
    )

    result = @matcher.find_match(business)
    refute_nil result
    assert_equal "Good Match Cafe", result[:restaurant][:name]
  end

  def test_score_below_threshold_returns_nil
    insert_restaurant(name: "Completely Different Restaurant", latitude: 44.0, longitude: -79.0)

    business = make_business(
      name: "Another Unrelated Place",
      latitude: 44.5,
      longitude: -79.5
    )

    result = @matcher.find_match(business)
    assert_nil result
  end

  def test_calculate_score_individual_components
    restaurant = {
      name: "Test Restaurant",
      address: "123 Main St",
      latitude: 44.389,
      longitude: -79.690,
      phone: "+14165551234"
    }

    # Same name, same location, same phone - should be very high
    business = make_business(
      name: "Test Restaurant",
      address: "123 Main St",
      latitude: 44.389,
      longitude: -79.690,
      phone: "+14165551234"
    )

    score = @matcher.calculate_score(business, restaurant)
    assert score >= 90, "Perfect match should score 90+"
  end

  private

  def insert_restaurant(attrs = {})
    @db[:restaurants].insert(
      name: attrs[:name] || "Test Restaurant",
      address: attrs[:address],
      latitude: attrs[:latitude],
      longitude: attrs[:longitude],
      phone: attrs[:phone],
      created_at: Time.now,
      updated_at: Time.now
    )
  end

  def make_business(attrs = {})
    {
      external_id: attrs[:external_id] || "test:123",
      name: attrs[:name] || "Test Business",
      address: attrs[:address] || "123 Test St",
      latitude: attrs[:latitude] || 44.0,
      longitude: attrs[:longitude] || -79.0,
      phone: attrs[:phone],
      rating: attrs[:rating],
      review_count: attrs[:review_count] || 0,
      categories: attrs[:categories] || [],
      photos: attrs[:photos] || []
    }
  end
end
