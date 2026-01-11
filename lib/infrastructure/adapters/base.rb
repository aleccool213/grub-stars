# frozen_string_literal: true

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

      def search_businesses(location:, categories: nil, limit: 50, offset: 0)
        raise NotImplementedError, "#{self.class}#search_businesses not implemented"
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
    end
  end
end
