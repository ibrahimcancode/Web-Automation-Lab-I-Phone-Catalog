// Deterministic automated test for demo mode.
//
// `npm run demo:all` uses a dedicated chaos config (configs/chaos.demo.json)
// with random_mode=false, so all EIGHT core scenarios are FORCED to fire during
// a single run at their controlled points — no probability, no seed luck. This
// test proves:
//   1. The demo config is deterministic and complete (static).
//   2. The catalog really ships DEMO_CATALOG_SIZE models (static).
//   3. A real workflow run against that config detects AND resolves all eight
//      scenarios with valid, duplicate-free data (end-to-end, headless).
// The demo script itself (scripts/demo-all.js) additionally asserts the full
// 43/43 extraction in the live run; this tier keeps a bounded limit to stay fast.

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startSite } from './helpers/site.js';
import { runBotOnce } from './helpers/bot.js';
import { Reporter } from '../bot/reporting.js';
import {
  loadDemoConfig,
  validateDemoConfig,
  DEMO_SCENARIOS,
  DEMO_CATALOG_SIZE,
} from '../configs/demoConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsJson = path.join(__dirname, '..', 'iphone-catalog', 'src', 'data', 'models.json');

test.describe('Demo config (static)', () => {
  test('is deterministic: random_mode=false, enabled, fixed seed', () => {
    const cfg = loadDemoConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.random_mode).toBe(false);
    expect(typeof cfg.seed).toBe('number');
  });

  test('forces every one of the eight core scenarios on', () => {
    const cfg = loadDemoConfig();
    for (const name of DEMO_SCENARIOS) {
      expect(cfg.scenarios[name], `${name} should be enabled`).toBeDefined();
      expect(cfg.scenarios[name].enabled, `${name} should be forced on`).toBe(true);
    }
  });

  test('passes validateDemoConfig (all eight present + enabled)', () => {
    expect(validateDemoConfig(loadDemoConfig())).toEqual([]);
  });

  test('catalog dataset ships exactly DEMO_CATALOG_SIZE models', () => {
    const models = JSON.parse(fs.readFileSync(modelsJson, 'utf8'));
    expect(models.length).toBe(DEMO_CATALOG_SIZE);
  });
});

test.describe('Demo mode end-to-end (headless, deterministic)', () => {
  test.describe.configure({ timeout: 360_000 });
  let site;
  test.beforeAll(async () => {
    site = await startSite(loadDemoConfig(), { port: 5245 });
  });
  test.afterAll(async () => site?.close());

  test('recovers all eight scenarios in one run with valid, duplicate-free data', async () => {
    const { summary, reporter } = await runBotOnce({ baseUrl: site.baseUrl, limit: 3 });

    expect(summary.verdict).toBe('PASS');
    expect(summary.items_failed).toBe(0);
    expect(summary.failure_reasons).toEqual([]);
    expect(summary.data_validation.invalid).toBe(0);
    expect(summary.data_validation.duplicates).toEqual([]);
    expect(summary.screenshots).toBeGreaterThan(0);

    // Every core scenario was detected AND recovered during this one run.
    for (const name of DEMO_SCENARIOS) {
      expect(summary.disruptions[name].detected, `${name} should be detected`).toBeGreaterThan(0);
      expect(summary.disruptions[name].resolved, `${name} should be resolved`).toBeGreaterThan(0);
    }

    // Bounded retries preserved: server_errors retries past the 503s.
    expect(summary.disruptions.server_errors.retries).toBeGreaterThan(0);

    // Evidence file set written by the reporter.
    expect(fs.existsSync(path.join(reporter.runDir, 'events.jsonl'))).toBe(true);
  });
});

test.describe('Reporter screenshot resilience (regression: masked root-cause errors)', () => {
  // Investigated failure: `page.screenshot: Target page, context or browser has
  // been closed` REPLACED the real root-cause error (see runs/...dqs5 events).
  // The reporter must never throw from screenshot(), so a capture failure on an
  // already-closed page is safely recorded as evidence while the caller keeps
  // its original error path.

  function makeReporter() {
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-screenshot-test-'));
    return new Reporter({ runDir, baseUrl: 'http://localhost:5173' });
  }

  test('returns null and records a screenshot_failed event when capture throws', async () => {
    const reporter = makeReporter();
    await reporter.init();
    const boom = new Error('Target page, context or browser has been closed');
    const page = { screenshot: async () => { throw boom; } };

    const file = await reporter.screenshot(page, 'fatal-error');

    expect(file).toBeNull();
    const failed = reporter.events.filter((e) => e.action === 'screenshot_failed');
    expect(failed).toHaveLength(1);
    expect(failed[0].outcome).toBe('error');
    expect(failed[0].detail).toContain('Target page, context or browser has been closed');
  });

  test('returns the file path on success and records no screenshot_failed event', async () => {
    const reporter = makeReporter();
    await reporter.init();
    const page = { screenshot: async (opts) => opts.path };

    const file = await reporter.screenshot(page, 'ok');

    expect(file).toMatch(/screenshots[\\/].*ok\.png$/);
    expect(reporter.events.filter((e) => e.action === 'screenshot_failed')).toHaveLength(0);
  });

  test('buildSummary ignores screenshot_failed evidence (no false FAIL)', async () => {
    const { buildSummary } = await import('../bot/reporting.js');
    const summary = buildSummary({
      events: [
        { scenario: 'workflow', action: 'screenshot_failed', outcome: 'error', detail: 'boom' },
        { scenario: 'cookie_banner', action: 'detected', outcome: 'detected' },
        { scenario: 'cookie_banner', action: 'recovered', outcome: 'resolved' },
      ],
      results: [{
        id: 'iphone-16e', name: 'iPhone 16e', tier: 'Standard',
        year: 2025, price: 499, status: 'ok',
      }],
      runMeta: { run_id: 'test-run' },
    });
    expect(summary.verdict).toBe('PASS');
    expect(summary.disruptions.cookie_banner).toEqual({ detected: 1, resolved: 1, retries: 0 });
  });
});
