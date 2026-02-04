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
require_relative "../lib/grub_stars"

class TripAdvisorDuplicateFixerCLI
  def initialize(db_path, dry_run: true, verbose: false)
    @db_path = db_path
    @dry_run = dry_run
    @verbose = verbose
  end

  def run
    print_header

    db = connect_database
    service = Services::MergeDuplicatesService.new(db: db)

    # Find duplicates first for reporting
    duplicates = service.find_tripadvisor_only_restaurants
    puts "Found #{duplicates.count} TripAdvisor-only restaurants to analyze"
    puts

    # Run the merge operation
    result = service.merge_tripadvisor_duplicates(dry_run: @dry_run)

    # Print details for each restaurant
    result.details.each do |detail|
      print_detail(detail, service)
    end

    print_summary(result)

    db.disconnect
  end

  private

  def print_header
    puts "=" * 70
    puts "TripAdvisor Duplicate Restaurant Fixer"
    puts "=" * 70
    puts "Database: #{@db_path}"
    puts "Mode: #{@dry_run ? 'DRY RUN (no changes will be made)' : 'EXECUTE (changes will be applied)'}"
    puts "=" * 70
    puts
  end

  def connect_database
    unless File.exist?(@db_path)
      puts "Error: Database file not found: #{@db_path}"
      exit 1
    end

    db = Sequel.sqlite(@db_path)
    GrubStars::Database.create_schema(db)
    db
  end

  def print_detail(detail, service)
    puts "-" * 50
    puts "Analyzing: #{detail.duplicate_name}"
    puts "  ID: #{detail.duplicate_id}"

    if detail.target_id
      puts "  ✓ Found match: #{detail.target_name} (ID: #{detail.target_id})"
      puts "    Similarity: #{(detail.similarity * 100).round(1)}%"
      sources = service.get_sources(detail.target_id)
      puts "    Sources: #{sources.join(', ')}"

      if detail.merged
        puts "  → Merged successfully"
      elsif @dry_run
        puts "  → Would merge (dry run)"
      else
        puts "  ✗ Merge failed: #{detail.reason}"
      end
    else
      puts "  ❌ #{detail.reason}"
    end
  end

  def print_summary(result)
    puts
    puts "=" * 70
    puts "Summary:"
    puts "  Merged: #{result.merged_count}"
    puts "  Skipped (no match found): #{result.skipped_count}"
    puts "=" * 70

    if @dry_run && result.merged_count > 0
      puts
      puts "This was a dry run. To apply changes, run with --execute"
    end
  end
end

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

  cli = TripAdvisorDuplicateFixerCLI.new(
    options[:db_path],
    dry_run: options[:dry_run],
    verbose: options[:verbose]
  )
  cli.run
end
