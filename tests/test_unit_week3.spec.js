// Week 3 unit tests: pure modules only — navigation-duration classification, the
// slow_responses handler contract, and buildSummary aggregation for the new
// scenario. No browser or site required.

import { test, expect } from '@playwright/test';
import { classifyNavigationDuration, DEFAULT_SLOW_THRESHOLD_MS, DEFAULT_DEADLINE_MS } from '../bot/timeouts.js';
import { ensureHandlersLoaded, getHandlers, getNavigationHandlers } from '../bot/handlers/index.js';
import slowResponseHandler from '../bot/handlers/slow_response_handler.js';
import domDriftHandler from '../bot/handlers/dom_drift_handler.js';
import blockedClicksHandler from '../bot/handlers/blocked_clicks_handler.js';
import rateLimitHandler from '../bot/handlers/rate_limit_handler.js';
import sessionExpiryHandler from '../bot/handlers/session_expiry_handler.js';
import { getSelector, getSelectorChain } from '../bot/selectors.js';
import { buildSummary } from '../bot/reporting.js';

test.describe('classifyNavigationDuration', () => {
  test('classifies fast loads as normal', () => {
    expect(classifyNavigationDuration(0)).toBe('normal');
    expect(classifyNavigationDuration(DEFAULT_SLOW_THRESHOLD_MS - 1)).toBe('normal');
  });

  test('classifies slow-but-loaded as slow (threshold inclusive)', () => {
    expect(classifyNavigationDuration(DEFAULT_SLOW_THRESHOLD_MS)).toBe('slow');
    expect(classifyNavigationDuration(4000)).toBe('slow');
  });

  test('classifies durations at or beyond the deadline as dead', () => {
    expect(classifyNavigationDuration(DEFAULT_DEADLINE_MS)).toBe('dead');
    expect(classifyNavigationDuration(DEFAULT_DEADLINE_MS + 1)).toBe('dead');
  });

  test('treats missing/invalid durations as dead', () => {
    expect(classifyNavigationDuration(undefined)).toBe('dead');
    expect(classifyNavigationDuration(null)).toBe('dead');
    expect(classifyNavigationDuration(NaN)).toBe('dead');
    expect(classifyNavigationDuration(-1)).toBe('dead');
  });

  test('honors custom thresholds', () => {
    const opts = { slowThresholdMs: 2000, deadlineMs: 3000 };
    expect(classifyNavigationDuration(2500, opts)).toBe('slow');
    expect(classifyNavigationDuration(3000, opts)).toBe('dead');
  });
});

test.describe('slow_responses handler', () => {
  test('is registered as a navigation handler', async () => {
    await ensureHandlersLoaded();
    expect(getHandlers().map((h) => h.name)).toContain('slow_responses');
    expect(getNavigationHandlers().map((h) => h.name)).toEqual([
      'rate_limiting',
      'session_expiry',
      'server_errors',
      'slow_responses',
      'unexpected_redirect',
    ]);
  });

  test('detect claims a slow-but-loaded response', () => {
    expect(slowResponseHandler.detect({ response: { status: () => 200 }, navigationMs: 2500 })).toBe(true);
  });

  test('detect ignores fast loads', () => {
    expect(slowResponseHandler.detect({ response: { status: () => 200 }, navigationMs: 300 })).toBe(false);
  });

  test('detect defers errors and 5xx to server_errors', () => {
    expect(slowResponseHandler.detect({ error: new Error('net::ERR'), navigationMs: 2500 })).toBe(false);
    expect(slowResponseHandler.detect({ response: { status: () => 503 }, navigationMs: 2500 })).toBe(false);
  });

  test('recover marks the state resolved without retry', () => {
    expect(slowResponseHandler.recover({ navigationMs: 2500 })).toEqual({
      retry: false,
      outcome: 'resolved',
      detail: 'loaded in 2500ms',
    });
  });
});

function validItem(overrides = {}) {
  return {
    id: 'iphone-16e',
    name: 'iPhone 16e',
    tier: 'Standard',
    year: 2025,
    price: 499,
    color: 'Black',
    storageGBs: [128, 256],
    status: 'ok',
    ...overrides,
  };
}

test.describe('buildSummary (slow_responses)', () => {
  test('aggregates slow_responses detections and resolutions', () => {
    const events = [
      { scenario: 'slow_responses', action: 'detected', outcome: 'detected' },
      { scenario: 'slow_responses', action: 'recovered', outcome: 'resolved', detail: 'loaded in 2521ms' },
      { scenario: 'server_errors', action: 'detected', outcome: 'detected' },
      { scenario: 'server_errors', action: 'retry', outcome: 'retrying' },
    ];
    const summary = buildSummary({
      events,
      results: [validItem()],
      runMeta: { run_id: 'test-run' },
    });
    expect(summary.disruptions.slow_responses).toEqual({ detected: 1, resolved: 1, retries: 0 });
    expect(summary.disruptions.server_errors).toEqual({ detected: 1, resolved: 0, retries: 1 });
    expect(summary.retries_total).toBe(1);
    expect(summary.verdict).toBe('PASS');
  });
});

test.describe('selector fallback chains (Scenario 7)', () => {
  test('getSelector returns the primary selector for chain keys (backward compat)', () => {
    expect(getSelector('catalog.card')).toBe('.catalog-grid .product-card');
    expect(getSelector('catalog.loadMore')).toBe('.catalog-grid button.load-more');
    expect(getSelector('detail.title')).toBe('.page-detail .detail-header h1');
    expect(getSelector('home.page')).toBe('.page-home');
    expect(getSelector('chaos.popup.input')).toBe('#newsletter-popup .chaos-popup-input');
  });

  test('getSelectorChain returns the full ordered chain for drift-aware keys', () => {
    expect(getSelectorChain('catalog.card')).toEqual([
      '.catalog-grid .product-card',
      '.catalog-grid-alt1 .product-card-alt1',
      '.product-list.alt2 .product-item.alt2',
    ]);
    expect(getSelectorChain('catalog.page')).toEqual(['.page-catalog', '.page-catalog-alt1', '.page-catalog-alt2']);
  });

  test('getSelectorChain treats plain string leaves as single-selector chains', () => {
    expect(getSelectorChain('chaos.popup.input')).toEqual(['#newsletter-popup .chaos-popup-input']);
    expect(getSelectorChain('nope.missing')).toEqual([]);
  });
});

test.describe('dom_drift handler (Scenario 7)', () => {
  test('is registered as an overlay handler', async () => {
    await ensureHandlersLoaded();
    expect(getHandlers().map((h) => h.name)).toContain('dom_drift');
    expect(domDriftHandler.type).toBe('overlay');
  });

  test('recover reports resolved when no drift is currently detected', async () => {
    const rec = await domDriftHandler.recover({});
    expect(rec.outcome).toBe('resolved');
  });

  test('buildSummary counts dom_drift fallback evidence as resolved', () => {
    const summary = buildSummary({
      events: [
        { scenario: 'dom_drift', action: 'detected', outcome: 'detected' },
        {
          scenario: 'dom_drift',
          action: 'fallback_used',
          outcome: 'resolved',
          detail: 'catalog.card: primary(s) [...] failed → fallback [...]',
        },
        { scenario: 'dom_drift', action: 'recovered', outcome: 'resolved', detail: 'selector drift: catalog.card' },
      ],
      results: [validItem()],
      runMeta: { run_id: 'test-run' },
    });
    expect(summary.disruptions.dom_drift).toEqual({ detected: 1, resolved: 2, retries: 0 });
  });
});

test.describe('blocked_clicks handler (Scenario 8)', () => {
  test('is registered as an overlay handler', async () => {
    await ensureHandlersLoaded();
    expect(getHandlers().map((h) => h.name)).toContain('blocked_clicks');
    expect(blockedClicksHandler.type).toBe('overlay');
  });

  test('detect reports no blocker when the page has no load-more button', async () => {
    const page = {
      evaluate: async () => false,
    };
    expect(await blockedClicksHandler.detect({ page })).toBe(false);
  });

  test('recover resolves with the number of removed blockers', async () => {
    const page = { evaluate: async () => 2 };
    const rec = await blockedClicksHandler.recover({ page });
    expect(rec.outcome).toBe('resolved');
    expect(rec.detail).toMatch(/removed 2 click blocker/);
    expect(rec.retry).toBe(true);
  });

  test('recover resolves with zero when nothing is blocked', async () => {
    const page = { evaluate: async () => 0 };
    const rec = await blockedClicksHandler.recover({ page });
    expect(rec.outcome).toBe('resolved');
    expect(rec.detail).toMatch(/removed 0 click blocker/);
  });

  test('buildSummary counts blocked_clicks detected/resolved evidence', () => {
    const summary = buildSummary({
      events: [
        { scenario: 'blocked_clicks', action: 'detected', outcome: 'detected' },
        { scenario: 'blocked_clicks', action: 'recovered', outcome: 'resolved', detail: 'removed 1 click blocker(s)' },
        { scenario: 'workflow', action: 'load_more', outcome: 'ok' },
      ],
      results: [validItem()],
      runMeta: { run_id: 'test-run' },
    });
    expect(summary.disruptions.blocked_clicks).toEqual({ detected: 1, resolved: 1, retries: 0 });
  });
});

test.describe('rate_limiting handler (Scenario 9)', () => {
  test('is registered as a navigation handler', async () => {
    await ensureHandlersLoaded();
    expect(getHandlers().map((h) => h.name)).toContain('rate_limiting');
    expect(getNavigationHandlers().map((h) => h.name)).toContain('rate_limiting');
  });

  test('detect claims a 429 response', async () => {
    expect(await rateLimitHandler.detect({ response: { status: () => 429 } })).toBe(true);
  });

  test('detect ignores non-429 responses', async () => {
    expect(await rateLimitHandler.detect({ response: { status: () => 200 } })).toBe(false);
    expect(await rateLimitHandler.detect({ response: { status: () => 503 } })).toBe(false);
    expect(await rateLimitHandler.detect({ response: null })).toBe(false);
  });

  test('recover returns retry with backoff waitMs (real Playwright headers() API)', async () => {
    const response = { status: () => 429, headers: async () => ({ 'retry-after': '1' }) };
    const rec = await rateLimitHandler.recover({ response });
    expect(rec.retry).toBe(true);
    expect(rec.waitMs).toBeGreaterThanOrEqual(1000);
    expect(rec.detail).toMatch(/backoff/);
  });

  test('recover honors the actual Retry-After header value', async () => {
    const response = { status: () => 429, headers: async () => ({ 'retry-after': '3' }) };
    const rec = await rateLimitHandler.recover({ response });
    expect(rec.retry).toBe(true);
    expect(rec.waitMs).toBe(3000);
    expect(rec.detail).toContain('3s');
  });

  test('recover stays bounded and defaults when Retry-After is missing or invalid', async () => {
    const missing = await rateLimitHandler.recover({ response: { status: () => 429, headers: async () => ({}) } });
    expect(missing.waitMs).toBe(1000);

    const invalid = await rateLimitHandler.recover({
      response: { status: () => 429, headers: async () => ({ 'retry-after': 'not-a-number' }) },
    });
    expect(invalid.waitMs).toBe(1000);

    const huge = await rateLimitHandler.recover({
      response: { status: () => 429, headers: async () => ({ 'retry-after': '120' }) },
    });
    expect(huge.waitMs).toBe(30000);
  });

  test('buildSummary counts rate_limiting evidence', () => {
    const summary = buildSummary({
      events: [
        { scenario: 'rate_limiting', action: 'detected', outcome: 'detected' },
        { scenario: 'rate_limiting', action: 'recovered', outcome: 'resolved', detail: 'retried after 1s backoff' },
      ],
      results: [validItem()],
      runMeta: { run_id: 'test-run' },
    });
    expect(summary.disruptions.rate_limiting).toEqual({ detected: 1, resolved: 1, retries: 0 });
  });
});

test.describe('session_expiry handler (Scenario 10)', () => {
  test('is registered as a navigation handler', async () => {
    await ensureHandlersLoaded();
    expect(getHandlers().map((h) => h.name)).toContain('session_expiry');
    expect(getNavigationHandlers().map((h) => h.name)).toContain('session_expiry');
  });

  test('detect claims when interstitial is visible', async () => {
    const page = { isVisible: async () => true };
    expect(await sessionExpiryHandler.detect({ page })).toBe(true);
  });

  test('detect returns false when interstitial is absent', async () => {
    const page = { isVisible: async () => false };
    expect(await sessionExpiryHandler.detect({ page })).toBe(false);
  });

  test('recover returns resolved after clicking continue', async () => {
    const page = {
      waitForSelector: async () => ({ click: async () => {} }),
      waitForNavigation: async () => {},
    };
    const rec = await sessionExpiryHandler.recover({ page });
    expect(rec.outcome).toBe('resolved');
    expect(rec.detail).toMatch(/session restored/);
  });

  test('buildSummary counts session_expiry evidence', () => {
    const summary = buildSummary({
      events: [
        { scenario: 'session_expiry', action: 'detected', outcome: 'detected' },
        {
          scenario: 'session_expiry',
          action: 'recovered',
          outcome: 'resolved',
          detail: 'clicked continue, session restored',
        },
      ],
      results: [validItem()],
      runMeta: { run_id: 'test-run' },
    });
    expect(summary.disruptions.session_expiry).toEqual({ detected: 1, resolved: 1, retries: 0 });
  });
});
