# frozen_string_literal: true

require_relative "../infrastructure/repositories/restaurant_repository"

module Services
  # Service for searching restaurants
  class SearchRestaurantsService
    class LocationNotIndexedError < StandardError; end

    def initialize(restaurant_repo: nil)
      @restaurant_repo = restaurant_repo || Infrastructure::Repositories::RestaurantRepository.new
    end

    # Search restaurants by name
    # @param query [String] Search query
    # @param location [String, nil] Optional location filter (e.g., "barrie, ontario")
    # @return [Array<Domain::Models::Restaurant>] Restaurants with basic associations (ratings, external_ids)
    # @raise [LocationNotIndexedError] if location is specified but hasn't been indexed
    def search_by_name(query, location: nil)
      validate_location(location) if location
      @restaurant_repo.search_by_name(query, location: location)
    end

    # Search restaurants by category
    # @param category [String] Category name
    # @param location [String, nil] Optional location filter (e.g., "barrie, ontario")
    # @return [Array<Domain::Models::Restaurant>] Restaurants with basic associations (ratings, external_ids)
    # @raise [LocationNotIndexedError] if location is specified but hasn't been indexed
    def search_by_category(category, location: nil)
      validate_location(location) if location
      @restaurant_repo.search_by_category(category, location: location)
    end

    # Get a single restaurant by name (fuzzy match, returns best match)
    # @param name [String] Restaurant name
    # @param location [String, nil] Optional location filter
    # @return [Domain::Models::Restaurant, nil] Restaurant or nil if not found
    # @raise [LocationNotIndexedError] if location is specified but hasn't been indexed
    def find_by_name(name, location: nil)
      validate_location(location) if location
      results = search_by_name(name, location: location)
      results.first
    end

    # Get all indexed locations
    # @return [Array<String>] List of unique indexed locations
    def all_indexed_locations
      @restaurant_repo.all_indexed_locations
    end

    private

    # Validate that a location has been indexed
    # @param location [String] Location to validate
    # @raise [LocationNotIndexedError] if location hasn't been indexed
    def validate_location(location)
      indexed_locations = all_indexed_locations
      unless indexed_locations.include?(location.downcase)
        raise LocationNotIndexedError,
              "Location '#{location}' has not been indexed. Available locations: #{indexed_locations.join(', ')}"
      end
    end
  end
end
