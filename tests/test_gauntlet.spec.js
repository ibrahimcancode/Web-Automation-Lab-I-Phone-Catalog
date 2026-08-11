// Week 3 all-eight chaos gauntlet: the real workflow against the sandbox in
// RANDOM mode, ALL 8 scenarios enabled, fixed seeds.
//
// §5 Phase 3.4 — "the chaos gauntlet": random mode, all scenarios on, fixed
// seed, asserting a complete and correct result end-to-end, re-run with
// multiple fixed seeds. Each scenario is individually proven forced-on by its
// dedicated test; this file proves the bot stays correct under the full
// randomized combination and recovers from whatever the seed throws at it.
//
// Verified nav-1 activations (engine mulberry32, delay pre-draws included):
//   seed 42 -> newsletter_popup, server_errors, unexpected_redirect
//   seed 99 -> cookie_banner, slow_responses, unexpected_redirect, dom_drift,
//              blocked_clicks
// A recovery that re-navigates re-rolls the PRNG, so exactly which scenarios
// surface is deterministic per seed — confirmed empirically:
//   seed 42 -> server_errors (retries), slow_responses, unexpected_redirect
//   seed 99 -> + cookie_banner, dom_drift, blocked_clicks (all 6 handled)

import { test, expect } from '@playwright/test';
import { startSite } from './helpers/site.js';
import { runBotOnce } from './helpers/bot.js';

const ALL_EIGHT = {
  enabled: true,
  random_mode: true,
  scenarios: {
    cookie_banner: { enabled: true, probability: 0.5 },
    newsletter_popup: { enabled: true, probability: 0.5, min_delay_seconds: 2, max_delay_seconds: 6 },
    simulated_captcha: { enabled: true, probability: 0.5, delay_seconds: 1 },
    server_errors: { enabled: true, probability: 0.5, status_code: 503, fail_first_n: 2 },
    slow_responses: { enabled: true, probability: 0.5, min_delay_ms: 2500, max_delay_ms: 4000 },
    unexpected_redirect: { enabled: true, probability: 0.5 },
    dom_drift: { enabled: true, probability: 0.5 },
    blocked_clicks: { enabled: true, probability: 0.5, rearm_after_dismissal_ms: 1500 },
  },
};

function assertCompleteAndCorrect(summary) {
  expect(summary.verdict).toBe('PASS');
  expect(summary.items_failed).toBe(0);
  expect(summary.failure_reasons).toEqual([]);
  expect(summary.data_validation.valid).toBeGreaterThan(0);
  expect(summary.data_validation.invalid).toBe(0);
  expect(summary.data_validation.duplicates).toEqual([]);
  expect(summary.screenshots).toBeGreaterThan(0);
}

test.describe('All-eight chaos gauntlet, seed 42 (random mode)', () => {
  test.setTimeout(240_000);
  let site;
  test.beforeAll(async () => {
    site = await startSite({ ...ALL_EIGHT, seed: 42 }, { port: 5230 });
  });
  test.afterAll(async () => site?.close());

  test('completes a correct run, recovering from server errors and redirects', async () => {
    const { summary } = await runBotOnce({ baseUrl: site.baseUrl, limit: 2 });

    assertCompleteAndCorrect(summary);

    // Server errors: fail_first_n middleware + active roll -> bounded retries.
    expect(summary.disruptions.server_errors.detected).toBeGreaterThan(0);
    expect(summary.disruptions.server_errors.retries).toBeGreaterThan(0);
    expect(summary.retries_total).toBeGreaterThan(0);

    // Unexpected redirects: late client-side redirect (even behind a slow load)
    // is detected and the bot returns to the intended destination.
    expect(summary.disruptions.unexpected_redirect.detected).toBeGreaterThan(0);
    expect(summary.disruptions.unexpected_redirect.resolved).toBeGreaterThan(0);
  });
});

test.describe('All-eight chaos gauntlet, seed 99 (random mode)', () => {
  test.setTimeout(240_000);
  let site;
  test.beforeAll(async () => {
    site = await startSite({ ...ALL_EIGHT, seed: 99 }, { port: 5231 });
  });
  test.afterAll(async () => site?.close());

  test('completes a correct run, recovering from five overlapping scenarios', async () => {
    const { summary } = await runBotOnce({ baseUrl: site.baseUrl, limit: 2 });

    assertCompleteAndCorrect(summary);

    // Overlay scenarios that seed 99 deterministically activates are detected
    // AND resolved in the same run.
    for (const name of ['cookie_banner', 'unexpected_redirect', 'dom_drift', 'blocked_clicks']) {
      expect(summary.disruptions[name].detected, `${name} should be detected`).toBeGreaterThan(0);
      expect(summary.disruptions[name].resolved, `${name} should be resolved`).toBeGreaterThan(0);
    }
  });
});
