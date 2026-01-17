#!/usr/bin/env node

/**
 * Post Screenshots to PR Description
 *
 * This script commits screenshots to the PR branch and updates the PR
 * description with embedded images.
 *
 * Usage:
 *   node scripts/post-screenshots-to-pr.js <PR_NUMBER> [OPTIONS]
 *
 * Options:
 *   --dir <path>         Screenshots directory (default: ./screenshots)
 *   --section <name>     Section header (default: "Screenshots")
 *   --commit-path <path> Path in repo for screenshots (default: docs/screenshots/<scenario>)
 *   --no-commit          Don't commit files, just update PR with existing paths
 *   --dry-run            Preview without making changes
 *
 * Examples:
 *   node scripts/post-screenshots-to-pr.js 42
 *   node scripts/post-screenshots-to-pr.js 42 --section "UI Changes"
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function exec(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', ...options }).trim();
  } catch (error) {
    if (options.ignoreError) return '';
    throw error;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    prNumber: null,
    screenshotsDir: './screenshots',
    sectionName: 'Screenshots',
    commitPath: null, // Will be auto-generated
    noCommit: false,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dir':
        options.screenshotsDir = args[++i];
        break;
      case '--section':
        options.sectionName = args[++i];
        break;
      case '--commit-path':
        options.commitPath = args[++i];
        break;
      case '--no-commit':
        options.noCommit = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
      default:
        if (!options.prNumber && /^\d+$/.test(args[i])) {
          options.prNumber = args[i];
        }
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Post Screenshots to PR Description

Usage:
  node scripts/post-screenshots-to-pr.js <PR_NUMBER> [OPTIONS]

Options:
  --dir <path>         Screenshots directory (default: ./screenshots)
  --section <name>     Section header (default: "Screenshots")
  --commit-path <path> Path in repo for screenshots
  --no-commit          Don't commit, use existing file references
  --dry-run            Preview without making changes

Examples:
  node scripts/post-screenshots-to-pr.js 42
  node scripts/post-screenshots-to-pr.js 42 --section "Before/After"
  node scripts/post-screenshots-to-pr.js 42 --no-commit
`);
}

async function main() {
  const options = parseArgs();

  if (!options.prNumber) {
    console.error('Error: PR number is required');
    printHelp();
    process.exit(1);
  }

  // Check for required tools
  try {
    exec('gh --version');
  } catch {
    console.error('Error: GitHub CLI (gh) is required. Install from https://cli.github.com/');
    process.exit(1);
  }

  // Load manifest
  const manifestPath = path.join(options.screenshotsDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: Manifest not found at ${manifestPath}`);
    console.error('Run screenshot.js first to generate screenshots.');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`\nPosting screenshots to PR #${options.prNumber}`);
  console.log(`Scenario: ${manifest.scenario || 'unnamed'}`);
  console.log(`Screenshots: ${manifest.screenshots.length}`);

  // Get repo info
  const repo = exec('gh repo view --json nameWithOwner -q .nameWithOwner');
  console.log(`Repository: ${repo}`);

  // Get PR branch
  const prBranch = exec(`gh pr view ${options.prNumber} --json headRefName -q .headRefName`);
  console.log(`PR Branch: ${prBranch}`);

  // Determine commit path
  const scenarioSlug = (manifest.scenario || 'screenshots').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  const commitPath = options.commitPath || `docs/screenshots/${scenarioSlug}`;

  let imageUrls = {};

  if (!options.noCommit) {
    console.log(`\nCommitting screenshots to: ${commitPath}/`);

    // Ensure we're on the PR branch
    const currentBranch = exec('git branch --show-current');
    if (currentBranch !== prBranch) {
      console.log(`Switching to branch: ${prBranch}`);
      if (!options.dryRun) {
        exec(`git fetch origin ${prBranch}`);
        exec(`git checkout ${prBranch}`);
      }
    }

    // Create directory and copy files
    const targetDir = path.resolve(commitPath);
    if (!options.dryRun) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    for (const screenshot of manifest.screenshots) {
      const srcPath = path.join(options.screenshotsDir, screenshot.filename);
      const destPath = path.join(targetDir, screenshot.filename);

      if (!fs.existsSync(srcPath)) {
        console.warn(`Warning: Screenshot not found: ${srcPath}`);
        continue;
      }

      console.log(`  Copying: ${screenshot.filename}`);
      if (!options.dryRun) {
        fs.copyFileSync(srcPath, destPath);
      }

      // GitHub raw URL format
      const rawUrl = `https://raw.githubusercontent.com/${repo}/${prBranch}/${commitPath}/${screenshot.filename}`;
      imageUrls[screenshot.name] = rawUrl;
    }

    // Commit and push
    if (!options.dryRun) {
      console.log('\nCommitting screenshots...');
      exec(`git add "${targetDir}"`);

      try {
        exec(`git commit -m "Add PR screenshots: ${manifest.scenario || 'screenshots'}"`);
        console.log('Pushing to remote...');
        exec(`git push origin ${prBranch}`);
      } catch (error) {
        // Check if nothing to commit
        const status = exec('git status --porcelain', { ignoreError: true });
        if (!status) {
          console.log('Screenshots already committed (no changes).');
        } else {
          throw error;
        }
      }
    }
  } else {
    // No commit mode - use relative paths (assumes files exist in repo)
    for (const screenshot of manifest.screenshots) {
      const relativePath = path.join(options.screenshotsDir, screenshot.filename);
      imageUrls[screenshot.name] = relativePath;
    }
  }

  // Build markdown content
  let markdown = `## ${options.sectionName}\n\n`;
  markdown += `_Generated: ${manifest.timestamp}_\n\n`;

  for (const screenshot of manifest.screenshots) {
    const url = imageUrls[screenshot.name];
    if (!url) continue;

    markdown += `### ${screenshot.name}\n\n`;
    if (screenshot.description) {
      markdown += `${screenshot.description}\n\n`;
    }
    markdown += `![${screenshot.name}](${url})\n\n`;
  }

  console.log('\n--- Generated Markdown ---');
  console.log(markdown);
  console.log('---\n');

  if (options.dryRun) {
    console.log('[DRY RUN] Would update PR description with above content');
    return;
  }

  // Get current PR body
  const currentBody = exec(`gh pr view ${options.prNumber} --json body -q .body`);

  // Build new body
  let newBody;
  const sectionMarker = `## ${options.sectionName}`;

  if (currentBody.includes(sectionMarker)) {
    // Replace existing section
    const lines = currentBody.split('\n');
    const newLines = [];
    let inSection = false;
    let inserted = false;

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (inSection) {
          // End of our section, insert new content
          newLines.push(markdown.trim());
          newLines.push('');
          inserted = true;
          inSection = false;
        }
        if (line === sectionMarker) {
          inSection = true;
          continue;
        }
      }
      if (!inSection) {
        newLines.push(line);
      }
    }

    // If section was at the end
    if (inSection && !inserted) {
      newLines.push(markdown.trim());
    }

    newBody = newLines.join('\n');
  } else {
    // Append new section
    newBody = currentBody + '\n\n---\n\n' + markdown;
  }

  // Update PR
  console.log('Updating PR description...');

  // Write body to temp file to avoid shell escaping issues
  const tempFile = `/tmp/pr-body-${Date.now()}.md`;
  fs.writeFileSync(tempFile, newBody);

  try {
    exec(`gh pr edit ${options.prNumber} --body-file "${tempFile}"`);
    console.log(`\n✓ PR #${options.prNumber} updated with screenshots!`);
    console.log(`  View at: https://github.com/${repo}/pull/${options.prNumber}`);
  } finally {
    fs.unlinkSync(tempFile);
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
