# frozen_string_literal: true

require "yaml"
require "fileutils"

module GrubStars
  class Config
    class << self
      attr_writer :config_dir

      def config_dir
        @config_dir ||= ENV.fetch("GRUB_STARS_CONFIG_DIR", File.expand_path("~/.grub_stars"))
      end

      def config_path
        File.join(config_dir, "config.yml")
      end

      def defaults
        {
          "db_path" => File.join(config_dir, "grub_stars.db")
        }
      end

      def load
        ensure_config_dir
        @settings = if File.exist?(config_path)
                      defaults.merge(YAML.load_file(config_path) || {})
                    else
                      defaults.dup
                    end
      rescue Psych::SyntaxError
        # If config file is corrupted, use defaults
        @settings = defaults.dup
      end

      def get(key)
        settings[key.to_s]
      end

      def set(key, value)
        settings[key.to_s] = value
        save
      end

      def db_path
        get("db_path")
      end

      def db_path=(path)
        set("db_path", File.expand_path(path))
      end

      def settings
        @settings ||= load
      end

      def reset!
        @settings = nil
        @config_dir = nil
      end

      def to_h
        settings.dup
      end

      private

      def ensure_config_dir
        FileUtils.mkdir_p(config_dir) unless File.directory?(config_dir)
      end

      def save
        ensure_config_dir
        File.write(config_path, YAML.dump(settings))
      end
    end
  end
end
