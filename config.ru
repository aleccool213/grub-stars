# frozen_string_literal: true

# Ruby 4.0 compatibility - must load Logger before Sentry
require "logger"

require "bundler/setup"
require "dotenv"
Dotenv.load

require_relative "lib/api/server"

run GrubStars::API::Server
