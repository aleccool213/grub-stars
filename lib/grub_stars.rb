# frozen_string_literal: true

require "fileutils"
require_relative "config"
require_relative "database"
require_relative "adapters/base"
require_relative "adapters/yelp"
require_relative "adapters/google"
require_relative "logger"
require_relative "matcher"
require_relative "indexer"
require_relative "search"
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
        db
      end
    end

    def reset_db!
      @db = nil
    end
  end
end
