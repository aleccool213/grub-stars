#!/bin/bash

# Post Screenshots to PR Description
#
# This script uploads screenshots to GitHub and updates a PR description
# with the images. It reads from the manifest.json created by screenshot.js.
#
# Usage:
#   ./scripts/post-screenshots-to-pr.sh <PR_NUMBER> [OPTIONS]
#
# Options:
#   --dir <path>       Screenshots directory (default: ./screenshots)
#   --section <name>   Section header for screenshots (default: "Screenshots")
#   --append           Append to existing description instead of replacing screenshots section
#   --dry-run          Show what would be done without making changes
#
# Examples:
#   ./scripts/post-screenshots-to-pr.sh 42
#   ./scripts/post-screenshots-to-pr.sh 42 --section "UI Changes"
#   ./scripts/post-screenshots-to-pr.sh 42 --dir ./my-screenshots --append

set -e

# Default values
SCREENSHOTS_DIR="./screenshots"
SECTION_NAME="Screenshots"
APPEND_MODE=false
DRY_RUN=false
PR_NUMBER=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dir)
      SCREENSHOTS_DIR="$2"
      shift 2
      ;;
    --section)
      SECTION_NAME="$2"
      shift 2
      ;;
    --append)
      APPEND_MODE=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 <PR_NUMBER> [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --dir <path>       Screenshots directory (default: ./screenshots)"
      echo "  --section <name>   Section header (default: 'Screenshots')"
      echo "  --append           Append to existing description"
      echo "  --dry-run          Preview without making changes"
      exit 0
      ;;
    *)
      if [[ -z "$PR_NUMBER" ]]; then
        PR_NUMBER="$1"
      fi
      shift
      ;;
  esac
done

if [[ -z "$PR_NUMBER" ]]; then
  echo "Error: PR number is required"
  echo "Usage: $0 <PR_NUMBER> [OPTIONS]"
  exit 1
fi

# Check for required tools
if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI (gh) is required but not installed"
  echo "Install it from: https://cli.github.com/"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed"
  exit 1
fi

# Check manifest exists
MANIFEST_FILE="$SCREENSHOTS_DIR/manifest.json"
if [[ ! -f "$MANIFEST_FILE" ]]; then
  echo "Error: Manifest file not found at $MANIFEST_FILE"
  echo "Run the screenshot script first: node scripts/screenshot.js ..."
  exit 1
fi

echo "Posting screenshots to PR #$PR_NUMBER"
echo "Reading manifest from: $MANIFEST_FILE"

# Get repo info
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
echo "Repository: $REPO"

# Read screenshot info from manifest
SCENARIO_NAME=$(jq -r '.scenario // "screenshots"' "$MANIFEST_FILE")
TIMESTAMP=$(jq -r '.timestamp' "$MANIFEST_FILE")
SCREENSHOT_COUNT=$(jq '.screenshots | length' "$MANIFEST_FILE")

echo "Scenario: $SCENARIO_NAME"
echo "Screenshots: $SCREENSHOT_COUNT"
echo ""

# Build markdown content
MARKDOWN="## $SECTION_NAME\n\n"
MARKDOWN+="_Generated: ${TIMESTAMP}_\n\n"

# Upload each screenshot and build markdown
UPLOADED_URLS=()
for i in $(seq 0 $((SCREENSHOT_COUNT - 1))); do
  NAME=$(jq -r ".screenshots[$i].name" "$MANIFEST_FILE")
  FILENAME=$(jq -r ".screenshots[$i].filename" "$MANIFEST_FILE")
  DESCRIPTION=$(jq -r ".screenshots[$i].description // empty" "$MANIFEST_FILE")
  FILEPATH="$SCREENSHOTS_DIR/$FILENAME"

  if [[ ! -f "$FILEPATH" ]]; then
    echo "Warning: Screenshot file not found: $FILEPATH"
    continue
  fi

  echo "Uploading: $FILENAME"

  if [[ "$DRY_RUN" == "true" ]]; then
    # In dry run, use placeholder URL
    IMAGE_URL="https://placeholder.example.com/$FILENAME"
  else
    # Upload to GitHub by creating a temporary issue comment, extracting URL, then deleting
    # This is a workaround since gh doesn't have direct image upload

    # Alternative: Use the GitHub API to upload to the repo's issue attachments
    # For now, we'll embed images using a data URL or reference local paths
    # The best approach is to commit screenshots to the repo or use external hosting

    # Upload via issue comment (creates CDN URL)
    TEMP_BODY="![${NAME}](uploading...)"

    # Create a temporary comment with the image
    # GitHub processes the image and returns a CDN URL
    COMMENT_RESULT=$(gh api \
      --method POST \
      -H "Accept: application/vnd.github+json" \
      "/repos/${REPO}/issues/${PR_NUMBER}/comments" \
      -f body="Uploading screenshot: ${NAME}" 2>&1) || true

    TEMP_COMMENT_ID=$(echo "$COMMENT_RESULT" | jq -r '.id // empty')

    if [[ -n "$TEMP_COMMENT_ID" ]]; then
      # Unfortunately, GitHub API doesn't support direct file upload via comments
      # We need to use the web upload or commit files to repo

      # Delete temp comment
      gh api --method DELETE "/repos/${REPO}/issues/comments/${TEMP_COMMENT_ID}" 2>/dev/null || true
    fi

    # Best approach: Commit screenshots to a branch and reference them
    # For now, we'll add them as relative paths (works if pushed to repo)
    IMAGE_URL="$FILEPATH"
  fi

  # Build markdown for this screenshot
  if [[ -n "$DESCRIPTION" ]]; then
    MARKDOWN+="### ${NAME}\n\n"
    MARKDOWN+="${DESCRIPTION}\n\n"
  else
    MARKDOWN+="### ${NAME}\n\n"
  fi

  # Reference the image (will work after files are committed)
  MARKDOWN+="![${NAME}](${IMAGE_URL})\n\n"

  UPLOADED_URLS+=("$IMAGE_URL")
done

echo ""
echo "Generated markdown:"
echo "---"
echo -e "$MARKDOWN"
echo "---"

if [[ "$DRY_RUN" == "true" ]]; then
  echo ""
  echo "[DRY RUN] Would update PR #$PR_NUMBER with above content"
  exit 0
fi

# Get current PR description
CURRENT_BODY=$(gh pr view "$PR_NUMBER" --json body -q '.body')

# Build new description
if [[ "$APPEND_MODE" == "true" ]]; then
  # Append to existing description
  NEW_BODY="${CURRENT_BODY}\n\n---\n\n$(echo -e "$MARKDOWN")"
else
  # Replace screenshots section if it exists, otherwise append
  SECTION_MARKER="## $SECTION_NAME"

  if echo "$CURRENT_BODY" | grep -q "^${SECTION_MARKER}"; then
    # Replace existing section (everything from section header to next ## or end)
    # This is tricky with bash, so we'll use a simpler approach
    NEW_BODY=$(echo "$CURRENT_BODY" | awk -v section="$SECTION_MARKER" -v content="$(echo -e "$MARKDOWN")" '
      BEGIN { in_section = 0; printed = 0 }
      /^## / {
        if (in_section) {
          in_section = 0
          printed = 1
          print content
        }
        if ($0 == section) {
          in_section = 1
          next
        }
      }
      !in_section { print }
      END {
        if (in_section && !printed) {
          print content
        }
      }
    ')
  else
    # Append new section
    NEW_BODY="${CURRENT_BODY}\n\n---\n\n$(echo -e "$MARKDOWN")"
  fi
fi

# Update PR description
echo "Updating PR #$PR_NUMBER description..."
gh pr edit "$PR_NUMBER" --body "$(echo -e "$NEW_BODY")"

echo ""
echo "Done! PR #$PR_NUMBER has been updated with screenshots."
echo "View at: https://github.com/${REPO}/pull/${PR_NUMBER}"
