# Browser Automation with Agent Browser

**Tool:** [agent-browser](https://agent-browser.dev) - Headless browser automation CLI by Vercel Labs designed for AI agents.

## Installation

```bash
npm install -g agent-browser
```

## Key Features

- Works with any AI agent (Claude Code, Cursor, Codex, Copilot, Gemini, opencode, etc.)
- AI-first design - returns accessibility tree with refs for deterministic element selection
- Fast Rust CLI with Node.js fallback
- 50+ commands for navigation, forms, screenshots, network, storage
- Multiple isolated browser sessions

## Common Commands

```bash
# Navigate and get page snapshot
agent-browser open http://localhost:9292
agent-browser snapshot --json

# Interact with elements using refs
agent-browser click @e1
agent-browser type @e2 "search query"
agent-browser submit @e3

# Screenshots
agent-browser screenshot --full-page

# Form handling
agent-browser select @e4 "option-value"
agent-browser check @e5
agent-browser upload @e6 /path/to/file

# Session management
agent-browser new-session my-session
agent-browser list-sessions
agent-browser close-session my-session
```

## Usage with AI Agents

The `--json` flag provides machine-readable output:
```bash
agent-browser snapshot --json
# Returns: {"success":true,"data":{"snapshot":"...","refs":{...}}}
```

## Example Workflow

```bash
bundle _2.5.23_ exec rackup &
agent-browser open http://localhost:9292/categories.html
agent-browser snapshot --json
agent-browser click @e3
agent-browser wait --selector "#search-results"
agent-browser screenshot --name "categories-clicked"
```
