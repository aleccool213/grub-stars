# frozen_string_literal: true

require_relative "../test_helper"
require "rack/test"
require_relative "../../lib/api/server"

# Tests for static web UI file serving
class WebUITest < GrubStars::IntegrationTest
  include Rack::Test::Methods

  def app
    GrubStars::API::Server
  end

  # Test that index page is served at root
  def test_root_serves_index_page
    get "/"

    assert last_response.ok?, "Expected 200 OK but got #{last_response.status}"
    assert_equal "text/html;charset=utf-8", last_response.content_type
    assert_includes last_response.body, "<html", "Should contain HTML"
    assert_includes last_response.body, "grub stars", "Should contain app name"
  end

  # Test that search page loads
  def test_search_page_loads
    get "/index.html"

    assert last_response.ok?
    assert_includes last_response.body, "<html"
    assert_includes last_response.body, "search", "Should contain search functionality"
  end

  # Test that details page loads
  def test_details_page_loads
    get "/details.html"

    assert last_response.ok?
    assert_includes last_response.body, "<html"
  end

  # Test that index location page loads
  def test_index_location_page_loads
    get "/index-location.html"

    assert last_response.ok?
    assert_includes last_response.body, "<html"
    assert_includes last_response.body, "location", "Should have location input"
  end

  # Test that JS modules are served with correct content type
  def test_js_modules_served_correctly
    get "/js/api.js"

    assert last_response.ok?
    # Sinatra serves JS files with this content type
    assert_match(/javascript/, last_response.content_type)
  end

  # Test that CSS files are served
  def test_css_files_served
    get "/css/custom.css"

    assert last_response.ok?
    assert_equal "text/css;charset=utf-8", last_response.content_type
  end

  # Test that test page loads
  def test_test_page_loads
    get "/test.html"

    assert last_response.ok?
    assert_includes last_response.body, "<html"
    assert_includes last_response.body, "test", "Should contain test functionality"
  end

  # Test 404 for non-existent files
  def test_nonexistent_file_returns_404
    get "/nonexistent.html"

    assert_equal 404, last_response.status
  end

  # Integration: Test that web UI can access API endpoints
  def test_api_accessible_from_same_origin
    get "/health"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert_equal "ok", body["data"]["status"]
  end

  def test_api_categories_accessible
    get "/categories"

    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert body["data"].is_a?(Array)
  end

  def test_api_search_accessible
    get "/restaurants/search", name: "test"

    # Should return 200 even with no results
    assert last_response.ok?
    body = JSON.parse(last_response.body)
    assert body["data"].is_a?(Array)
  end
end
