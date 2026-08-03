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
  test('loads all four Week 2 handlers exactly once', async () => {
    await ensureHandlersLoaded();
    await ensureHandlersLoaded(); // idempotent — must not double-register
    const names = getHandlers().map((h) => h.name).sort();
    expect(names).toEqual(['cookie_banner', 'newsletter_popup', 'server_errors', 'simulated_captcha']);
  });

  test('overlay handlers are ordered by priority', async () => {
    await ensureHandlersLoaded();
    expect(getOverlayHandlers().map((h) => h.name)).toEqual([
      'cookie_banner',
      'newsletter_popup',
      'simulated_captcha',
    ]);
  });

  test('navigation handlers are only server_errors', async () => {
    await ensureHandlersLoaded();
    expect(getNavigationHandlers().map((h) => h.name)).toEqual(['server_errors']);
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