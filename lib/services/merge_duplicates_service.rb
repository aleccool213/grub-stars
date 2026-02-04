# frozen_string_literal: true

require_relative "../infrastructure/repositories/restaurant_repository"
require_relative "../infrastructure/repositories/rating_repository"
require_relative "../infrastructure/repositories/review_repository"
require_relative "../infrastructure/repositories/media_repository"
require_relative "../infrastructure/repositories/category_repository"
require_relative "../infrastructure/repositories/external_id_repository"

module Services
  # Service for finding and merging duplicate restaurants
  # Primarily used to fix TripAdvisor restaurants that were created as duplicates
  # because the search API didn't return GPS coordinates for matching
  class MergeDuplicatesService
    # Minimum name similarity score (0.0 to 1.0) to consider as a match
    NAME_SIMILARITY_THRESHOLD = 0.85

    # Maximum distance in degrees between two restaurants to consider as same location
    # ~0.005 degrees ≈ 500 meters
    GPS_DISTANCE_THRESHOLD = 0.005

    # Result struct for merge operations
    MergeResult = Struct.new(:merged_count, :skipped_count, :details, keyword_init: true)

    # Detail struct for individual merge operations
    MergeDetail = Struct.new(:duplicate_id, :duplicate_name, :target_id, :target_name, :similarity, :merged, :reason, keyword_init: true)

    def initialize(
      db: nil,
      restaurant_repo: nil,
      rating_repo: nil,
      review_repo: nil,
      media_repo: nil,
      category_repo: nil,
      external_id_repo: nil,
      logger: nil
    )
      @db = db || GrubStars.db
      @restaurant_repo = restaurant_repo || Infrastructure::Repositories::RestaurantRepository.new(db: @db)
      @rating_repo = rating_repo || Infrastructure::Repositories::RatingRepository.new(db: @db)
      @review_repo = review_repo || Infrastructure::Repositories::ReviewRepository.new(db: @db)
      @media_repo = media_repo || Infrastructure::Repositories::MediaRepository.new(db: @db)
      @category_repo = category_repo || Infrastructure::Repositories::CategoryRepository.new(db: @db)
      @external_id_repo = external_id_repo || Infrastructure::Repositories::ExternalIdRepository.new(db: @db)
      @logger = logger || GrubStars::Logger.silent
    end

    # Find restaurants that only have TripAdvisor external_id (potential duplicates)
    # @return [Array<Hash>] Array of restaurant records
    def find_tripadvisor_only_restaurants
      @db[:restaurants]
        .join(:external_ids, restaurant_id: Sequel[:restaurants][:id])
        .where(Sequel[:external_ids][:source] => "tripadvisor")
        .exclude(
          Sequel[:restaurants][:id] => @db[:external_ids]
            .where(source: %w[yelp google])
            .select(:restaurant_id)
        )
        .select_all(:restaurants)
        .distinct
        .all
    end

    # Find potential matches for a restaurant based on name similarity and GPS proximity
    # @param restaurant [Hash] The restaurant to find matches for
    # @param sources [Array<String>] Sources to match against (default: yelp, google)
    # @return [Array<Hash>] Array of potential matches with similarity scores, sorted by similarity desc
    def find_potential_matches(restaurant, sources: %w[yelp google])
      # Find restaurants that have the specified external_ids
      candidates = @db[:restaurants]
        .join(:external_ids, restaurant_id: :id)
        .where(source: sources)
        .exclude(Sequel[:restaurants][:id] => restaurant[:id])
        .select_all(:restaurants)
        .distinct
        .all

      # Calculate similarity for each candidate
      candidates_with_similarity = candidates.map do |candidate|
        similarity = calculate_name_similarity(restaurant[:name], candidate[:name])
        candidate.merge(similarity: similarity)
      end

      # Filter by name similarity threshold
      matches = candidates_with_similarity.select { |c| c[:similarity] >= NAME_SIMILARITY_THRESHOLD }

      # If the restaurant has GPS, also filter by proximity
      if restaurant[:latitude] && restaurant[:longitude]
        matches = matches.select do |candidate|
          next false unless candidate[:latitude] && candidate[:longitude]

          within_gps_threshold?(restaurant, candidate)
        end
      end

      # Sort by similarity (best first)
      matches.sort_by { |m| -m[:similarity] }
    end

    # Calculate name similarity between two strings using Levenshtein distance
    # @param name1 [String] First name
    # @param name2 [String] Second name
    # @return [Float] Similarity score from 0.0 to 1.0
    def calculate_name_similarity(name1, name2)
      str1 = name1.to_s.downcase
      str2 = name2.to_s.downcase
      max_len = [str1.length, str2.length].max
      return 1.0 if max_len.zero?

      distance = levenshtein_distance(str1, str2)
      1.0 - (distance.to_f / max_len)
    end

    # Merge a duplicate restaurant into a target restaurant
    # @param duplicate [Hash] The duplicate restaurant to merge from
    # @param target [Hash] The target restaurant to merge into
    # @return [Boolean] true if merge was successful
    def merge_restaurants(duplicate, target)
      @db.transaction do
        # Move external_ids from duplicate to target
        @db[:external_ids]
          .where(restaurant_id: duplicate[:id])
          .update(restaurant_id: target[:id])

        # Move ratings (only if target doesn't have rating from same source)
        existing_rating_sources = @db[:ratings]
          .where(restaurant_id: target[:id])
          .select_map(:source)

        @db[:ratings]
          .where(restaurant_id: duplicate[:id])
          .exclude(source: existing_rating_sources)
          .update(restaurant_id: target[:id])

        # Delete duplicate ratings from same source
        @db[:ratings]
          .where(restaurant_id: duplicate[:id])
          .delete

        # Move reviews (avoid duplicates by checking URL)
        existing_review_urls = @db[:reviews]
          .where(restaurant_id: target[:id])
          .select_map(:url)
          .compact

        @db[:reviews]
          .where(restaurant_id: duplicate[:id])
          .exclude(url: existing_review_urls)
          .update(restaurant_id: target[:id])

        # Delete duplicate reviews
        @db[:reviews]
          .where(restaurant_id: duplicate[:id])
          .delete

        # Move media (avoid duplicates by checking URL)
        existing_media_urls = @db[:media]
          .where(restaurant_id: target[:id])
          .select_map(:url)
          .compact

        @db[:media]
          .where(restaurant_id: duplicate[:id])
          .exclude(url: existing_media_urls)
          .update(restaurant_id: target[:id])

        # Delete duplicate media
        @db[:media]
          .where(restaurant_id: duplicate[:id])
          .delete

        # Move category associations (avoid duplicates)
        existing_categories = @db[:restaurant_categories]
          .where(restaurant_id: target[:id])
          .select_map(:category_id)

        @db[:restaurant_categories]
          .where(restaurant_id: duplicate[:id])
          .exclude(category_id: existing_categories)
          .update(restaurant_id: target[:id])

        # Delete duplicate category associations
        @db[:restaurant_categories]
          .where(restaurant_id: duplicate[:id])
          .delete

        # Update target with any missing data from duplicate
        updates = { updated_at: Time.now }
        updates[:latitude] = duplicate[:latitude] if duplicate[:latitude] && !target[:latitude]
        updates[:longitude] = duplicate[:longitude] if duplicate[:longitude] && !target[:longitude]
        updates[:phone] = duplicate[:phone] if duplicate[:phone] && !target[:phone]

        @db[:restaurants].where(id: target[:id]).update(updates)

        # Delete the duplicate restaurant
        @db[:restaurants].where(id: duplicate[:id]).delete
      end

      true
    rescue Sequel::Error => e
      @logger.warn("Error merging restaurant #{duplicate[:id]} into #{target[:id]}: #{e.message}")
      false
    end

    # Find and merge all TripAdvisor duplicates
    # @param dry_run [Boolean] If true, don't actually perform merges
    # @return [MergeResult] Result with counts and details
    def merge_tripadvisor_duplicates(dry_run: true)
      duplicates = find_tripadvisor_only_restaurants
      details = []
      merged_count = 0
      skipped_count = 0

      duplicates.each do |duplicate|
        matches = find_potential_matches(duplicate)

        if matches.empty?
          details << MergeDetail.new(
            duplicate_id: duplicate[:id],
            duplicate_name: duplicate[:name],
            target_id: nil,
            target_name: nil,
            similarity: nil,
            merged: false,
            reason: "No matching restaurant found"
          )
          skipped_count += 1
          next
        end

        best_match = matches.first

        if dry_run
          details << MergeDetail.new(
            duplicate_id: duplicate[:id],
            duplicate_name: duplicate[:name],
            target_id: best_match[:id],
            target_name: best_match[:name],
            similarity: best_match[:similarity],
            merged: false,
            reason: "Dry run - would merge"
          )
          merged_count += 1
        else
          success = merge_restaurants(duplicate, best_match)
          details << MergeDetail.new(
            duplicate_id: duplicate[:id],
            duplicate_name: duplicate[:name],
            target_id: best_match[:id],
            target_name: best_match[:name],
            similarity: best_match[:similarity],
            merged: success,
            reason: success ? "Merged successfully" : "Merge failed"
          )
          merged_count += 1 if success
          skipped_count += 1 unless success
        end
      end

      MergeResult.new(
        merged_count: merged_count,
        skipped_count: skipped_count,
        details: details
      )
    end

    # Get sources for a restaurant
    # @param restaurant_id [Integer] Restaurant ID
    # @return [Array<String>] Array of source names
    def get_sources(restaurant_id)
      @db[:external_ids]
        .where(restaurant_id: restaurant_id)
        .select_map(:source)
    end

    private

    def within_gps_threshold?(restaurant1, restaurant2)
      lat_diff = (restaurant1[:latitude] - restaurant2[:latitude]).abs
      lng_diff = (restaurant1[:longitude] - restaurant2[:longitude]).abs
      lat_diff <= GPS_DISTANCE_THRESHOLD && lng_diff <= GPS_DISTANCE_THRESHOLD
    end

    def levenshtein_distance(s1, s2)
      return s2.length if s1.empty?
      return s1.length if s2.empty?

      rows = s1.length + 1
      cols = s2.length + 1
      dist = Array.new(rows) { Array.new(cols, 0) }

      (0...rows).each { |i| dist[i][0] = i }
      (0...cols).each { |j| dist[0][j] = j }

      (1...rows).each do |i|
        (1...cols).each do |j|
          cost = s1[i - 1] == s2[j - 1] ? 0 : 1
          dist[i][j] = [
            dist[i - 1][j] + 1,
            dist[i][j - 1] + 1,
            dist[i - 1][j - 1] + cost
          ].min
        end
      end

      dist[rows - 1][cols - 1]
    end
  end
end
