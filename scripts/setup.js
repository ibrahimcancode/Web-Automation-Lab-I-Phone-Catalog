// One-command fresh-clone setup (`npm run setup`).
//
//   1. Installs the sandbox (iphone-catalog) dependencies from its lockfile.
//   2. Ensures the Playwright Chromium browser is installed.
//
// Cross-platform (Windows / Linux / macOS): npm is spawned through the shell
// (never a hardcoded `npm.cmd`), and the Playwright CLI is executed directly
// with the current Node executable from the root node_modules install.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SANDBOX_DIR = path.join(ROOT, 'iphone-catalog');

function fail(message) {
  console.error(`\n[setup] FAILED — ${message}`);
  process.exit(1);
}

console.log('[setup] 1/2 Installing sandbox dependencies (npm ci in iphone-catalog)...');
const sandboxInstall = spawnSync('npm', ['ci'], {
  cwd: SANDBOX_DIR,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (sandboxInstall.status !== 0 || sandboxInstall.error) {
  fail('installing iphone-catalog dependencies failed — run `npm install` at the repository root first, then retry.');
}

console.log('[setup] 2/2 Installing Playwright Chromium...');
let playwrightCli;
try {
  // cli.js is not in playwright's "exports" map, so resolve the (exported)
  // package.json and join the CLI path relative to the package directory.
  const pkgJson = createRequire(path.join(ROOT, 'package.json')).resolve('playwright/package.json');
  playwrightCli = path.join(path.dirname(pkgJson), 'cli.js');
} catch {
  fail('Playwright was not found in node_modules — run `npm install` at the repository root first, then retry.');
}
const browserInstall = spawnSync(process.execPath, [playwrightCli, 'install', 'chromium'], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (browserInstall.status !== 0 || browserInstall.error) {
  fail('installing the Playwright Chromium browser failed.');
}

console.log('');
console.log('[setup] SUCCESS — the workspace is ready:');
console.log('  npm run test:unit    fast unit checks (no browser/site needed)');
console.log('  npm run demo:quick   visible two-phone chaos demo');
