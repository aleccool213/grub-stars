# frozen_string_literal: true

require_relative "../../domain/models/restaurant"
require_relative "./rating_repository"
require_relative "./review_repository"
require_relative "./media_repository"
require_relative "./category_repository"
require_relative "./external_id_repository"

module Infrastructure
  module Repositories
    # Repository for Restaurant data access
    class RestaurantRepository
      # Minimum similarity score for fuzzy matches (0.0 to 1.0)
      FUZZY_THRESHOLD = 0.6

      def initialize(db = GrubStars.db)
        @db = db
        @rating_repo = RatingRepository.new(db)
        @review_repo = ReviewRepository.new(db)
        @media_repo = MediaRepository.new(db)
        @category_repo = CategoryRepository.new(db)
        @external_id_repo = ExternalIdRepository.new(db)
      end

      # Find a restaurant by ID
      def find_by_id(id)
        row = @db[:restaurants].where(id: id).first
        row ? to_domain_model(row) : nil
      end

      # Find a restaurant by ID with all associations
      def find_by_id_with_associations(id)
        restaurant = find_by_id(id)
        return nil unless restaurant

        load_associations(restaurant)
      end

      # Find a restaurant by external ID (from a specific source)
      def find_by_external_id(source, external_id)
        ext_record = @db[:external_ids].where(source: source, external_id: external_id).first
        return nil unless ext_record

        find_by_id(ext_record[:restaurant_id])
      end

      # Search restaurants by name
      def search_by_name(query, location: nil)
        dataset = @db[:restaurants]
          .select_all(:restaurants)
          .select_append(Sequel.function(:fuzzy_match, :name, query).as(:match_score))
          .where(
            Sequel.|(
              Sequel.ilike(:name, "%#{query}%"),
              Sequel.lit("fuzzy_match(name, ?) >= ?", query, FUZZY_THRESHOLD)
            )
          )

        # Add fuzzy location filter if provided
        if location
          dataset = dataset.where(
            Sequel.|(
              Sequel.ilike(:location, "%#{location}%"),
              Sequel.lit("similarity(location, ?) >= ?", location, FUZZY_THRESHOLD)
            )
          )
        end

        dataset
          .order(Sequel.desc(:match_score), :name)
          .all
          .map { |row| to_domain_model_with_basic_associations(row) }
      end

      # Search restaurants by category
      def search_by_category(category, location: nil)
        dataset = @db[:restaurants]
          .join(:restaurant_categories, restaurant_id: Sequel[:restaurants][:id])
          .join(:categories, id: Sequel[:restaurant_categories][:category_id])
          .select_all(:restaurants)
          .select_append(
            Sequel.function(:similarity, Sequel[:categories][:name], category).as(:match_score)
          )
          .where(
            Sequel.|(
              Sequel.ilike(Sequel[:categories][:name], "%#{category}%"),
              Sequel.lit("similarity(categories.name, ?) >= ?", category, FUZZY_THRESHOLD)
            )
          )

        # Add fuzzy location filter if provided
        if location
          dataset = dataset.where(
            Sequel.|(
              Sequel.ilike(Sequel[:restaurants][:location], "%#{location}%"),
              Sequel.lit("similarity(restaurants.location, ?) >= ?", location, FUZZY_THRESHOLD)
            )
          )
        end

        dataset
          .distinct
          .order(Sequel.desc(:match_score), Sequel[:restaurants][:name])
          .all
          .map { |row| to_domain_model_with_basic_associations(row) }
      end

      # Find candidate restaurants for matching (within geographic bounds)
      def find_candidates_for_matching(latitude, longitude, delta)
        return [] unless latitude && longitude

        @db[:restaurants]
          .where(
            latitude: (latitude - delta)..(latitude + delta),
            longitude: (longitude - delta)..(longitude + delta)
          )
          .all
          .map { |row| to_domain_model(row) }
      end

      # Create a new restaurant
      def create(restaurant)
        now = Time.now

        restaurant.id = @db[:restaurants].insert(
          name: restaurant.name,
          address: restaurant.address,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          phone: restaurant.phone,
          location: restaurant.location,
          created_at: now,
          updated_at: now
        )

        restaurant.created_at = now
        restaurant.updated_at = now
        restaurant
      end

      # Update an existing restaurant
      def update(restaurant)
        @db[:restaurants].where(id: restaurant.id).update(
          name: restaurant.name,
          address: restaurant.address,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          phone: restaurant.phone,
          location: restaurant.location,
          updated_at: Time.now
        )
        restaurant
      end

      # Update specific fields of a restaurant (for merging)
      def update_fields(restaurant_id, fields)
        fields[:updated_at] = Time.now
        @db[:restaurants].where(id: restaurant_id).update(fields)
      end

      # Save a restaurant (create or update)
      def save(restaurant)
        if restaurant.id
          update(restaurant)
        else
          create(restaurant)
        end
      end

      private

      # Convert database row to domain model (basic, no associations)
      def to_domain_model(row)
        Domain::Models::Restaurant.new(
          id: row[:id],
          name: row[:name],
          address: row[:address],
          latitude: row[:latitude],
          longitude: row[:longitude],
          phone: row[:phone],
          location: row[:location],
          created_at: row[:created_at],
          updated_at: row[:updated_at]
        )
      end

      # Load all associations for a restaurant
      def load_associations(restaurant)
        restaurant.ratings = @rating_repo.find_by_restaurant_id(restaurant.id)
        restaurant.reviews = @review_repo.find_by_restaurant_id(restaurant.id)
        restaurant.media = @media_repo.find_by_restaurant_id(restaurant.id)
        restaurant.categories = @category_repo.find_by_restaurant_id(restaurant.id)
        restaurant.external_ids = @external_id_repo.find_by_restaurant_id(restaurant.id)
        restaurant
      end

      # Load basic associations (ratings and external_ids) for search results
      def load_basic_associations(restaurant)
        restaurant.ratings = @rating_repo.find_by_restaurant_id(restaurant.id)
        restaurant.external_ids = @external_id_repo.find_by_restaurant_id(restaurant.id)
        restaurant
      end

      # Convert database row to domain model with basic associations
      def to_domain_model_with_basic_associations(row)
        restaurant = to_domain_model(row)
        load_basic_associations(restaurant)
      end
    end
  end
end
