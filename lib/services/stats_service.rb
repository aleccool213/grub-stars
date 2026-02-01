# frozen_string_literal: true

require_relative "../infrastructure/repositories/api_request_repository"
require_relative "../infrastructure/repositories/restaurant_repository"
require_relative "../infrastructure/adapters/yelp"
require_relative "../infrastructure/adapters/google"
require_relative "../infrastructure/adapters/tripadvisor"

module Services
  # Service for gathering application statistics
  class StatsService
    ADAPTERS = %w[yelp google tripadvisor].freeze

    def initialize(api_request_repo: nil, db: nil)
      @api_request_repo = api_request_repo || Infrastructure::Repositories::ApiRequestRepository.new
      @db = db || GrubStars.db
    end

    # Get all statistics
    # @return [Hash] Statistics including restaurant counts and API usage
    def get_all_stats
      {
        restaurants: restaurant_stats,
        api_usage: api_usage_stats,
        data_coverage: data_coverage_stats
      }
    end

    # Get restaurant count statistics
    # @return [Hash] Restaurant counts
    def restaurant_stats
      {
        total: @db[:restaurants].count,
        by_location: restaurants_by_location
      }
    end

    # Get API usage statistics per adapter
    # @return [Hash] API usage per adapter with limits and remaining
    def api_usage_stats
      adapter_limits = {
        "yelp" => GrubStars::Adapters::Yelp::REQUEST_LIMIT,
        "google" => GrubStars::Adapters::Google::REQUEST_LIMIT,
        "tripadvisor" => GrubStars::Adapters::TripAdvisor::REQUEST_LIMIT
      }

      counts = @api_request_repo.all_counts

      ADAPTERS.each_with_object({}) do |adapter, result|
        count_data = counts[adapter] || { count: 0, reset_at: nil }
        limit = adapter_limits[adapter]

        result[adapter] = {
          requests_used: count_data[:count],
          request_limit: limit,
          remaining: limit ? [limit - count_data[:count], 0].max : nil,
          percentage_used: limit && limit > 0 ? ((count_data[:count].to_f / limit) * 100).round(1) : 0,
          reset_at: count_data[:reset_at]&.to_s,
          days_until_reset: @api_request_repo.days_until_reset(adapter)
        }
      end
    end

    # Get data coverage statistics
    # Shows how many restaurants have data from all/multiple sources
    # @return [Hash] Data coverage stats
    def data_coverage_stats
      # Count restaurants by number of sources they have data from
      source_counts = @db[:external_ids]
        .select(:restaurant_id)
        .select_append { count(distinct(:source)).as(:source_count) }
        .group(:restaurant_id)
        .all

      total = @db[:restaurants].count
      with_all_sources = source_counts.count { |r| r[:source_count] >= ADAPTERS.length }
      with_multiple_sources = source_counts.count { |r| r[:source_count] >= 2 }
      with_single_source = source_counts.count { |r| r[:source_count] == 1 }

      # Count restaurants by specific source (using COUNT(DISTINCT) for SQLite compatibility)
      by_source = ADAPTERS.each_with_object({}) do |adapter, result|
        result[adapter] = @db[:external_ids]
          .where(source: adapter)
          .select { count(distinct(:restaurant_id)).as(:count) }
          .first[:count]
      end

      {
        total_restaurants: total,
        with_all_sources: with_all_sources,
        with_multiple_sources: with_multiple_sources,
        with_single_source: with_single_source,
        by_source: by_source,
        configured_adapters: ADAPTERS
      }
    end

    private

    # Get restaurant count by location
    # @return [Hash] Count by location
    def restaurants_by_location
      @db[:restaurants]
        .select { [lower(location).as(:location), count(:id).as(:count)] }
        .where(Sequel.~(location: nil))
        .group(Sequel.function(:lower, :location))
        .all
        .each_with_object({}) { |row, hash| hash[row[:location]] = row[:count] }
    end
  end
end
