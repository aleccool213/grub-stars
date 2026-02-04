#!/bin/bash
# End-to-end test for reviews and descriptions feature
# This script starts the mock server and main server, then runs Playwright tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Use a test database
export GRUB_STARS_DB_PATH="/tmp/grub_stars_e2e_test.db"

# Use mock server URLs
export YELP_API_KEY="mock_api_key"
export YELP_API_BASE_URL="http://localhost:4567"
export GOOGLE_API_KEY="mock_api_key"
export GOOGLE_API_BASE_URL="http://localhost:4567"
export TRIPADVISOR_API_KEY="mock_api_key"
export TRIPADVISOR_API_BASE_URL="http://localhost:4567/api/v1"

cd "$PROJECT_DIR"

echo "=== Reviews E2E Test ==="
echo ""

# Cleanup
echo "Cleaning up..."
rm -f "$GRUB_STARS_DB_PATH"
pkill -f "mock_server.rb" 2>/dev/null || true
pkill -f "rackup" 2>/dev/null || true
sleep 1

# Start mock server
echo "Starting mock server on port 4567..."
ruby dev/mock_server.rb > /tmp/mock_server.log 2>&1 &
MOCK_PID=$!
sleep 2

if ! kill -0 $MOCK_PID 2>/dev/null; then
  echo "ERROR: Mock server failed to start"
  cat /tmp/mock_server.log
  exit 1
fi

# Start main server
echo "Starting main server on port 9292..."
bundle _2.5.23_ exec rackup -p 9292 > /tmp/main_server.log 2>&1 &
MAIN_PID=$!
sleep 3

if ! kill -0 $MAIN_PID 2>/dev/null; then
  echo "ERROR: Main server failed to start"
  cat /tmp/main_server.log
  kill $MOCK_PID 2>/dev/null
  exit 1
fi

echo "Servers started successfully"
echo ""

# Run Playwright scenario
echo "Running Playwright scenario..."
node scripts/screenshot.js --scenario scripts/scenarios/reviews-e2e.json

# Show results
echo ""
echo "Screenshots saved to screenshots/ directory:"
ls -la screenshots/reviews-and-descriptions-*.png 2>/dev/null || echo "  (no screenshots found)"

# Cleanup
echo ""
echo "Cleaning up..."
kill $MAIN_PID 2>/dev/null || true
kill $MOCK_PID 2>/dev/null || true

echo ""
echo "=== Test Complete ==="
