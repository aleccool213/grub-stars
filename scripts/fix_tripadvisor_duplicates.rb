#!/usr/bin/env ruby
# frozen_string_literal: true

# Migration Script: Fix TripAdvisor Duplicate Restaurants
#
# This script finds and merges TripAdvisor restaurants that were created as duplicates
# because the original search API didn't return GPS coordinates, preventing the matcher
# from finding existing Yelp/Google entries.
#
# Usage:
#   ruby scripts/fix_tripadvisor_duplicates.rb [database_path]
#
# Options:
#   --dry-run     Show what would be merged without making changes (default)
#   --execute     Actually perform the merges
#   --verbose     Show detailed matching information
#
# Example:
#   # Dry run on production database copy
#   ruby scripts/fix_tripadvisor_duplicates.rb /tmp/grub_stars_prod.db --dry-run
#
#   # Execute the migration
#   ruby scripts/fix_tripadvisor_duplicates.rb /tmp/grub_stars_prod.db --execute

require "sequel"

class TripAdvisorDuplicateFixer
  # Minimum name similarity score (0.0 to 1.0) to consider as a match
  NAME_SIMILARITY_THRESHOLD = 0.85

  # Maximum distance in degrees between two restaurants to consider as same location
  # ~0.005 degrees ≈ 500 meters
  GPS_DISTANCE_THRESHOLD = 0.005

  def initialize(db_path, dry_run: true, verbose: false)
    @db = Sequel.sqlite(db_path)
    @dry_run = dry_run
    @verbose = verbose
    @merged_count = 0
    @skipped_count = 0

    register_similarity_function
  end

  def run
    puts "=" * 70
    puts "TripAdvisor Duplicate Restaurant Fixer"
    puts "=" * 70
    puts "Database: #{@db.opts[:database]}"
    puts "Mode: #{@dry_run ? 'DRY RUN (no changes will be made)' : 'EXECUTE (changes will be applied)'}"
    puts "=" * 70
    puts

    # Find TripAdvisor-only restaurants (potential duplicates)
    tripadvisor_only = find_tripadvisor_only_restaurants
    puts "Found #{tripadvisor_only.count} TripAdvisor-only restaurants to analyze"
    puts

    tripadvisor_only.each do |ta_restaurant|
      process_restaurant(ta_restaurant)
    end

    puts
    puts "=" * 70
    puts "Summary:"
    puts "  Merged: #{@merged_count}"
    puts "  Skipped (no match found): #{@skipped_count}"
    puts "=" * 70

    if @dry_run && @merged_count > 0
      puts
      puts "This was a dry run. To apply changes, run with --execute"
    end
  end

  private

  def register_similarity_function
    sqlite_db = @db.synchronize { |conn| conn }

    sqlite_db.create_function("similarity", 2) do |func, s1, s2|
      str1 = s1.to_s.downcase
      str2 = s2.to_s.downcase
      max_len = [str1.length, str2.length].max
      if max_len.zero?
        func.result = 1.0
      else
        distance = levenshtein_distance(str1, str2)
        func.result = 1.0 - (distance.to_f / max_len)
      end
    end
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

  # Find restaurants that ONLY have TripAdvisor external_id (no Yelp or Google)
  def find_tripadvisor_only_restaurants
    @db[:restaurants]
      .join(:external_ids, restaurant_id: :id)
      .where(source: "tripadvisor")
      .exclude(
        id: @db[:external_ids]
          .where(source: %w[yelp google])
          .select(:restaurant_id)
      )
      .select_all(:restaurants)
      .distinct
      .all
  end

  def process_restaurant(ta_restaurant)
    puts "-" * 50
    puts "Analyzing: #{ta_restaurant[:name]}"
    puts "  ID: #{ta_restaurant[:id]}"
    puts "  Address: #{ta_restaurant[:address]}"
    puts "  GPS: #{ta_restaurant[:latitude]}, #{ta_restaurant[:longitude]}" if ta_restaurant[:latitude]

    # Find potential matches (restaurants with Yelp or Google that might be the same)
    matches = find_potential_matches(ta_restaurant)

    if matches.empty?
      puts "  ❌ No matching restaurant found"
      @skipped_count += 1
      return
    end

    # Take the best match
    best_match = matches.first
    puts "  ✓ Found match: #{best_match[:name]} (ID: #{best_match[:id]})"
    puts "    Similarity: #{(best_match[:similarity] * 100).round(1)}%"
    puts "    Address: #{best_match[:address]}"
    puts "    Sources: #{get_sources(best_match[:id]).join(', ')}"

    if @verbose
      puts "    GPS: #{best_match[:latitude]}, #{best_match[:longitude]}"
      puts "    Phone: #{best_match[:phone]}"
    end

    merge_restaurants(ta_restaurant, best_match)
  end

  def find_potential_matches(ta_restaurant)
    # Find restaurants that have Yelp or Google external_ids
    # and have similar names
    query = @db[:restaurants]
      .join(:external_ids, restaurant_id: :id)
      .where(source: %w[yelp google])
      .exclude(Sequel[:restaurants][:id] => ta_restaurant[:id])
      .select_all(:restaurants)
      .select_append(
        Sequel.lit("similarity(?, restaurants.name)", ta_restaurant[:name]).as(:similarity)
      )
      .distinct

    # Filter by name similarity
    candidates = query.all.select { |r| r[:similarity] >= NAME_SIMILARITY_THRESHOLD }

    # If TripAdvisor restaurant has GPS, also filter by proximity
    if ta_restaurant[:latitude] && ta_restaurant[:longitude]
      candidates = candidates.select do |r|
        next false unless r[:latitude] && r[:longitude]

        lat_diff = (r[:latitude] - ta_restaurant[:latitude]).abs
        lng_diff = (r[:longitude] - ta_restaurant[:longitude]).abs
        lat_diff <= GPS_DISTANCE_THRESHOLD && lng_diff <= GPS_DISTANCE_THRESHOLD
      end
    end

    # Sort by similarity (best first)
    candidates.sort_by { |r| -r[:similarity] }
  end

  def get_sources(restaurant_id)
    @db[:external_ids]
      .where(restaurant_id: restaurant_id)
      .select_map(:source)
  end

  def merge_restaurants(duplicate, target)
    puts "  → Merging ID #{duplicate[:id]} into ID #{target[:id]}"

    if @dry_run
      puts "    [DRY RUN] Would move external_ids, ratings, reviews, media"
      puts "    [DRY RUN] Would delete restaurant ID #{duplicate[:id]}"
      @merged_count += 1
      return
    end

    @db.transaction do
      # Move external_ids from duplicate to target
      moved_external_ids = @db[:external_ids]
        .where(restaurant_id: duplicate[:id])
        .update(restaurant_id: target[:id])
      puts "    Moved #{moved_external_ids} external_id(s)"

      # Move ratings (only if target doesn't have rating from same source)
      existing_rating_sources = @db[:ratings]
        .where(restaurant_id: target[:id])
        .select_map(:source)

      moved_ratings = @db[:ratings]
        .where(restaurant_id: duplicate[:id])
        .exclude(source: existing_rating_sources)
        .update(restaurant_id: target[:id])
      puts "    Moved #{moved_ratings} rating(s)"

      # Delete duplicate ratings from same source (keep target's)
      deleted_duplicate_ratings = @db[:ratings]
        .where(restaurant_id: duplicate[:id])
        .delete
      puts "    Deleted #{deleted_duplicate_ratings} duplicate rating(s)" if deleted_duplicate_ratings > 0

      # Move reviews (avoid duplicates by checking URL)
      existing_review_urls = @db[:reviews]
        .where(restaurant_id: target[:id])
        .select_map(:url)

      moved_reviews = @db[:reviews]
        .where(restaurant_id: duplicate[:id])
        .exclude(url: existing_review_urls)
        .update(restaurant_id: target[:id])
      puts "    Moved #{moved_reviews} review(s)"

      # Delete duplicate reviews
      deleted_duplicate_reviews = @db[:reviews]
        .where(restaurant_id: duplicate[:id])
        .delete
      puts "    Deleted #{deleted_duplicate_reviews} duplicate review(s)" if deleted_duplicate_reviews > 0

      # Move media (avoid duplicates by checking URL)
      existing_media_urls = @db[:media]
        .where(restaurant_id: target[:id])
        .select_map(:url)

      moved_media = @db[:media]
        .where(restaurant_id: duplicate[:id])
        .exclude(url: existing_media_urls)
        .update(restaurant_id: target[:id])
      puts "    Moved #{moved_media} media item(s)"

      # Delete duplicate media
      deleted_duplicate_media = @db[:media]
        .where(restaurant_id: duplicate[:id])
        .delete
      puts "    Deleted #{deleted_duplicate_media} duplicate media item(s)" if deleted_duplicate_media > 0

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
      updates = {}
      updates[:latitude] = duplicate[:latitude] if duplicate[:latitude] && !target[:latitude]
      updates[:longitude] = duplicate[:longitude] if duplicate[:longitude] && !target[:longitude]
      updates[:phone] = duplicate[:phone] if duplicate[:phone] && !target[:phone]
      updates[:updated_at] = Time.now

      @db[:restaurants].where(id: target[:id]).update(updates) unless updates.empty?

      # Delete the duplicate restaurant
      @db[:restaurants].where(id: duplicate[:id]).delete
      puts "    ✓ Deleted duplicate restaurant ID #{duplicate[:id]}"

      @merged_count += 1
    end
  rescue Sequel::Error => e
    puts "    ❌ Error merging: #{e.message}"
    raise if @dry_run == false # Re-raise in execute mode
  end
end

# Parse command line arguments
def parse_args
  args = ARGV.dup
  options = {
    dry_run: true,
    verbose: false,
    db_path: nil
  }

  args.reject! do |arg|
    case arg
    when "--dry-run"
      options[:dry_run] = true
      true
    when "--execute"
      options[:dry_run] = false
      true
    when "--verbose", "-v"
      options[:verbose] = true
      true
    when "--help", "-h"
      puts "Usage: ruby scripts/fix_tripadvisor_duplicates.rb [database_path] [options]"
      puts
      puts "Options:"
      puts "  --dry-run     Show what would be merged without making changes (default)"
      puts "  --execute     Actually perform the merges"
      puts "  --verbose     Show detailed matching information"
      puts "  --help        Show this help message"
      exit 0
    else
      false
    end
  end

  options[:db_path] = args.first
  options
end

if __FILE__ == $PROGRAM_NAME
  options = parse_args

  unless options[:db_path]
    puts "Error: Database path required"
    puts "Usage: ruby scripts/fix_tripadvisor_duplicates.rb /path/to/database.db [--dry-run|--execute]"
    exit 1
  end

  unless File.exist?(options[:db_path])
    puts "Error: Database file not found: #{options[:db_path]}"
    exit 1
  end

  fixer = TripAdvisorDuplicateFixer.new(
    options[:db_path],
    dry_run: options[:dry_run],
    verbose: options[:verbose]
  )
  fixer.run
end
