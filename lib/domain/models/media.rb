# frozen_string_literal: true

module Domain
  module Models
    # Media domain model (photos and videos)
    class Media
      attr_accessor :id, :restaurant_id, :source, :media_type, :url, :fetched_at

      def initialize(attributes = {})
        @id = attributes[:id]
        @restaurant_id = attributes[:restaurant_id]
        @source = attributes[:source]
        @media_type = attributes[:media_type]
        @url = attributes[:url]
        @fetched_at = attributes[:fetched_at]
      end

      def photo?
        media_type == "photo"
      end

      def video?
        media_type == "video"
      end

      def to_h
        {
          id: id,
          restaurant_id: restaurant_id,
          source: source,
          media_type: media_type,
          url: url,
          fetched_at: fetched_at
        }
      end
    end
  end
end
