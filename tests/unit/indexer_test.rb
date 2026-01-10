# frozen_string_literal: true

require_relative "../test_helper"

class IndexerTest < GrubStars::IntegrationTest
  def setup
    super
    @mock_adapter = MockAdapter.new
  end

  def test_indexes_businesses_from_adapter
    @mock_adapter.businesses = [
      make_business(external_id: "biz1", name: "Test Bakery", rating: 4.5, latitude: 44.0, longitude: -79.0),
      make_business(external_id: "biz2", name: "Corner Cafe", rating: 4.0, latitude: 45.0, longitude: -80.0)
    ]

    indexer = GrubStars::Indexer.new(db: @db, adapters: [@mock_adapter], logger: GrubStars::Logger.silent)
    stats = indexer.index(location: "barrie")

    assert_equal 2, stats[:total]
    assert_equal 2, stats[:created]
    assert_equal 0, stats[:updated]
    assert_equal 0, stats[:merged]
    assert_equal 2, @db[:restaurants].count
  end

  def test_stores_restaurant_details
    @mock_adapter.businesses = [
      make_business(
        external_id: "biz1",
        name: "Test Bakery",
        address: "123 Main St, Barrie, ON",
        latitude: 44.3894,
        longitude: -79.6903,
        phone: "+14165551234"
      )
    ]

    indexer = GrubStars::Indexer.new(db: @db, adapters: [@mock_adapter], logger: GrubStars::Logger.silent)
    indexer.index(location: "barrie")

    restaurant = @db[:restaurants].first
    assert_equal "Test Bakery", restaurant[:name]
    assert_equal "123 Main St, Barrie, ON", restaurant[:address]
    assert_in_delta 44.3894, restaurant[:latitude], 0.0001
    assert_in_delta(-79.6903, restaurant[:longitude], 0.0001)
    assert_equal "+14165551234", restaurant[:phone]

    # Check external_id is stored in external_ids table
    ext_id = @db[:external_ids].where(restaurant_id: restaurant[:id]).first
    assert_equal "mock", ext_id[:source]
    assert_equal "biz1", ext_id[:external_id]
  end

  def test_stores_categories
    @mock_adapter.businesses = [
      make_business(external_id: "biz1", name: "Test Bakery", categories: ["bakeries", "cafes"])
    ]

    indexer = GrubStars::Indexer.new(db: @db, adapters: [@mock_adapter], logger: GrubStars::Logger.silent)
    indexer.index(location: "barrie")

    categories = @db[:categories].select_map(:name)
    assert_includes categories, "bakeries"
    assert_includes categories, "cafes"

    restaurant = @db[:restaurants].first
    linked = @db[:restaurant_categories].where(restaurant_id: restaurant[:id]).count
    assert_equal 2, linked
  end

  def test_stores_ratings
    @mock_adapter.businesses = [
      make_business(external_id: "biz1", name: "Test Bakery", rating: 4.5, review_count: 120)
    ]

    indexer = GrubStars::Indexer.new(db: @db, adapters: [@mock_adapter], logger: GrubStars::Logger.silent)
    indexer.index(location: "barrie")

    restaurant = @db[:restaurants].first
    rating = @db[:ratings].where(restaurant_id: restaurant[:id]).first

    assert_equal "mock", rating[:source]
    assert_equal 4.5, rating[:score]
    assert_equal 120, rating[:review_count]
  end

  def test_stores_photos
    @mock_adapter.businesses = [
      make_business(
        external_id: "biz1",
        name: "Test Bakery",
        photos: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"]
      )
    ]

    indexer = GrubStars::Indexer.new(db: @db, adapters: [@mock_adapter], logger: GrubStars::Logger.silent)
    indexer.index(location: "barrie")

    restaurant = @db[:restaurants].first
    photos = @db[:media].where(restaurant_id: restaurant[:id], media_type: "photo").all

    assert_equal 2, photos.length
    assert_equal "https://example.com/photo1.jpg", photos[0][:url]
  end

  def test_updates_existing_restaurant_by_external_id
    @mock_adapter.businesses = [
      make_business(external_id: "biz1", name: "Test Bakery", rating: 4.5)
    ]

    indexer = GrubStars::Indexer.new(db: @db, adapters: [@mock_adapter], logger: GrubStars::Logger.silent)
    indexer.index(location: "barrie")

    # Update name and rating (same external_id)
    @mock_adapter.businesses = [
      make_business(external_id: "biz1", name: "Test Bakery Updated", rating: 4.8)
    ]
    stats = indexer.index(location: "barrie")

    assert_equal 1, stats[:total]
    assert_equal 0, stats[:created]
    assert_equal 1, stats[:updated]
    assert_equal 0, stats[:merged]
    assert_equal 1, @db[:restaurants].count

    restaurant = @db[:restaurants].first
    assert_equal "Test Bakery Updated", restaurant[:name]

    rating = @db[:ratings].where(restaurant_id: restaurant[:id]).first
    assert_equal 4.8, rating[:score]
  end

  def test_raises_error_when_no_adapters_configured
    unconfigured = MockAdapter.new(configured: false)

    indexer = GrubStars::Indexer.new(db: @db, adapters: [unconfigured], logger: GrubStars::Logger.silent)

    assert_raises(GrubStars::Indexer::NoAdaptersConfiguredError) do
      indexer.index(location: "barrie")
    end
  end

  def test_multiple_adapters_supported
    adapter1 = MockAdapter.new(configured: true, name: "adapter1")
    adapter1.businesses = [make_business(external_id: "a1", name: "Unique Place 1", latitude: 44.0, longitude: -79.0)]

    adapter2 = MockAdapter.new(configured: true, name: "adapter2")
    adapter2.businesses = [make_business(external_id: "a2", name: "Unique Place 2", latitude: 45.0, longitude: -80.0)]

    indexer = GrubStars::Indexer.new(db: @db, adapters: [adapter1, adapter2], logger: GrubStars::Logger.silent)
    stats = indexer.index(location: "barrie")

    assert_equal 2, stats[:total]
    assert_equal 2, stats[:created]
  end

  def test_merges_matching_restaurants_from_different_adapters
    # First adapter creates a restaurant
    adapter1 = MockAdapter.new(configured: true, name: "yelp")
    adapter1.businesses = [
      make_business(
        external_id: "yelp:123",
        name: "Downtown Bakery",
        address: "100 Main St, Barrie",
        latitude: 44.389,
        longitude: -79.690,
        phone: "+17055551234",
        rating: 4.5
      )
    ]

    # Second adapter has the same restaurant (slightly different name)
    adapter2 = MockAdapter.new(configured: true, name: "google")
    adapter2.businesses = [
      make_business(
        external_id: "google:456",
        name: "Downtown Bakery & Cafe",
        address: "100 Main Street, Barrie",
        latitude: 44.389,
        longitude: -79.690,
        phone: "+17055551234",
        rating: 4.2
      )
    ]

    indexer = GrubStars::Indexer.new(db: @db, adapters: [adapter1, adapter2], logger: GrubStars::Logger.silent)
    stats = indexer.index(location: "barrie")

    assert_equal 2, stats[:total]
    assert_equal 1, stats[:created]
    assert_equal 0, stats[:updated]
    assert_equal 1, stats[:merged]

    # Should only have one restaurant
    assert_equal 1, @db[:restaurants].count

    # But should have two external IDs
    restaurant = @db[:restaurants].first
    ext_ids = @db[:external_ids].where(restaurant_id: restaurant[:id]).all
    assert_equal 2, ext_ids.length

    # And two ratings (one per source)
    ratings = @db[:ratings].where(restaurant_id: restaurant[:id]).all
    assert_equal 2, ratings.length
    sources = ratings.map { |r| r[:source] }
    assert_includes sources, "yelp"
    assert_includes sources, "google"
  end

  private

  def make_business(attrs = {})
    {
      external_id: attrs[:external_id] || "test_id",
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

  class MockAdapter < GrubStars::Adapters::Base
    attr_accessor :businesses

    def initialize(configured: true, name: "mock")
      @configured = configured
      @name = name
      @businesses = []
    end

    def source_name
      @name
    end

    def configured?
      @configured
    end

    def search_all_businesses(location:, categories: nil)
      total = @businesses.length
      @businesses.each_with_index do |biz, idx|
        progress = {
          current: idx + 1,
          total: total,
          percent: ((idx + 1).to_f / total * 100).round(1)
        }
        yield biz, progress if block_given?
      end
      total
    end
  end
end
