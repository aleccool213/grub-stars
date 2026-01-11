# frozen_string_literal: true

require "faraday"
require "json"
require_relative "base"

module GrubStars
  module Adapters
    class Yelp < Base
      DEFAULT_BASE_URL = "https://api.yelp.com/v3"

      def initialize(api_key: nil, base_url: nil)
        @api_key = api_key || ENV["YELP_API_KEY"]
        @base_url = base_url || ENV["YELP_API_BASE_URL"] || DEFAULT_BASE_URL
      end

      def source_name
        "yelp"
      end

      def configured?
        !@api_key.nil? && !@api_key.empty?
      end

      # Search for businesses by location
      # Returns array of business hashes with normalized fields
      def search_businesses(location:, categories: nil, limit: 50, offset: 0)
        ensure_configured!

        params = {
          location: location,
          limit: [limit, 50].min,  # API max is 50
          offset: offset
        }
        params[:categories] = categories if categories

        response = connection.get("businesses/search", params)
        handle_response(response)

        data = JSON.parse(response.body)
        data["businesses"].map { |biz| normalize_business(biz) }
      end

      # Get detailed business information
      # Returns normalized business hash with additional details
      def get_business(id)
        ensure_configured!

        response = connection.get("businesses/#{id}")
        handle_response(response)

        data = JSON.parse(response.body)
        normalize_business(data)
      end

      # Get reviews for a business (requires Enhanced plan)
      # Returns array of normalized review hashes
      def get_reviews(id)
        ensure_configured!

        response = connection.get("businesses/#{id}/reviews")
        handle_response(response)

        data = JSON.parse(response.body)
        data["reviews"].map { |review| normalize_review(review) }
      end

      # Paginate through all businesses in a location
      # Yields businesses array and progress hash { current:, total:, percent: }
      def search_all_businesses(location:, categories: nil, &block)
        ensure_configured!

        offset = 0
        limit = 50
        total = nil
        processed = 0

        loop do
          params = {
            location: location,
            limit: limit,
            offset: offset
          }
          params[:categories] = categories if categories

          response = connection.get("businesses/search", params)
          handle_response(response)

          data = JSON.parse(response.body)
          total ||= [data["total"], 240].min  # Yelp caps at 240

          businesses = data["businesses"].map { |biz| normalize_business(biz) }
          break if businesses.empty?

          businesses.each do |biz|
            processed += 1
            progress = {
              current: processed,
              total: total,
              percent: ((processed.to_f / total) * 100).round(1)
            }
            yield biz, progress if block_given?
          end

          offset += limit
          break if offset >= 240 || offset >= total
        end

        total
      end

      private

      def connection
        @connection ||= Faraday.new(url: @base_url) do |conn|
          conn.headers["Authorization"] = "Bearer #{@api_key}"
          conn.headers["Accept"] = "application/json"
          conn.adapter Faraday.default_adapter
        end
      end

      def ensure_configured!
        raise ConfigurationError, "Yelp API key not configured. Set YELP_API_KEY environment variable." unless configured?
      end

      def handle_response(response)
        return if response.success?

        body = begin
          JSON.parse(response.body)
        rescue JSON::ParserError
          response.body
        end

        message = body.is_a?(Hash) ? body.dig("error", "description") || body.to_s : body.to_s
        raise APIError.new("Yelp API error: #{message}", status: response.status, body: body)
      end

      # Normalize Yelp business data to common format
      def normalize_business(data)
        {
          external_id: "yelp:#{data["id"]}",
          name: data["name"],
          alias: data["alias"],
          phone: data["phone"],
          display_phone: data["display_phone"],
          address: format_address(data["location"]),
          latitude: data.dig("coordinates", "latitude"),
          longitude: data.dig("coordinates", "longitude"),
          rating: data["rating"],
          review_count: data["review_count"],
          categories: extract_categories(data["categories"]),
          photos: data["photos"] || [],
          url: data["url"],
          is_closed: data["is_closed"]
        }
      end

      def normalize_review(data)
        {
          id: data["id"],
          rating: data["rating"],
          text: data["text"],
          url: data["url"],
          time_created: data["time_created"],
          user_name: data.dig("user", "name")
        }
      end

      def format_address(location)
        return nil unless location

        parts = [
          location["address1"],
          location["address2"],
          location["address3"],
          location["city"],
          location["state"],
          location["zip_code"],
          location["country"]
        ].compact.reject(&:empty?)

        parts.join(", ")
      end

      def extract_categories(categories)
        return [] unless categories

        categories.map { |cat| cat["alias"] }
      end
    end
  end
end
