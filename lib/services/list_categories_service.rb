# frozen_string_literal: true

require_relative "../infrastructure/repositories/category_repository"

module Services
  # Service for listing categories
  class ListCategoriesService
    def initialize(category_repo: nil)
      @category_repo = category_repo || Infrastructure::Repositories::CategoryRepository.new
    end

    # Get all category names
    # @return [Array<String>] List of category names
    def all_category_names
      @category_repo.find_all_names
    end

    # Get all categories as domain models
    # @return [Array<Domain::Models::Category>] List of categories
    def all_categories
      @category_repo.find_all
    end
  end
end
