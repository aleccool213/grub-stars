#!/usr/bin/env ruby
# frozen_string_literal: true

# Debug script to trace review fetching and indexing
# Run: ruby -I lib scripts/debug-reviews.rb

require "grub_stars"
require "json"
require "fileutils"

# Use mock server
ENV["YELP_API_KEY"] = "mock_api_key"
ENV["YELP_API_BASE_URL"] = "http://localhost:4567"
ENV["GOOGLE_API_KEY"] = "mock_api_key"
ENV["GOOGLE_API_BASE_URL"] = "http://localhost:4567"

# Use a test database
test_db_path = "/tmp/grub_stars_debug.db"
FileUtils.rm_f(test_db_path)
ENV["GRUB_STARS_DB_PATH"] = test_db_path

puts "=" * 60
puts "Debug Review Fetching & Indexing"
puts "=" * 60
puts ""
puts "Using database: #{test_db_path}"
puts ""

# Reset database connection
GrubStars.reset_db!

# Create Yelp adapter
yelp = GrubStars::Adapters::Yelp.new

puts "1. Testing Yelp adapter directly..."
puts "   Base URL: #{yelp.instance_variable_get(:@base_url)}"
puts ""

# Search for businesses
puts "2. Searching for businesses in Barrie (limit 2)..."
begin
  businesses = yelp.search_businesses(location: "barrie, ontario", limit: 2)
  puts "   Found #{businesses.length} businesses"

  businesses.each do |biz|
    puts ""
    puts "   Business: #{biz[:name]}"
    puts "     external_id: #{biz[:external_id]}"

    # Extract the raw ID (without prefix)
    raw_id = biz[:external_id].sub(/^yelp:/, "")
    puts "     raw_id for reviews: #{raw_id}"

    # Try to fetch reviews
    puts "     Fetching reviews..."
    begin
      reviews = yelp.get_reviews(raw_id)
      puts "     Reviews fetched: #{reviews.length}"
      if reviews.any?
        puts "     First review text: #{reviews.first[:text][0..60]}..."
      end
    rescue => e
      puts "     ERROR fetching reviews: #{e.message}"
    end
  end
rescue => e
  puts "   ERROR: #{e.message}"
  puts "   Make sure mock server is running on port 4567"
  exit 1
end

puts ""
puts "3. Running full indexing service..."

service = Services::IndexRestaurantsService.new(adapters: [yelp])
stats = service.index(location: "barrie, ontario")

puts "   Index stats:"
puts "     Total: #{stats[:total]}"
puts "     Created: #{stats[:created]}"
puts "     Updated: #{stats[:updated]}"
puts "     Merged: #{stats[:merged]}"

puts ""
puts "4. Checking database..."

db = GrubStars.db

restaurant_count = db[:restaurants].count
review_count = db[:reviews].count

puts "   Restaurants: #{restaurant_count}"
puts "   Reviews: #{review_count}"

puts ""
puts "5. Sample restaurant data:"

db[:restaurants].limit(3).each do |r|
  puts ""
  puts "   #{r[:name]} (ID: #{r[:id]})"
  puts "     Description: #{r[:description] ? r[:description][0..60] + '...' : 'NULL'}"

  reviews = db[:reviews].where(restaurant_id: r[:id]).all
  puts "     Reviews stored: #{reviews.length}"
  if reviews.any?
    puts "     First review snippet: #{reviews.first[:snippet][0..50]}..."
  end
end

puts ""
puts "=" * 60
puts "Done"
puts "=" * 60
