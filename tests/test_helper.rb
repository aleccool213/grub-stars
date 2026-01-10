# frozen_string_literal: true

require "minitest/autorun"
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
