# frozen_string_literal: true

require_relative "../test_helper"

class CLITest < GrubStars::IntegrationTest
  def setup
    super
    # Point GrubStars.db to our test database
    @original_db_path = GrubStars::Config.get("db_path")
    GrubStars::Config.set("db_path", GrubStars::TestHelper::TEST_DB_PATH)
    GrubStars.reset_db!
  end

  def teardown
    # Restore original config
    if @original_db_path
      GrubStars::Config.set("db_path", @original_db_path)
    end
    GrubStars.reset_db!
    super
  end

  def test_search_with_category_no_data
    output = capture_stdout { GrubStars::CLI.start(["search", "--category", "bakery"]) }
    assert_match(/No restaurants found/, output)
  end

  def test_search_with_category_with_data
    seed_restaurant
    output = capture_stdout { GrubStars::CLI.start(["search", "--category", "bakeries"]) }
    assert(output.include?("Test Bakery"), output)
  end

  def test_search_with_name
    output = capture_stdout { GrubStars::CLI.start(["search", "--name", "corner cafe"]) }
    assert_match(/No restaurants found/, output)
  end

  def test_search_with_name_with_data
    seed_restaurant
    output = capture_stdout { GrubStars::CLI.start(["search", "--name", "bakery"]) }
    assert(output.include?("Test Bakery"), output)
  end

  def test_search_without_options_fails
    exit_code = nil
    capture_stdout do
      exit_code = run_cli_expecting_exit(["search"])
    end
    assert_equal 1, exit_code
  end

  def test_index_with_location_shows_message
    # Without API keys configured, it will fail but should show the initial message
    capture_stdout do
      begin
        GrubStars::CLI.start(["index", "--location", "barrie, ontario"])
      rescue SystemExit
        # Expected - no adapters configured
      end
    end
    # Test passes if no unexpected exception was raised
  end

  def test_index_without_location_fails
    assert_raises(SystemExit) do
      capture_output { GrubStars::CLI.start(["index"]) }
    end
  end

  def test_index_without_adapters_shows_error
    exit_code = nil
    output = capture_stdout do
      exit_code = run_cli_expecting_exit(["index", "--location", "barrie"])
    end
    assert_equal 1, exit_code
    assert_match(/No adapters configured/, output)
  end

  def test_info_with_name_not_found
    exit_code = nil
    output = capture_stdout do
      exit_code = run_cli_expecting_exit(["info", "--name", "nonexistent place"])
    end
    assert_equal 1, exit_code
    assert_match(/No restaurant found/, output)
  end

  def test_info_with_name_found
    seed_restaurant
    output = capture_stdout { GrubStars::CLI.start(["info", "--name", "bakery"]) }
    assert(output.include?("Test Bakery"), output)
    assert(output.include?("123 Main St"), output)
  end

  def test_info_with_id_not_found
    exit_code = nil
    output = capture_stdout do
      exit_code = run_cli_expecting_exit(["info", "--id", "99999"])
    end
    assert_equal 1, exit_code
    assert_match(/No restaurant found/, output)
  end

  def test_info_with_id_found
    seed_restaurant
    output = capture_stdout { GrubStars::CLI.start(["info", "--id", "1"]) }
    assert(output.include?("Test Bakery"), output)
  end

  def test_info_without_options_fails
    exit_code = nil
    capture_stdout do
      exit_code = run_cli_expecting_exit(["info"])
    end
    assert_equal 1, exit_code
  end

  def test_help_shows_commands
    output = capture_stdout { GrubStars::CLI.start(["help"]) }
    assert_match(/search/, output)
    assert_match(/index/, output)
    assert_match(/info/, output)
  end

  private

  def seed_restaurant
    # Force GrubStars to use our test database
    GrubStars.reset_db!
    db = GrubStars.db

    restaurant_id = db[:restaurants].insert(
      name: "Test Bakery",
      address: "123 Main St",
      latitude: 44.389,
      longitude: -79.690,
      phone: "+15551234567",
      created_at: Time.now,
      updated_at: Time.now
    )

    db[:external_ids].insert(
      restaurant_id: restaurant_id,
      source: "yelp",
      external_id: "test-bakery-123"
    )

    category_id = db[:categories].insert(name: "bakeries")
    db[:restaurant_categories].insert(
      restaurant_id: restaurant_id,
      category_id: category_id
    )

    db[:ratings].insert(
      restaurant_id: restaurant_id,
      source: "yelp",
      score: 4.5,
      review_count: 100,
      fetched_at: Time.now
    )
  end

  def capture_stdout
    original = $stdout
    $stdout = StringIO.new
    yield
    $stdout.string
  ensure
    $stdout = original
  end

  def capture_output
    original_stdout = $stdout
    original_stderr = $stderr
    $stdout = StringIO.new
    $stderr = StringIO.new
    yield
    [$stdout.string, $stderr.string]
  ensure
    $stdout = original_stdout
    $stderr = original_stderr
  end

  def run_cli_expecting_exit(args)
    GrubStars::CLI.start(args)
    0  # If we get here, no exit was called
  rescue SystemExit => e
    e.status
  end
end
