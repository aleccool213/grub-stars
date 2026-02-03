# frozen_string_literal: true

require "fileutils"
require_relative "config"
require_relative "logger"

# Infrastructure Layer
require_relative "infrastructure/database"
require_relative "infrastructure/adapters/base"
require_relative "infrastructure/adapters/yelp"
require_relative "infrastructure/adapters/google"
require_relative "infrastructure/adapters/tripadvisor"

# Domain Layer
require_relative "domain/models/restaurant"
require_relative "domain/models/rating"
require_relative "domain/models/review"
require_relative "domain/models/media"
require_relative "domain/models/category"
require_relative "domain/models/external_id"
require_relative "domain/matcher"

# Infrastructure - Repositories
require_relative "infrastructure/repositories/restaurant_repository"
require_relative "infrastructure/repositories/rating_repository"
require_relative "infrastructure/repositories/review_repository"
require_relative "infrastructure/repositories/media_repository"
require_relative "infrastructure/repositories/category_repository"
require_relative "infrastructure/repositories/external_id_repository"
require_relative "infrastructure/repositories/api_request_repository"

# Service Layer
require_relative "services/index_restaurants_service"
require_relative "services/search_restaurants_service"
require_relative "services/restaurant_details_service"
require_relative "services/list_categories_service"

# Presentation Layer
require_relative "cli"

module GrubStars
  VERSION = "0.1.0"

  class << self
    def db
      @db ||= begin
        db_path = Config.db_path
        db_dir = File.dirname(db_path)
        FileUtils.mkdir_p(db_dir) unless File.directory?(db_dir)
        db = Database.connect(db_path)
        Database.create_schema(db)
        Database.migrate(db)
        db
      end
    end

    def reset_db!
      @db = nil
    end
  end
end
