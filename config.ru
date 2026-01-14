# frozen_string_literal: true

require "dotenv"
Dotenv.load

require_relative "lib/api/server"

run GrubStars::API::Server
