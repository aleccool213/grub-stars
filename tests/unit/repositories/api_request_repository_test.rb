# frozen_string_literal: true

require_relative "../../test_helper"

class ApiRequestRepositoryTest < Minitest::Test
  def setup
    @db = create_test_db
    @repo = Infrastructure::Repositories::ApiRequestRepository.new(@db)
  end

  def teardown
    @db.disconnect
  end

  def test_get_count_returns_zero_for_new_adapter
    count = @repo.get_count("yelp")
    assert_equal 0, count
  end

  def test_increment_creates_record_and_returns_count
    count = @repo.increment("yelp")

    assert_equal 1, count
    assert_equal 1, @repo.get_count("yelp")
  end

  def test_increment_increases_existing_count
    @repo.increment("yelp")
    @repo.increment("yelp")
    count = @repo.increment("yelp")

    assert_equal 3, count
    assert_equal 3, @repo.get_count("yelp")
  end

  def test_increment_by_custom_amount
    count = @repo.increment("google", 5)

    assert_equal 5, count
    assert_equal 5, @repo.get_count("google")
  end

  def test_reset_sets_count_to_zero
    @repo.increment("yelp", 100)
    @repo.reset("yelp")

    assert_equal 0, @repo.get_count("yelp")
  end

  def test_reset_updates_reset_at
    @repo.increment("yelp")
    @repo.reset("yelp")

    reset_date = @repo.get_reset_date("yelp")
    assert reset_date
    # SQLite may return Time or DateTime depending on adapter
    assert reset_date.respond_to?(:to_date), "reset_date should be a date/time object"
  end

  def test_all_counts_returns_hash_with_counts
    @repo.increment("yelp", 10)
    @repo.increment("google", 20)

    counts = @repo.all_counts

    assert_equal 10, counts["yelp"][:count]
    assert_equal 20, counts["google"][:count]
  end

  def test_separate_adapters_have_separate_counts
    @repo.increment("yelp", 5)
    @repo.increment("google", 10)
    @repo.increment("tripadvisor", 15)

    assert_equal 5, @repo.get_count("yelp")
    assert_equal 10, @repo.get_count("google")
    assert_equal 15, @repo.get_count("tripadvisor")
  end

  def test_days_until_reset_returns_nil_for_new_adapter
    days = @repo.days_until_reset("yelp")
    assert_nil days
  end

  def test_days_until_reset_returns_days_remaining
    @repo.increment("yelp")  # This sets reset_at to now

    days = @repo.days_until_reset("yelp")

    # Should be approximately 30 days (could be 28-31 depending on month)
    assert days >= 28
    assert days <= 31
  end

  def test_auto_reset_after_month
    # Insert a record with reset_at set to over a month ago
    two_months_ago = DateTime.now << 2  # 2 months ago
    @db[:api_requests].insert(
      adapter: "yelp",
      request_count: 4500,
      reset_at: two_months_ago,
      updated_at: two_months_ago
    )

    # Getting count should trigger auto-reset
    count = @repo.get_count("yelp")

    assert_equal 0, count
  end

  def test_no_auto_reset_within_month
    # Insert a record with reset_at set to recently
    one_week_ago = DateTime.now - 7
    @db[:api_requests].insert(
      adapter: "yelp",
      request_count: 100,
      reset_at: one_week_ago,
      updated_at: one_week_ago
    )

    count = @repo.get_count("yelp")

    assert_equal 100, count
  end

  private

  def create_test_db
    db = Sequel.sqlite
    GrubStars::Database.create_schema(db)
    db
  end
end
