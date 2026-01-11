# frozen_string_literal: true

require_relative "../infrastructure/repositories/restaurant_repository"

module Services
  # Service for getting detailed restaurant information
  class RestaurantDetailsService
    def initialize(restaurant_repo: nil)
      @restaurant_repo = restaurant_repo || Infrastructure::Repositories::RestaurantRepository.new
    end

    # Get a restaurant by ID with all details
    # @param id [Integer] Restaurant ID
    # @return [Domain::Models::Restaurant, nil] Restaurant with all associations or nil if not found
    def get_by_id(id)
      @restaurant_repo.find_by_id_with_associations(id)
    end

    # Get a restaurant by name with all details
    # @param name [String] Restaurant name
    # @return [Domain::Models::Restaurant, nil] Restaurant with all associations or nil if not found
    def get_by_name(name)
      # First search by name
      search_service = SearchRestaurantsService.new(restaurant_repo: @restaurant_repo)
      results = search_service.search_by_name(name)
      return nil if results.empty?

      # Get the best match with full details
      get_by_id(results.first.id)
    end
  end
end
