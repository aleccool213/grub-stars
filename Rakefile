# frozen_string_literal: true

# Ruby 4.0 compatibility - must load Logger before Sentry
# This ensures Logger is available when Sentry gem is loaded during tests
require "logger"

require "rake/testtask"

Rake::TestTask.new(:test) do |t|
  t.libs << "tests"
  t.test_files = FileList["tests/**/*_test.rb"]
  t.warning = false
end

namespace :test do
  Rake::TestTask.new(:integration) do |t|
    t.libs << "tests"
    t.test_files = FileList["tests/integration/**/*_test.rb"]
    t.warning = false
  end
end

task default: :test
