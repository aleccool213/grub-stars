# frozen_string_literal: true

require_relative "../test_helper"
require "tmpdir"

class ConfigTest < Minitest::Test
  def setup
    # Reset any existing state and use a temporary directory for tests
    GrubStars::Config.reset!
    @test_dir = Dir.mktmpdir("grub_stars_test")
    GrubStars::Config.config_dir = @test_dir
  end

  def teardown
    GrubStars::Config.reset!
    FileUtils.rm_rf(@test_dir) if @test_dir && File.directory?(@test_dir)
  end

  def test_default_db_path
    expected = File.join(@test_dir, "grub_stars.db")
    assert_equal expected, GrubStars::Config.db_path
  end

  def test_get_returns_default_when_not_set
    assert_equal File.join(@test_dir, "grub_stars.db"), GrubStars::Config.get("db_path")
  end

  def test_set_updates_value
    GrubStars::Config.set("db_path", "/custom/path/test.db")
    assert_equal "/custom/path/test.db", GrubStars::Config.get("db_path")
  end

  def test_db_path_setter_expands_path
    GrubStars::Config.db_path = "~/my_database.db"
    assert_equal File.expand_path("~/my_database.db"), GrubStars::Config.db_path
  end

  def test_config_persists_to_file
    GrubStars::Config.set("db_path", "/persisted/path.db")

    # Reset settings but keep same config_dir
    GrubStars::Config.instance_variable_set(:@settings, nil)

    assert_equal "/persisted/path.db", GrubStars::Config.db_path
  end

  def test_creates_config_directory
    FileUtils.rm_rf(@test_dir)
    refute File.directory?(@test_dir)

    GrubStars::Config.load

    assert File.directory?(@test_dir)
  end

  def test_to_h_returns_all_settings
    settings = GrubStars::Config.to_h
    assert_kind_of Hash, settings
    assert settings.key?("db_path")
  end

  def test_to_h_returns_copy
    settings = GrubStars::Config.to_h
    settings["db_path"] = "/modified/path.db"

    refute_equal "/modified/path.db", GrubStars::Config.db_path
  end

  def test_handles_empty_config_file
    FileUtils.mkdir_p(@test_dir)
    File.write(GrubStars::Config.config_path, "")
    GrubStars::Config.instance_variable_set(:@settings, nil)

    # Should fall back to defaults
    assert_equal File.join(@test_dir, "grub_stars.db"), GrubStars::Config.db_path
  end

  def test_handles_corrupted_config_file
    FileUtils.mkdir_p(@test_dir)
    File.write(GrubStars::Config.config_path, "not: valid: yaml: {{{{")
    GrubStars::Config.instance_variable_set(:@settings, nil)

    # Should gracefully fall back to defaults
    assert_equal File.join(@test_dir, "grub_stars.db"), GrubStars::Config.db_path
  end

  def test_config_path_uses_config_dir
    assert_equal File.join(@test_dir, "config.yml"), GrubStars::Config.config_path
  end

  def test_defaults_uses_config_dir
    defaults = GrubStars::Config.defaults
    assert_equal File.join(@test_dir, "grub_stars.db"), defaults["db_path"]
  end
end
