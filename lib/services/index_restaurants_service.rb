# frozen_string_literal: true

require_relative "../infrastructure/repositories/restaurant_repository"
require_relative "../infrastructure/repositories/rating_repository"
require_relative "../infrastructure/repositories/review_repository"
require_relative "../infrastructure/repositories/media_repository"
require_relative "../infrastructure/repositories/category_repository"
require_relative "../infrastructure/repositories/external_id_repository"
require_relative "../domain/matcher"
require_relative "../domain/models/restaurant"
require_relative "../domain/models/external_id"
require_relative "../domain/models/review"

module Services
  # Service for indexing restaurants from external adapters
  class IndexRestaurantsService
    class NoAdaptersConfiguredError < StandardError; end

    def initialize(
      restaurant_repo: nil,
      rating_repo: nil,
      review_repo: nil,
      media_repo: nil,
      category_repo: nil,
      external_id_repo: nil,
      matcher: nil,
      adapters: nil,
      logger: nil
    )
      @restaurant_repo = restaurant_repo || Infrastructure::Repositories::RestaurantRepository.new
      @rating_repo = rating_repo || Infrastructure::Repositories::RatingRepository.new
      @review_repo = review_repo || Infrastructure::Repositories::ReviewRepository.new
      @media_repo = media_repo || Infrastructure::Repositories::MediaRepository.new
      @category_repo = category_repo || Infrastructure::Repositories::CategoryRepository.new
      @external_id_repo = external_id_repo || Infrastructure::Repositories::ExternalIdRepository.new
      @logger = logger || GrubStars::Logger.new
      @matcher = matcher || Domain::Matcher.new(logger: @logger)
      @adapters = adapters || default_adapters
    end

    # Default limit for restaurants per index operation
    # This helps manage API costs across adapters (Yelp, Google, TripAdvisor)
    DEFAULT_LIMIT = 50

    # Index restaurants from all configured adapters
    # @param location [String] Location to index (e.g., "barrie, ontario")
    # @param categories [String, nil] Optional category filter (e.g., "bakery")
    # @param limit [Integer] Maximum restaurants to index per adapter (default: 50)
    # @param on_progress [Proc, nil] Optional callback for progress updates
    #   Called with { adapter:, current:, total:, percent:, restaurant_name:, phase: }
    # @return [Hash] Detailed statistics including restaurant lists:
    #   { total:, created:, updated:, merged:, limit:, limit_per_adapter:, limit_reached:,
    #     restaurants_created: [], restaurants_updated: [], restaurants_merged: [],
    #     adapters: { source_name => { total:, created:, updated:, merged: } } }
    def index(location:, categories: nil, limit: DEFAULT_LIMIT, on_progress: nil)
      configured_adapters = @adapters.select(&:configured?)

      if configured_adapters.empty?
        raise NoAdaptersConfiguredError, "No adapters configured. Set API keys in .env file."
      end

      stats = {
        total: 0,
        created: 0,
        updated: 0,
        merged: 0,
        restaurants_created: [],
        restaurants_updated: [],
        restaurants_merged: [],
        adapters: {}
      }
      any_limit_reached = false

      # Each adapter gets its own limit (not shared across adapters)
      configured_adapters.each do |adapter|
        # Log adapter starting
        @logger.adapter_phase(adapter: adapter.source_name, phase: :starting)

        # Notify progress callback that we're starting a new adapter
        on_progress&.call({
          adapter: adapter.source_name,
          phase: :starting,
          current: 0,
          total: 0,
          percent: 0,
          restaurant_name: nil
        })

        adapter_stats = index_with_adapter(adapter, location, categories, limit: limit, on_progress: on_progress)

        # Clear progress line before showing completion
        @logger.clear_line

        # Aggregate totals
        stats[:total] += adapter_stats[:total]
        stats[:created] += adapter_stats[:created]
        stats[:updated] += adapter_stats[:updated]
        stats[:merged] += adapter_stats[:merged]
        any_limit_reached ||= adapter_stats[:limit_reached]

        # Aggregate restaurant lists
        stats[:restaurants_created].concat(adapter_stats[:restaurants_created])
        stats[:restaurants_updated].concat(adapter_stats[:restaurants_updated])
        stats[:restaurants_merged].concat(adapter_stats[:restaurants_merged])

        # Store per-adapter stats
        adapter_summary = {
          total: adapter_stats[:total],
          created: adapter_stats[:created],
          updated: adapter_stats[:updated],
          merged: adapter_stats[:merged]
        }
        stats[:adapters][adapter.source_name] = adapter_summary

        # Log adapter completion with stats
        @logger.adapter_phase(adapter: adapter.source_name, phase: :completed, stats: adapter_summary)

        # Notify progress callback that adapter is complete
        on_progress&.call({
          adapter: adapter.source_name,
          phase: :completed,
          current: adapter_stats[:total],
          total: adapter_stats[:total],
          percent: 100,
          restaurant_name: nil
        })
      end

      @logger.clear_line

      # Phase 2: Reverse-lookup pass (TripAdvisor only)
      # TripAdvisor's forward search returns ~10 results vs Yelp's 240 and Google's 60.
      # For restaurants missing TripAdvisor data, search by name to fill the gap.
      reverse_adapters = configured_adapters.select { |a| a.source_name == "tripadvisor" }
      reverse_stats = reverse_lookup(location, reverse_adapters, on_progress: on_progress)
      stats[:merged] += reverse_stats[:merged]
      stats[:total] += reverse_stats[:total]
      reverse_stats[:per_adapter].each do |source_name, adapter_reverse|
        if stats[:adapters][source_name]
          stats[:adapters][source_name][:merged] += adapter_reverse[:merged]
          stats[:adapters][source_name][:total] += adapter_reverse[:total]
        end
      end
      stats[:restaurants_merged].concat(reverse_stats[:restaurants_merged])

      # Add limit info to response
      # limit_per_adapter: The limit given to each adapter (new, more accurate name)
      # limit: Same as limit_per_adapter (for backward compatibility)
      # limit_reached: True if any adapter hit its limit
      stats[:limit_per_adapter] = limit
      stats[:limit] = limit
      stats[:limit_reached] = any_limit_reached

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

    # Re-index a single restaurant by fetching fresh data from its known external sources
    # AND cautiously searching for data on sources that don't yet have an external ID
    # Preserves restaurant identity (name, address, coordinates) and only updates
    # ratings, photos, reviews, and categories from fresh adapter data
    # @param restaurant_id [Integer] Restaurant ID to re-index
    # @return [Hash] Result with sources_updated, sources_failed, sources_added, and changes
    def reindex_restaurant(restaurant_id)
      restaurant = @restaurant_repo.find_by_id_with_associations(restaurant_id)
      raise ArgumentError, "Restaurant with ID #{restaurant_id} not found" unless restaurant

      external_ids = restaurant.external_ids || []
      existing_sources = external_ids.map(&:source)

      # Store old values for comparison
      old_data = capture_restaurant_state(restaurant)

      sources_updated = []
      sources_added = []
      sources_failed = []

      # Step 1: Refresh from existing external IDs
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

          # Refresh only data fields (ratings, photos, reviews, categories)
          # while preserving the restaurant's identity (name, address, coordinates)
          refresh_restaurant_data(restaurant, fresh_data, ext_id.source, adapter)
          sources_updated << ext_id.source
        rescue StandardError => e
          @logger.warn("Failed to refresh from #{ext_id.source}: #{e.message}")
          sources_failed << { source: ext_id.source, error: e.message }
        end
      end

      # Step 2: Search for the restaurant on adapters that don't have an external ID yet
      # Uses strict matching (>=90% name similarity) to avoid matching the wrong restaurant
      configured_adapters = @adapters.select(&:configured?)
      new_adapters = configured_adapters.reject { |a| existing_sources.include?(a.source_name) }

      new_adapters.each do |adapter|
        begin
          # Search by restaurant name with location context
          search_results = adapter.search_by_name(
            name: restaurant.name,
            location: restaurant.location,
            limit: 5
          )

          next if search_results.nil? || search_results.empty?

          # Use strict matching to find a high-confidence match
          best_match = find_strict_match_for_restaurant(restaurant, search_results)
          next unless best_match

          # Merge data from the new source (only fills in missing fields, never overwrites identity)
          merge_restaurant(restaurant, best_match, adapter.source_name, restaurant.location)
          sources_added << adapter.source_name
        rescue StandardError => e
          @logger.warn("Failed to search #{adapter.source_name}: #{e.message}")
          sources_failed << { source: adapter.source_name, error: e.message }
        end
      end

      # Reload restaurant to get updated data
      updated_restaurant = @restaurant_repo.find_by_id_with_associations(restaurant_id)
      new_data = capture_restaurant_state(updated_restaurant)

      # Calculate what changed
      changes = calculate_changes(old_data, new_data)

      {
        sources_updated: sources_updated,
        sources_added: sources_added,
        sources_failed: sources_failed,
        changes: changes,
        message: build_result_message(sources_updated, sources_failed, changes, sources_added)
      }
    end

    private

    # Minimum name similarity required for reindex discovery (90%)
    REINDEX_NAME_SIMILARITY_THRESHOLD = 0.9
    # Minimum overall match score for reindex discovery (out of 100)
    REINDEX_MATCH_THRESHOLD = 80

    # Find a strict match from search results for an existing restaurant during reindex
    # Requires >=90% name similarity AND high overall score to avoid false matches
    # @param restaurant [Domain::Models::Restaurant] Existing restaurant to match against
    # @param search_results [Array<Hash>] Search results from adapter
    # @return [Hash, nil] Best matching result or nil if no confident match
    def find_strict_match_for_restaurant(restaurant, search_results)
      restaurant_data = {
        name: restaurant.name,
        address: restaurant.address,
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
        phone: restaurant.phone
      }

      best_match = nil
      best_score = 0

      search_results.each do |result|
        scores = @matcher.calculate_component_scores_for_hashes(restaurant_data, result)
        total_score = scores.values.sum

        # Require name similarity >= 90% (name_score / NAME_WEIGHT)
        name_similarity = scores[:name].to_f / Domain::Matcher::NAME_WEIGHT
        next if name_similarity < REINDEX_NAME_SIMILARITY_THRESHOLD

        # Require high overall score
        next if total_score < REINDEX_MATCH_THRESHOLD

        if total_score > best_score
          best_score = total_score
          best_match = result
        end
      end

      best_match
    end

    # Refresh only data fields for an existing restaurant from fresh adapter data
    # Preserves identity (name, address, coordinates) — only updates ratings, photos,
    # reviews, and categories
    def refresh_restaurant_data(restaurant, fresh_data, source, adapter)
      reviews = fetch_reviews(adapter, fresh_data[:external_id])

      # Update description from reviews if not already set
      if (restaurant.description.nil? || restaurant.description.empty?) && reviews.any?
        description = generate_description(reviews)
        @restaurant_repo.update_fields(restaurant.id, { description: description }) if description
      end

      # Refresh associated data
      store_categories(restaurant.id, fresh_data[:categories])
      store_rating(restaurant.id, source, fresh_data)
      store_photos(restaurant.id, source, fresh_data[:photos])
      store_reviews(restaurant.id, source, reviews)
    end

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
        description: restaurant.description,
        ratings: restaurant.ratings.map { |r| { source: r.source, score: r.score, review_count: r.review_count } },
        photos_count: restaurant.photos.size,
        reviews_count: restaurant.reviews.size
      }
    end

    def calculate_changes(old_data, new_data)
      changes = {}

      # Check basic fields
      %i[name address phone description].each do |field|
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

    def build_result_message(sources_updated, sources_failed, changes, sources_added = [])
      parts = []

      if sources_updated.any?
        parts << "Updated from #{sources_updated.join(', ')}"
      end

      if sources_added.any?
        parts << "Added data from #{sources_added.join(', ')}"
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

    # Fetch detailed business info to get photos (search endpoints often don't return photos)
    # Merges detail data with search data, preferring non-empty values from details
    def fetch_business_details(adapter, search_data)
      # Extract raw ID from external_id (e.g., "yelp:abc123" -> "abc123")
      raw_id = strip_source_prefix(search_data[:external_id], adapter.source_name)
      return search_data unless raw_id

      begin
        details = adapter.get_business(raw_id)
        return search_data unless details

        # Merge: use details data for photos, keep search data for anything details doesn't have
        merged = search_data.dup
        merged[:photos] = details[:photos] if details[:photos] && !details[:photos].empty?

        # Also update other fields if details has better data
        %i[phone address rating review_count].each do |field|
          merged[field] = details[field] if details[field] && (merged[field].nil? || merged[field].to_s.empty?)
        end

        merged
      rescue StandardError => e
        @logger.warn("Failed to fetch details for #{search_data[:name]}: #{e.message}")
        search_data
      end
    end

    def index_with_adapter(adapter, location, categories = nil, limit: nil, on_progress: nil)
      stats = {
        total: 0,
        created: 0,
        updated: 0,
        merged: 0,
        limit_reached: false,
        restaurants_created: [],
        restaurants_updated: [],
        restaurants_merged: []
      }
      source = adapter.source_name

      adapter.search_all_businesses(location: location, categories: categories, limit: limit) do |biz, progress|
        # Stop if we've reached the limit
        if limit && stats[:total] >= limit
          stats[:limit_reached] = true
          break
        end

        @logger.progress(
          name: biz[:name],
          current: progress[:current],
          total: progress[:total],
          percent: progress[:percent],
          adapter: source
        )

        # Call progress callback if provided
        on_progress&.call({
          adapter: source,
          phase: :indexing,
          current: progress[:current],
          total: progress[:total],
          percent: progress[:percent],
          restaurant_name: biz[:name]
        })

        # Fetch detailed business info to get photos (search endpoints don't return photos)
        biz_with_details = fetch_business_details(adapter, biz)

        result = store_business(biz_with_details, source, location, adapter: adapter)
        stats[:total] += 1

        restaurant_info = { name: biz[:name], address: biz[:address] }

        case result
        when :created
          stats[:created] += 1
          stats[:restaurants_created] << restaurant_info
        when :updated
          stats[:updated] += 1
          stats[:restaurants_updated] << restaurant_info
        when :merged
          stats[:merged] += 1
          stats[:restaurants_merged] << restaurant_info
        end
      end

      # Also mark limit_reached if we processed exactly the limit amount
      stats[:limit_reached] = true if limit && stats[:total] >= limit

      stats
    end

    # Reverse-lookup pass: for each adapter, find restaurants missing that source
    # and search the adapter by name to try to fill in the gap.
    # Uses strict matching (same as reindex) to avoid false matches.
    def reverse_lookup(location, adapters, on_progress: nil)
      stats = { merged: 0, total: 0, restaurants_merged: [], per_adapter: {} }

      adapters.each do |adapter|
        source = adapter.source_name
        adapter_stats = { merged: 0, total: 0 }

        # Find restaurants in this location that don't have data from this adapter
        missing = @restaurant_repo.find_missing_source(location, source)
        next if missing.empty?

        @logger.adapter_phase(adapter: source, phase: :starting)
        on_progress&.call({
          adapter: source,
          phase: :reverse_lookup,
          current: 0,
          total: missing.length,
          percent: 0,
          restaurant_name: nil
        })

        missing.each_with_index do |restaurant, index|
          begin
            search_results = adapter.search_by_name(
              name: restaurant.name,
              location: location,
              limit: 5
            )

            next if search_results.nil? || search_results.empty?

            best_match = find_strict_match_for_restaurant(restaurant, search_results)
            next unless best_match

            # Fetch details to get full data (GPS, photos, phone)
            best_match = fetch_business_details(adapter, best_match)

            merge_restaurant(restaurant, best_match, source, location, adapter: adapter)
            adapter_stats[:merged] += 1
            stats[:restaurants_merged] << { name: restaurant.name, address: restaurant.address }
          rescue StandardError => e
            @logger.warn("Reverse lookup failed for '#{restaurant.name}' on #{source}: #{e.message}")
          end

          adapter_stats[:total] += 1

          @logger.progress(
            name: restaurant.name,
            current: index + 1,
            total: missing.length,
            percent: (((index + 1).to_f / missing.length) * 100).round(1),
            adapter: "#{source} reverse"
          )

          on_progress&.call({
            adapter: source,
            phase: :reverse_lookup,
            current: index + 1,
            total: missing.length,
            percent: (((index + 1).to_f / missing.length) * 100).round(1),
            restaurant_name: restaurant.name
          })
        end

        @logger.clear_line
        @logger.adapter_phase(adapter: "#{source} reverse-lookup", phase: :completed, stats: {
          total: adapter_stats[:total], created: 0, merged: adapter_stats[:merged], updated: 0
        })

        stats[:merged] += adapter_stats[:merged]
        stats[:total] += adapter_stats[:total]
        stats[:per_adapter][source] = adapter_stats
      end

      stats
    end

    def store_business(data, source, location = nil, adapter: nil)
      # First, check if we already have this exact external ID from this source
      existing_by_id = find_by_external_id(data[:external_id], source)

      if existing_by_id
        update_restaurant(existing_by_id, data, source, location, adapter: adapter)
        return :updated
      end

      # Try to find a match using the matcher (name, address, GPS, phone)
      match_result = find_match(data)

      if match_result
        merge_restaurant(match_result[:restaurant], data, source, location, adapter: adapter)
        return :merged
      end

      # No match found, create new restaurant
      create_restaurant(data, source, location, adapter: adapter)
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

    def create_restaurant(data, source, location = nil, adapter: nil)
      now = Time.now

      # Fetch reviews from API if adapter available
      reviews = fetch_reviews(adapter, data[:external_id])

      # Generate description from first review if available
      description = generate_description(reviews)

      # Create restaurant domain model
      restaurant = Domain::Models::Restaurant.new(
        name: data[:name],
        address: data[:address],
        latitude: data[:latitude],
        longitude: data[:longitude],
        phone: data[:phone],
        location: location,
        description: description
      )

      # Save to repository
      @restaurant_repo.create(restaurant)

      # Store associated data
      store_external_id(restaurant.id, source, data[:external_id])
      store_categories(restaurant.id, data[:categories])
      store_rating(restaurant.id, source, data)
      store_photos(restaurant.id, source, data[:photos])
      store_reviews(restaurant.id, source, reviews)

      restaurant.id
    end

    def update_restaurant(existing, data, source, location = nil, adapter: nil)
      # Fetch reviews from API if adapter available
      reviews = fetch_reviews(adapter, data[:external_id])

      # Generate description from first review if not already set
      if existing.description.nil? || existing.description.empty?
        existing.description = generate_description(reviews)
      end

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
      store_reviews(existing.id, source, reviews)

      existing.id
    end

    def merge_restaurant(existing, data, source, location = nil, adapter: nil)
      # Fetch reviews from API if adapter available
      reviews = fetch_reviews(adapter, data[:external_id])

      # Only fill in missing core data from new source
      updates = {}
      updates[:phone] = data[:phone] if existing.phone.nil? && data[:phone]
      updates[:address] = data[:address] if existing.address.nil? && data[:address]
      updates[:latitude] = data[:latitude] if existing.latitude.nil? && data[:latitude]
      updates[:longitude] = data[:longitude] if existing.longitude.nil? && data[:longitude]
      # Set location if not already set
      updates[:location] = location if existing.location.nil? && location
      # Set description from reviews if not already set
      if (existing.description.nil? || existing.description.empty?) && reviews.any?
        updates[:description] = generate_description(reviews)
      end

      @restaurant_repo.update_fields(existing.id, updates) unless updates.empty?

      # Add new source data
      store_external_id(existing.id, source, data[:external_id])
      store_categories(existing.id, data[:categories])
      store_rating(existing.id, source, data)
      store_photos(existing.id, source, data[:photos])
      store_reviews(existing.id, source, reviews)

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

    def store_reviews(restaurant_id, source, reviews)
      return if reviews.nil? || reviews.empty?

      reviews.each do |review_data|
        review = Domain::Models::Review.new(
          restaurant_id: restaurant_id,
          source: source,
          snippet: review_data[:text],
          url: review_data[:url],
          fetched_at: Time.now
        )
        @review_repo.save(review)
      end
    end

    def fetch_reviews(adapter, external_id)
      return [] unless adapter && external_id

      # Return empty array if adapter doesn't support get_reviews
      return [] unless adapter.respond_to?(:get_reviews)

      # Strip source prefix from external_id (e.g., "yelp:abc123" -> "abc123")
      raw_id = strip_source_prefix(external_id, adapter.source_name)

      reviews = adapter.get_reviews(raw_id)
      reviews || []
    rescue StandardError => e
      @logger.warn("Failed to fetch reviews: #{e.message}")
      []
    end

    def generate_description(reviews)
      return nil if reviews.nil? || reviews.empty?

      # Use the first review's text as description, truncated to ~200 chars
      first_review = reviews.first
      text = first_review[:text]
      return nil if text.nil? || text.empty?

      # Truncate at word boundary if too long
      if text.length > 200
        truncated = text[0, 200]
        # Find last space to avoid cutting mid-word
        last_space = truncated.rindex(" ")
        truncated = truncated[0, last_space] if last_space && last_space > 150
        "#{truncated}..."
      else
        text
      end
    end
  end
end
