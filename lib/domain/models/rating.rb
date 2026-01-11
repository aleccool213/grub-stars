# frozen_string_literal: true

module Domain
  module Models
    # Rating domain model
    class Rating
      attr_accessor :id, :restaurant_id, :source, :score, :review_count, :fetched_at

      def initialize(attributes = {})
        @id = attributes[:id]
        @restaurant_id = attributes[:restaurant_id]
        @source = attributes[:source]
        @score = attributes[:score]
        @review_count = attributes[:review_count]
        @fetched_at = attributes[:fetched_at]
      end

      def to_h
        {
          id: id,
          restaurant_id: restaurant_id,
          source: source,
          score: score,
          review_count: review_count,
          fetched_at: fetched_at
        }
      end
    end
  end
end
