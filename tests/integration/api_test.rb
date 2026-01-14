# frozen_string_literal: true

require_relative "../test_helper"
require "rack/test"
require "webmock/minitest"
require_relative "../../lib/api/server"

class APITest < GrubStars::IntegrationTest
  include Rack::Test::Methods

  def app
    GrubStars::API::Server
  end

  def setup
    super
    WebMock.disable_net_connect!
    GrubStars::API::JobManager.reset!
    @original_db_path = GrubStars::Config.get("db_path")
    GrubStars::Config.set("db_path", GrubStars::TestHelper::TEST_DB_PATH)
    GrubStars.reset_db!
  end

  def teardown
    WebMock.allow_net_connect!
    GrubStars::API::JobManager.reset!
    if @original_db_path
      GrubStars::Config.set("db_path", @original_db_path)
    end
    GrubStars.reset_db!
    super
  end

  # Health endpoint tests
  def test_health_returns_ok
    get "/health"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal "ok", body["data"]["status"]
    assert body["meta"]["timestamp"]
  end

  # Categories endpoint tests
  def test_categories_empty_database
    get "/categories"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal [], body["data"]
    assert_equal 0, body["meta"]["count"]
  end

  def test_categories_with_data
    seed_restaurant

    get "/categories"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_includes body["data"], "bakeries"
    assert_equal 1, body["meta"]["count"]
  end

  # Locations endpoint tests
  def test_locations_empty_database
    get "/locations"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal [], body["data"]
    assert_equal 0, body["meta"]["count"]
  end

  def test_locations_with_data
    seed_restaurant_with_location

    get "/locations"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_includes body["data"], "barrie, ontario"
  end

  # Search endpoint tests
  def test_search_requires_parameter
    get "/restaurants/search"

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_REQUEST", body["error"]["code"]
    assert_match(/name.*category/i, body["error"]["message"])
  end

  def test_search_by_name_no_results
    get "/restaurants/search", name: "nonexistent"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal [], body["data"]
    assert_equal 0, body["meta"]["count"]
  end

  def test_search_by_name_with_results
    seed_restaurant

    get "/restaurants/search", name: "bakery"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal 1, body["data"].length
    assert_equal "Test Bakery", body["data"][0]["name"]
    assert_equal "123 Main St", body["data"][0]["address"]
    assert body["data"][0]["ratings"].is_a?(Array)
    assert body["data"][0]["categories"].is_a?(Array)
  end

  def test_search_by_category
    seed_restaurant

    get "/restaurants/search", category: "bakeries"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal 1, body["data"].length
    assert_equal "Test Bakery", body["data"][0]["name"]
  end

  def test_search_with_location_filter
    seed_restaurant_with_location

    get "/restaurants/search", name: "bakery", location: "barrie, ontario"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal 1, body["data"].length
  end

  def test_search_with_unindexed_location
    seed_restaurant_with_location

    get "/restaurants/search", name: "test", location: "toronto"

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "LOCATION_NOT_INDEXED", body["error"]["code"]
  end

  # Restaurant detail endpoint tests
  def test_restaurant_not_found
    get "/restaurants/999"

    assert_equal 404, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "NOT_FOUND", body["error"]["code"]
    assert_match(/999/, body["error"]["message"])
  end

  def test_restaurant_found
    seed_restaurant

    get "/restaurants/1"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal "Test Bakery", body["data"]["name"]
    assert_equal "123 Main St", body["data"]["address"]
    assert_equal 44.389, body["data"]["latitude"]
    assert_equal(-79.690, body["data"]["longitude"])
    assert body["data"]["ratings"].is_a?(Array)
    assert body["data"]["categories"].is_a?(Array)
  end

  # Index endpoint tests (async)
  def test_index_requires_location
    post "/index", {}.to_json, { "CONTENT_TYPE" => "application/json" }

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_REQUEST", body["error"]["code"]
    assert_match(/location/i, body["error"]["message"])
  end

  def test_index_invalid_json
    post "/index", "not valid json", { "CONTENT_TYPE" => "application/json" }

    assert_equal 400, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "INVALID_JSON", body["error"]["code"]
  end

  def test_index_returns_job_id
    stub_yelp_search
    stub_yelp_business("bakery-barrie")

    with_env("YELP_API_KEY" => "test_key") do
      post "/index", { location: "barrie, ontario" }.to_json, { "CONTENT_TYPE" => "application/json" }
    end

    assert_equal 202, last_response.status
    body = JSON.parse(last_response.body)

    assert body["data"]["job_id"], "Expected job_id in response"
    assert_equal "barrie, ontario", body["meta"]["location"]
  end

  def test_index_job_completes_successfully
    stub_yelp_search
    stub_yelp_business("bakery-barrie")

    # Set env for entire test since job runs in background
    original_key = ENV["YELP_API_KEY"]
    ENV["YELP_API_KEY"] = "test_key"

    post "/index", { location: "barrie, ontario" }.to_json, { "CONTENT_TYPE" => "application/json" }
    job_id = JSON.parse(last_response.body)["data"]["job_id"]

    # Wait for job to complete
    wait_for_job(job_id)

    get "/jobs/#{job_id}"
    assert last_response.ok?
    body = JSON.parse(last_response.body)

    assert_equal "completed", body["data"]["status"]
    assert_equal 1, body["data"]["result"]["total"]
    assert_equal 1, body["data"]["result"]["created"]

    # Verify restaurant was created
    assert_equal 1, GrubStars.db[:restaurants].count
  ensure
    ENV["YELP_API_KEY"] = original_key
  end

  def test_index_job_fails_without_adapters
    post "/index", { location: "barrie" }.to_json, { "CONTENT_TYPE" => "application/json" }

    assert_equal 202, last_response.status
    job_id = JSON.parse(last_response.body)["data"]["job_id"]

    wait_for_job(job_id)

    get "/jobs/#{job_id}"
    body = JSON.parse(last_response.body)

    assert_equal "failed", body["data"]["status"]
    assert_match(/No adapters configured/i, body["data"]["error"])
  end

  def test_index_rejects_when_too_many_jobs
    # Stub slow API response to keep jobs running
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .to_return do
        sleep 2
        { status: 200, body: { total: 0, businesses: [] }.to_json }
      end

    original_key = ENV["YELP_API_KEY"]
    ENV["YELP_API_KEY"] = "test_key"

    # Fill up the job queue
    3.times do |i|
      post "/index", { location: "city#{i}" }.to_json, { "CONTENT_TYPE" => "application/json" }
      assert_equal 202, last_response.status
    end

    # Give threads a moment to start
    sleep 0.1

    # Fourth job should be rejected
    post "/index", { location: "overflow" }.to_json, { "CONTENT_TYPE" => "application/json" }

    assert_equal 429, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "TOO_MANY_JOBS", body["error"]["code"]
  ensure
    ENV["YELP_API_KEY"] = original_key
  end

  # Jobs endpoint tests
  def test_jobs_list_empty
    get "/jobs"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal [], body["data"]
    assert_equal 0, body["meta"]["count"]
  end

  def test_jobs_list_shows_jobs
    post "/index", { location: "barrie" }.to_json, { "CONTENT_TYPE" => "application/json" }
    post "/index", { location: "toronto" }.to_json, { "CONTENT_TYPE" => "application/json" }

    get "/jobs"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal 2, body["data"].length
    assert_equal 2, body["meta"]["count"]
  end

  def test_job_not_found
    get "/jobs/nonexistent-id"

    assert_equal 404, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal "NOT_FOUND", body["error"]["code"]
  end

  def test_job_status_pending_or_running
    post "/index", { location: "barrie" }.to_json, { "CONTENT_TYPE" => "application/json" }
    job_id = JSON.parse(last_response.body)["data"]["job_id"]

    get "/jobs/#{job_id}"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_includes %w[pending running completed failed], body["data"]["status"]
    assert body["data"]["id"]
    assert body["data"]["created_at"]
  end

  # JSON content type tests
  def test_responses_are_json
    get "/health"

    assert_equal "application/json", last_response.content_type
  end

  private

  def seed_restaurant
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

  def seed_restaurant_with_location
    GrubStars.reset_db!
    db = GrubStars.db

    restaurant_id = db[:restaurants].insert(
      name: "Test Bakery",
      address: "123 Main St",
      latitude: 44.389,
      longitude: -79.690,
      phone: "+15551234567",
      location: "barrie, ontario",
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
  end

  def with_env(env_vars)
    original_values = {}
    env_vars.each do |key, value|
      original_values[key] = ENV[key]
      ENV[key] = value
    end
    yield
  ensure
    original_values.each do |key, value|
      if value.nil?
        ENV.delete(key)
      else
        ENV[key] = value
      end
    end
  end

  def wait_for_job(job_id, timeout: 5)
    deadline = Time.now + timeout
    loop do
      job = GrubStars::API::JobManager.instance.get(job_id)
      break if job.nil? || %i[completed failed].include?(job.status)
      raise "Job timeout" if Time.now > deadline

      sleep 0.05
    end
  end

  def stub_yelp_search
    stub_request(:get, /api\.yelp\.com.*businesses\/search/)
      .to_return(
        status: 200,
        body: {
          total: 1,
          businesses: [yelp_business_data("bakery-barrie", "Test Bakery")]
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_yelp_business(id)
    stub_request(:get, /api\.yelp\.com.*businesses\/#{id}/)
      .to_return(
        status: 200,
        body: yelp_business_data(id, "Test Business").to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def yelp_business_data(id, name)
    {
      "id" => id,
      "name" => name,
      "rating" => 4.5,
      "review_count" => 100,
      "coordinates" => { "latitude" => 44.3894, "longitude" => -79.6903 },
      "location" => {
        "address1" => "123 Main St",
        "city" => "Barrie",
        "state" => "ON",
        "zip_code" => "L4M 1A6",
        "country" => "CA"
      },
      "categories" => [{ "alias" => "bakeries", "title" => "Bakeries" }],
      "photos" => ["https://example.com/photo1.jpg"],
      "phone" => "+17055551234"
    }
  end
end
