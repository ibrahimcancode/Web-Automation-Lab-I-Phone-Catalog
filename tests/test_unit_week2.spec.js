// Week 2 unit tests: pure modules only — backoff math, the captcha question
// parser, the handler registry contract, and selector-map completeness. No
// browser or site required.

import { test, expect } from '@playwright/test';
import { selectors, getSelector, assertSelectorMapComplete } from '../bot/selectors.js';
import {
  nextRetryDelayMs,
  maxRetries,
  isRetryExhausted,
  retrySchedule,
  DEFAULT_BACKOFF,
} from '../bot/backoff.js';
import { parseMathQuestion } from '../bot/handlers/captcha_handler.js';
import {
  ensureHandlersLoaded,
  getHandlers,
  getOverlayHandlers,
  getNavigationHandlers,
} from '../bot/handlers/index.js';
import { validateExtractedItem, validateExtractedItems, VALID_TIERS } from '../bot/validate.js';
import { buildSummary } from '../bot/reporting.js';

test.describe('backoff', () => {
  test('produces an exponential schedule capped at maxMs', () => {
    expect(nextRetryDelayMs(1)).toBe(1000);
    expect(nextRetryDelayMs(2)).toBe(2000);
    expect(nextRetryDelayMs(3)).toBe(4000);
    expect(nextRetryDelayMs(4)).toBe(8000);
    expect(nextRetryDelayMs(5)).toBe(8000);
    expect(nextRetryDelayMs(0)).toBe(0);
  });

  test('honors custom base, factor, and maxMs', () => {
    const opts = { baseMs: 100, factor: 3, maxMs: 5000 };
    expect(nextRetryDelayMs(1, opts)).toBe(100);
    expect(nextRetryDelayMs(2, opts)).toBe(300);
    expect(nextRetryDelayMs(3, opts)).toBe(900);
    expect(nextRetryDelayMs(4, opts)).toBe(2700);
    expect(nextRetryDelayMs(5, opts)).toBe(5000);
  });

  test('caps retries and detects exhaustion', () => {
    expect(DEFAULT_BACKOFF.maxAttempts).toBe(4);
    expect(maxRetries()).toBe(4);
    expect(isRetryExhausted(4)).toBe(false);
    expect(isRetryExhausted(5)).toBe(true);
    expect(retrySchedule()).toEqual([1000, 2000, 4000, 8000]);
  });
});

test.describe('captcha question parser', () => {
  test('parses addition', () => {
    const parsed = parseMathQuestion('What is 7 + 3?');
    expect(parsed).toEqual({ a: 7, op: '+', b: 3, answer: 10 });
  });

  test('parses subtraction including negatives', () => {
    expect(parseMathQuestion('What is 3 - 7?').answer).toBe(-4);
    expect(parseMathQuestion('What is 10 - 4?').answer).toBe(6);
  });

  test('parses negative first operand', () => {
    expect(parseMathQuestion('What is -2 + 5?').answer).toBe(3);
  });

  test('returns null for unparseable text', () => {
    expect(parseMathQuestion('')).toBeNull();
    expect(parseMathQuestion('please solve 3x=9')).toBeNull();
    expect(parseMathQuestion('What is 2 * 3?')).toBeNull();
  });
});

test.describe('handler registry', () => {
  test('loads all five Week 3 handlers exactly once', async () => {
    await ensureHandlersLoaded();
    await ensureHandlersLoaded(); // idempotent — must not double-register
    const names = getHandlers().map((h) => h.name).sort();
    expect(names).toEqual(['cookie_banner', 'newsletter_popup', 'server_errors', 'simulated_captcha', 'slow_responses']);
  });

  test('overlay handlers are ordered by priority', async () => {
    await ensureHandlersLoaded();
    expect(getOverlayHandlers().map((h) => h.name)).toEqual([
      'cookie_banner',
      'newsletter_popup',
      'simulated_captcha',
    ]);
  });

  test('navigation handlers are server_errors and slow_responses', async () => {
    await ensureHandlersLoaded();
    expect(getNavigationHandlers().map((h) => h.name)).toEqual(['server_errors', 'slow_responses']);
  });

  test('every handler exposes the contract', async () => {
    await ensureHandlersLoaded();
    for (const h of getHandlers()) {
      expect(typeof h.name).toBe('string');
      expect(['overlay', 'navigation']).toContain(h.type);
      expect(typeof h.detect).toBe('function');
      expect(typeof h.recover).toBe('function');
    }
  });
});

test.describe('selector map', () => {
  const requiredKeys = [
    'nav.home',
    'nav.catalog',
    'nav.compare',
    'nav.favorites',
    'catalog.page',
    'catalog.resultCount',
    'catalog.card',
    'catalog.cardLink',
    'catalog.cardName',
    'catalog.loadMore',
    'catalog.emptyState',
    'detail.page',
    'detail.title',
    'detail.tier',
    'detail.year',
    'detail.priceLabel',
    'detail.priceValue',
    'detail.storageOptions',
    'detail.colorLabel',
    'detail.specSheet',
    'detail.keyFeatures',
    'detail.similarModels',
    'chaos.cookie.banner',
    'chaos.cookie.accept',
    'chaos.cookie.reject',
    'chaos.popup.overlay',
    'chaos.popup.dialog',
    'chaos.popup.input',
    'chaos.popup.subscribe',
    'chaos.popup.close',
    'chaos.popup.success',
    'chaos.captcha.overlay',
    'chaos.captcha.checkbox',
    'chaos.captcha.question',
    'chaos.captcha.input',
    'chaos.captcha.submit',
    'chaos.captcha.error',
  ];

  test('all selectors referenced by the bot resolve', () => {
    const { missing, ok } = assertSelectorMapComplete(requiredKeys);
    expect({ missing, ok }).toEqual({ missing: [], ok: true });
  });

  test('every leaf selector is a non-empty string', () => {
    const walk = (node, prefix) => {
      for (const [key, value] of Object.entries(node)) {
        const pathKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') {
          expect(value.length, pathKey).toBeGreaterThan(0);
        } else {
          walk(value, pathKey);
        }
      }
    };
    walk(selectors, '');
  });

  test('key handler selectors are correct', () => {
    expect(getSelector('chaos.popup.input')).toBe('#newsletter-popup .chaos-popup-input');
    expect(getSelector('chaos.captcha.overlay')).toBe('#simulated-captcha-overlay');
    expect(getSelector('chaos.cookie.banner')).toBe('#cookie-banner');
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

test.describe('validateExtractedItem', () => {
  test('accepts a valid extracted item', () => {
    expect(validateExtractedItem(validItem())).toEqual([]);
    expect(VALID_TIERS).toContain('Pro Max');
  });

  test('flags each missing required field', () => {
    const errors = validateExtractedItem({});
    expect(errors).toEqual([
      'Missing required field: id',
      'Missing required field: name',
      'Missing required field: tier',
      'Missing required field: year',
      'Missing required field: price',
    ]);
  });

  test('flags empty-string required fields', () => {
    const errors = validateExtractedItem({ id: '', name: '', tier: '', year: '', price: '' });
    expect(errors.filter((e) => e.startsWith('Missing required field'))).toHaveLength(5);
  });

  test('rejects invalid field values', () => {
    expect(validateExtractedItem(validItem({ tier: 'Not-A-Tier' }))).toEqual(['Invalid tier: Not-A-Tier']);
    expect(validateExtractedItem(validItem({ year: 1999 }))).toEqual(['Year out of range: 1999']);
    expect(validateExtractedItem(validItem({ year: 2099 }))).toEqual(['Year out of range: 2099']);
    expect(validateExtractedItem(validItem({ price: -5 }))).toEqual(['Invalid price: -5']);
    expect(validateExtractedItem(validItem({ price: 'abc' }))).toEqual(['Invalid price: abc']);
    expect(validateExtractedItem(validItem({ id: 'iPhone 16E!' }))).toEqual(['id must be lowercase and URL-safe']);
  });

  test('accepts a string price that cleans to a number', () => {
    expect(validateExtractedItem(validItem({ price: '$1,299' }))).toEqual([]);
  });
});

test.describe('validateExtractedItems', () => {
  test('reports total / valid / invalid counts for a mixed list', () => {
    const result = validateExtractedItems([
      validItem(),
      validItem({ id: 'iphone-17' }),
      validItem({ tier: 'Bogus' }),
    ]);
    expect(result.total).toBe(3);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(1);
    expect(result.ok).toBe(false);
  });

  test('detects duplicate ids', () => {
    const result = validateExtractedItems([validItem(), validItem({ name: 'Second copy' })]);
    expect(result.duplicates).toEqual(['iphone-16e']);
    expect(result.ok).toBe(false);
  });

  test('is ok for a clean, unique list', () => {
    const result = validateExtractedItems([validItem(), validItem({ id: 'iphone-17' })]);
    expect(result.duplicates).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

test.describe('buildSummary', () => {
  test('returns PASS with no failure reasons for a clean run', () => {
    const summary = buildSummary({
      events: [],
      results: [validItem(), validItem({ id: 'iphone-17' })],
      runMeta: { run_id: 'test-run' },
      config: { baseUrl: 'http://x', limit: 2, screenshots: 3 },
    });
    expect(summary.verdict).toBe('PASS');
    expect(summary.failure_reasons).toEqual([]);
    expect(summary.items_requested).toBe(2);
    expect(summary.items_processed).toBe(2);
    expect(summary.items_failed).toBe(0);
    expect(summary.data_validation.valid).toBe(2);
    expect(summary.data_validation.invalid).toBe(0);
    expect(summary.screenshots).toBe(3);
  });

  test('returns FAIL with a meaningful reason when extracted data is invalid', () => {
    const summary = buildSummary({
      events: [],
      results: [validItem({ tier: 'Bogus' })],
      runMeta: { run_id: 'test-run' },
    });
    expect(summary.verdict).toBe('FAIL');
    expect(summary.failure_reasons).toEqual(['data validation: 1 invalid item(s)']);
  });

  test('returns FAIL when a workflow item failed', () => {
    const summary = buildSummary({
      events: [],
      results: [validItem({ id: 'iphone-broken', status: 'failed', error: 'boom' })],
      runMeta: { run_id: 'test-run' },
    });
    expect(summary.verdict).toBe('FAIL');
    expect(summary.items_failed).toBe(1);
    expect(summary.failure_reasons).toEqual(['workflow: 1 item(s) failed']);
  });

  test('fails with both reasons when data is invalid and the item also failed', () => {
    const summary = buildSummary({
      events: [],
      results: [validItem({ id: 'iphone-broken', name: null, tier: null, year: null, price: null, status: 'failed', error: 'boom' })],
      runMeta: { run_id: 'test-run' },
    });
    expect(summary.verdict).toBe('FAIL');
    expect(summary.failure_reasons).toEqual([
      'data validation: 1 invalid item(s)',
      'workflow: 1 item(s) failed',
    ]);
  });

  test('aggregates detected / resolved / retries per scenario', () => {
    const events = [
      { scenario: 'cookie_banner', action: 'detected', outcome: 'detected' },
      { scenario: 'cookie_banner', action: 'recovered', outcome: 'resolved' },
      { scenario: 'newsletter_popup', action: 'detected', outcome: 'detected' },
      { scenario: 'newsletter_popup', action: 'recovered', outcome: 'resolved' },
      { scenario: 'simulated_captcha', action: 'detected', outcome: 'detected' },
      { scenario: 'simulated_captcha', action: 'recovered', outcome: 'resolved' },
      { scenario: 'server_errors', action: 'detected', outcome: 'detected' },
      { scenario: 'server_errors', action: 'retry', outcome: 'retrying', detail: 'attempt 1/4' },
      { scenario: 'server_errors', action: 'retry', outcome: 'retrying', detail: 'attempt 2/4' },
      { scenario: 'workflow', action: 'extracted', outcome: 'ok' },
    ];
    const summary = buildSummary({
      events,
      results: [validItem()],
      runMeta: { run_id: 'test-run' },
    });
    expect(summary.verdict).toBe('PASS');
    expect(summary.disruptions.cookie_banner).toEqual({ detected: 1, resolved: 1, retries: 0 });
    expect(summary.disruptions.newsletter_popup).toEqual({ detected: 1, resolved: 1, retries: 0 });
    expect(summary.disruptions.simulated_captcha).toEqual({ detected: 1, resolved: 1, retries: 0 });
    expect(summary.disruptions.server_errors).toEqual({ detected: 1, resolved: 0, retries: 2 });
    expect(summary.retries_total).toBe(2);
  });

  test('carries run metadata into the summary', () => {
    const startedAt = new Date('2026-08-10T00:00:00Z');
    const endedAt = new Date('2026-08-10T00:01:00Z');
    const summary = buildSummary({
      events: [],
      results: [validItem()],
      runMeta: { run_id: 'run-abc' },
      config: { baseUrl: 'http://localhost:5173', limit: 1, startedAt, endedAt, durationMs: 60000, screenshots: 5 },
    });
    expect(summary.run_id).toBe('run-abc');
    expect(summary.base_url).toBe('http://localhost:5173');
    expect(summary.limit).toBe(1);
    expect(summary.duration_ms).toBe(60000);
    expect(summary.screenshots).toBe(5);
  });
});