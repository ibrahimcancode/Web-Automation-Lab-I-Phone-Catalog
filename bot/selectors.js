// Centralized selectors for the whole bot.
// Every selector used against the sandbox site lives here so that Week 3
// (Scenario 7, DOM drift) can extend this module into fallback chains without
// touching business logic. Each logical element maps to its primary selector now.

export const selectors = {
  nav: {
    home: 'nav.desktop-nav a[href="/"]',
    catalog: 'nav.desktop-nav a[href="/catalog"]',
    compare: 'nav.desktop-nav a[href="/compare"]',
    favorites: 'nav.desktop-nav a[href="/favorites"]',
  },

  catalog: {
    page: '.page-catalog',
    resultCount: '.result-count',
    card: '.catalog-grid .product-card',
    cardLink: '.catalog-grid .product-card a.card-link',
    cardName: '.catalog-grid .product-card .card-name a',
    loadMore: '.catalog-grid button.load-more',
    emptyState: '.empty-state',
  },

  detail: {
    page: '.page-detail',
    title: '.page-detail .detail-header h1',
    tier: '.page-detail .detail-header .tier-badge',
    year: '.page-detail .detail-year',
    priceLabel: '.page-detail .price-label',
    priceValue: '.page-detail .price-value',
    storageOptions: '.page-detail .storage-options .storage-btn',
    colorLabel: '.page-detail .color-label',
    specSheet: '.page-detail .spec-sheet',
    keyFeatures: '.page-detail .key-features li',
    similarModels: '.page-detail .similar-models',
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
      checkbox: '#simulated-captcha-overlay .chaos-captcha-checkbox-btn',
      question: '#simulated-captcha-overlay .chaos-captcha-question',
      input: '#simulated-captcha-overlay .chaos-captcha-input',
      submit: '#simulated-captcha-overlay .chaos-captcha-submit',
      error: '#simulated-captcha-overlay .chaos-captcha-error',
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

// Flattened lookup keyed by "module.element" (e.g. "catalog.card", "chaos.popup.input").
export function getSelector(key) {
  const parts = key.split('.');
  let node = selectors;
  for (const part of parts) {
    if (node == null) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}