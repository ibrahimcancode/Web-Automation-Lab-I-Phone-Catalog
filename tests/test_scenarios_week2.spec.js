// Week 2 scenario tests: each chaos scenario is forced on deterministically
// (random_mode=false) and the bot must detect and recover from it.
//
// Overlay scenarios (cookie, captcha) run the full workflow and assert
// detect+resolve counts. server_errors is retry-based (no "resolved" state), so
// it asserts detections + retries. The newsletter popup only surfaces ~3s after
// the cookie banner is dismissed, so it is exercised with a targeted flow that
// clears the cookie, waits for the delayed modal, then sweeps it away.

import { test, expect } from '@playwright/test';

test.describe.configure({ timeout: 180_000 });
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startSite } from './helpers/site.js';
import { runBotOnce } from './helpers/bot.js';
import { createSession, closeSession } from '../bot/browser.js';
import { navigateWithGuard, clearObstacles } from '../bot/workflow.js';
import { Reporter } from '../bot/reporting.js';
import { selectors } from '../bot/selectors.js';

function configFor(scenarios) {
  return {
    enabled: true,
    random_mode: false,
    seed: 42,
    scenarios,
  };
}

test.describe('Scenario: cookie_banner', () => {
  let site;
  test.beforeAll(async () => {
    site = await startSite(configFor({ cookie_banner: { enabled: true, probability: 1.0 } }), { port: 5221 });
  });
  test.afterAll(async () => site?.close());

  test('bot accepts the banner and continues', async () => {
    const { summary } = await runBotOnce({ baseUrl: site.baseUrl, limit: 2 });
    expect(summary.verdict).toBe('PASS');
    expect(summary.items_processed).toBeGreaterThan(0);
    expect(summary.disruptions.cookie_banner.detected).toBeGreaterThan(0);
    expect(summary.disruptions.cookie_banner.resolved).toBeGreaterThan(0);
  });
});

test.describe('Scenario: simulated_captcha', () => {
  let site;
  test.beforeAll(async () => {
    site = await startSite(configFor({ simulated_captcha: { enabled: true, probability: 1.0, delay_seconds: 1 } }), { port: 5223 });
  });
  test.afterAll(async () => site?.close());

  test('bot solves the gate and continues', async () => {
    const { summary } = await runBotOnce({ baseUrl: site.baseUrl, limit: 2 });
    expect(summary.verdict).toBe('PASS');
    expect(summary.items_processed).toBeGreaterThan(0);
    expect(summary.disruptions.simulated_captcha.detected).toBeGreaterThan(0);
    expect(summary.disruptions.simulated_captcha.resolved).toBeGreaterThan(0);
  });
});

test.describe('Scenario: server_errors', () => {
  let site;
  test.beforeAll(async () => {
    site = await startSite(
      configFor({ server_errors: { enabled: true, probability: 1.0, status_code: 503, fail_first_n: 2 } }),
      { port: 5224 },
    );
  });
  test.afterAll(async () => site?.close());

  test('bot retries past the transient 503s and still passes', async () => {
    const { summary } = await runBotOnce({ baseUrl: site.baseUrl, limit: 2 });
    expect(summary.verdict).toBe('PASS');
    expect(summary.items_processed).toBeGreaterThan(0);
    const d = summary.disruptions.server_errors;
    expect(d.detected).toBeGreaterThan(0);
    expect(d.retries).toBeGreaterThan(0);
  });
});

test.describe('Scenario: newsletter_popup', () => {
  let site;
  test.beforeAll(async () => {
    // Popup waits for the cookie banner to be dismissed first (collision rule).
    site = await startSite(
      configFor({
        cookie_banner: { enabled: true, probability: 1.0 },
        newsletter_popup: { enabled: true, probability: 1.0, min_delay_seconds: 2, max_delay_seconds: 6 },
      }),
      { port: 5222 },
    );
  });
  test.afterAll(async () => site?.close());

  test('bot clears the cookie, then subscribes and dismisses the modal', async () => {
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-test-newsletter-'));
    const reporter = new Reporter({ runDir, baseUrl: site.baseUrl });
    await reporter.init();
    const session = await createSession({ headless: true, baseUrl: site.baseUrl });
    const { page } = session;

    try {
      const homeCtx = { page, step: 'home' };
      await navigateWithGuard(page, `${site.baseUrl}/`, homeCtx, reporter);
      await page.waitForSelector('.page-home', { state: 'visible' });

      // First sweep clears the cookie banner; that arms the delayed popup.
      await clearObstacles(homeCtx, reporter);

      // The modal appears ~3s after cookie dismissal — wait for it.
      await page.waitForSelector(selectors.chaos.popup.overlay, { state: 'visible', timeout: 12_000 });

      // Second sweep must detect and recover the popup (fill+submit+dismiss).
      await clearObstacles(homeCtx, reporter);
      await page.waitForSelector(selectors.chaos.popup.overlay, { state: 'hidden', timeout: 5000 });

      const news = reporter.events.filter((e) => e.scenario === 'newsletter_popup');
      expect(news.some((e) => e.action === 'detected')).toBe(true);
      expect(news.some((e) => e.action === 'recovered' && e.outcome === 'resolved')).toBe(true);
    } finally {
      await closeSession(session);
    }
  });
});