// Centralized selectors for the whole bot.
//
// Week 3 (Scenario 7, DOM drift) extends this module into fallback chains. Each
// logical element maps to an array of selectors tried in order:
//   index 0 → the primary selector (the original, non-drifted DOM)
//   index 1+ → fallback selectors (alternate DOM variants produced by the
//              sandbox `dom_drift` scenario)
//
// Backward compatibility: `getSelector(key)` returns the primary selector as a
// plain string (or the leaf string when the value is a string), so code that
// expects a selector string keeps working unchanged.

export const selectors = {
  nav: {
    home: 'nav.desktop-nav a[href="/"]',
    catalog: 'nav.desktop-nav a[href="/catalog"]',
    compare: 'nav.desktop-nav a[href="/compare"]',
    favorites: 'nav.desktop-nav a[href="/favorites"]',
  },

  home: {
    page: ['.page-home', '.page-home-alt1', '.page-home-alt2'],
  },

  catalog: {
    page: ['.page-catalog', '.page-catalog-alt1', '.page-catalog-alt2'],
    resultCount: ['.result-count', '.result-count-alt1', '.result-count-alt2'],
    card: [
      '.catalog-grid .product-card',
      '.catalog-grid-alt1 .product-card-alt1',
      '.product-list.alt2 .product-item.alt2',
    ],
    cardLink: [
      '.catalog-grid .product-card a.card-link',
      '.catalog-grid-alt1 .product-card-alt1 a.card-link-alt1',
      '.product-list.alt2 .product-item.alt2 a.item-link',
    ],
    cardName: [
      '.catalog-grid .product-card .card-name a',
      '.catalog-grid-alt1 .product-card-alt1 .card-name-alt1 a',
      '.product-list.alt2 .product-item.alt2 .item-title a',
    ],
    loadMore: [
      '.catalog-grid button.load-more',
      '.catalog-grid-alt1 button.load-more-alt1',
      '.product-list.alt2 button.load-more.alt2',
    ],
    emptyState: ['.empty-state', '.empty-state-alt1', '.empty-state-alt2'],
  },

  detail: {
    page: ['.page-detail', '.page-detail-alt1', '.page-detail-alt2'],
    title: [
      '.page-detail .detail-header h1',
      '.page-detail-alt1 .detail-header-alt1 h1',
      '.page-detail-alt2 .detail-header-alt2 h1',
    ],
    tier: [
      '.page-detail .detail-header .tier-badge',
      '.page-detail-alt1 .detail-header-alt1 .tier-badge-alt1',
      '.page-detail-alt2 .detail-header-alt2 .tier-badge-alt2',
    ],
    year: ['.page-detail .detail-year', '.page-detail-alt1 .detail-year-alt1', '.page-detail-alt2 .detail-year-alt2'],
    priceLabel: [
      '.page-detail .price-label',
      '.page-detail-alt1 .price-label-alt1',
      '.page-detail-alt2 .price-label-alt2',
    ],
    priceValue: [
      '.page-detail .price-value',
      '.page-detail-alt1 .price-value-alt1',
      '.page-detail-alt2 .price-value-alt2',
    ],
    storageOptions: [
      '.page-detail .storage-options .storage-btn',
      '.page-detail-alt1 .storage-options-alt1 .storage-btn-alt1',
      '.page-detail-alt2 .storage-options-alt2 .storage-btn-alt2',
    ],
    colorLabel: [
      '.page-detail .color-label',
      '.page-detail-alt1 .color-label-alt1',
      '.page-detail-alt2 .color-label-alt2',
    ],
    specSheet: ['.page-detail .spec-sheet', '.page-detail-alt1 .spec-sheet-alt1', '.page-detail-alt2 .spec-sheet-alt2'],
    keyFeatures: [
      '.page-detail .key-features li',
      '.page-detail-alt1 .key-features-alt1 li',
      '.page-detail-alt2 .key-features-alt2 li',
    ],
    similarModels: [
      '.page-detail .similar-models .card-grid .product-card',
      '.page-detail-alt1 .similar-models-alt1 .card-grid-alt1 .product-card-alt1',
      '.page-detail-alt2 .similar-models-alt2 .card-grid-alt2 .product-card-alt2',
    ],
  },

  chaos: {
    cookie: {
      banner: '#cookie-banner',
      accept: '#cookie-banner .chaos-btn-accept',
      reject: '#cookie-banner .chaos-btn-reject',
    },
    popup: {
      overlay: '.chaos-popup-overlay[data-chaos="popup"]',
      dialog: '#newsletter-popup',
      input: '#newsletter-popup .chaos-popup-input',
      subscribe: '#newsletter-popup .chaos-btn-subscribe',
      close: '#newsletter-popup .chaos-popup-close',
      success: '.chaos-popup-success',
    },
    captcha: {
      overlay: '#simulated-captcha-overlay',
      grid: '.chaos-captcha-grid',
      tile: '.chaos-captcha-tile',
      submit: '.chaos-captcha-submit',
    },
  },
};

// Validate that every logical element referenced by the workflow exists here.
// Unit-tested so a typo in a selector key surfaces as a test failure, not a
// mysterious bot bug.
export function assertSelectorMapComplete(requiredKeys) {
  const missing = requiredKeys.filter((key) => !getSelector(key));
  return {
    missing,
    ok: missing.length === 0,
  };
}

// Flattened lookup keyed by "module.element" (e.g. "catalog.card"). Returns the
// primary selector as a plain string for backward compatibility.
export function getSelector(key) {
  const parts = key.split('.');
  let node = selectors;
  for (const part of parts) {
    if (node == null) return undefined;
    node = node[part];
  }
  if (typeof node === 'string') return node;
  if (Array.isArray(node) && node.length > 0) return node[0];
  return undefined;
}

// Get the full ordered fallback chain for a key. Returns [string] for plain
// string selectors so callers can treat every leaf uniformly.
export function getSelectorChain(key) {
  const parts = key.split('.');
  let node = selectors;
  for (const part of parts) {
    if (node == null) return [];
    node = node[part];
  }
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.filter(Boolean);
  return [];
}

// Bounded wait per chain attempt. The primary selector legitimately does NOT
// exist under DOM drift, so trying it must fail fast (not burn Playwright's
// 30s default) before the fallback selector is tried.
const CHAIN_ATTEMPT_TIMEOUT_MS = 3000;

// Try multiple selectors in order until one matches, using waitForSelector.
// The chain is resolved in Node context — only plain selector strings are passed
// into the browser. Returns the matched element. Logs the fallback via the
// optional `onFallback` callback: (key, failedSelectors, matchedSelector).
export async function waitForSelectorChain(page, key, options = {}, onFallback = null) {
  const chain = getSelectorChain(key);
  if (chain.length === 0) {
    throw new Error(`No selector chain for key: ${key}`);
  }
  const attemptOptions = { ...options, timeout: options.timeout ?? CHAIN_ATTEMPT_TIMEOUT_MS };
  for (let i = 0; i < chain.length; i += 1) {
    const sel = chain[i];
    try {
      const handle = await page.waitForSelector(sel, attemptOptions);
      if (i > 0 && onFallback) {
        onFallback(key, chain.slice(0, i), sel);
      }
      return handle;
    } catch {
      // try the next selector in the chain
    }
  }
  return page.waitForSelector(chain[chain.length - 1], attemptOptions);
}

// Try multiple selectors in order until one matches, using page.$ (non-waiting).
// Used by the dom_drift handler for cheap detection. Returns { key, selector }
// for the first selector that exists, or null when none match. `onFallback`
// receives (key, failedSelectors, matchedSelector) when a fallback was used.
export async function findFirstMatchingSelector(page, key, onFallback = null) {
  const chain = getSelectorChain(key);
  for (let i = 0; i < chain.length; i += 1) {
    const sel = chain[i];
    try {
      const handle = await page.$(sel);
      if (handle) {
        await handle.dispose().catch(() => {});
        if (i > 0 && onFallback) {
          onFallback(key, chain.slice(0, i), sel);
        }
        return { key, selector: sel, usedFallback: i > 0 };
      }
    } catch {
      // invalid selector — treat as no match
    }
  }
  return null;
}
