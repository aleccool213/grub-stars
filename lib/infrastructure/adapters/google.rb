# frozen_string_literal: true

require "faraday"
require "json"
require_relative "base"

module GrubStars
  module Adapters
    class Google < Base
      DEFAULT_BASE_URL = "https://maps.googleapis.com/maps/api/place"

      # Free tier limit: 10000 requests
      REQUEST_LIMIT = 10_000

      def initialize(api_key: nil, base_url: nil, api_request_repository: nil)
        super(api_request_repository: api_request_repository)
        @api_key = api_key || ENV["GOOGLE_API_KEY"]
        @base_url = base_url || ENV["GOOGLE_API_BASE_URL"] || DEFAULT_BASE_URL
      end

      def source_name
        "google"
      end

      def configured?
        !@api_key.nil? && !@api_key.empty?
      end

      # Search for businesses by location using text query
      # Returns array of business hashes with normalized fields
      def search_businesses(location:, categories: nil, limit: 20, offset: 0)
        ensure_configured!
        track_request!

        query = build_query(location, categories)
        response = connection.get("textsearch/json", query: query, key: @api_key)
        handle_response(response)

        data = JSON.parse(response.body)
        spots = data["results"] || []

        # Apply offset and limit (Google doesn't have native pagination for this)
        spots = spots.drop(offset).take(limit)
        spots.map { |spot| normalize_spot(spot) }
      end

      # Search for businesses by name
      # Returns array of business hashes with normalized fields
      def search_by_name(name:, location: nil, limit: 10)
        ensure_configured!
        track_request!

        query = location ? "#{name} in #{location}" : name
        response = connection.get("textsearch/json", query: query, key: @api_key)
        handle_response(response)

        data = JSON.parse(response.body)
        spots = data["results"] || []

        # Apply limit
        spots = spots.take(limit)
        spots.map { |spot| normalize_spot(spot) }
      end

      # Get detailed business information
      # Returns normalized business hash with additional details
      def get_business(place_id)
        ensure_configured!
        track_request!

        fields = "place_id,name,formatted_address,formatted_phone_number,geometry,rating,user_ratings_total,types,url,photos,permanently_closed"
        response = connection.get("details/json", placeid: place_id, fields: fields, key: @api_key)
        handle_response(response)

        data = JSON.parse(response.body)
        normalize_spot(data["result"], detailed: true)
      end

      # Get reviews for a business
      # Note: Google Places API returns up to 5 reviews
      def get_reviews(place_id)
        ensure_configured!
        track_request!

        fields = "reviews"
        response = connection.get("details/json", placeid: place_id, fields: fields, key: @api_key)
        handle_response(response)

        data = JSON.parse(response.body)
        reviews = data.dig("result", "reviews") || []
        normalize_reviews(reviews)
      end

      # Paginate through all businesses in a location
      # Yields businesses array and progress hash { current:, total:, percent: }
      def search_all_businesses(location:, categories: nil, &block)
        ensure_configured!

        query = build_query(location, categories)

        # Google Places API returns up to 60 results via pagination tokens
        all_spots = []
        next_page_token = nil

        loop do
          track_request!

          params = { query: query, key: @api_key }
          params[:pagetoken] = next_page_token if next_page_token

          response = connection.get("textsearch/json", params)
          handle_response(response)

          data = JSON.parse(response.body)
          spots = data["results"] || []
          all_spots.concat(spots)

          next_page_token = data["next_page_token"]
          break unless next_page_token
          break if all_spots.length >= 60  # Google's max

          # Google requires a short delay before using next_page_token
          sleep(2)
        end

        total = all_spots.length
        all_spots.each_with_index do |spot, index|
          normalized = normalize_spot(spot)
          progress = {
            current: index + 1,
            total: total,
            percent: (((index + 1).to_f / total) * 100).round(1)
          }
          yield normalized, progress if block_given?
        end

        total
      end

      private

      def connection
        @connection ||= Faraday.new(url: @base_url) do |conn|
          conn.headers["Accept"] = "application/json"
          conn.adapter Faraday.default_adapter
        end
      end

      def ensure_configured!
        raise ConfigurationError, "Google API key not configured. Set GOOGLE_API_KEY environment variable." unless configured?
      end

      def handle_response(response)
        return if response.success?

        body = begin
          JSON.parse(response.body)
        rescue JSON::ParserError
          response.body
        end

        message = body.is_a?(Hash) ? body["error_message"] || body["status"] || body.to_s : body.to_s
        raise APIError.new("Google API error: #{message}", status: response.status, body: body)
      end

      def build_query(location, categories = nil)
        if categories
          "#{categories} in #{location}"
        else
          "restaurants in #{location}"
        end
      end

      # Normalize Google Places data to common format
      def normalize_spot(spot, detailed: false)
        return nil unless spot

        {
          external_id: "google:#{spot["place_id"]}",
          name: spot["name"],
          phone: spot["formatted_phone_number"],
          address: spot["formatted_address"] || spot["vicinity"],
          latitude: spot.dig("geometry", "location", "lat"),
          longitude: spot.dig("geometry", "location", "lng"),
          rating: spot["rating"],
          review_count: spot["user_ratings_total"],
          categories: normalize_types(spot["types"]),
          photos: extract_photos(spot),
          url: spot["url"],
          is_closed: spot["permanently_closed"]
        }
      end

      def normalize_reviews(reviews)
        reviews.map do |review|
          {
            id: nil,  # Google doesn't provide review IDs
            rating: review["rating"],
            text: review["text"],
            url: review["author_url"],
            time_created: review["time"] ? Time.at(review["time"]).iso8601 : nil,
            user_name: review["author_name"]
          }
        end
      end

      def normalize_types(types)
        return [] unless types

        # Filter out generic types, keep relevant ones
        ignored_types = %w[point_of_interest establishment food]
        types.reject { |t| ignored_types.include?(t) }
      end

      def extract_photos(spot)
        return [] unless spot["photos"]

        spot["photos"].first(5).map do |photo|
          # Use direct URL if available (e.g., from mock server), otherwise build from photo_reference
          if photo["url"]
            photo["url"]
          elsif photo["photo_reference"]
            "#{@base_url}/photo?maxwidth=400&photoreference=#{photo["photo_reference"]}&key=#{@api_key}"
          end
        end.compact
      end
    end
  end
end
