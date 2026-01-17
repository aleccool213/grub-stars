#!/bin/bash
# Start script for test environment
# Runs mock server in background, then starts main API

set -e

echo "Starting mock API server on port 4567..."
cd /app
bundle _2.5.23_ exec ruby dev/mock_server.rb -p 4567 -o 0.0.0.0 &
MOCK_PID=$!

# Wait for mock server to be ready
echo "Waiting for mock server to start..."
sleep 3

# Verify mock server is running
if ! kill -0 $MOCK_PID 2>/dev/null; then
  echo "ERROR: Mock server failed to start"
  exit 1
fi

echo "Mock server started (PID: $MOCK_PID)"

echo "Starting main API server on port 9292..."
exec bundle _2.5.23_ exec rackup -o 0.0.0.0 -p 9292
