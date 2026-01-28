# frozen_string_literal: true

require_relative "../repositories/api_request_repository"

module GrubStars
  module Adapters
    class Base
      class NotImplementedError < StandardError; end
      class ConfigurationError < StandardError; end
      class APIError < StandardError
        attr_reader :status, :body

        def initialize(message, status: nil, body: nil)
          @status = status
          @body = body
          super(message)
        end
      end

      class RateLimitError < StandardError
        attr_reader :adapter, :limit, :current_count

        def initialize(adapter:, limit:, current_count:)
          @adapter = adapter
          @limit = limit
          @current_count = current_count
          super("API rate limit exceeded for #{adapter}: #{current_count}/#{limit} requests used")
        end
      end

      # Override in subclasses to set the request limit
      # Set to nil for unlimited requests
      REQUEST_LIMIT = nil

      def initialize(api_request_repository: nil)
        @api_request_repository = api_request_repository
      end

      def search_businesses(location:, categories: nil, limit: 50, offset: 0)
        raise NotImplementedError, "#{self.class}#search_businesses not implemented"
      end

      def search_by_name(name:, location: nil, limit: 10)
        raise NotImplementedError, "#{self.class}#search_by_name not implemented"
      end

      def get_business(id)
        raise NotImplementedError, "#{self.class}#get_business not implemented"
      end

      def get_reviews(id)
        raise NotImplementedError, "#{self.class}#get_reviews not implemented"
      end

      def source_name
        raise NotImplementedError, "#{self.class}#source_name not implemented"
      end

      def configured?
        raise NotImplementedError, "#{self.class}#configured? not implemented"
      end

      # Get the request limit for this adapter
      def request_limit
        self.class::REQUEST_LIMIT
      end

      # Get current request count
      def request_count
        api_request_repository.get_count(source_name)
      end

      # Check if we can make more requests
      def requests_available?
        limit = request_limit
        return true if limit.nil?  # No limit set

        request_count < limit
      end

      # Get remaining requests before hitting limit
      def remaining_requests
        limit = request_limit
        return nil if limit.nil?  # No limit set

        [limit - request_count, 0].max
      end

      protected

      # Call this before making an API request
      # Raises RateLimitError if limit exceeded
      def track_request!
        limit = request_limit
        return if limit.nil?  # No limit set

        current = request_count
        if current >= limit
          raise RateLimitError.new(
            adapter: source_name,
            limit: limit,
            current_count: current
          )
        end

        api_request_repository.increment(source_name)
      end

      private

      def api_request_repository
        @api_request_repository ||= Infrastructure::Repositories::ApiRequestRepository.new
      end
    end
  end
end
