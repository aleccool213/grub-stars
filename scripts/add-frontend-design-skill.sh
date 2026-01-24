#!/bin/bash
#
# Add Frontend Design Skill to Claude Code Session
#
# This script fetches the frontend-design skill from skills.sh and integrates it
# into the Claude Code configuration for this project.
#
# Usage:
#   ./scripts/add-frontend-design-skill.sh
#

set -e

SKILL_URL="https://skills.sh/anthropics/skills/frontend-design"
SKILL_DIR=".claude/skills"
SKILL_FILE="$SKILL_DIR/frontend-design.md"

echo "🎨 Adding Frontend Design Skill to Claude Code..."
echo ""

# Create skills directory if it doesn't exist
if [ ! -d "$SKILL_DIR" ]; then
  echo "📁 Creating skills directory: $SKILL_DIR"
  mkdir -p "$SKILL_DIR"
fi

# Fetch the skill content
echo "📥 Fetching skill from $SKILL_URL..."
if command -v curl &> /dev/null; then
  curl -s -L "$SKILL_URL" -o "$SKILL_FILE"
elif command -v wget &> /dev/null; then
  wget -q -O "$SKILL_FILE" "$SKILL_URL"
else
  echo "❌ Error: Neither curl nor wget is available. Please install one of them."
  exit 1
fi

# Verify the file was created
if [ ! -f "$SKILL_FILE" ]; then
  echo "❌ Error: Failed to download skill file"
  exit 1
fi

# Check if file has content
if [ ! -s "$SKILL_FILE" ]; then
  echo "❌ Error: Downloaded file is empty"
  rm "$SKILL_FILE"
  exit 1
fi

echo "✅ Skill downloaded successfully to: $SKILL_FILE"
echo ""

# Create or update .claude/config.json to reference the skill
CONFIG_FILE=".claude/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "📝 Creating Claude Code config file: $CONFIG_FILE"
  mkdir -p .claude
  cat > "$CONFIG_FILE" << 'EOF'
{
  "skills": [
    "skills/frontend-design.md"
  ]
}
EOF
  echo "✅ Config file created"
else
  echo "ℹ️  Config file already exists: $CONFIG_FILE"
  echo "   Please manually add 'skills/frontend-design.md' to the skills array if needed"
fi

echo ""
echo "🎉 Frontend Design Skill installed!"
echo ""
echo "The skill provides guidance for creating distinctive, production-grade frontend"
echo "interfaces while avoiding generic 'AI slop' aesthetics."
echo ""
echo "Key principles:"
echo "  • Use distinctive typography (avoid Inter, Roboto, Arial)"
echo "  • Employ bold color schemes (avoid purple gradients)"
echo "  • Create asymmetric, memorable layouts"
echo "  • Add high-impact animations and visual details"
echo ""
echo "Claude Code will now reference this skill in future sessions."
