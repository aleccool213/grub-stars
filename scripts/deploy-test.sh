#!/bin/bash
# Deploy to test environment on Fly.io
# Uses mock API server - no real API keys needed
#
# Usage: ./scripts/deploy-test.sh [--skip-sentry]

set -e

# Parse arguments
SKIP_SENTRY=false
for arg in "$@"; do
  case $arg in
    --skip-sentry)
      SKIP_SENTRY=true
      shift
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: ./scripts/deploy-test.sh [--skip-sentry]"
      exit 1
      ;;
  esac
done

echo "=== Deploying grub-stars TEST environment ==="
echo ""

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
  echo "ERROR: fly CLI not found. Install it:"
  echo "  curl -L https://fly.io/install.sh | sh"
  exit 1
fi

# Check if logged in
if ! fly auth whoami &> /dev/null; then
  echo "Not logged in to Fly.io. Running 'fly auth login'..."
  fly auth login
fi

# Create app if it doesn't exist
if ! fly apps list | grep -q "grub-stars-test"; then
  echo "Creating grub-stars-test app..."
  fly apps create grub-stars-test
fi

# Create volume if it doesn't exist
if ! fly volumes list --config fly.test.toml 2>/dev/null | grep -q "grub_stars_test_data"; then
  echo "Creating persistent volume..."
  fly volumes create grub_stars_test_data --size 1 --region ord --config fly.test.toml
fi

# Deploy
echo "Deploying..."
fly deploy --config fly.test.toml

echo ""
if [ "$SKIP_SENTRY" = true ]; then
  echo "Skipping Sentry release (--skip-sentry flag set)"
else
  echo "Creating Sentry release..."
  if [ -z "$SENTRY_AUTH_TOKEN" ]; then
    echo "ERROR: SENTRY_AUTH_TOKEN environment variable is not set"
    echo ""
    echo "Sentry release creation is required for deployments."
    echo "To set up Sentry:"
    echo "  1. Get your token from: https://sentry.io/settings/account/api/auth-tokens/"
    echo "  2. Export it: export SENTRY_AUTH_TOKEN=your_token_here"
    echo "  3. Or add it to your .env file"
    echo ""
    echo "To skip Sentry release (not recommended):"
    echo "  ./scripts/deploy-test.sh --skip-sentry"
    exit 1
  fi
  SENTRY_ENVIRONMENT=test ./scripts/sentry-release.sh
fi

echo ""
echo "=== Deployment complete ==="
echo "App URL: https://grub-stars-test.fly.dev"
echo ""
echo "Useful commands:"
echo "  fly logs --config fly.test.toml        # View logs"
echo "  fly ssh console --config fly.test.toml # SSH into container"
echo "  fly status --config fly.test.toml      # Check status"
