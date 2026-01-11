#!/usr/bin/env ruby
# frozen_string_literal: true

# Quick verification script for TripAdvisor adapter
# This doesn't require test dependencies, just checks the adapter can be instantiated

require_relative "../lib/infrastructure/adapters/base"
require_relative "../lib/infrastructure/adapters/tripadvisor"

puts "Verifying TripAdvisor Adapter..."
puts ""

# Test 1: Can instantiate adapter
puts "1. Instantiating adapter..."
adapter = GrubStars::Adapters::TripAdvisor.new(api_key: "test_key")
puts "   ✓ Adapter created"

# Test 2: Source name
puts "2. Checking source name..."
if adapter.source_name == "tripadvisor"
  puts "   ✓ Source name is 'tripadvisor'"
else
  puts "   ✗ Source name is '#{adapter.source_name}' (expected 'tripadvisor')"
  exit 1
end

# Test 3: Configuration check
puts "3. Checking configuration..."
if adapter.configured?
  puts "   ✓ Adapter is configured with API key"
else
  puts "   ✗ Adapter is not configured"
  exit 1
end

# Test 4: Unconfigured adapter
puts "4. Checking unconfigured adapter..."
unconfigured = GrubStars::Adapters::TripAdvisor.new(api_key: nil)
if !unconfigured.configured?
  puts "   ✓ Adapter correctly reports as unconfigured"
else
  puts "   ✗ Adapter should not be configured without API key"
  exit 1
end

# Test 5: Check methods exist
puts "5. Checking required methods exist..."
required_methods = [:search_businesses, :get_business, :get_reviews, :search_all_businesses, :get_photos]
missing_methods = required_methods.reject { |m| adapter.respond_to?(m) }
if missing_methods.empty?
  puts "   ✓ All required methods present"
else
  puts "   ✗ Missing methods: #{missing_methods.join(', ')}"
  exit 1
end

puts ""
puts "All verification checks passed! ✓"
puts ""
puts "To run full tests with dependencies:"
puts "  bundle install"
puts "  bundle exec rake test"
