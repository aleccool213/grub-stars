# frozen_string_literal: true

require_relative "../../domain/models/review"

module Infrastructure
  module Repositories
    # Repository for Review data access
    class ReviewRepository
      def initialize(db = GrubStars.db)
        @db = db
      end

      def find_by_restaurant_id(restaurant_id)
        @db[:reviews]
          .where(restaurant_id: restaurant_id)
          .all
          .map { |row| to_domain_model(row) }
      end

      def save(review)
        if review.id
          update(review)
        else
          create(review)
        end
      end

      private

      def create(review)
        review.id = @db[:reviews].insert(
          restaurant_id: review.restaurant_id,
          source: review.source,
          snippet: review.snippet,
          url: review.url,
          fetched_at: review.fetched_at || Time.now
        )
        review
      end

      def update(review)
        @db[:reviews].where(id: review.id).update(
          snippet: review.snippet,
          url: review.url,
          fetched_at: review.fetched_at || Time.now
        )
        review
      end

      def to_domain_model(row)
        Domain::Models::Review.new(
          id: row[:id],
          restaurant_id: row[:restaurant_id],
          source: row[:source],
          snippet: row[:snippet],
          url: row[:url],
          fetched_at: row[:fetched_at]
        )
      end
    end
  end
end
