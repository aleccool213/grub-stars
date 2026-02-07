# PR Screenshots

Use the Playwright-based screenshot tools to capture UI changes for PR descriptions.

## Setup (one-time)

```bash
npm install
npx playwright install chromium
```

## Taking Screenshots

**Quick single screenshot:**
```bash
bundle _2.5.23_ exec rackup &
node scripts/screenshot.js --url http://localhost:9292 --name homepage
```

**Run a scenario file:**
```bash
node scripts/screenshot.js --scenario scripts/scenarios/search-flow.json
```

**Dynamic scenario with custom actions:**
```bash
node scripts/screenshot.js --url http://localhost:9292 \
  --actions '[{"action":"click","selector":"#search"},{"action":"wait","ms":500}]' \
  --name after-click
```

## Posting to PR

```bash
node scripts/post-screenshots-to-pr.js <PR_NUMBER>
node scripts/post-screenshots-to-pr.js 42 --section "UI Changes"
node scripts/post-screenshots-to-pr.js 42 --dry-run
```

## Creating Custom Scenarios

Create JSON files in `scripts/scenarios/` with this structure:
```json
{
  "name": "feature-demo",
  "baseUrl": "http://localhost:9292",
  "viewport": { "width": 1280, "height": 720 },
  "steps": [
    { "action": "goto", "path": "/" },
    { "action": "screenshot", "name": "before", "description": "Initial state" },
    { "action": "click", "selector": "#my-button" },
    { "action": "wait", "ms": 500 },
    { "action": "screenshot", "name": "after", "description": "After clicking" }
  ]
}
```

**Supported Actions:** `goto`, `click`, `type`, `hover`, `scroll`, `wait`, `screenshot`, `select`, `press`

## Best Practices

Always capture **both empty and filled states** for PR screenshots:

```bash
# Terminal 1: Start mock server
ruby dev/mock_server.rb

# Terminal 2: Start main server
ruby -I lib $(bundle _2.5.23_ show rack)/bin/rackup config.ru

# Index test data
curl -X POST http://localhost:9292/index \
  -H "Content-Type: application/json" \
  -d '{"location": "barrie, ontario"}'

# Take screenshots
node scripts/screenshot.js --url http://localhost:9292/categories.html --name categories-filled
```

## Limitations

Playwright crashes with very tall viewports (e.g., `height: 2000`). Use scroll-based screenshots instead:
```bash
node scripts/screenshot.js --url "http://localhost:9292/page" --name "section" --actions '[{"action":"scroll","y":600}]'
```
