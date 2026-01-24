#!/bin/bash
#
# Add Frontend Design Skill to Claude Code Session
#
# This script uses the official skills.sh CLI to install the frontend-design skill
# from Anthropic's skills repository.
#
# Usage:
#   ./scripts/add-frontend-design-skill.sh
#
# Requirements:
#   - Node.js/npm (for npx)
#

set -e

echo "🎨 Adding Frontend Design Skill to Claude Code..."
echo ""

# Check if npx is available
if ! command -v npx &> /dev/null; then
  echo "❌ Error: npx is not available. Please install Node.js and npm."
  echo ""
  echo "Install Node.js from:"
  echo "  • https://nodejs.org/"
  echo "  • Or use nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
  exit 1
fi

echo "📥 Installing frontend-design skill using skills.sh CLI..."
echo ""

# Run the official npx command
npx skills add https://github.com/anthropics/skills --skill frontend-design

echo ""
echo "🎉 Frontend Design Skill installed!"
echo ""
echo "⚠️  IMPORTANT: Restart Claude Code to activate the skill."
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
echo "After restarting Claude Code, use '/skills' to verify installation."
echo ""
echo "Learn more: https://skills.sh/anthropics/skills/frontend-design"
