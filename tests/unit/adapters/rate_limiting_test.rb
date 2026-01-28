# frozen_string_literal: true

require_relative "../../test_helper"

class RateLimitingTest < Minitest::Test
  def setup
    @db = create_test_db
    @api_request_repo = Infrastructure::Repositories::ApiRequestRepository.new(@db)
  end

  def teardown
    @db.disconnect
  end

  def test_yelp_has_5000_request_limit
    assert_equal 5000, GrubStars::Adapters::Yelp::REQUEST_LIMIT
  end

  def test_google_has_10000_request_limit
    assert_equal 10_000, GrubStars::Adapters::Google::REQUEST_LIMIT
  end

  def test_tripadvisor_has_5000_request_limit
    assert_equal 5000, GrubStars::Adapters::TripAdvisor::REQUEST_LIMIT
  end

  def test_adapter_request_limit_method
    adapter = GrubStars::Adapters::Yelp.new(
      api_key: "test_key",
      api_request_repository: @api_request_repo
    )

    assert_equal 5000, adapter.request_limit
  end

  def test_adapter_request_count_returns_current_count
    adapter = GrubStars::Adapters::Yelp.new(
      api_key: "test_key",
      api_request_repository: @api_request_repo
    )

    @api_request_repo.increment("yelp", 100)

    assert_equal 100, adapter.request_count
  end

  def test_adapter_requests_available_when_under_limit
    adapter = GrubStars::Adapters::Yelp.new(
      api_key: "test_key",
      api_request_repository: @api_request_repo
    )

    @api_request_repo.increment("yelp", 100)

    assert adapter.requests_available?
  end

  def test_adapter_requests_not_available_when_at_limit
    adapter = GrubStars::Adapters::Yelp.new(
      api_key: "test_key",
      api_request_repository: @api_request_repo
    )

    @api_request_repo.increment("yelp", 5000)

    refute adapter.requests_available?
  end

  def test_adapter_remaining_requests
    adapter = GrubStars::Adapters::Yelp.new(
      api_key: "test_key",
      api_request_repository: @api_request_repo
    )

    @api_request_repo.increment("yelp", 4000)

    assert_equal 1000, adapter.remaining_requests
  end

  def test_adapter_remaining_requests_never_negative
    adapter = GrubStars::Adapters::Yelp.new(
      api_key: "test_key",
      api_request_repository: @api_request_repo
    )

    @api_request_repo.increment("yelp", 6000)  # Over the limit

    assert_equal 0, adapter.remaining_requests
  end

  def test_rate_limit_error_raised_when_limit_exceeded
    # Create adapter with mocked repository
    adapter = TestableAdapter.new(
      api_key: "test_key",
      api_request_repository: @api_request_repo
    )

    # Set count to limit
    @api_request_repo.increment("testable", 100)

    error = assert_raises(GrubStars::Adapters::Base::RateLimitError) do
      adapter.make_request
    end

    assert_equal "testable", error.adapter
    assert_equal 100, error.limit
    assert_equal 100, error.current_count
    assert_match(/API rate limit exceeded/, error.message)
  end

  def test_rate_limit_error_not_raised_when_under_limit
    adapter = TestableAdapter.new(
      api_key: "test_key",
      api_request_repository: @api_request_repo
    )

    @api_request_repo.increment("testable", 50)

    # Should not raise
    adapter.make_request

    # Count should be incremented
    assert_equal 51, @api_request_repo.get_count("testable")
  end

  def test_each_adapter_tracks_separately
    yelp = GrubStars::Adapters::Yelp.new(
      api_key: "test_key",
      api_request_repository: @api_request_repo
    )
    google = GrubStars::Adapters::Google.new(
      api_key: "test_key",
      api_request_repository: @api_request_repo
    )

    @api_request_repo.increment("yelp", 1000)
    @api_request_repo.increment("google", 2000)

    assert_equal 1000, yelp.request_count
    assert_equal 2000, google.request_count
    assert_equal 4000, yelp.remaining_requests
    assert_equal 8000, google.remaining_requests
  end

  private

  def create_test_db
    db = Sequel.sqlite
    GrubStars::Database.create_schema(db)
    db
  end

  # Test adapter with exposed track_request! method
  class TestableAdapter < GrubStars::Adapters::Base
    REQUEST_LIMIT = 100

    def initialize(api_key:, api_request_repository: nil)
      super(api_request_repository: api_request_repository)
      @api_key = api_key
    end

    def source_name
      "testable"
    end

    def configured?
      !@api_key.nil?
    end

    # Expose track_request! for testing
    def make_request
      track_request!
    end
  end
end
