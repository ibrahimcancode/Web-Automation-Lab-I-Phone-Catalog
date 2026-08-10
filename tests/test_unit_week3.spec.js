// Week 3 unit tests: pure modules only — navigation-duration classification, the
// slow_responses handler contract, and buildSummary aggregation for the new
// scenario. No browser or site required.

import { test, expect } from '@playwright/test';
import {
  classifyNavigationDuration,
  DEFAULT_SLOW_THRESHOLD_MS,
  DEFAULT_DEADLINE_MS,
} from '../bot/timeouts.js';
import {
  ensureHandlersLoaded,
  getHandlers,
  getNavigationHandlers,
} from '../bot/handlers/index.js';
import slowResponseHandler from '../bot/handlers/slow_response_handler.js';
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
    expect(getNavigationHandlers().map((h) => h.name)).toEqual(['server_errors', 'slow_responses', 'unexpected_redirect']);
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
