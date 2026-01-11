# frozen_string_literal: true

require "faraday"
require "json"
require_relative "base"

module GrubStars
  module Adapters
    class TripAdvisor < Base
      DEFAULT_BASE_URL = "https://api.content.tripadvisor.com/api/v1"

      def initialize(api_key: nil, base_url: nil)
        @api_key = api_key || ENV["TRIPADVISOR_API_KEY"]
        @base_url = base_url || ENV["TRIPADVISOR_API_BASE_URL"] || DEFAULT_BASE_URL
      end

      def source_name
        "tripadvisor"
      end

      def configured?
        !@api_key.nil? && !@api_key.empty?
      end

      # Search for businesses by location
      # Returns array of business hashes with normalized fields
      def search_businesses(location:, categories: nil, limit: 10, offset: 0)
        ensure_configured!

        query = build_search_query(location, categories)
        params = {
          searchQuery: query,
          key: @api_key,
          language: "en"
        }

        response = connection.get("location/search", params)
        handle_response(response)

        data = JSON.parse(response.body)
        locations = data["data"] || []

        # Apply offset and limit (TripAdvisor returns up to 10 results)
        locations = locations.drop(offset).take(limit)
        locations.map { |loc| normalize_location(loc) }
      end

      # Search for businesses by name
      # Returns array of business hashes with normalized fields
      def search_by_name(name:, location: nil, limit: 10)
        ensure_configured!

        query = location ? "#{name} in #{location}" : name
        params = {
          searchQuery: query,
          key: @api_key,
          language: "en"
        }

        response = connection.get("location/search", params)
        handle_response(response)

        data = JSON.parse(response.body)
        locations = data["data"] || []

        # Apply limit
        locations = locations.take(limit)
        locations.map { |loc| normalize_location(loc) }
      end

      # Get detailed business information
      # Returns normalized business hash with additional details
      def get_business(id)
        ensure_configured!

        # Extract location_id from external_id format "tripadvisor:123456"
        location_id = id.to_s.sub(/^tripadvisor:/, "")

        params = {
          key: @api_key,
          language: "en"
        }

        response = connection.get("location/#{location_id}", params)
        handle_response(response)

        data = JSON.parse(response.body)
        normalize_location_details(data)
      end

      # Get reviews for a business (returns up to 5 reviews)
      # Returns array of normalized review hashes
      def get_reviews(id)
        ensure_configured!

        # Extract location_id from external_id format "tripadvisor:123456"
        location_id = id.to_s.sub(/^tripadvisor:/, "")

        params = {
          key: @api_key,
          language: "en"
        }

        response = connection.get("location/#{location_id}/reviews", params)
        handle_response(response)

        data = JSON.parse(response.body)
        reviews = data["data"] || []
        reviews.map { |review| normalize_review(review) }
      end

      # Paginate through all businesses in a location
      # Yields businesses array and progress hash { current:, total:, percent: }
      def search_all_businesses(location:, categories: nil, &block)
        ensure_configured!

        query = build_search_query(location, categories)
        params = {
          searchQuery: query,
          key: @api_key,
          language: "en"
        }

        response = connection.get("location/search", params)
        handle_response(response)

        data = JSON.parse(response.body)
        locations = data["data"] || []

        total = locations.length
        locations.each_with_index do |loc, index|
          normalized = normalize_location(loc)
          progress = {
            current: index + 1,
            total: total,
            percent: (((index + 1).to_f / total) * 100).round(1)
          }
          yield normalized, progress if block_given?
        end

        total
      end

      # Get photos for a business (returns up to 5 photos)
      # Returns array of photo URLs
      def get_photos(id)
        ensure_configured!

        # Extract location_id from external_id format "tripadvisor:123456"
        location_id = id.to_s.sub(/^tripadvisor:/, "")

        params = {
          key: @api_key,
          language: "en"
        }

        response = connection.get("location/#{location_id}/photos", params)
        handle_response(response)

        data = JSON.parse(response.body)
        photos = data["data"] || []
        extract_photo_urls(photos)
      rescue APIError => e
        # If photos endpoint fails, return empty array
        []
      end

      private

      def connection
        @connection ||= Faraday.new(url: @base_url) do |conn|
          conn.headers["Accept"] = "application/json"
          conn.adapter Faraday.default_adapter
        end
      end

      def ensure_configured!
        raise ConfigurationError, "TripAdvisor API key not configured. Set TRIPADVISOR_API_KEY environment variable." unless configured?
      end

      def handle_response(response)
        return if response.success?

        body = begin
          JSON.parse(response.body)
        rescue JSON::ParserError
          response.body
        end

        message = body.is_a?(Hash) ? body["message"] || body["error"] || body.to_s : body.to_s
        raise APIError.new("TripAdvisor API error: #{message}", status: response.status, body: body)
      end

      def build_search_query(location, categories = nil)
        if categories
          "#{categories} in #{location}"
        else
          "restaurants in #{location}"
        end
      end

      # Normalize TripAdvisor location data from search to common format
      def normalize_location(data)
        return nil unless data

        {
          external_id: "tripadvisor:#{data["location_id"]}",
          name: data["name"],
          address: format_address(data["address_obj"]),
          latitude: data.dig("address_obj", "latitude")&.to_f,
          longitude: data.dig("address_obj", "longitude")&.to_f,
          rating: data["rating"]&.to_f,
          review_count: data["num_reviews"]&.to_i,
          categories: [],  # Categories not available in search results
          photos: [],  # Photos require separate API call
          url: data["web_url"],
          is_closed: nil  # Not available in basic data
        }
      end

      # Normalize TripAdvisor location details to common format
      def normalize_location_details(data)
        return nil unless data

        {
          external_id: "tripadvisor:#{data["location_id"]}",
          name: data["name"],
          phone: data["phone"],
          address: format_address(data["address_obj"]),
          latitude: data.dig("address_obj", "latitude")&.to_f,
          longitude: data.dig("address_obj", "longitude")&.to_f,
          rating: data["rating"]&.to_f,
          review_count: data["num_reviews"]&.to_i,
          categories: extract_categories(data),
          photos: [],  # Photos require separate API call via get_photos
          url: data["web_url"],
          is_closed: data["is_closed"]
        }
      end

      def normalize_review(data)
        {
          id: data["id"],
          rating: data["rating"]&.to_i,
          text: data["text"],
          url: data["url"],
          time_created: data["published_date"],
          user_name: data.dig("user", "username")
        }
      end

      def format_address(address_obj)
        return nil unless address_obj

        parts = [
          address_obj["street1"],
          address_obj["street2"],
          address_obj["city"],
          address_obj["state"],
          address_obj["postalcode"],
          address_obj["country"]
        ].compact.reject(&:empty?)

        parts.join(", ")
      end

      def extract_categories(data)
        categories = []

        # Add category if available
        categories << data["category"]["name"] if data.dig("category", "name")

        # Add subcategory if available
        data["subcategory"]&.each do |subcat|
          categories << subcat["name"] if subcat["name"]
        end

        categories.compact.uniq
      end

      def extract_photo_urls(photos)
        photos.map do |photo|
          # Use the large size (max 550px) as a good balance
          photo.dig("images", "large", "url") ||
          photo.dig("images", "medium", "url") ||
          photo.dig("images", "original", "url")
        end.compact
      end
    end
  end
end
