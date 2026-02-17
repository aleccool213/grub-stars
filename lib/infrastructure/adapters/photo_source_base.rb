# frozen_string_literal: true

require_relative "base"

module GrubStars
  module Adapters
    # Base class for adapters that provide photos/videos but not structured
    # business data (address, rating, reviews, categories).
    #
    # Unlike Adapters::Base (used by Yelp, Google, TripAdvisor), photo source
    # adapters enrich existing restaurant records with additional media rather
    # than discovering new restaurants.
    #
    # Photo source adapters are NOT registered in the default adapter list and
    # are NOT called during the primary indexing loop in IndexRestaurantsService.
    # Instead, they are used by EnrichPhotosService.
    class PhotoSourceBase < Base
      # Search for photos related to a specific restaurant.
      # Uses restaurant name, location text, and/or coordinates to find relevant media.
      #
      # @param restaurant_name [String] Name of the restaurant
      # @param location [String] Location text (e.g., "barrie, ontario")
      # @param latitude [Float, nil] Restaurant latitude for proximity filtering
      # @param longitude [Float, nil] Restaurant longitude for proximity filtering
      # @param limit [Integer] Maximum number of photos to return
      # @return [Array<Hash>] Array of photo hashes with keys:
      #   :url [String] Direct URL to the photo
      #   :caption [String, nil] Caption or description text
      #   :posted_at [String, nil] ISO 8601 timestamp when the photo was posted
      #   :author [String, nil] Username of the poster
      #   :external_id [String, nil] Source-specific media ID (for deduplication)
      def search_photos(restaurant_name:, location:, latitude: nil, longitude: nil, limit: 20)
        raise NotImplementedError, "#{self.class}#search_photos not implemented"
      end

      # Search for photos by hashtag.
      #
      # @param hashtag [String] Hashtag to search (without # prefix)
      # @param limit [Integer] Maximum number of photos to return
      # @return [Array<Hash>] Array of photo hashes (same shape as search_photos)
      def search_by_hashtag(hashtag:, limit: 20)
        raise NotImplementedError, "#{self.class}#search_by_hashtag not implemented"
      end

      # Get recent media from a specific business account.
      #
      # @param username [String] Business account username
      # @param limit [Integer] Maximum number of photos to return
      # @return [Array<Hash>] Array of photo hashes (same shape as search_photos)
      def get_business_media(username:, limit: 20)
        raise NotImplementedError, "#{self.class}#get_business_media not implemented"
      end
    end
  end
end
