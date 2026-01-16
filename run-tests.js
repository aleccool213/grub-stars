#!/usr/bin/env node

/**
 * Headless browser test runner for grub stars JavaScript tests
 * Uses Playwright to run tests in Chromium
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

/**
 * Simple HTTP server to serve static files
 * Needed because ES modules require HTTP/HTTPS protocol (file:// won't work)
 */
function createServer(webDir, port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
  };

  const server = http.createServer((req, res) => {
    // Default to index.html for root path
    let filePath = req.url === '/' ? '/test.html' : req.url;
    filePath = path.join(webDir, filePath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(webDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath);
      const mimeType = mimeTypes[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}

async function runTests() {
  console.log('🧪 Starting JavaScript test suite...\n');

  // Check if web directory exists
  const webDir = path.join(__dirname, 'web');
  if (!fs.existsSync(webDir)) {
    console.error('❌ Error: web/ directory not found');
    process.exit(1);
  }

  // Start HTTP server
  const port = 8765;
  console.log(`Starting HTTP server on port ${port}...`);
  const server = await createServer(webDir, port);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-proxy-server',
      '--disable-web-security',
    ],
  });

  try {
    const page = await browser.newPage();

    // Collect console messages
    const consoleMessages = [];
    let testResultsFromConsole = null;

    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(text);

      // Forward console output to stdout
      console.log(text);

      // Parse test results from console output
      if (text.includes('📊 Test Results:')) {
        const match = text.match(/(\d+)\/(\d+) passed/);
        if (match) {
          testResultsFromConsole = {
            passed: parseInt(match[1]),
            total: parseInt(match[2]),
          };
        }
      }
    });

    // Catch page errors
    page.on('pageerror', (error) => {
      console.error('❌ Page error:', error.message);
    });

    // Handle page crashes gracefully
    let pageCrashed = false;
    page.on('crash', () => {
      pageCrashed = true;
    });

    // Navigate to test page via HTTP
    const testUrl = `http://localhost:${port}/test.html`;
    console.log(`Loading: ${testUrl}\n`);

    try {
      await page.goto(testUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    } catch (error) {
      if (!pageCrashed && !testResultsFromConsole) {
        throw error;
      }
      // If page crashed but we have test results, continue
    }

    // Wait a bit for scripts to load and execute
    if (!pageCrashed) {
      try {
        await page.waitForTimeout(3000);
      } catch (e) {
        // Page might have crashed during wait
      }
    }

    // Check if we already have results from console parsing
    if (testResultsFromConsole) {
      await browser.close();
      server.close();

      const testsPassed = testResultsFromConsole.passed === testResultsFromConsole.total;
      if (testsPassed) {
        console.log('\n✅ All tests passed!');
        process.exit(0);
      } else {
        console.log(`\n❌ ${testResultsFromConsole.total - testResultsFromConsole.passed} test(s) failed!`);
        process.exit(1);
      }
    }

    // Otherwise, wait for tests to complete via title
    try {
      const testResults = await page.waitForFunction(
        () => {
          const title = document.title;
          if (title.includes('✅') || title.includes('❌')) {
            return {
              passed: title.includes('✅'),
              title: title
            };
          }
          return null;
        },
        { timeout: 60000 }
      );

      // Get test results
      const results = await testResults.jsonValue();
      const testsPassed = results.passed;

      await browser.close();
      server.close();

      if (testsPassed) {
        console.log('\n✅ All tests passed!');
        process.exit(0);
      } else {
        console.log('\n❌ Some tests failed!');
        process.exit(1);
      }
    } catch (error) {
      // Final fallback: check console output
      if (testResultsFromConsole) {
        await browser.close();
        server.close();

        const testsPassed = testResultsFromConsole.passed === testResultsFromConsole.total;
        if (testsPassed) {
          console.log('\n✅ All tests passed (from console output)!');
          process.exit(0);
        } else {
          console.log(`\n❌ ${testResultsFromConsole.total - testResultsFromConsole.passed} test(s) failed!`);
          process.exit(1);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('\n❌ Test runner error:', error.message);
    await browser.close();
    server.close();
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
