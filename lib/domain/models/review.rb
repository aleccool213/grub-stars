# frozen_string_literal: true

module Domain
  module Models
    # Review domain model
    class Review
      attr_accessor :id, :restaurant_id, :source, :snippet, :url, :fetched_at

      def initialize(attributes = {})
        @id = attributes[:id]
        @restaurant_id = attributes[:restaurant_id]
        @source = attributes[:source]
        @snippet = attributes[:snippet]
        @url = attributes[:url]
        @fetched_at = attributes[:fetched_at]
      end

      def to_h
        {
          id: id,
          restaurant_id: restaurant_id,
          source: source,
          snippet: snippet,
          url: url,
          fetched_at: fetched_at
        }
      end
    end
  end
end
