# frozen_string_literal: true

require_relative "../infrastructure/repositories/restaurant_repository"
require_relative "../infrastructure/repositories/api_request_repository"

module Services
  # Service for gathering system statistics
  class StatsService
    def initialize(
      restaurant_repo: nil,
      api_request_repo: nil,
      db: nil
    )
      @restaurant_repo = restaurant_repo || Infrastructure::Repositories::RestaurantRepository.new
      @api_request_repo = api_request_repo || Infrastructure::Repositories::ApiRequestRepository.new
      @db = db || GrubStars.db
    end

    # Get comprehensive system statistics
    # @return [Hash] Statistics including restaurant counts, API usage, and provider coverage
    def get_stats
      {
        restaurants: restaurant_stats,
        provider_coverage: provider_coverage_stats,
        api_usage: api_usage_stats,
        locations: @restaurant_repo.all_indexed_locations
      }
    end

    private

    def restaurant_stats
      {
        total: @db[:restaurants].count,
        with_photos: @db[:media].select(:restaurant_id).distinct.count,
        with_reviews: @db[:reviews].select(:restaurant_id).distinct.count,
        with_ratings: @db[:ratings].select(:restaurant_id).distinct.count,
        with_external_ids: @db[:external_ids].select(:restaurant_id).distinct.count,
        single_source_only: single_source_count,
        multi_source: multi_source_count
      }
    end

    def single_source_count
      @db[:external_ids]
        .select(:restaurant_id)
        .group(:restaurant_id)
        .having(Sequel.function(:count, :source) => 1)
        .count
    end

    def multi_source_count
      total_with_external_ids = @db[:external_ids].select(:restaurant_id).distinct.count
      total_with_external_ids - single_source_count
    end

    def provider_coverage_stats
      @db[:external_ids]
        .select(:source)
        .group(:source)
        .select_append(Sequel.function(:count, :restaurant_id).as(:count))
        .all
        .each_with_object({}) { |row, h| h[row[:source]] = row[:count] }
    end

    def api_usage_stats
      available_adapters.map do |adapter|
        build_adapter_stats(adapter)
      end
    end

    def build_adapter_stats(adapter)
      count = @api_request_repo.get_count(adapter.source_name)
      limit = adapter.request_limit
      reset_date = @api_request_repo.get_reset_date(adapter.source_name)
      days_until = @api_request_repo.days_until_reset(adapter.source_name)

      {
        name: adapter.source_name,
        configured: adapter.configured?,
        request_count: count,
        request_limit: limit,
        remaining: limit ? [limit - count, 0].max : nil,
        usage_percent: limit ? ((count.to_f / limit) * 100).round(1) : nil,
        reset_at: reset_date&.iso8601,
        days_until_reset: days_until
      }
    end

    def available_adapters
      [
        GrubStars::Adapters::Yelp.new,
        GrubStars::Adapters::Google.new,
        GrubStars::Adapters::TripAdvisor.new
      ]
    end
  end
end
