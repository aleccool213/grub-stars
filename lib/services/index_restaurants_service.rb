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
      @logger = logger || GrubStars::Logger.new
      @matcher = matcher || Domain::Matcher.new(logger: @logger)
      @adapters = adapters || default_adapters
    end

    # Default limit for restaurants per index operation
    # This helps manage API costs across adapters (Yelp, Google, TripAdvisor)
    DEFAULT_LIMIT = 100

    # Index restaurants from all configured adapters
    # @param location [String] Location to index (e.g., "barrie, ontario")
    # @param categories [String, nil] Optional category filter (e.g., "bakery")
    # @param limit [Integer] Maximum restaurants to index (default: 100)
    # @return [Hash] Statistics: { total:, created:, updated:, merged:, limit:, limit_reached: }
    def index(location:, categories: nil, limit: DEFAULT_LIMIT)
      configured_adapters = @adapters.select(&:configured?)

      if configured_adapters.empty?
        raise NoAdaptersConfiguredError, "No adapters configured. Set API keys in .env file."
      end

      stats = { total: 0, created: 0, updated: 0, merged: 0 }
      remaining_limit = limit

      configured_adapters.each do |adapter|
        break if remaining_limit <= 0

        adapter_stats = index_with_adapter(adapter, location, categories, limit: remaining_limit)
        stats[:total] += adapter_stats[:total]
        stats[:created] += adapter_stats[:created]
        stats[:updated] += adapter_stats[:updated]
        stats[:merged] += adapter_stats[:merged]

        remaining_limit -= adapter_stats[:total]
      end

      @logger.clear_line

      # Add limit info to response
      stats[:limit] = limit
      stats[:limit_reached] = stats[:total] >= limit

      stats
    end

    # Index a single restaurant from adapter business data
    # @param business_data [Hash] Normalized business data from adapter
    # @param source [String] Source adapter name (e.g., "yelp", "google")
    # @param location [String, nil] Optional location to associate with restaurant
    # @return [Symbol] Result: :created, :updated, or :merged
    def index_restaurant(business_data:, source:, location: nil)
      store_business(business_data, source, location)
    end

    # Re-index a single restaurant by fetching fresh data from all known sources
    # This updates the existing restaurant without creating a new one
    # @param restaurant_id [Integer] Restaurant ID to re-index
    # @return [Hash] Result with sources_updated, sources_failed, and changes
    def reindex_restaurant(restaurant_id)
      restaurant = @restaurant_repo.find_by_id_with_associations(restaurant_id)
      raise ArgumentError, "Restaurant with ID #{restaurant_id} not found" unless restaurant

      external_ids = restaurant.external_ids || []
      if external_ids.empty?
        return { sources_updated: [], sources_failed: [], changes: {}, message: "No external sources to refresh" }
      end

      # Store old values for comparison
      old_data = capture_restaurant_state(restaurant)

      sources_updated = []
      sources_failed = []

      external_ids.each do |ext_id|
        adapter = find_adapter_by_name(ext_id.source)
        next unless adapter&.configured?

        begin
          # Strip source prefix from external_id if present (e.g., "yelp:abc123" -> "abc123")
          # because adapters use the raw ID for API calls but return prefixed external_ids
          raw_external_id = strip_source_prefix(ext_id.external_id, ext_id.source)

          # Fetch fresh data from the adapter
          fresh_data = adapter.get_business(raw_external_id)
          next unless fresh_data

          # Update using existing index_restaurant logic (will update, not create)
          store_business(fresh_data, ext_id.source, restaurant.location)
          sources_updated << ext_id.source
        rescue StandardError => e
          @logger.warn("Failed to refresh from #{ext_id.source}: #{e.message}")
          sources_failed << { source: ext_id.source, error: e.message }
        end
      end

      # Reload restaurant to get updated data
      updated_restaurant = @restaurant_repo.find_by_id_with_associations(restaurant_id)
      new_data = capture_restaurant_state(updated_restaurant)

      # Calculate what changed
      changes = calculate_changes(old_data, new_data)

      {
        sources_updated: sources_updated,
        sources_failed: sources_failed,
        changes: changes,
        message: build_result_message(sources_updated, sources_failed, changes)
      }
    end

    private

    def find_adapter_by_name(name)
      @adapters.find { |a| a.source_name == name }
    end

    def strip_source_prefix(external_id, source)
      return external_id unless external_id
      # Remove source prefix if present (e.g., "yelp:abc123" -> "abc123")
      prefix = "#{source}:"
      external_id.start_with?(prefix) ? external_id[prefix.length..] : external_id
    end

    def capture_restaurant_state(restaurant)
      {
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        ratings: restaurant.ratings.map { |r| { source: r.source, score: r.score, review_count: r.review_count } },
        photos_count: restaurant.photos.size,
        reviews_count: restaurant.reviews.size
      }
    end

    def calculate_changes(old_data, new_data)
      changes = {}

      # Check basic fields
      %i[name address phone].each do |field|
        if old_data[field] != new_data[field]
          changes[field] = { old: old_data[field], new: new_data[field] }
        end
      end

      # Check rating changes
      old_data[:ratings].each do |old_rating|
        new_rating = new_data[:ratings].find { |r| r[:source] == old_rating[:source] }
        next unless new_rating

        if old_rating[:score] != new_rating[:score]
          changes["#{old_rating[:source]}_rating"] = {
            old: old_rating[:score],
            new: new_rating[:score]
          }
        end
        if old_rating[:review_count] != new_rating[:review_count]
          changes["#{old_rating[:source]}_review_count"] = {
            old: old_rating[:review_count],
            new: new_rating[:review_count]
          }
        end
      end

      # Check photo count
      if old_data[:photos_count] != new_data[:photos_count]
        changes[:photos] = { old: old_data[:photos_count], new: new_data[:photos_count] }
      end

      changes
    end

    def build_result_message(sources_updated, sources_failed, changes)
      parts = []

      if sources_updated.any?
        parts << "Updated from #{sources_updated.join(', ')}"
      end

      if sources_failed.any?
        parts << "Failed: #{sources_failed.map { |f| f[:source] }.join(', ')}"
      end

      if changes.any?
        change_descriptions = changes.map do |key, val|
          case key
          when :photos
            diff = val[:new] - val[:old]
            diff > 0 ? "#{diff} new photos" : "#{-diff} photos removed"
          when /_rating$/
            source = key.to_s.sub('_rating', '')
            "#{source} rating: #{val[:old]} → #{val[:new]}"
          when /_review_count$/
            source = key.to_s.sub('_review_count', '')
            diff = val[:new] - val[:old]
            diff > 0 ? "#{diff} new #{source} reviews" : nil
          else
            nil
          end
        end.compact

        parts << change_descriptions.join(', ') if change_descriptions.any?
      end

      parts.empty? ? "Data refreshed (no changes detected)" : parts.join('. ')
    end

    def default_adapters
      [
        GrubStars::Adapters::Yelp.new,
        GrubStars::Adapters::Google.new,
        GrubStars::Adapters::TripAdvisor.new
      ]
    end

    def index_with_adapter(adapter, location, categories = nil, limit: nil)
      stats = { total: 0, created: 0, updated: 0, merged: 0 }
      source = adapter.source_name

      adapter.search_all_businesses(location: location, categories: categories, limit: limit) do |biz, progress|
        # Stop if we've reached the limit
        break if limit && stats[:total] >= limit

        @logger.progress(
          name: biz[:name],
          current: progress[:current],
          total: progress[:total],
          percent: progress[:percent]
        )

        result = store_business(biz, source, location)
        stats[:total] += 1
        stats[:created] += 1 if result == :created
        stats[:updated] += 1 if result == :updated
        stats[:merged] += 1 if result == :merged
      end

      stats
    end

    def store_business(data, source, location = nil)
      # First, check if we already have this exact external ID from this source
      existing_by_id = find_by_external_id(data[:external_id], source)

      if existing_by_id
        update_restaurant(existing_by_id, data, source, location)
        return :updated
      end

      # Try to find a match using the matcher (name, address, GPS, phone)
      match_result = find_match(data)

      if match_result
        merge_restaurant(match_result[:restaurant], data, source, location)
        return :merged
      end

      # No match found, create new restaurant
      create_restaurant(data, source, location)
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

    def create_restaurant(data, source, location = nil)
      now = Time.now

      # Create restaurant domain model
      restaurant = Domain::Models::Restaurant.new(
        name: data[:name],
        address: data[:address],
        latitude: data[:latitude],
        longitude: data[:longitude],
        phone: data[:phone],
        location: location
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

    def update_restaurant(existing, data, source, location = nil)
      # Update restaurant
      existing.name = data[:name]
      existing.address = data[:address]
      existing.latitude = data[:latitude]
      existing.longitude = data[:longitude]
      existing.phone = data[:phone]
      # Update location if not set or if a new location is provided
      existing.location = location if existing.location.nil? || location

      @restaurant_repo.update(existing)

      # Update associated data
      store_categories(existing.id, data[:categories])
      store_rating(existing.id, source, data)
      store_photos(existing.id, source, data[:photos])

      existing.id
    end

    def merge_restaurant(existing, data, source, location = nil)
      # Only fill in missing core data from new source
      updates = {}
      updates[:phone] = data[:phone] if existing.phone.nil? && data[:phone]
      updates[:address] = data[:address] if existing.address.nil? && data[:address]
      updates[:latitude] = data[:latitude] if existing.latitude.nil? && data[:latitude]
      updates[:longitude] = data[:longitude] if existing.longitude.nil? && data[:longitude]
      # Set location if not already set
      updates[:location] = location if existing.location.nil? && location

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
