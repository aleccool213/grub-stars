# frozen_string_literal: true

require_relative "../../test_helper"

class DomainMatcherTest < Minitest::Test
  def setup
    @matcher = Domain::Matcher.new
  end

  def test_find_match_with_identical_names
    business_data = {
      name: "Flying Monkeys Brewery",
      address: "107 Dunlop St E",
      latitude: 44.389356,
      longitude: -79.690331,
      phone: "7057078020"
    }

    candidate = Domain::Models::Restaurant.new(
      name: "Flying Monkeys Brewery",
      address: "107 Dunlop St E",
      latitude: 44.389356,
      longitude: -79.690331,
      phone: "7057078020"
    )

    result = @matcher.find_match(business_data, [candidate])

    assert result
    assert_equal candidate, result[:restaurant]
    assert result[:score] >= Domain::Matcher::MATCH_THRESHOLD
  end

  def test_find_match_with_similar_names
    business_data = {
      name: "Tim Hortons",
      address: "123 Main St",
      latitude: 44.5,
      longitude: -79.5
    }

    candidate = Domain::Models::Restaurant.new(
      name: "Tim Horton's",
      address: "123 Main Street",
      latitude: 44.5,
      longitude: -79.5
    )

    result = @matcher.find_match(business_data, [candidate])

    assert result
    assert_equal candidate, result[:restaurant]
  end

  def test_find_match_returns_nil_for_different_restaurants
    business_data = {
      name: "McDonald's",
      address: "100 First St",
      latitude: 44.5,
      longitude: -79.5
    }

    candidate = Domain::Models::Restaurant.new(
      name: "Burger King",
      address: "200 Second St",
      latitude: 45.0,
      longitude: -80.0
    )

    result = @matcher.find_match(business_data, [candidate])

    assert_nil result
  end

  def test_find_match_returns_best_match_from_multiple_candidates
    business_data = {
      name: "Starbucks",
      latitude: 44.5,
      longitude: -79.5
    }

    good_match = Domain::Models::Restaurant.new(
      name: "Starbucks Coffee",
      latitude: 44.5,
      longitude: -79.5
    )

    bad_match = Domain::Models::Restaurant.new(
      name: "Tim Hortons",
      latitude: 44.6,
      longitude: -79.6
    )

    result = @matcher.find_match(business_data, [bad_match, good_match])

    assert result
    assert_equal good_match, result[:restaurant]
  end

  def test_calculate_score_perfect_match
    business_data = {
      name: "Test Restaurant",
      address: "123 Main St",
      latitude: 44.5,
      longitude: -79.5,
      phone: "5551234"
    }

    restaurant = Domain::Models::Restaurant.new(
      name: "Test Restaurant",
      address: "123 Main St",
      latitude: 44.5,
      longitude: -79.5,
      phone: "5551234"
    )

    score = @matcher.calculate_score(business_data, restaurant)
    assert score >= 90 # Should be very high for perfect match
  end

  def test_normalize_name_removes_punctuation
    assert_equal "test restaurant", @matcher.send(:normalize_name, "Test Restaurant!")
    assert_equal "test restaurant", @matcher.send(:normalize_name, "Test-Restaurant")
  end

  def test_normalize_address_removes_street_suffixes
    normalized = @matcher.send(:normalize_address, "123 Main Street")
    refute_match(/street/i, normalized)

    normalized = @matcher.send(:normalize_address, "456 Oak Avenue")
    refute_match(/avenue/i, normalized)
  end

  def test_normalize_phone_keeps_only_digits
    assert_equal "5551234567", @matcher.send(:normalize_phone, "(555) 123-4567")
    assert_equal "5551234567", @matcher.send(:normalize_phone, "555.123.4567")
  end

  def test_gps_score_close_proximity
    business_data = { latitude: 44.5, longitude: -79.5 }
    restaurant = Domain::Models::Restaurant.new(
      latitude: 44.5001,
      longitude: -79.5001
    )

    score = @matcher.send(:gps_score, business_data, restaurant)
    assert score > 20 # Should be high for very close proximity
  end

  def test_gps_score_far_distance
    business_data = { latitude: 44.5, longitude: -79.5 }
    restaurant = Domain::Models::Restaurant.new(
      latitude: 45.0,
      longitude: -80.0
    )

    score = @matcher.send(:gps_score, business_data, restaurant)
    assert_equal 0, score # Too far apart
  end

  def test_phone_score_exact_match
    score = @matcher.send(:phone_score, "5551234567", "5551234567")
    assert_equal Domain::Matcher::PHONE_WEIGHT, score
  end

  def test_phone_score_normalized_match
    score = @matcher.send(:phone_score, "(555) 123-4567", "555-123-4567")
    assert_equal Domain::Matcher::PHONE_WEIGHT, score
  end

  def test_phone_score_no_match
    score = @matcher.send(:phone_score, "5551234567", "5559876543")
    assert_equal 0, score
  end
end
