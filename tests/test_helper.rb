# frozen_string_literal: true

# Ruby 4.0 compatibility - must load Logger before Sentry
# This MUST come before bundler/setup to ensure Logger is available
# when the Sentry gem is autoloaded
gem "logger"
require "logger"

require "bundler/setup"
require "minitest/autorun"
require "minitest/mock"
require "fileutils"

# Load the application
require_relative "../lib/grub_stars"

module GrubStars
  module TestHelper
    TEST_DB_PATH = File.expand_path("../tmp/test.db", __dir__)

    def setup_test_db
      FileUtils.mkdir_p(File.dirname(TEST_DB_PATH))
      FileUtils.rm_f(TEST_DB_PATH)
      @db = GrubStars::Database.connect(TEST_DB_PATH)
      GrubStars::Database.create_schema(@db)
      @db
    end

    def teardown_test_db
      @db&.disconnect
      FileUtils.rm_f(TEST_DB_PATH)
    end
  end
end

class GrubStars::IntegrationTest < Minitest::Test
  include GrubStars::TestHelper

  def setup
    @db = setup_test_db
  end

  def teardown
    teardown_test_db
  end
end
