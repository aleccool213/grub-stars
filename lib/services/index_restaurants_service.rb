# frozen_string_literal: true

require_relative "../infrastructure/repositories/restaurant_repository"
require_relative "../infrastructure/repositories/rating_repository"
require_relative "../infrastructure/repositories/media_repository"
require_relative "../infrastructure/repositories/category_repository"
require_relative "../infrastructure/repositories/external_id_repository"
require_relative "../domain/matcher"
require_relative "../domain/models/restaurant"
require_relative "../domain/models/external_id"

module Services
  # Service for indexing restaurants from external adapters
  class IndexRestaurantsService
    class NoAdaptersConfiguredError < StandardError; end

    def initialize(
      restaurant_repo: nil,
      rating_repo: nil,
      media_repo: nil,
      category_repo: nil,
      external_id_repo: nil,
      matcher: nil,
      adapters: nil,
      logger: nil
    )
      @restaurant_repo = restaurant_repo || Infrastructure::Repositories::RestaurantRepository.new
      @rating_repo = rating_repo || Infrastructure::Repositories::RatingRepository.new
      @media_repo = media_repo || Infrastructure::Repositories::MediaRepository.new
      @category_repo = category_repo || Infrastructure::Repositories::CategoryRepository.new
      @external_id_repo = external_id_repo || Infrastructure::Repositories::ExternalIdRepository.new
      @matcher = matcher || Domain::Matcher.new
      @adapters = adapters || default_adapters
      @logger = logger || GrubStars::Logger.new
    end

    # Index restaurants from all configured adapters
    # @param location [String] Location to index (e.g., "barrie, ontario")
    # @return [Hash] Statistics: { total:, created:, updated:, merged: }
    def index(location:)
      configured_adapters = @adapters.select(&:configured?)

      if configured_adapters.empty?
        raise NoAdaptersConfiguredError, "No adapters configured. Set API keys in .env file."
      end

      stats = { total: 0, created: 0, updated: 0, merged: 0 }

      configured_adapters.each do |adapter|
        adapter_stats = index_with_adapter(adapter, location)
        stats[:total] += adapter_stats[:total]
        stats[:created] += adapter_stats[:created]
        stats[:updated] += adapter_stats[:updated]
        stats[:merged] += adapter_stats[:merged]
      end

      @logger.clear_line
      stats
    end

    private

    def default_adapters
      [GrubStars::Adapters::Yelp.new, GrubStars::Adapters::Google.new]
    end

    def index_with_adapter(adapter, location)
      stats = { total: 0, created: 0, updated: 0, merged: 0 }
      source = adapter.source_name

      adapter.search_all_businesses(location: location) do |biz, progress|
        @logger.progress(
          name: biz[:name],
          current: progress[:current],
          total: progress[:total],
          percent: progress[:percent]
        )

        result = store_business(biz, source)
        stats[:total] += 1
        stats[:created] += 1 if result == :created
        stats[:updated] += 1 if result == :updated
        stats[:merged] += 1 if result == :merged
      end

      stats
    end

    def store_business(data, source)
      # First, check if we already have this exact external ID from this source
      existing_by_id = find_by_external_id(data[:external_id], source)

      if existing_by_id
        update_restaurant(existing_by_id, data, source)
        return :updated
      end

      # Try to find a match using the matcher (name, address, GPS, phone)
      match_result = find_match(data)

      if match_result
        merge_restaurant(match_result[:restaurant], data, source)
        return :merged
      end

      # No match found, create new restaurant
      create_restaurant(data, source)
      :created
    end

    def find_by_external_id(external_id, source)
      return nil if external_id.nil?

      @restaurant_repo.find_by_external_id(source, external_id)
    end

    def find_match(data)
      # Get candidates from repository (nearby restaurants based on GPS)
      candidates = if data[:latitude] && data[:longitude]
                     delta = 0.01 # ~1km bounding box
                     @restaurant_repo.find_candidates_for_matching(
                       data[:latitude], data[:longitude], delta
                     )
                   else
                     [] # No GPS data, can't match
                   end

      # Use domain matcher to find best match
      @matcher.find_match(data, candidates)
    end

    def create_restaurant(data, source)
      now = Time.now

      # Create restaurant domain model
      restaurant = Domain::Models::Restaurant.new(
        name: data[:name],
        address: data[:address],
        latitude: data[:latitude],
        longitude: data[:longitude],
        phone: data[:phone]
      )

      # Save to repository
      @restaurant_repo.create(restaurant)

      # Store associated data
      store_external_id(restaurant.id, source, data[:external_id])
      store_categories(restaurant.id, data[:categories])
      store_rating(restaurant.id, source, data)
      store_photos(restaurant.id, source, data[:photos])

      restaurant.id
    end

    def update_restaurant(existing, data, source)
      # Update restaurant
      existing.name = data[:name]
      existing.address = data[:address]
      existing.latitude = data[:latitude]
      existing.longitude = data[:longitude]
      existing.phone = data[:phone]

      @restaurant_repo.update(existing)

      # Update associated data
      store_categories(existing.id, data[:categories])
      store_rating(existing.id, source, data)
      store_photos(existing.id, source, data[:photos])

      existing.id
    end

    def merge_restaurant(existing, data, source)
      # Only fill in missing core data from new source
      updates = {}
      updates[:phone] = data[:phone] if existing.phone.nil? && data[:phone]
      updates[:address] = data[:address] if existing.address.nil? && data[:address]
      updates[:latitude] = data[:latitude] if existing.latitude.nil? && data[:latitude]
      updates[:longitude] = data[:longitude] if existing.longitude.nil? && data[:longitude]

      @restaurant_repo.update_fields(existing.id, updates) unless updates.empty?

      # Add new source data
      store_external_id(existing.id, source, data[:external_id])
      store_categories(existing.id, data[:categories])
      store_rating(existing.id, source, data)
      store_photos(existing.id, source, data[:photos])

      existing.id
    end

    def store_external_id(restaurant_id, source, external_id)
      return if external_id.nil?

      ext_id = Domain::Models::ExternalId.new(
        restaurant_id: restaurant_id,
        source: source,
        external_id: external_id
      )

      @external_id_repo.save(ext_id)
    end

    def store_categories(restaurant_id, categories)
      return if categories.nil? || categories.empty?

      @category_repo.link_categories_to_restaurant(restaurant_id, categories)
    end

    def store_rating(restaurant_id, source, data)
      return unless data[:rating]

      @rating_repo.upsert(
        restaurant_id,
        source,
        score: data[:rating],
        review_count: data[:review_count]
      )
    end

    def store_photos(restaurant_id, source, photos)
      return if photos.nil? || photos.empty?

      @media_repo.replace_media(restaurant_id, source, "photo", photos)
    end
  end
end
