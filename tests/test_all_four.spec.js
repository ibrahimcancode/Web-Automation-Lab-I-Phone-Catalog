// Week 2 all-four combination test: the real workflow against the sandbox with
// ALL four handled scenarios forced on simultaneously (random_mode=false, so
// every enabled scenario deterministically activates).
//
// This is the §4.12 "combination forced on" proof — stronger than the
// per-scenario tests, because it exercises handler interactions (delayed popup
// landing mid-workflow, captcha gating a later page, transient 503s on the
// first navigations) in one run. It runs the real workflow through
// tests/helpers/bot.js with a small `limit` to keep it fast.

import { test, expect } from '@playwright/test';
import { startSite } from './helpers/site.js';
import { runBotOnce } from './helpers/bot.js';

test.describe.configure({ timeout: 180_000 });

const ALL_FOUR = {
  enabled: true,
  random_mode: false,
  seed: 42,
  scenarios: {
    cookie_banner: { enabled: true, probability: 1.0 },
    newsletter_popup: { enabled: true, probability: 1.0, min_delay_seconds: 2, max_delay_seconds: 6 },
    simulated_captcha: { enabled: true, probability: 1.0, delay_seconds: 1 },
    server_errors: { enabled: true, probability: 1.0, status_code: 503, fail_first_n: 2 },
  },
};

const OVERLAY_SCENARIOS = ['cookie_banner', 'newsletter_popup', 'simulated_captcha'];

test.describe('All four scenarios combined (chaos gauntlet-lite)', () => {
  let site;
  test.beforeAll(async () => {
    site = await startSite(ALL_FOUR, { port: 5225 });
  });
  test.afterAll(async () => site?.close());

  test('bot detects and recovers from all four in one run, PASS with zero failures', async () => {
    const { summary } = await runBotOnce({ baseUrl: site.baseUrl, limit: 2 });

    // Overall verdict + data completeness.
    expect(summary.verdict).toBe('PASS');
    expect(summary.items_failed).toBe(0);
    expect(summary.failure_reasons).toEqual([]);
    expect(summary.data_validation.valid).toBeGreaterThan(0);
    expect(summary.data_validation.invalid).toBe(0);
    expect(summary.data_validation.duplicates).toEqual([]);

    // All four scenarios were detected during the run.
    for (const name of [...OVERLAY_SCENARIOS, 'server_errors']) {
      expect(summary.disruptions[name].detected, `${name} should be detected`).toBeGreaterThan(0);
    }

    // Overlay scenarios were resolved (not just detected).
    for (const name of OVERLAY_SCENARIOS) {
      expect(summary.disruptions[name].resolved, `${name} should be resolved`).toBeGreaterThan(0);
    }

    // Server errors caused bounded retries past the transient 503s.
    expect(summary.disruptions.server_errors.retries).toBeGreaterThan(0);
    expect(summary.retries_total).toBeGreaterThan(0);

    // Anomaly screenshots were generated for the detected disruptions.
    expect(summary.screenshots).toBeGreaterThan(0);
  });
});
