# frozen_string_literal: true

require "sentry-ruby"

module GrubStars
  class SentryConfig
    def self.init
      return unless dsn

      Sentry.init do |config|
        config.dsn = dsn
        config.environment = environment
        config.release = release
        config.breadcrumbs_logger = [:sentry_logger, :http_logger]
        config.send_default_pii = false
        config.traces_sample_rate = traces_sample_rate
        config.profiles_sample_rate = profiles_sample_rate if traces_sample_rate > 0
      end
    end

    def self.dsn
      ENV["SENTRY_DSN"]
    end

    def self.environment
      ENV["SENTRY_ENVIRONMENT"] || "development"
    end

    def self.release
      ENV["SENTRY_RELEASE"] || `git rev-parse --short HEAD`.strip rescue "unknown"
    end

    def self.traces_sample_rate
      (ENV["SENTRY_TRACES_SAMPLE_RATE"] || "0.1").to_f
    end

    def self.profiles_sample_rate
      (ENV["SENTRY_PROFILES_SAMPLE_RATE"] || "0.1").to_f
    end
  end
end
