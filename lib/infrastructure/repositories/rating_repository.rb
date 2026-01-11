# frozen_string_literal: true

require_relative "../../domain/models/rating"

module Infrastructure
  module Repositories
    # Repository for Rating data access
    class RatingRepository
      def initialize(db = GrubStars.db)
        @db = db
      end

      def find_by_restaurant_id(restaurant_id)
        @db[:ratings]
          .where(restaurant_id: restaurant_id)
          .all
          .map { |row| to_domain_model(row) }
      end

      def find_by_restaurant_and_source(restaurant_id, source)
        row = @db[:ratings].where(restaurant_id: restaurant_id, source: source).first
        row ? to_domain_model(row) : nil
      end

      def save(rating)
        if rating.id
          update(rating)
        else
          create(rating)
        end
      end

      def upsert(restaurant_id, source, score:, review_count:)
        existing = find_by_restaurant_and_source(restaurant_id, source)

        rating_data = {
          score: score,
          review_count: review_count,
          fetched_at: Time.now
        }

        if existing
          @db[:ratings].where(id: existing.id).update(rating_data)
          existing.id
        else
          @db[:ratings].insert(rating_data.merge(
            restaurant_id: restaurant_id,
            source: source
          ))
        end
      end

      private

      def create(rating)
        rating.id = @db[:ratings].insert(
          restaurant_id: rating.restaurant_id,
          source: rating.source,
          score: rating.score,
          review_count: rating.review_count,
          fetched_at: rating.fetched_at || Time.now
        )
        rating
      end

      def update(rating)
        @db[:ratings].where(id: rating.id).update(
          score: rating.score,
          review_count: rating.review_count,
          fetched_at: rating.fetched_at || Time.now
        )
        rating
      end

      def to_domain_model(row)
        Domain::Models::Rating.new(
          id: row[:id],
          restaurant_id: row[:restaurant_id],
          source: row[:source],
          score: row[:score],
          review_count: row[:review_count],
          fetched_at: row[:fetched_at]
        )
      end
    end
  end
end
