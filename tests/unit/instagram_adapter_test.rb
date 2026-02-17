# frozen_string_literal: true

require_relative "../test_helper"
require "webmock/minitest"

class InstagramAdapterTest < Minitest::Test
  BASE_URL = "https://graph.facebook.com/v21.0"
  USER_ID = "17841400987654321"
  ACCESS_TOKEN = "test_access_token"

  def setup
    @adapter = GrubStars::Adapters::Instagram.new(
      access_token: ACCESS_TOKEN,
      user_id: USER_ID
    )
    WebMock.disable_net_connect!
  end

  def teardown
    WebMock.allow_net_connect!
  end

  # --- source_name / configured? ---

  def test_source_name
    assert_equal "instagram", @adapter.source_name
  end

  def test_configured_with_token_and_user_id
    assert @adapter.configured?
  end

  def test_not_configured_without_access_token
    adapter = GrubStars::Adapters::Instagram.new(access_token: nil, user_id: USER_ID)
    refute adapter.configured?
  end

  def test_not_configured_with_empty_access_token
    adapter = GrubStars::Adapters::Instagram.new(access_token: "", user_id: USER_ID)
    refute adapter.configured?
  end

  def test_not_configured_without_user_id
    adapter = GrubStars::Adapters::Instagram.new(access_token: ACCESS_TOKEN, user_id: nil)
    refute adapter.configured?
  end

  def test_not_configured_with_empty_user_id
    adapter = GrubStars::Adapters::Instagram.new(access_token: ACCESS_TOKEN, user_id: "")
    refute adapter.configured?
  end

  # --- Rate limiting ---

  def test_has_5000_request_limit
    assert_equal 5000, GrubStars::Adapters::Instagram::REQUEST_LIMIT
  end

  # --- Configuration errors ---

  def test_search_photos_raises_configuration_error_when_not_configured
    adapter = GrubStars::Adapters::Instagram.new(access_token: nil, user_id: nil)

    assert_raises(GrubStars::Adapters::Base::ConfigurationError) do
      adapter.search_photos(restaurant_name: "Test", location: "Barrie")
    end
  end

  def test_search_by_hashtag_raises_configuration_error_when_not_configured
    adapter = GrubStars::Adapters::Instagram.new(access_token: nil, user_id: nil)

    assert_raises(GrubStars::Adapters::Base::ConfigurationError) do
      adapter.search_by_hashtag(hashtag: "test")
    end
  end

  def test_get_business_media_raises_configuration_error_when_not_configured
    adapter = GrubStars::Adapters::Instagram.new(access_token: nil, user_id: nil)

    assert_raises(GrubStars::Adapters::Base::ConfigurationError) do
      adapter.get_business_media(username: "test")
    end
  end

  # --- search_by_hashtag ---

  def test_search_by_hashtag_returns_photos
    stub_hashtag_search("casacantina", "17841563456789012")
    stub_hashtag_recent_media("17841563456789012")

    results = @adapter.search_by_hashtag(hashtag: "casacantina")

    assert_equal 4, results.length  # 5 items minus 1 VIDEO
    assert_equal "https://scontent.cdninstagram.com/v/t51.2885-15/photo1.jpg", results[0][:url]
    assert_equal "Best tacos in Barrie! #casacantina #barriefood", results[0][:caption]
    assert_equal "2026-01-15T18:30:00+0000", results[0][:posted_at]
    assert_equal "foodie_barrie", results[0][:author]
    assert_equal "17895637284950123", results[0][:external_id]
    assert_equal "https://www.instagram.com/p/ABC123/", results[0][:permalink]
  end

  def test_search_by_hashtag_skips_video_media
    stub_hashtag_search("casacantina", "17841563456789012")
    stub_hashtag_recent_media("17841563456789012")

    results = @adapter.search_by_hashtag(hashtag: "casacantina")

    media_ids = results.map { |r| r[:external_id] }
    refute_includes media_ids, "17895637284950126"  # The VIDEO item
  end

  def test_search_by_hashtag_includes_carousel_albums
    stub_hashtag_search("casacantina", "17841563456789012")
    stub_hashtag_recent_media("17841563456789012")

    results = @adapter.search_by_hashtag(hashtag: "casacantina")

    media_ids = results.map { |r| r[:external_id] }
    assert_includes media_ids, "17895637284950125"  # The CAROUSEL_ALBUM item
  end

  def test_search_by_hashtag_returns_empty_when_hashtag_not_found
    stub_request(:get, /#{BASE_URL}\/ig_hashtag_search/)
      .to_return(
        status: 200,
        body: { data: [] }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    results = @adapter.search_by_hashtag(hashtag: "nonexistenthashtag")

    assert_equal [], results
  end

  # --- search_photos ---

  def test_search_photos_derives_hashtag_from_restaurant_name
    stub_hashtag_search("casacantina", "17841563456789012")
    stub_hashtag_recent_media("17841563456789012")

    results = @adapter.search_photos(
      restaurant_name: "Casa Cantina",
      location: "barrie, ontario"
    )

    assert_equal 4, results.length
  end

  def test_search_photos_strips_special_characters_for_hashtag
    stub_hashtag_search("joespizzapasta", "17841563456789099")
    stub_request(:get, /#{BASE_URL}\/17841563456789099\/recent_media/)
      .to_return(
        status: 200,
        body: { data: [] }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    results = @adapter.search_photos(
      restaurant_name: "Joe's Pizza & Pasta",
      location: "toronto"
    )

    assert_equal [], results
  end

  # --- get_business_media ---

  def test_get_business_media_returns_photos
    stub_business_discovery("casacantina_barrie")

    results = @adapter.get_business_media(username: "casacantina_barrie")

    # 4 items: 2 IMAGE + 1 CAROUSEL_ALBUM = 3 (VIDEO skipped)
    assert_equal 3, results.length

    assert_equal "https://scontent.cdninstagram.com/v/t51.2885-15/biz_photo1.jpg", results[0][:url]
    assert_match(/New winter menu/, results[0][:caption])
    assert_equal "casacantina_barrie", results[0][:author]
    assert_equal "18012345678901234", results[0][:external_id]
  end

  def test_get_business_media_skips_videos
    stub_business_discovery("casacantina_barrie")

    results = @adapter.get_business_media(username: "casacantina_barrie")

    media_ids = results.map { |r| r[:external_id] }
    refute_includes media_ids, "18012345678901236"  # The VIDEO item
  end

  def test_get_business_media_returns_empty_when_no_media
    stub_request(:get, /#{BASE_URL}\/#{USER_ID}/)
      .with(query: hash_including(username: "empty_restaurant"))
      .to_return(
        status: 200,
        body: {
          business_discovery: {
            id: "123",
            username: "empty_restaurant",
            media: { data: [] }
          },
          id: USER_ID
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    results = @adapter.get_business_media(username: "empty_restaurant")

    assert_equal [], results
  end

  # --- API error handling ---

  def test_raises_api_error_on_hashtag_search_failure
    stub_request(:get, /#{BASE_URL}\/ig_hashtag_search/)
      .to_return(
        status: 400,
        body: {
          error: {
            message: "Invalid hashtag",
            type: "OAuthException",
            code: 100
          }
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    error = assert_raises(GrubStars::Adapters::Base::APIError) do
      @adapter.search_by_hashtag(hashtag: "bad hashtag")
    end

    assert_equal 400, error.status
    assert_match(/Invalid hashtag/, error.message)
  end

  def test_raises_api_error_on_business_discovery_failure
    stub_request(:get, /#{BASE_URL}\/#{USER_ID}/)
      .to_return(
        status: 400,
        body: {
          error: {
            message: "User not found or is not a business account",
            type: "OAuthException",
            code: 100
          }
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    error = assert_raises(GrubStars::Adapters::Base::APIError) do
      @adapter.get_business_media(username: "personal_account")
    end

    assert_equal 400, error.status
    assert_match(/not a business account/, error.message)
  end

  # --- Base contract methods raise NotImplementedError ---

  def test_search_businesses_raises_not_implemented
    assert_raises(GrubStars::Adapters::Base::NotImplementedError) do
      @adapter.search_businesses(location: "barrie")
    end
  end

  def test_get_business_raises_not_implemented
    assert_raises(GrubStars::Adapters::Base::NotImplementedError) do
      @adapter.get_business("some-id")
    end
  end

  def test_get_reviews_raises_not_implemented
    assert_raises(GrubStars::Adapters::Base::NotImplementedError) do
      @adapter.get_reviews("some-id")
    end
  end

  private

  def stub_hashtag_search(hashtag, hashtag_id)
    stub_request(:get, /#{BASE_URL}\/ig_hashtag_search/)
      .with(query: hash_including(q: hashtag, user_id: USER_ID))
      .to_return(
        status: 200,
        body: { data: [{ id: hashtag_id }] }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_hashtag_recent_media(hashtag_id)
    fixture = File.read(File.expand_path("../../dev/fixtures/instagram/hashtag_recent_media.json", __dir__))

    stub_request(:get, /#{BASE_URL}\/#{hashtag_id}\/recent_media/)
      .with(query: hash_including(user_id: USER_ID))
      .to_return(
        status: 200,
        body: fixture,
        headers: { "Content-Type" => "application/json" }
      )
  end

  def stub_business_discovery(username)
    fixture = File.read(File.expand_path("../../dev/fixtures/instagram/business_discovery.json", __dir__))

    stub_request(:get, /#{BASE_URL}\/#{USER_ID}/)
      .with(query: hash_including(username: username))
      .to_return(
        status: 200,
        body: fixture,
        headers: { "Content-Type" => "application/json" }
      )
  end
end
