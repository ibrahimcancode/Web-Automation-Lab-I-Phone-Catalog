// Happy-path end-to-end test: chaos fully disabled, the bot should walk the
// catalog and extract valid items with zero disruptions detected.

import { test, expect } from '@playwright/test';
import { startSite } from './helpers/site.js';
import { runBotOnce } from './helpers/bot.js';

const CHAOS_OFF = { enabled: false, random_mode: false, seed: 42, scenarios: {} };

test.describe('Happy path (chaos disabled)', () => {
  let site;

  test.beforeAll(async () => {
    site = await startSite(CHAOS_OFF, { port: 5211 });
  });

  test.afterAll(async () => {
    await site?.close();
  });

  test('bot extracts items with no disruptions', async () => {
    const { results, summary } = await runBotOnce({ baseUrl: site.baseUrl, limit: 3 });

    expect(summary.verdict).toBe('PASS');
    expect(summary.items_processed).toBeGreaterThan(0);
    expect(summary.items_failed).toBe(0);
    expect(summary.failure_reasons).toEqual([]);
    expect(results.length).toBe(3);
    for (const item of results) {
      expect(item.status).toBe('ok');
    }

    const totalDetected = Object.values(summary.disruptions).reduce((sum, d) => sum + d.detected, 0);
    expect(totalDetected).toBe(0);
  });
});
