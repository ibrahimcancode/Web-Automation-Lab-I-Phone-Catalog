// Week 4 E2E tests — visual CAPTCHA fail-safe, HTTP 429 recovery,
// session-expiry recovery, and checkpoint/resume proof.
//
// Each test boots a fresh site instance with a unique port so tests
// remain isolated and can run serially without port collisions.

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startSite } from './helpers/site.js';
import { runBotOnce } from './helpers/bot.js';
import { createSession, closeSession } from '../bot/browser.js';
import { runWorkflow } from '../bot/workflow.js';
import { Reporter } from '../bot/reporting.js';
import { createCheckpoint, readCheckpoint, writeCheckpoint, getCompletedIds } from '../bot/checkpoint.js';
import { CONFIDENCE_THRESHOLD, MAX_CAPTCHA_RETRIES } from '../bot/handlers/captcha_handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function configFor(scenarios) {
  return { enabled: true, random_mode: false, seed: 42, scenarios };
}

// ── Visual CAPTCHA fail-safe ──────────────────────────────────────────
test.describe('Visual CAPTCHA — fail-safe behavior (E2E)', () => {
  test.describe.configure({ timeout: 180_000 });

  /** @type {Awaited<ReturnType<typeof startSite>>} */
  let site;

  test.beforeAll(async () => {
    site = await startSite(
      configFor({
        simulated_captcha: { enabled: true, probability: 1.0, delay_seconds: 1 },
        cookie_banner: { enabled: false },
      }),
      { port: 5240 },
    );
  });

  test.afterAll(async () => {
    await site?.close();
  });

  test('bot detects and resolves the visual CAPTCHA with pixel analysis', async () => {
    const { results, summary, reporter } = await runBotOnce({
      baseUrl: site.baseUrl,
      limit: 2,
    });

    expect(summary.verdict).toBe('PASS');
    expect(results.length).toBe(2);
    expect(results.every((r) => r.status === 'ok')).toBe(true);

    // CAPTCHA was detected and resolved
    expect(summary.disruptions.simulated_captcha.detected).toBeGreaterThan(0);
    expect(summary.disruptions.simulated_captcha.resolved).toBeGreaterThan(0);

    // Event log contains the new structured events
    const events = reporter.events.filter((e) => e.scenario === 'simulated_captcha');
    expect(events.length).toBeGreaterThan(0);

    // Must have tile analysis events
    const tileEvents = events.filter((e) => e.action === 'captcha_tile_analyzed');
    expect(tileEvents.length).toBeGreaterThanOrEqual(9);

    // Must have at least one selection submitted
    const submittedEvents = events.filter((e) => e.action === 'captcha_selection_submitted');
    expect(submittedEvents.length).toBeGreaterThan(0);

    // Confidence threshold and retry cap are exported and correct
    expect(CONFIDENCE_THRESHOLD).toBe(0.5);
    expect(MAX_CAPTCHA_RETRIES).toBe(3);
  });

  test('no arithmetic CAPTCHA code remains in production path', async () => {
    const handlerPath = path.resolve(__dirname, '../bot/handlers/captcha_handler.js');
    const content = fs.readFileSync(handlerPath, 'utf8');
    expect(content).not.toContain('parseMathQuestion');
    expect(content).not.toContain('What is');
    expect(content).not.toContain('arithmetic');
  });
});

// ── HTTP 429 rate-limiting ───────────────────────────────────────────
test.describe('HTTP 429 rate-limiting — recovery (E2E)', () => {
  test.describe.configure({ timeout: 180_000 });

  /** @type {Awaited<ReturnType<typeof startSite>>} */
  let site;

  test.beforeAll(async () => {
    site = await startSite(
      configFor({
        rate_limiting: { enabled: true, probability: 1.0, fail_first_n: 1 },
        cookie_banner: { enabled: false },
        newsletter_popup: { enabled: false },
        simulated_captcha: { enabled: false },
      }),
      { port: 5241 },
    );
  });

  test.afterAll(async () => {
    await site?.close();
  });

  test('bot detects 429, backs off, and eventually succeeds', async () => {
    const { summary } = await runBotOnce({
      baseUrl: site.baseUrl,
      limit: 2,
    });

    expect(summary.verdict).toBe('PASS');
    expect(summary.items_processed).toBeGreaterThan(0);
    expect(summary.items_failed).toBe(0);

    // Rate limiting was detected and resolved (handler claims, not retries)
    expect(summary.disruptions.rate_limiting.detected).toBeGreaterThan(0);
    expect(summary.disruptions.rate_limiting.resolved).toBeGreaterThan(0);

    // No overlay scenarios should have fired
    expect(summary.disruptions.cookie_banner.detected).toBe(0);
    expect(summary.disruptions.simulated_captcha.detected).toBe(0);
  });
});

// ── Session expiry ───────────────────────────────────────────────────
test.describe('Session expiry — recovery (E2E)', () => {
  test.describe.configure({ timeout: 180_000 });

  /** @type {Awaited<ReturnType<typeof startSite>>} */
  let site;

  test.beforeAll(async () => {
    site = await startSite(
      configFor({
        session_expiry: { enabled: true, probability: 1.0, trigger_after_navigations: 4 },
        cookie_banner: { enabled: false },
        newsletter_popup: { enabled: false },
        simulated_captcha: { enabled: false },
      }),
      { port: 5242 },
    );
  });

  test.afterAll(async () => {
    await site?.close();
  });

  test('bot detects expired session, clicks continue, and resumes scraping', async () => {
    const { summary } = await runBotOnce({
      baseUrl: site.baseUrl,
      limit: 2,
    });

    expect(summary.verdict).toBe('PASS');
    expect(summary.items_processed).toBeGreaterThan(0);
    expect(summary.items_failed).toBe(0);

    // Session expiry was detected and resolved
    expect(summary.disruptions.session_expiry.detected).toBeGreaterThan(0);
    expect(summary.disruptions.session_expiry.resolved).toBeGreaterThan(0);
  });
});

// ── Checkpoint / resume ──────────────────────────────────────────────
test.describe('Checkpoint and resume — end to end (E2E)', () => {
  test.describe.configure({ timeout: 240_000 });

  /** @type {Awaited<ReturnType<typeof startSite>>} */
  let site;

  test.beforeAll(async () => {
    site = await startSite(
      configFor({
        cookie_banner: { enabled: false },
        simulated_captcha: { enabled: false },
        newsletter_popup: { enabled: false },
        server_errors: { enabled: false },
        rate_limiting: { enabled: false },
        session_expiry: { enabled: false },
      }),
      { port: 5243 },
    );
  });

  test.afterAll(async () => {
    await site?.close();
  });

  test('bot writes checkpoint during run and resumes from it', async () => {
    // --- Phase 1: initial run processing 2 items ---
    const run1Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-checkpoint-run1-'));
    const reporter1 = new Reporter({ runDir: run1Dir, baseUrl: site.baseUrl });
    await reporter1.init();

    const session1 = await createSession({ headless: true, baseUrl: site.baseUrl });
    try {
      const cp1 = createCheckpoint({
        runId: reporter1.runId,
        runDir: run1Dir,
        baseUrl: site.baseUrl,
      });

      const { results: results1, summary: summary1 } = await runWorkflow({
        session: session1,
        reporter: reporter1,
        limit: 2,
        startedAt: new Date(),
        checkpoint: cp1,
        runDir: run1Dir,
      });

      // Verify initial run succeeded
      expect(summary1.verdict).toBe('PASS');
      expect(results1.length).toBe(2);

      // Verify checkpoint was written to disk
      const savedCp1 = await readCheckpoint(run1Dir);
      expect(savedCp1).not.toBeNull();
      expect(savedCp1.finalized).toBe(true);
      expect(savedCp1.completed_item_ids.length).toBe(2);
      expect(savedCp1.observed_item_ids.length).toBeGreaterThanOrEqual(2);
      expect(savedCp1.results.length).toBe(2);
    } finally {
      await closeSession(session1);
    }

    // --- Phase 2: resume with limit 4, should skip the 2 already done ---
    const run2Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-checkpoint-run2-'));

    // Read the checkpoint from phase 1 and prepare for resume
    const savedCp1 = await readCheckpoint(run1Dir);
    const completedIds = getCompletedIds(savedCp1);
    expect(completedIds.size).toBe(2);

    // Write the checkpoint into the new run dir so the workflow can find it
    await writeCheckpoint(run2Dir, savedCp1);

    const reporter2 = new Reporter({ runDir: run2Dir, baseUrl: site.baseUrl });
    await reporter2.init();

    const session2 = await createSession({ headless: true, baseUrl: site.baseUrl });
    try {
      const cp2 = await readCheckpoint(run2Dir);
      const { results: results2, summary: summary2 } = await runWorkflow({
        session: session2,
        reporter: reporter2,
        limit: 4,
        startedAt: new Date(),
        checkpoint: cp2,
        runDir: run2Dir,
      });

      // Resume should have produced new results beyond the 2 completed ones
      expect(results2.length).toBeGreaterThanOrEqual(3);
      expect(summary2.resumed).toBe(true);

      // The newly processed items must not overlap with the original 2
      const newResults = results2.filter((r) => !completedIds.has(r.id));
      expect(newResults.length).toBeGreaterThanOrEqual(1);
      for (const r of newResults) {
        expect(completedIds.has(r.id)).toBe(false);
      }

      // Checkpoint finalized again
      const finalCp = await readCheckpoint(run2Dir);
      expect(finalCp.finalized).toBe(true);
      expect(finalCp.completed_item_ids.length).toBeGreaterThanOrEqual(3);
    } finally {
      await closeSession(session2);
    }
  });
});
