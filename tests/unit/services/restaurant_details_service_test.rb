# frozen_string_literal: true

require_relative "../../test_helper"

class RestaurantDetailsServiceTest < Minitest::Test
  def setup
    @db = create_test_db
    @restaurant_repo = Infrastructure::Repositories::RestaurantRepository.new(@db)
    @service = Services::RestaurantDetailsService.new(restaurant_repo: @restaurant_repo)

    # Create test restaurant with all associations
    @restaurant_id = @db[:restaurants].insert(
      name: "Test Restaurant",
      address: "123 Main St",
      latitude: 44.5,
      longitude: -79.5,
      phone: "555-1234",
      created_at: Time.now,
      updated_at: Time.now
    )

    # Add rating
    @db[:ratings].insert(
      restaurant_id: @restaurant_id,
      source: "yelp",
      score: 4.5,
      review_count: 100,
      fetched_at: Time.now
    )

    # Add review
    @db[:reviews].insert(
      restaurant_id: @restaurant_id,
      source: "yelp",
      snippet: "Great food!",
      url: "https://yelp.com/review/1",
      fetched_at: Time.now
    )

    # Add media
    @db[:media].insert(
      restaurant_id: @restaurant_id,
      source: "yelp",
      media_type: "photo",
      url: "https://example.com/photo.jpg",
      fetched_at: Time.now
    )

    # Add category
    category_id = @db[:categories].insert(name: "Italian")
    @db[:restaurant_categories].insert(
      restaurant_id: @restaurant_id,
      category_id: category_id
    )

    # Add external ID
    @db[:external_ids].insert(
      restaurant_id: @restaurant_id,
      source: "yelp",
      external_id: "yelp-123"
    )
  end

  def teardown
    @db.disconnect
  end

  def test_get_by_id_with_all_associations
    restaurant = @service.get_by_id(@restaurant_id)

    assert restaurant
    assert_equal "Test Restaurant", restaurant.name
    assert_equal "123 Main St", restaurant.address

    # Check all associations are loaded
    assert_equal 1, restaurant.ratings.length
    assert_equal 4.5, restaurant.ratings.first.score

    assert_equal 1, restaurant.reviews.length
    assert_equal "Great food!", restaurant.reviews.first.snippet

    assert_equal 1, restaurant.media.length
    assert_equal "photo", restaurant.media.first.media_type

    assert_equal 1, restaurant.categories.length
    assert_equal "Italian", restaurant.categories.first.name

    assert_equal 1, restaurant.external_ids.length
    assert_equal "yelp", restaurant.external_ids.first.source
  end

  def test_get_by_id_returns_nil_when_not_found
    restaurant = @service.get_by_id(99999)
    assert_nil restaurant
  end

  def test_get_by_name_with_all_associations
    restaurant = @service.get_by_name("Test Restaurant")

    assert restaurant
    assert_equal "Test Restaurant", restaurant.name

    # Check associations are loaded
    assert_equal 1, restaurant.ratings.length
    assert_equal 1, restaurant.reviews.length
    assert_equal 1, restaurant.media.length
    assert_equal 1, restaurant.categories.length
  end

  def test_get_by_name_returns_nil_when_not_found
    restaurant = @service.get_by_name("Nonexistent")
    assert_nil restaurant
  end

  private

  def create_test_db
    db = Sequel.sqlite
    GrubStars::Database.create_schema(db)
    GrubStars::Database.register_fuzzy_functions(db)
    db
  end
end
