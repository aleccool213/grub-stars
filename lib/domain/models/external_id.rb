# frozen_string_literal: true

module Domain
  module Models
    # ExternalId domain model - tracks IDs from external sources (Yelp, Google, etc.)
    class ExternalId
      attr_accessor :id, :restaurant_id, :source, :external_id

      def initialize(attributes = {})
        @id = attributes[:id]
        @restaurant_id = attributes[:restaurant_id]
        @source = attributes[:source]
        @external_id = attributes[:external_id]
      end

      def to_h
        {
          id: id,
          restaurant_id: restaurant_id,
          source: source,
          external_id: external_id
        }
      end
    end
  end
end
