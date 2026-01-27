# frozen_string_literal: true

require_relative "../test_helper"
require "rack/test"
require_relative "../../lib/api/server"

class AuthTest < GrubStars::IntegrationTest
  include Rack::Test::Methods

  def app
    GrubStars::API::Server
  end

  def setup
    super
    @original_db_path = GrubStars::Config.get("db_path")
    GrubStars::Config.set("db_path", GrubStars::TestHelper::TEST_DB_PATH)
    GrubStars.reset_db!
  end

  def teardown
    if @original_db_path
      GrubStars::Config.set("db_path", @original_db_path)
    end
    GrubStars.reset_db!
    super
  end

  # Auth status endpoint tests
  def test_auth_status_when_auth_disabled
    without_auth do
      get "/auth/status"

      assert last_response.ok?
      body = JSON.parse(last_response.body)
      assert_equal false, body["data"]["auth_required"]
      assert_equal true, body["data"]["authenticated"]
    end
  end

  def test_auth_status_when_auth_enabled_not_logged_in
    with_auth("secret123") do
      get "/auth/status"

      assert last_response.ok?
      body = JSON.parse(last_response.body)
      assert_equal true, body["data"]["auth_required"]
      assert_equal false, body["data"]["authenticated"]
    end
  end

  # Login endpoint tests
  def test_login_succeeds_with_correct_password
    with_auth("secret123") do
      post "/login", { password: "secret123" }.to_json, json_headers

      assert last_response.ok?
      body = JSON.parse(last_response.body)
      assert_equal true, body["data"]["success"]
    end
  end

  def test_login_fails_with_wrong_password
    with_auth("secret123") do
      post "/login", { password: "wrongpassword" }.to_json, json_headers

      assert_equal 401, last_response.status
      body = JSON.parse(last_response.body)
      assert_equal "INVALID_PASSWORD", body["error"]["code"]
    end
  end

  def test_login_succeeds_when_auth_disabled
    without_auth do
      post "/login", { password: "anything" }.to_json, json_headers

      assert last_response.ok?
      body = JSON.parse(last_response.body)
      assert_equal true, body["data"]["success"]
    end
  end

  # Session persistence tests
  def test_login_creates_session
    with_auth("secret123") do
      # Login
      post "/login", { password: "secret123" }.to_json, json_headers
      assert last_response.ok?

      # Check auth status - should be authenticated now
      get "/auth/status"
      body = JSON.parse(last_response.body)
      assert_equal true, body["data"]["authenticated"]
    end
  end

  # Logout endpoint tests
  def test_logout_clears_session
    with_auth("secret123") do
      # Login first
      post "/login", { password: "secret123" }.to_json, json_headers
      assert last_response.ok?

      # Logout
      post "/logout"
      assert last_response.ok?
      body = JSON.parse(last_response.body)
      assert_equal true, body["data"]["success"]

      # Check auth status - should not be authenticated
      get "/auth/status"
      body = JSON.parse(last_response.body)
      assert_equal false, body["data"]["authenticated"]
    end
  end

  # Protected endpoint tests
  def test_index_endpoint_protected_when_auth_enabled
    with_auth("secret123") do
      post "/index", { location: "barrie" }.to_json, json_headers

      assert_equal 401, last_response.status
      body = JSON.parse(last_response.body)
      assert_equal "UNAUTHORIZED", body["error"]["code"]
    end
  end

  def test_index_endpoint_accessible_after_login
    with_auth("secret123") do
      # Login first
      post "/login", { password: "secret123" }.to_json, json_headers
      assert last_response.ok?

      # Try to access /index - should get past auth (will fail with NO_ADAPTERS, not UNAUTHORIZED)
      post "/index", { location: "barrie" }.to_json, json_headers

      # We expect 503 NO_ADAPTERS because no API keys are configured
      # The important thing is we didn't get 401 UNAUTHORIZED
      assert_equal 503, last_response.status
      body = JSON.parse(last_response.body)
      assert_equal "NO_ADAPTERS", body["error"]["code"]
    end
  end

  def test_index_endpoint_not_protected_when_auth_disabled
    without_auth do
      post "/index", { location: "barrie" }.to_json, json_headers

      # Should get NO_ADAPTERS, not UNAUTHORIZED
      assert_equal 503, last_response.status
      body = JSON.parse(last_response.body)
      assert_equal "NO_ADAPTERS", body["error"]["code"]
    end
  end

  # Read-only endpoints should remain public
  def test_public_endpoints_accessible_without_auth
    with_auth("secret123") do
      # These should all work without authentication
      get "/health"
      assert last_response.ok?

      get "/categories"
      assert last_response.ok?

      get "/locations"
      assert last_response.ok?

      get "/restaurants/search", name: "test"
      assert last_response.ok?
    end
  end

  private

  def json_headers
    { "CONTENT_TYPE" => "application/json" }
  end

  def with_auth(password)
    # We need to reload the server class to pick up the new constant
    # Since AUTH_PASSWORD is set at class load time, we use a workaround
    original_password = ENV["GRUB_STARS_AUTH_PASSWORD"]
    ENV["GRUB_STARS_AUTH_PASSWORD"] = password

    # Force the constant to be re-evaluated by using instance methods
    GrubStars::API::Server.class_eval do
      remove_const(:AUTH_PASSWORD) if const_defined?(:AUTH_PASSWORD)
      const_set(:AUTH_PASSWORD, ENV["GRUB_STARS_AUTH_PASSWORD"])
    end

    yield
  ensure
    if original_password.nil?
      ENV.delete("GRUB_STARS_AUTH_PASSWORD")
    else
      ENV["GRUB_STARS_AUTH_PASSWORD"] = original_password
    end

    GrubStars::API::Server.class_eval do
      remove_const(:AUTH_PASSWORD) if const_defined?(:AUTH_PASSWORD)
      const_set(:AUTH_PASSWORD, ENV["GRUB_STARS_AUTH_PASSWORD"])
    end
  end

  def without_auth
    with_auth(nil) do
      yield
    end
  end
end
