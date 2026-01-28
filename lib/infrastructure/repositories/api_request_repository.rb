# frozen_string_literal: true

require "date"

module Infrastructure
  module Repositories
    # Repository for tracking API request counts per adapter
    class ApiRequestRepository
      def initialize(db = GrubStars.db)
        @db = db
      end

      # Get current request count for an adapter
      # Automatically resets if a month has passed since last reset
      def get_count(adapter_name)
        check_and_reset_if_needed(adapter_name)
        row = @db[:api_requests].where(adapter: adapter_name).first
        row ? row[:request_count] : 0
      end

      # Increment request count for an adapter
      # Returns the new count
      def increment(adapter_name, amount = 1)
        check_and_reset_if_needed(adapter_name)
        now = DateTime.now

        # Try to update existing record
        updated = @db[:api_requests]
          .where(adapter: adapter_name)
          .update(
            request_count: Sequel[:request_count] + amount,
            updated_at: now
          )

        if updated.zero?
          # Record doesn't exist, create it with reset_at set to now
          @db[:api_requests].insert(
            adapter: adapter_name,
            request_count: amount,
            reset_at: now,
            updated_at: now
          )
          amount
        else
          # Return the new count
          row = @db[:api_requests].where(adapter: adapter_name).first
          row[:request_count]
        end
      end

      # Reset count for an adapter (useful for manual reset or testing)
      def reset(adapter_name)
        @db[:api_requests]
          .where(adapter: adapter_name)
          .update(
            request_count: 0,
            reset_at: DateTime.now,
            updated_at: DateTime.now
          )
      end

      # Get all adapter counts with reset dates
      def all_counts
        @db[:api_requests].all.each_with_object({}) do |row, hash|
          check_and_reset_if_needed(row[:adapter])
        end

        # Re-fetch after potential resets
        @db[:api_requests].all.each_with_object({}) do |row, hash|
          hash[row[:adapter]] = {
            count: row[:request_count],
            reset_at: row[:reset_at],
            updated_at: row[:updated_at]
          }
        end
      end

      # Get reset date for an adapter
      def get_reset_date(adapter_name)
        row = @db[:api_requests].where(adapter: adapter_name).first
        row ? row[:reset_at] : nil
      end

      # Get days until next reset for an adapter
      def days_until_reset(adapter_name)
        reset_date = get_reset_date(adapter_name)
        return nil unless reset_date

        next_reset = next_reset_date(reset_date)
        (next_reset - Date.today).to_i
      end

      private

      # Check if a month has passed and reset if needed
      def check_and_reset_if_needed(adapter_name)
        row = @db[:api_requests].where(adapter: adapter_name).first
        return unless row && row[:reset_at]

        if should_reset?(row[:reset_at])
          @db[:api_requests]
            .where(adapter: adapter_name)
            .update(
              request_count: 0,
              reset_at: DateTime.now,
              updated_at: DateTime.now
            )
        end
      end

      # Check if the reset date was more than a month ago
      def should_reset?(reset_at)
        return true unless reset_at

        reset_date = to_date(reset_at)
        next_reset = next_reset_date(reset_date)
        Date.today >= next_reset
      end

      # Calculate the next reset date (same day next month)
      def next_reset_date(from_date)
        from_date = to_date(from_date)
        from_date >> 1  # Add one month
      end

      # Convert various date/time types to Date
      def to_date(value)
        case value
        when Date
          value
        when DateTime, Time
          value.to_date
        else
          Date.parse(value.to_s)
        end
      end
    end
  end
end
