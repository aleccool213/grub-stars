# frozen_string_literal: true

require_relative "../../domain/models/category"

module Infrastructure
  module Repositories
    # Repository for Category data access
    class CategoryRepository
      def initialize(db = GrubStars.db)
        @db = db
      end

      def find_all
        @db[:categories]
          .order(:name)
          .all
          .map { |row| to_domain_model(row) }
      end

      def find_all_names
        @db[:categories].order(:name).select_map(:name)
      end

      def find_by_name(name)
        row = @db[:categories].where(name: name).first
        row ? to_domain_model(row) : nil
      end

      def find_by_restaurant_id(restaurant_id)
        @db[:categories]
          .join(:restaurant_categories, category_id: :id)
          .where(Sequel[:restaurant_categories][:restaurant_id] => restaurant_id)
          .all
          .map { |row| to_domain_model(row) }
      end

      def find_or_create(name)
        existing = find_by_name(name)
        return existing if existing

        category_id = @db[:categories].insert(name: name)
        Domain::Models::Category.new(id: category_id, name: name)
      end

      def link_to_restaurant(restaurant_id, category_id)
        begin
          @db[:restaurant_categories].insert(
            restaurant_id: restaurant_id,
            category_id: category_id
          )
        rescue Sequel::UniqueConstraintViolation
          # Already linked, ignore
        end
      end

      def link_categories_to_restaurant(restaurant_id, category_names)
        return if category_names.nil? || category_names.empty?

        category_names.each do |category_name|
          category = find_or_create(category_name)
          link_to_restaurant(restaurant_id, category.id)
        end
      end

      private

      def to_domain_model(row)
        Domain::Models::Category.new(
          id: row[:id],
          name: row[:name]
        )
      end
    end
  end
end
