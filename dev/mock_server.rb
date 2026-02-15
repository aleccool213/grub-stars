#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8

Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

# Mock API Server for local development and testing
# Supports Yelp, Google Places, and TripAdvisor APIs
#
# Usage:
#   bundle exec ruby dev/mock_server.rb
#
# Then set in your .env:
#   YELP_API_KEY=mock_api_key
#   YELP_API_BASE_URL=http://localhost:4567
#   GOOGLE_API_KEY=mock_api_key
#   GOOGLE_API_BASE_URL=http://localhost:4567
#   TRIPADVISOR_API_KEY=mock_api_key
#   TRIPADVISOR_API_BASE_URL=http://localhost:4567/api/v1

require "sinatra"
require "json"

# Configurable delay for testing progress UI
# Set MOCK_DELAY_MS environment variable to override (in milliseconds)
# Example: MOCK_DELAY_MS=0 ruby dev/mock_server.rb  # disable delays
MOCK_DELAY_MS = (ENV["MOCK_DELAY_MS"] || 500).to_i
MOCK_DELAY_PER_ITEM_MS = (ENV["MOCK_DELAY_PER_ITEM_MS"] || 200).to_i

def simulate_delay(per_item: false)
  delay_ms = per_item ? MOCK_DELAY_PER_ITEM_MS : MOCK_DELAY_MS
  sleep(delay_ms / 1000.0) if delay_ms > 0
end

# Load fixture data
FIXTURES_DIR = File.expand_path("fixtures", __dir__)

def load_fixture(name)
  path = File.join(FIXTURES_DIR, "#{name}.json")
  JSON.parse(File.read(path, encoding: "UTF-8"))
end

# Yelp fixtures
YELP_BUSINESSES = load_fixture("yelp_businesses")
YELP_REVIEWS = load_fixture("yelp_reviews")

# Google fixtures
GOOGLE_BUSINESSES = load_fixture("google_businesses")
GOOGLE_DETAILS = load_fixture("google_details")
GOOGLE_REVIEWS = load_fixture("google_reviews")

# TripAdvisor fixtures
TRIPADVISOR_LOCATIONS = load_fixture("tripadvisor_locations")
TRIPADVISOR_DETAILS = load_fixture("tripadvisor_details")
TRIPADVISOR_REVIEWS = load_fixture("tripadvisor_reviews")
TRIPADVISOR_PHOTOS = load_fixture("tripadvisor_photos")

# Build lookup hashes
YELP_BUSINESS_BY_ID = YELP_BUSINESSES["businesses"].each_with_object({}) do |biz, hash|
  hash[biz["id"]] = biz
end

GOOGLE_PLACE_BY_ID = GOOGLE_BUSINESSES["results"].each_with_object({}) do |place, hash|
  hash[place["place_id"]] = place
end

# ============================================
# Yelp API Endpoints
# ============================================

# Middleware to check Yelp authorization
before "/businesses/*" do
  content_type :json

  auth = request.env["HTTP_AUTHORIZATION"]
  unless auth&.start_with?("Bearer ")
    halt 401, { error: { code: "UNAUTHORIZED", description: "Missing or invalid API key" } }.to_json
  end
end

# GET /businesses/search - Search for businesses (Yelp)
get "/businesses/search" do
  # Add artificial delay for testing progress UI
  simulate_delay

  location = params["location"]
  categories = params["categories"]
  limit = (params["limit"] || 50).to_i
  offset = (params["offset"] || 0).to_i

  unless location
    halt 400, { error: { code: "VALIDATION_ERROR", description: "location is required" } }.to_json
  end

  businesses = YELP_BUSINESSES["businesses"]

  # Filter by location (city name in query)
  location_lower = location.downcase
  businesses = businesses.select do |biz|
    city = biz.dig("location", "city")&.downcase || ""
    state = biz.dig("location", "state")&.downcase || ""
    # Match if location contains city name or state abbreviation
    location_lower.include?(city) || location_lower.include?(state)
  end

  # Filter by categories if provided
  if categories
    category_list = categories.split(",")
    businesses = businesses.select do |biz|
      biz_categories = biz["categories"].map { |c| c["alias"] }
      (biz_categories & category_list).any?
    end
  end

  total = businesses.length
  paginated = businesses.slice(offset, limit) || []

  {
    total: total,
    businesses: paginated,
    region: YELP_BUSINESSES["region"]
  }.to_json
end

# GET /businesses/:id - Get business details (Yelp)
get "/businesses/:id" do
  # Add per-item delay for testing progress UI
  simulate_delay(per_item: true)

  id = params["id"]
  business = YELP_BUSINESS_BY_ID[id]

  unless business
    halt 404, { error: { code: "BUSINESS_NOT_FOUND", description: "Business #{id} not found" } }.to_json
  end

  business.to_json
end

# GET /businesses/:id/reviews - Get business reviews (Yelp)
get "/businesses/:id/reviews" do
  id = params["id"]

  unless YELP_BUSINESS_BY_ID[id]
    halt 404, { error: { code: "BUSINESS_NOT_FOUND", description: "Business #{id} not found" } }.to_json
  end

  reviews = YELP_REVIEWS[id] || { "reviews" => [], "total" => 0, "possible_languages" => ["en"] }
  reviews.to_json
end

# ============================================
# Google Places API Endpoints
# ============================================

# GET /textsearch/json - Text search for places (Google)
get "/textsearch/json" do
  content_type :json
  # Add artificial delay for testing progress UI
  simulate_delay

  query = params["query"]
  key = params["key"]

  unless key
    halt 400, { status: "REQUEST_DENIED", error_message: "API key is required" }.to_json
  end

  unless query
    halt 400, { status: "INVALID_REQUEST", error_message: "query is required" }.to_json
  end

  # Return all businesses for any query containing a location
  results = GOOGLE_BUSINESSES["results"]
  query_lower = query.downcase

  # Filter by location (extract city names from formatted_address)
  # Support common city names: Barrie, Toronto, Vancouver, Honolulu, Haleiwa, Kailua
  city_filter = nil
  ["barrie", "toronto", "vancouver", "honolulu", "haleiwa", "kailua", "oahu", "hawaii"].each do |city|
    if query_lower.include?(city)
      city_filter = city
      break
    end
  end

  if city_filter
    results = results.select do |r|
      address = r["formatted_address"]&.downcase || ""
      address.include?(city_filter)
    end
  end

  # Filter by category keywords in query if present
  if query_lower.include?("bakery") || query_lower.include?("bakeries")
    results = results.select { |r| r["types"].include?("bakery") }
  elsif query_lower.include?("sushi") || query_lower.include?("japanese")
    results = results.select { |r| r["types"].any? { |t| t.include?("sushi") || t.include?("japanese") } }
  elsif query_lower.include?("coffee") || query_lower.include?("cafe")
    results = results.select { |r| r["types"].any? { |t| t.include?("cafe") || t.include?("coffee") } }
  elsif query_lower.include?("italian")
    results = results.select { |r| r["types"].any? { |t| t.include?("italian") } }
  elsif query_lower.include?("vietnamese") || query_lower.include?("pho")
    results = results.select { |r| r["types"].any? { |t| t.include?("vietnamese") } }
  elsif query_lower.include?("brewery") || query_lower.include?("beer")
    results = results.select { |r| r["types"].include?("brewery") }
  end

  {
    status: "OK",
    results: results
  }.to_json
end

# GET /details/json - Get place details (Google)
get "/details/json" do
  content_type :json
  # Add per-item delay for testing progress UI
  simulate_delay(per_item: true)

  place_id = params["placeid"]
  key = params["key"]
  fields = params["fields"]

  unless key
    halt 400, { status: "REQUEST_DENIED", error_message: "API key is required" }.to_json
  end

  unless place_id
    halt 400, { status: "INVALID_REQUEST", error_message: "placeid is required" }.to_json
  end

  # Check if requesting reviews specifically
  if fields&.include?("reviews")
    review_data = GOOGLE_REVIEWS[place_id]
    if review_data
      return review_data.to_json
    else
      return { status: "OK", result: { reviews: [] } }.to_json
    end
  end

  # Return place details
  details = GOOGLE_DETAILS[place_id]
  unless details
    halt 404, { status: "NOT_FOUND", error_message: "Place #{place_id} not found" }.to_json
  end

  details.to_json
end

# GET /photo - Get place photo (Google) - returns redirect
get "/photo" do
  photo_reference = params["photoreference"]
  key = params["key"]

  unless key
    halt 400, { status: "REQUEST_DENIED", error_message: "API key is required" }.to_json
  end

  unless photo_reference
    halt 400, { status: "INVALID_REQUEST", error_message: "photoreference is required" }.to_json
  end

  # Return a mock photo URL redirect using placehold.co for placeholder images
  colors = %w[f0e68c ffa07a 98fb98 87ceeb dda0dd f5deb3 ffc0cb e0ffff]
  color = colors[photo_reference.hash.abs % colors.length]
  redirect "https://placehold.co/400x400/#{color}/333333?text=Photo", 302
end

# ============================================
# TripAdvisor API Endpoints
# ============================================

# GET /api/v1/location/search - Search for locations (TripAdvisor)
get "/api/v1/location/search" do
  content_type :json
  # Add artificial delay for testing progress UI
  simulate_delay

  search_query = params["searchQuery"]
  key = params["key"]
  language = params["language"]

  unless key
    halt 401, { message: "API key is required" }.to_json
  end

  unless search_query
    halt 400, { message: "searchQuery is required" }.to_json
  end

  # Return all locations for now (could filter by query)
  locations = TRIPADVISOR_LOCATIONS["data"]
  query_lower = search_query.downcase

  # Filter by location (city name in query)
  city_filter = nil
  ["barrie", "toronto", "vancouver", "honolulu", "haleiwa", "kailua", "oahu", "hawaii"].each do |city|
    if query_lower.include?(city)
      city_filter = city
      break
    end
  end

  if city_filter
    locations = locations.select do |loc|
      city = loc.dig("address_obj", "city")&.downcase || ""
      city.include?(city_filter)
    end
  end

  # Simple filtering by category query
  if query_lower.include?("bakery") || query_lower.include?("bakeries")
    locations = locations.select do |loc|
      loc.dig("subcategory")&.any? { |sc| sc["name"]&.downcase&.include?("bakery") } ||
      loc["name"]&.downcase&.include?("bakery")
    end
  elsif query_lower.include?("brewery") || query_lower.include?("beer")
    locations = locations.select do |loc|
      loc.dig("subcategory")&.any? { |sc| sc["name"]&.downcase&.include?("brewery") } ||
      loc["name"]&.downcase&.include?("brewery")
    end
  elsif query_lower.include?("sushi") || query_lower.include?("japanese")
    locations = locations.select do |loc|
      loc.dig("subcategory")&.any? { |sc| sc["name"]&.downcase&.include?("japanese") || sc["name"]&.downcase&.include?("sushi") } ||
      loc["name"]&.downcase&.include?("sushi")
    end
  elsif query_lower.include?("coffee") || query_lower.include?("cafe")
    locations = locations.select do |loc|
      loc.dig("subcategory")&.any? { |sc| sc["name"]&.downcase&.include?("cafe") || sc["name"]&.downcase&.include?("coffee") } ||
      loc["name"]&.downcase&.include?("coffee")
    end
  elsif query_lower.include?("italian")
    locations = locations.select do |loc|
      loc.dig("subcategory")&.any? { |sc| sc["name"]&.downcase&.include?("italian") } ||
      loc["name"]&.downcase&.include?("italian")
    end
  elsif query_lower.include?("vietnamese") || query_lower.include?("pho")
    locations = locations.select do |loc|
      loc.dig("subcategory")&.any? { |sc| sc["name"]&.downcase&.include?("vietnamese") } ||
      loc["name"]&.downcase&.include?("pho")
    end
  end

  { data: locations }.to_json
end

# GET /api/v1/location/:id - Get location details (TripAdvisor)
get "/api/v1/location/:id" do
  content_type :json
  # Add per-item delay for testing progress UI
  simulate_delay(per_item: true)

  location_id = params["id"]
  key = params["key"]

  unless key
    halt 401, { message: "API key is required" }.to_json
  end

  details = TRIPADVISOR_DETAILS[location_id]
  unless details
    halt 404, { message: "Location #{location_id} not found" }.to_json
  end

  details.to_json
end

# GET /api/v1/location/:id/reviews - Get location reviews (TripAdvisor)
get "/api/v1/location/:id/reviews" do
  content_type :json

  location_id = params["id"]
  key = params["key"]

  unless key
    halt 401, { message: "API key is required" }.to_json
  end

  reviews = TRIPADVISOR_REVIEWS[location_id]
  unless reviews
    # Return empty reviews if location doesn't have any
    return { data: [] }.to_json
  end

  reviews.to_json
end

# GET /api/v1/location/:id/photos - Get location photos (TripAdvisor)
get "/api/v1/location/:id/photos" do
  content_type :json

  location_id = params["id"]
  key = params["key"]

  unless key
    halt 401, { message: "API key is required" }.to_json
  end

  photos = TRIPADVISOR_PHOTOS[location_id]
  unless photos
    # Return empty photos if location doesn't have any
    return { data: [] }.to_json
  end

  photos.to_json
end

# ============================================
# Instagram Graph API Endpoints (Mock)
# ============================================

# Load Instagram fixtures
INSTAGRAM_HASHTAG_SEARCH = load_fixture("instagram/hashtag_search")
INSTAGRAM_HASHTAG_MEDIA = load_fixture("instagram/hashtag_recent_media")
INSTAGRAM_BUSINESS_DISCOVERY = load_fixture("instagram/business_discovery")

# Build a mapping of restaurant names (lowercased, stripped) to mock hashtag IDs
# so that any restaurant indexed from Yelp/Google/TripAdvisor gets Instagram photos
INSTAGRAM_MOCK_HASHTAG_COUNTER = { value: 17_841_563_456_789_012 }

def mock_instagram_photos_for_restaurant(name)
  # Generate 2-4 mock Instagram photos for any restaurant
  clean_name = name.downcase.gsub(/[^a-z0-9 ]/, "").strip
  hashtag = clean_name.gsub(/\s+/, "")
  photo_count = 2 + (name.hash.abs % 3)  # 2-4 photos

  (1..photo_count).map do |i|
    colors = %w[ff6b6b 4ecdc4 45b7d1 96ceb4 ffeaa7 dfe6e9 fd79a8 a29bfe]
    color = colors[(name.hash.abs + i) % colors.length]
    {
      "id" => "#{18_000_000_000_000_000 + name.hash.abs + i}",
      "caption" => ["Amazing food at #{name}! ##{hashtag}", "Date night at #{name} #foodie", "Best dish in town ##{hashtag} #food", "Highly recommend #{name}!"][i % 4],
      "media_type" => "IMAGE",
      "media_url" => "https://placehold.co/400x400/#{color}/ffffff?text=IG+#{i}",
      "permalink" => "https://www.instagram.com/p/MOCK#{name.hash.abs.to_s(36)[0, 6]}#{i}/",
      "timestamp" => "2026-01-#{format('%02d', [i * 5, 28].min)}T18:30:00+0000",
      "username" => ["foodie_local", "eats_and_treats", "hungry_explorer", "tasty_adventures"][i % 4]
    }
  end
end

# GET /ig_hashtag_search - Search for hashtag ID (Instagram Graph API)
get "/ig_hashtag_search" do
  content_type :json

  hashtag = params["q"]
  user_id = params["user_id"]
  access_token = params["access_token"]

  unless access_token
    halt 400, { error: { message: "An access token is required", type: "OAuthException", code: 190 } }.to_json
  end

  unless hashtag && !hashtag.empty?
    halt 400, { error: { message: "A hashtag query is required", type: "OAuthException", code: 100 } }.to_json
  end

  # Return a deterministic hashtag ID based on the hashtag string
  hashtag_id = (17_841_563_456_789_012 + hashtag.hash.abs % 1_000_000).to_s

  { data: [{ id: hashtag_id }] }.to_json
end

# GET /:hashtag_id/recent_media - Get recent media for a hashtag (Instagram Graph API)
# Match numeric IDs that look like Instagram hashtag IDs (17+ digits)
get %r{/(\d{17,})/recent_media} do |hashtag_id|
  content_type :json

  user_id = params["user_id"]
  access_token = params["access_token"]
  limit = (params["limit"] || 20).to_i

  unless access_token
    halt 400, { error: { message: "An access token is required", type: "OAuthException", code: 190 } }.to_json
  end

  # Look up which restaurant name this hashtag corresponds to
  # We use the fixture data as a fallback, but for any indexed restaurant
  # we generate mock photos dynamically
  # For the mock, just return the fixture data (which has varied media types)
  fixture_data = INSTAGRAM_HASHTAG_MEDIA["data"] || []
  { data: fixture_data.take(limit) }.to_json
end

# GET /:user_id?fields=business_discovery... - Business Discovery (Instagram Graph API)
# This endpoint is called with the app's own user_id and a target username.
# Must be defined AFTER the /recent_media route so that route matches first.
get %r{/(\d{17,})} do |user_id|
  content_type :json

  access_token = params["access_token"]
  username = params["username"]
  fields = params["fields"]

  unless access_token
    halt 400, { error: { message: "An access token is required", type: "OAuthException", code: 190 } }.to_json
  end

  # Only handle business_discovery requests
  if fields&.include?("business_discovery")
    unless username
      halt 400, { error: { message: "A username is required for business discovery", type: "OAuthException", code: 100 } }.to_json
    end

    # Return fixture data
    INSTAGRAM_BUSINESS_DISCOVERY.to_json
  else
    halt 400, { error: { message: "Unsupported fields parameter", type: "OAuthException", code: 100 } }.to_json
  end
end

# ============================================
# Startup Message
# ============================================

puts ""
puts "=" * 70
puts "  Mock API Server (Yelp + Google Places + TripAdvisor + Instagram)"
puts "=" * 70
puts ""
if MOCK_DELAY_MS > 0 || MOCK_DELAY_PER_ITEM_MS > 0
  puts "  ⏱️  Delay Configuration (for testing progress UI):"
  puts "    - Search delay: #{MOCK_DELAY_MS}ms" if MOCK_DELAY_MS > 0
  puts "    - Per-item delay: #{MOCK_DELAY_PER_ITEM_MS}ms" if MOCK_DELAY_PER_ITEM_MS > 0
  puts ""
end
puts "  Yelp Data:"
puts "    - #{YELP_BUSINESSES['businesses'].length} businesses"
puts "    - #{YELP_REVIEWS.keys.length} businesses with reviews"
puts ""
puts "  Google Data:"
puts "    - #{GOOGLE_BUSINESSES['results'].length} places"
puts "    - #{GOOGLE_REVIEWS.keys.length} places with reviews"
puts ""
puts "  TripAdvisor Data:"
puts "    - #{TRIPADVISOR_LOCATIONS['data'].length} locations"
puts "    - #{TRIPADVISOR_REVIEWS.keys.length} locations with reviews"
puts "    - #{TRIPADVISOR_PHOTOS.keys.length} locations with photos"
puts ""
puts "  Yelp Endpoints:"
puts "    GET /businesses/search?location=..."
puts "    GET /businesses/:id"
puts "    GET /businesses/:id/reviews"
puts ""
puts "  Google Endpoints:"
puts "    GET /textsearch/json?query=...&key=..."
puts "    GET /details/json?placeid=...&key=..."
puts "    GET /photo?photoreference=...&key=..."
puts ""
puts "  TripAdvisor Endpoints:"
puts "    GET /api/v1/location/search?searchQuery=...&key=..."
puts "    GET /api/v1/location/:id?key=..."
puts "    GET /api/v1/location/:id/reviews?key=..."
puts "    GET /api/v1/location/:id/photos?key=..."
puts ""
puts "  Instagram Data:"
puts "    - Mock hashtag search + recent media"
puts "    - Mock business discovery"
puts ""
puts "  Instagram Endpoints:"
puts "    GET /ig_hashtag_search?q=...&user_id=...&access_token=..."
puts "    GET /:hashtag_id/recent_media?user_id=...&access_token=..."
puts "    GET /:user_id?fields=business_discovery...&username=...&access_token=..."
puts ""
puts "  Configure your .env:"
puts "    YELP_API_KEY=mock_api_key"
puts "    YELP_API_BASE_URL=http://localhost:4567"
puts "    GOOGLE_API_KEY=mock_api_key"
puts "    GOOGLE_API_BASE_URL=http://localhost:4567"
puts "    TRIPADVISOR_API_KEY=mock_api_key"
puts "    TRIPADVISOR_API_BASE_URL=http://localhost:4567/api/v1"
puts "    INSTAGRAM_ACCESS_TOKEN=mock_access_token"
puts "    INSTAGRAM_USER_ID=17841400987654321"
puts "    INSTAGRAM_API_BASE_URL=http://localhost:4567"
puts ""
puts "  Delays (enabled by default for testing progress UI):"
puts "    MOCK_DELAY_MS=0 ruby dev/mock_server.rb         # disable search delay"
puts "    MOCK_DELAY_PER_ITEM_MS=0 ruby dev/mock_server.rb    # disable per-item delay"
puts ""
puts "=" * 70
puts ""
