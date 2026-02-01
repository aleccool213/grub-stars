#!/bin/bash
# Sentry Release Management Script
# Usage: ./scripts/sentry-release.sh [version]

set -e

# Get version from argument or generate from git
VERSION=${1:-$(git rev-parse --short HEAD)}
ENVIRONMENT=${SENTRY_ENVIRONMENT:-production}

echo "Creating Sentry release: $VERSION"

# Create release
sentry-cli releases new "$VERSION"

# Associate commits
sentry-cli releases set-commits "$VERSION" --auto

# Deploy release
sentry-cli releases deploys "$VERSION" new -e "$ENVIRONMENT"

echo "Sentry release $VERSION created and deployed to $ENVIRONMENT"
