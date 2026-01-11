# frozen_string_literal: true

require_relative "../../test_helper"

class RestaurantTest < Minitest::Test
  def test_initialize_with_attributes
    restaurant = Domain::Models::Restaurant.new(
      id: 1,
      name: "Test Restaurant",
      address: "123 Main St",
      latitude: 44.5,
      longitude: -79.5,
      phone: "555-1234"
    )

    assert_equal 1, restaurant.id
    assert_equal "Test Restaurant", restaurant.name
    assert_equal "123 Main St", restaurant.address
    assert_equal 44.5, restaurant.latitude
    assert_equal -79.5, restaurant.longitude
    assert_equal "555-1234", restaurant.phone
  end

  def test_distance_to_another_restaurant
    restaurant1 = Domain::Models::Restaurant.new(
      latitude: 44.389356,
      longitude: -79.690331
    )

    restaurant2 = Domain::Models::Restaurant.new(
      latitude: 44.389500,
      longitude: -79.690500
    )

    distance = restaurant1.distance_to(restaurant2)
    assert distance > 0
    assert distance < 0.1 # Less than 100 meters
  end

  def test_distance_to_returns_nil_without_coordinates
    restaurant1 = Domain::Models::Restaurant.new(name: "Test")
    restaurant2 = Domain::Models::Restaurant.new(latitude: 44.5, longitude: -79.5)

    assert_nil restaurant1.distance_to(restaurant2)
  end

  def test_photos_filters_media
    restaurant = Domain::Models::Restaurant.new(name: "Test")
    restaurant.media = [
      Domain::Models::Media.new(media_type: "photo", url: "photo1.jpg"),
      Domain::Models::Media.new(media_type: "video", url: "video1.mp4"),
      Domain::Models::Media.new(media_type: "photo", url: "photo2.jpg")
    ]

    photos = restaurant.photos
    assert_equal 2, photos.length
    assert photos.all? { |m| m.media_type == "photo" }
  end

  def test_videos_filters_media
    restaurant = Domain::Models::Restaurant.new(name: "Test")
    restaurant.media = [
      Domain::Models::Media.new(media_type: "photo", url: "photo1.jpg"),
      Domain::Models::Media.new(media_type: "video", url: "video1.mp4"),
      Domain::Models::Media.new(media_type: "video", url: "video2.mp4")
    ]

    videos = restaurant.videos
    assert_equal 2, videos.length
    assert videos.all? { |m| m.media_type == "video" }
  end

  def test_category_names
    restaurant = Domain::Models::Restaurant.new(name: "Test")
    restaurant.categories = [
      Domain::Models::Category.new(name: "Bakery"),
      Domain::Models::Category.new(name: "Cafe")
    ]

    assert_equal ["Bakery", "Cafe"], restaurant.category_names
  end

  def test_sources
    restaurant = Domain::Models::Restaurant.new(name: "Test")
    restaurant.external_ids = [
      Domain::Models::ExternalId.new(source: "yelp", external_id: "123"),
      Domain::Models::ExternalId.new(source: "google", external_id: "456")
    ]

    assert_equal ["yelp", "google"], restaurant.sources
  end

  def test_to_h_includes_all_data
    restaurant = Domain::Models::Restaurant.new(
      id: 1,
      name: "Test Restaurant",
      address: "123 Main St"
    )
    restaurant.ratings = [
      Domain::Models::Rating.new(source: "yelp", score: 4.5)
    ]
    restaurant.categories = [
      Domain::Models::Category.new(name: "Bakery")
    ]

    hash = restaurant.to_h
    assert_equal 1, hash[:id]
    assert_equal "Test Restaurant", hash[:name]
    assert_equal 1, hash[:ratings].length
    assert_equal ["Bakery"], hash[:categories]
  end
end
