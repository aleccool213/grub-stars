# frozen_string_literal: true

source "https://rubygems.org"

# Ruby 4.0 compatibility - these were moved out of stdlib
gem "ostruct"

# Logger MUST be loaded before Sentry due to Ruby 4.0 bundled gems behavior
gem "logger", require: true

gem "thor", "~> 1.4"
gem "sequel", "~> 5.99"
gem "sqlite3", "~> 2.0"
gem "faraday", "~> 2.7"
gem "dotenv", "~> 2.8"
gem "pastel", "~> 0.8"
gem "tty-spinner", "~> 0.9"
gem "tty-prompt", "~> 0.23"
gem "sinatra", "~> 3.0"
gem "rackup", "~> 1.0"
gem "puma", "~> 6.0"
gem "sentry-ruby", "~> 5.22"

group :development do
  gem "rubocop", "~> 1.69"
  gem "webrick", "~> 1.8"
end

group :test do
  gem "minitest", "~> 5.25"
  gem "minitest-mock", "~> 5.27"
  gem "rake", "~> 13.2"
  gem "webmock", "~> 3.23"
  gem "rack-test", "~> 2.1"
end
