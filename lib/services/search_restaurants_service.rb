# frozen_string_literal: true

require_relative "../infrastructure/repositories/restaurant_repository"

module Services
  # Service for searching restaurants
  class SearchRestaurantsService
    def initialize(restaurant_repo: nil)
      @restaurant_repo = restaurant_repo || Infrastructure::Repositories::RestaurantRepository.new
    end

    # Search restaurants by name
    # @param query [String] Search query
    # @return [Array<Domain::Models::Restaurant>] Restaurants with basic associations (ratings, external_ids)
    def search_by_name(query)
      @restaurant_repo.search_by_name(query)
    end

    # Search restaurants by category
    # @param category [String] Category name
    # @return [Array<Domain::Models::Restaurant>] Restaurants with basic associations (ratings, external_ids)
    def search_by_category(category)
      @restaurant_repo.search_by_category(category)
    end

    # Get a single restaurant by name (fuzzy match, returns best match)
    # @param name [String] Restaurant name
    # @return [Domain::Models::Restaurant, nil] Restaurant or nil if not found
    def find_by_name(name)
      results = search_by_name(name)
      results.first
    end
  end
end
