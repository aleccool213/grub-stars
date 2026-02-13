#!/bin/bash
# Sentry Release Management Script
# Usage: ./scripts/sentry-release.sh [version]

set -e

# Validate required environment variables
if [ -z "$SENTRY_AUTH_TOKEN" ]; then
  echo "ERROR: SENTRY_AUTH_TOKEN environment variable is not set"
  echo ""
  echo "To create a Sentry release, you need to set SENTRY_AUTH_TOKEN:"
  echo "  export SENTRY_AUTH_TOKEN=your_token_here"
  echo ""
  echo "Get your token from: https://sentry.io/settings/account/api/auth-tokens/"
  echo ""
  echo "Or copy .env.example to .env and fill in your token:"
  echo "  cp .env.example .env"
  exit 1
fi

# Get version from argument or generate from git
VERSION=${1:-$(git rev-parse --short HEAD)}
ENVIRONMENT=${SENTRY_ENVIRONMENT:-production}

echo "Creating Sentry release: $VERSION"

# Create release
sentry-cli releases new "$VERSION"

# Associate commits
sentry-cli releases set-commits "$VERSION" --auto --ignore-missing

# Deploy release
sentry-cli releases deploys "$VERSION" new -e "$ENVIRONMENT"

echo "Sentry release $VERSION created and deployed to $ENVIRONMENT"
