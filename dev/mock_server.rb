#!/usr/bin/env ruby
# frozen_string_literal: true

# Mock API Server for local development and testing
# Supports both Yelp and Google Places APIs
#
# Usage:
#   bundle exec ruby dev/mock_server.rb
#
# Then set in your .env:
#   YELP_API_KEY=mock_api_key
#   YELP_API_BASE_URL=http://localhost:4567
#   GOOGLE_API_KEY=mock_api_key
#   GOOGLE_API_BASE_URL=http://localhost:4567

require "sinatra"
require "json"

# Load fixture data
FIXTURES_DIR = File.expand_path("fixtures", __dir__)

def load_fixture(name)
  path = File.join(FIXTURES_DIR, "#{name}.json")
  JSON.parse(File.read(path))
end

# Yelp fixtures
YELP_BUSINESSES = load_fixture("yelp_businesses")
YELP_REVIEWS = load_fixture("yelp_reviews")

# Google fixtures
GOOGLE_BUSINESSES = load_fixture("google_businesses")
GOOGLE_DETAILS = load_fixture("google_details")
GOOGLE_REVIEWS = load_fixture("google_reviews")

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
  location = params["location"]
  categories = params["categories"]
  limit = (params["limit"] || 50).to_i
  offset = (params["offset"] || 0).to_i

  unless location
    halt 400, { error: { code: "VALIDATION_ERROR", description: "location is required" } }.to_json
  end

  businesses = YELP_BUSINESSES["businesses"]

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

  # Filter by category keywords in query if present
  query_lower = query.downcase
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

  # Return a mock photo URL redirect
  redirect "https://example.com/photos/#{photo_reference}.jpg", 302
end

# ============================================
# Startup Message
# ============================================

puts ""
puts "=" * 60
puts "  Mock API Server (Yelp + Google Places)"
puts "=" * 60
puts ""
puts "  Yelp Data:"
puts "    - #{YELP_BUSINESSES['businesses'].length} businesses"
puts "    - #{YELP_REVIEWS.keys.length} businesses with reviews"
puts ""
puts "  Google Data:"
puts "    - #{GOOGLE_BUSINESSES['results'].length} places"
puts "    - #{GOOGLE_REVIEWS.keys.length} places with reviews"
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
puts "  Configure your .env:"
puts "    YELP_API_KEY=mock_api_key"
puts "    YELP_API_BASE_URL=http://localhost:4567"
puts "    GOOGLE_API_KEY=mock_api_key"
puts "    GOOGLE_API_BASE_URL=http://localhost:4567"
puts ""
puts "=" * 60
puts ""
