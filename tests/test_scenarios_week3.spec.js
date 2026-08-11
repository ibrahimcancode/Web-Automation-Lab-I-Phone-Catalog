// Week 3 scenario test: slow_responses forced on deterministically
// (random_mode=false). Every HTML navigation is delayed by the configured
// min_delay_ms, and the bot must classify each load as slow, record the
// recovery, and continue without retrying or hanging.

import { test, expect } from '@playwright/test';
import { startSite } from './helpers/site.js';
import { runBotOnce } from './helpers/bot.js';

function configFor(scenarios) {
  return {
    enabled: true,
    random_mode: false,
    seed: 42,
    scenarios,
  };
}

// Observed navigation durations reported by the slow_responses recovered events.
function slowDurations(events) {
  return events
    .filter((e) => e.scenario === 'slow_responses' && e.action === 'recovered')
    .map((e) => {
      const m = /loaded in (\d+)ms/.exec(e.detail ?? '');
      return m ? Number(m[1]) : null;
    })
    .filter((d) => d !== null);
}

test.describe('Scenario: slow_responses', () => {
  let site;
  test.beforeAll(async () => {
    site = await startSite(
      configFor({ slow_responses: { enabled: true, probability: 1.0, min_delay_ms: 2500, max_delay_ms: 4000 } }),
      { port: 5226 },
    );
  });
  test.afterAll(async () => site?.close());

  test('bot detects the slow load, recovers in place, and passes without hanging', async () => {
    const { summary, reporter } = await runBotOnce({ baseUrl: site.baseUrl, limit: 2 });
    expect(summary.verdict).toBe('PASS');
    expect(summary.items_processed).toBeGreaterThan(0);
    expect(summary.items_failed).toBe(0);
    expect(summary.data_validation.invalid).toBe(0);

    const d = summary.disruptions.slow_responses;
    expect(d.detected).toBeGreaterThan(0);
    expect(d.resolved).toBeGreaterThan(0);
    expect(d.retries).toBe(0);
    expect(summary.screenshots).toBeGreaterThan(0);

    // Observed duration must meet the configured threshold (min_delay_ms).
    const durations = slowDurations(reporter.events);
    expect(durations.length).toBeGreaterThan(0);
    for (const ms of durations) {
      expect(ms).toBeGreaterThanOrEqual(2500);
    }
  });
});

test.describe('Scenario: unexpected_redirect', () => {
  let site;
  test.beforeAll(async () => {
    site = await startSite(
      configFor({ unexpected_redirect: { enabled: true, probability: 1.0 } }),
      { port: 5227 },
    );
  });
  test.afterAll(async () => site?.close());

  test('bot detects wrong destination, returns to target, and passes with valid extraction', async () => {
    const page = await (await import('../bot/browser.js')).createSession({ headless: true, baseUrl: site.baseUrl }).then((s) => s.page);
    await page.goto(site.baseUrl + '/');
    const windowConfig = await page.evaluate(() => window.__CHAOS_CONFIG__);
    console.log('WINDOW CHAOS CONFIG IN BROWSER:', windowConfig);
    const { summary, reporter } = await runBotOnce({ baseUrl: site.baseUrl, limit: 2 });
    console.log('SUMMARY:', JSON.stringify(summary, null, 2));
    console.log('EVENTS:', reporter.events);
    expect(summary.verdict).toBe('PASS');
    expect(summary.items_processed).toBeGreaterThan(0);
    expect(summary.items_failed).toBe(0);
    expect(summary.data_validation.invalid).toBe(0);
    expect(summary.data_validation.duplicates.length).toBe(0);

    const d = summary.disruptions.unexpected_redirect;
    expect(d.detected).toBeGreaterThan(0);
    expect(d.resolved).toBeGreaterThan(0);
    expect(summary.screenshots).toBeGreaterThan(0);

    const redirectEvents = reporter.events.filter((e) => e.scenario === 'unexpected_redirect');
    expect(redirectEvents.some((e) => e.action === 'detected')).toBe(true);
    expect(redirectEvents.some((e) => e.outcome === 'resolved')).toBe(true);
  });
});

test.describe('Scenario: dom_drift', () => {
  let site;
  test.beforeAll(async () => {
    site = await startSite(
      configFor({ dom_drift: { enabled: true, probability: 1.0 } }),
      { port: 5228 },
    );
  });
  test.afterAll(async () => site?.close());

  test('bot detects DOM drift via fallback selectors and passes with valid extraction', async () => {
    const { summary, reporter } = await runBotOnce({ baseUrl: site.baseUrl, limit: 2 });
    console.log('SUMMARY:', JSON.stringify(summary, null, 2));
    console.log('EVENTS:', reporter.events);
    expect(summary.verdict).toBe('PASS');
    expect(summary.items_processed).toBeGreaterThan(0);
    expect(summary.items_failed).toBe(0);
    expect(summary.data_validation.invalid).toBe(0);
    expect(summary.data_validation.duplicates.length).toBe(0);

    const d = summary.disruptions.dom_drift;
    expect(d.detected).toBeGreaterThan(0);
    expect(d.resolved).toBeGreaterThan(0);
    expect(summary.screenshots).toBeGreaterThan(0);

    const driftEvents = reporter.events.filter((e) => e.scenario === 'dom_drift');
    expect(driftEvents.some((e) => e.action === 'detected')).toBe(true);
    expect(driftEvents.some((e) => e.outcome === 'resolved')).toBe(true);
  });
});
