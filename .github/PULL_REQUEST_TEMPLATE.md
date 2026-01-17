## Summary

<!-- Describe what this PR does in 1-3 sentences -->

## Changes

<!-- List the main changes made in this PR -->

-

## Type of Change

<!-- Check all that apply -->

- [ ] Bug fix
- [ ] New feature
- [ ] Enhancement to existing feature
- [ ] Refactoring (no functional changes)
- [ ] Documentation
- [ ] UI/Design change

## Screenshots

<!--
REQUIRED for UI changes! Use the screenshot tool to capture before/after states.

To generate screenshots:
1. Start the server: bundle _2.5.23_ exec rackup &
2. Run scenario: node scripts/screenshot.js --scenario scripts/scenarios/your-scenario.json
3. Post to PR: node scripts/post-screenshots-to-pr.js <PR_NUMBER>

Or for quick screenshots:
  node scripts/screenshot.js --url http://localhost:9292 --name my-screenshot

See CLAUDE.md for full documentation.
-->

### Before

<!-- Add before screenshots here if applicable -->

### After

<!-- Add after screenshots here (required for UI changes) -->

## Test Plan

<!-- Describe how this change was tested -->

- [ ] Ran existing tests: `ruby -I lib $(bundle _2.5.23_ show rake)/exe/rake test`
- [ ] Added new tests (if applicable)
- [ ] Manual testing performed

## Checklist

- [ ] Code follows project conventions
- [ ] Self-review completed
- [ ] Tests pass locally
- [ ] Screenshots added (if UI change)
