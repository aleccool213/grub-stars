# frozen_string_literal: true

require "faraday"
require "json"
require_relative "photo_source_base"

module GrubStars
  module Adapters
    # Instagram photo source adapter using the Instagram Graph API.
    #
    # Provides hashtag-based photo search and business account media retrieval.
    # Does NOT provide structured restaurant data (address, rating, reviews).
    #
    # Requires a Meta Developer App with Instagram Graph API permissions and
    # a Facebook Page linked to an Instagram Business/Creator account.
    #
    # Environment variables:
    #   INSTAGRAM_ACCESS_TOKEN - Long-lived access token for the Graph API
    #   INSTAGRAM_USER_ID      - Instagram Business account user ID (numeric)
    #   INSTAGRAM_API_BASE_URL - Override base URL (for testing with mocks)
    class Instagram < PhotoSourceBase
      DEFAULT_BASE_URL = "https://graph.facebook.com/v21.0"

      # Monthly request budget (self-imposed, not an API limit).
      # The Graph API allows 200 calls/hour per user, but we budget monthly
      # to stay consistent with other adapters.
      REQUEST_LIMIT = 5000

      def initialize(access_token: nil, user_id: nil, base_url: nil, api_request_repository: nil)
        super(api_request_repository: api_request_repository)
        @access_token = access_token || ENV["INSTAGRAM_ACCESS_TOKEN"]
        @user_id = user_id || ENV["INSTAGRAM_USER_ID"]
        @base_url = base_url || ENV["INSTAGRAM_API_BASE_URL"] || DEFAULT_BASE_URL
      end

      def source_name
        "instagram"
      end

      def configured?
        !@access_token.nil? && !@access_token.empty? &&
          !@user_id.nil? && !@user_id.empty?
      end

      # Search for photos related to a restaurant by deriving hashtags from its name.
      #
      # Derives hashtags from the restaurant name (e.g., "Flying Monkeys Brewery"
      # becomes "flyingmonkeysbrewery") and searches for recent posts with that tag.
      def search_photos(restaurant_name:, location:, latitude: nil, longitude: nil, limit: 20)
        ensure_configured!

        hashtag = derive_hashtag(restaurant_name)
        search_by_hashtag(hashtag: hashtag, limit: limit)
      end

      # Search for recent photos tagged with a hashtag.
      #
      # Uses two Graph API calls:
      # 1. GET /ig_hashtag_search to resolve the hashtag name to an ID
      # 2. GET /{hashtag_id}/recent_media to fetch recent media
      def search_by_hashtag(hashtag:, limit: 20)
        ensure_configured!

        hashtag_id = lookup_hashtag_id(hashtag)
        return [] if hashtag_id.nil?

        fetch_hashtag_media(hashtag_id, limit: limit)
      end

      # Get recent media from a specific Instagram Business/Creator account.
      #
      # Uses the Business Discovery API to retrieve media from another account
      # without requiring that account's access token.
      def get_business_media(username:, limit: 20)
        ensure_configured!
        track_request!

        fields = "business_discovery.fields(media.limit(#{limit}){id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,username})"
        response = connection.get(@user_id, fields: fields, username: username, access_token: @access_token)
        handle_response(response)

        data = JSON.parse(response.body)
        media_items = data.dig("business_discovery", "media", "data") || []
        media_items.filter_map { |item| normalize_media(item) }
      end

      private

      def connection
        @connection ||= Faraday.new(url: @base_url) do |conn|
          conn.headers["Accept"] = "application/json"
          conn.adapter Faraday.default_adapter
        end
      end

      def ensure_configured!
        return if configured?

        raise ConfigurationError,
              "Instagram API not configured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID environment variables."
      end

      def handle_response(response)
        return if response.success?

        body = begin
          JSON.parse(response.body)
        rescue JSON::ParserError
          response.body
        end

        message = body.is_a?(Hash) ? body.dig("error", "message") || body.to_s : body.to_s
        raise APIError.new("Instagram API error: #{message}", status: response.status, body: body)
      end

      # Resolve a hashtag name to its Graph API ID.
      # Returns nil if the hashtag is not found.
      def lookup_hashtag_id(hashtag)
        track_request!

        response = connection.get("ig_hashtag_search", q: hashtag, user_id: @user_id, access_token: @access_token)
        handle_response(response)

        data = JSON.parse(response.body)
        items = data["data"] || []
        items.first&.dig("id")
      end

      # Fetch recent media for a hashtag ID.
      def fetch_hashtag_media(hashtag_id, limit: 20)
        track_request!

        fields = "id,caption,media_type,media_url,permalink,timestamp"
        response = connection.get(
          "#{hashtag_id}/recent_media",
          user_id: @user_id,
          fields: fields,
          limit: [limit, 50].min,
          access_token: @access_token
        )
        handle_response(response)

        data = JSON.parse(response.body)
        media_items = data["data"] || []
        media_items.filter_map { |item| normalize_media(item) }
      end

      # Normalize a Graph API media object to the common photo hash format.
      # Skips VIDEO media type (only returns IMAGE and CAROUSEL_ALBUM).
      def normalize_media(item)
        media_type = item["media_type"]
        return nil if media_type == "VIDEO"

        url = item["media_url"] || item["thumbnail_url"]
        return nil if url.nil? || url.empty?

        {
          url: url,
          caption: item["caption"],
          posted_at: item["timestamp"],
          author: item["username"],
          external_id: item["id"],
          permalink: item["permalink"]
        }
      end

      # Derive a hashtag from a restaurant name.
      # Strips non-alphanumeric characters and lowercases.
      # "Flying Monkeys Brewery" -> "flyingmonkeysbrewery"
      # "Joe's Pizza & Pasta" -> "joespizzapasta"
      def derive_hashtag(name)
        name.downcase.gsub(/[^a-z0-9]/, "")
      end
    end
  end
end
