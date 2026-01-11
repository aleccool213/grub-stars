# frozen_string_literal: true

require_relative "../../domain/models/external_id"

module Infrastructure
  module Repositories
    # Repository for ExternalId data access
    class ExternalIdRepository
      def initialize(db = GrubStars.db)
        @db = db
      end

      def find_by_source_and_external_id(source, external_id)
        row = @db[:external_ids].where(source: source, external_id: external_id).first
        row ? to_domain_model(row) : nil
      end

      def find_by_restaurant_id(restaurant_id)
        @db[:external_ids]
          .where(restaurant_id: restaurant_id)
          .all
          .map { |row| to_domain_model(row) }
      end

      def save(external_id_obj)
        return if external_id_obj.external_id.nil?

        begin
          external_id_obj.id = @db[:external_ids].insert(
            restaurant_id: external_id_obj.restaurant_id,
            source: external_id_obj.source,
            external_id: external_id_obj.external_id
          )
          external_id_obj
        rescue Sequel::UniqueConstraintViolation
          # Already exists, ignore
          nil
        end
      end

      private

      def to_domain_model(row)
        Domain::Models::ExternalId.new(
          id: row[:id],
          restaurant_id: row[:restaurant_id],
          source: row[:source],
          external_id: row[:external_id]
        )
      end
    end
  end
end
