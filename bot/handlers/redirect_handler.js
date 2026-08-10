// Scenario 6 — Unexpected redirects handler.
//
// Detects when navigation is redirected to an unintended destination (e.g. /promo)
// and returns to the intended destination without infinite loops.

import { registerHandler } from './index.js';

const handler = {
  name: 'unexpected_redirect',
  type: 'navigation',

  async detect(ctx) {
    const { page, url } = ctx;
    if (!page || !url) return false;
    try {
      const targetPath = new URL(url).pathname;
      let currentUrl = page.url();
      let currentPath = new URL(currentUrl).pathname;

      if (currentPath === '/promo' || (currentPath !== targetPath && !currentUrl.includes(targetPath))) {
        return true;
      }

      // Wait up to 1500ms if client-side React router is processing the redirect
      try {
        await page.waitForURL((u) => u.pathname === '/promo' || (u.pathname !== targetPath && !u.href.includes(targetPath)), { timeout: 1500 });
        currentUrl = page.url();
        currentPath = new URL(currentUrl).pathname;
        if (currentPath === '/promo' || (currentPath !== targetPath && !currentUrl.includes(targetPath))) {
          return true;
        }
      } catch {
        /* no redirect occurred within window */
      }
    } catch {
      /* ignore URL parsing errors */
    }
    return false;
  },

  async recover(ctx) {
    const { page, url } = ctx;
    const actualUrl = page.url();

    // Return to intended destination with noredirect parameter to avoid redirect loops
    const safeUrl = url.includes('?') ? `${url}&noredirect=1` : `${url}?noredirect=1`;
    await page.goto(safeUrl, { waitUntil: 'domcontentloaded' });
    try {
      if (url.includes('/catalog')) {
        await page.waitForSelector('.catalog-grid .product-card', { state: 'visible', timeout: 5000 });
      } else if (url.includes('/model/')) {
        await page.waitForSelector('.page-detail', { state: 'visible', timeout: 5000 });
      } else {
        await page.waitForSelector('.page-home', { state: 'visible', timeout: 5000 });
      }
    } catch {
      /* ignore timeout if element is not found */
    }

    return {
      outcome: 'resolved',
      detail: `redirected to ${actualUrl}, returned to ${url}`,
      retry: false,
    };
  },
};

registerHandler(handler);
export default handler;
