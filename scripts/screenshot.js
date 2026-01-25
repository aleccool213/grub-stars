#!/usr/bin/env node

/**
 * Dynamic Screenshot Script for PR Documentation
 *
 * Usage:
 *   # Run a scenario file
 *   node scripts/screenshot.js --scenario scenarios/search-demo.json
 *
 *   # Quick single screenshot
 *   node scripts/screenshot.js --url http://localhost:9292 --name homepage
 *
 *   # With actions via CLI
 *   node scripts/screenshot.js --url http://localhost:9292 \
 *     --actions '[{"action":"click","selector":"#search"}]' \
 *     --name after-click
 *
 * Scenario file format:
 * {
 *   "name": "feature-demo",
 *   "baseUrl": "http://localhost:9292",
 *   "viewport": { "width": 1280, "height": 720 },
 *   "steps": [
 *     { "action": "goto", "path": "/" },
 *     { "action": "screenshot", "name": "home", "description": "Homepage view" },
 *     { "action": "click", "selector": "#search-btn" },
 *     { "action": "type", "selector": "#query", "text": "pizza" },
 *     { "action": "screenshot", "name": "search", "fullPage": true }
 *   ]
 * }
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    scenario: null,
    url: null,
    name: null,
    actions: [],
    outputDir: './screenshots',
    viewport: { width: 1280, height: 720 }
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--scenario':
      case '-s':
        options.scenario = args[++i];
        break;
      case '--url':
      case '-u':
        options.url = args[++i];
        break;
      case '--name':
      case '-n':
        options.name = args[++i];
        break;
      case '--actions':
      case '-a':
        options.actions = JSON.parse(args[++i]);
        break;
      case '--output':
      case '-o':
        options.outputDir = args[++i];
        break;
      case '--viewport':
      case '-v':
        options.viewport = JSON.parse(args[++i]);
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Dynamic Screenshot Script for PR Documentation

Usage:
  node scripts/screenshot.js [options]

Options:
  --scenario, -s <file>    Path to scenario JSON file
  --url, -u <url>          Base URL for quick screenshot
  --name, -n <name>        Screenshot name (for quick mode)
  --actions, -a <json>     JSON array of actions (for quick mode)
  --output, -o <dir>       Output directory (default: ./screenshots)
  --viewport, -v <json>    Viewport size, e.g. '{"width":1280,"height":720}'
  --help, -h               Show this help

Supported Actions:
  goto        Navigate to a path or URL
              { "action": "goto", "path": "/search" }
              { "action": "goto", "url": "http://example.com" }

  click       Click an element
              { "action": "click", "selector": "#button" }

  type        Type text into an input
              { "action": "type", "selector": "#input", "text": "hello" }

  clear       Clear an input field
              { "action": "clear", "selector": "#input" }

  hover       Hover over an element
              { "action": "hover", "selector": ".menu-item" }

  scroll      Scroll to element or position
              { "action": "scroll", "selector": "#footer" }
              { "action": "scroll", "y": 500 }

  wait        Wait for condition
              { "action": "wait", "ms": 1000 }
              { "action": "wait", "selector": ".loaded" }
              { "action": "wait", "state": "networkidle" }

  screenshot  Capture screenshot
              { "action": "screenshot", "name": "result", "description": "After search" }
              { "action": "screenshot", "name": "full", "fullPage": true }
              { "action": "screenshot", "name": "element", "selector": ".card" }

  select      Select dropdown option
              { "action": "select", "selector": "select#category", "value": "bakery" }

  press       Press a key
              { "action": "press", "key": "Enter" }

  evaluate    Run JavaScript in the page
              { "action": "evaluate", "script": "document.title" }

Examples:
  # Run a scenario file
  node scripts/screenshot.js --scenario scripts/scenarios/search-demo.json

  # Quick homepage screenshot
  node scripts/screenshot.js --url http://localhost:9292 --name homepage

  # Screenshot with actions
  node scripts/screenshot.js --url http://localhost:9292 \\
    --actions '[{"action":"click","selector":"#search"},{"action":"wait","ms":500}]' \\
    --name after-search
`);
}

// Execute a single action
async function executeAction(page, action, context) {
  const { baseUrl, outputDir, screenshots } = context;

  switch (action.action) {
    case 'goto':
      const url = action.url || `${baseUrl}${action.path || '/'}`;
      console.log(`  → Navigating to ${url}`);
      await page.goto(url, { waitUntil: action.waitUntil || 'domcontentloaded', timeout: 30000 });
      // Give Twind time to generate styles
      await page.waitForTimeout(500);
      break;

    case 'click':
      console.log(`  → Clicking ${action.selector}`);
      await page.click(action.selector);
      break;

    case 'type':
      console.log(`  → Typing into ${action.selector}`);
      if (action.clear !== false) {
        await page.fill(action.selector, '');
      }
      await page.fill(action.selector, action.text);
      break;

    case 'clear':
      console.log(`  → Clearing ${action.selector}`);
      await page.fill(action.selector, '');
      break;

    case 'hover':
      console.log(`  → Hovering over ${action.selector}`);
      await page.hover(action.selector);
      break;

    case 'scroll':
      if (action.selector) {
        console.log(`  → Scrolling to ${action.selector}`);
        await page.locator(action.selector).scrollIntoViewIfNeeded();
      } else {
        console.log(`  → Scrolling to y=${action.y || 0}`);
        await page.evaluate((y) => window.scrollTo(0, y), action.y || 0);
      }
      break;

    case 'wait':
      if (action.ms) {
        console.log(`  → Waiting ${action.ms}ms`);
        await page.waitForTimeout(action.ms);
      } else if (action.selector) {
        console.log(`  → Waiting for ${action.selector}`);
        await page.waitForSelector(action.selector, { state: action.state || 'visible' });
      } else if (action.state) {
        console.log(`  → Waiting for ${action.state}`);
        await page.waitForLoadState(action.state);
      }
      break;

    case 'screenshot':
      const screenshotName = action.name || `screenshot-${screenshots.length + 1}`;
      const filename = `${screenshotName}.png`;
      const filepath = path.join(outputDir, filename);

      console.log(`  → Taking screenshot: ${filename}`);

      const screenshotOptions = { path: filepath };
      if (action.fullPage) {
        screenshotOptions.fullPage = true;
      }

      if (action.selector) {
        await page.locator(action.selector).screenshot(screenshotOptions);
      } else {
        await page.screenshot(screenshotOptions);
      }

      screenshots.push({
        name: screenshotName,
        filename,
        filepath,
        description: action.description || ''
      });
      break;

    case 'select':
      console.log(`  → Selecting "${action.value}" in ${action.selector}`);
      await page.selectOption(action.selector, action.value);
      break;

    case 'press':
      console.log(`  → Pressing ${action.key}`);
      await page.keyboard.press(action.key);
      break;

    case 'evaluate':
      console.log(`  → Evaluating script`);
      const result = await page.evaluate(action.script);
      if (action.log !== false) {
        console.log(`    Result: ${JSON.stringify(result)}`);
      }
      return result;

    default:
      console.warn(`  ⚠ Unknown action: ${action.action}`);
  }
}

// Run scenario
async function runScenario(scenario, options) {
  const outputDir = options.outputDir || scenario.outputDir || './screenshots';
  const viewport = scenario.viewport || options.viewport;
  const baseUrl = scenario.baseUrl || options.url || 'http://localhost:9292';

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\nStarting screenshot scenario: ${scenario.name || 'unnamed'}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Output: ${outputDir}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
    ],
  });

  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2 // Retina quality
  });

  const page = await context.newPage();
  const screenshots = [];

  // Block external requests (fonts, CDN) that may fail in sandboxed environments
  // but allow specific APIs needed for functionality
  await page.route('**/*', (route) => {
    const url = route.request().url();
    // Allow localhost/127.0.0.1 requests
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      route.continue();
    // Allow Photon geocoding API for address autocomplete
    } else if (url.includes('photon.komoot.io')) {
      route.continue();
    } else {
      route.abort('blockedbyclient');
    }
  });

  const execContext = { baseUrl, outputDir, screenshots };

  try {
    for (const step of scenario.steps) {
      await executeAction(page, step, execContext);
    }
  } finally {
    await browser.close();
  }

  console.log(`\nCompleted! ${screenshots.length} screenshot(s) saved to ${outputDir}/`);

  // Output manifest for post-processing
  const manifest = {
    scenario: scenario.name,
    timestamp: new Date().toISOString(),
    screenshots
  };

  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Manifest saved to ${manifestPath}`);

  return manifest;
}

// Main entry point
async function main() {
  const options = parseArgs();

  let scenario;

  if (options.scenario) {
    // Load scenario from file
    const scenarioPath = path.resolve(options.scenario);
    scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf-8'));
  } else if (options.url) {
    // Build scenario from CLI options
    scenario = {
      name: options.name || 'cli-screenshot',
      baseUrl: options.url,
      viewport: options.viewport,
      steps: [
        { action: 'goto', url: options.url },
        ...options.actions,
        { action: 'screenshot', name: options.name || 'screenshot' }
      ]
    };
  } else {
    console.error('Error: Must provide either --scenario or --url');
    printHelp();
    process.exit(1);
  }

  try {
    await runScenario(scenario, options);
  } catch (error) {
    console.error('\nError running scenario:', error.message);
    process.exit(1);
  }
}

main();
