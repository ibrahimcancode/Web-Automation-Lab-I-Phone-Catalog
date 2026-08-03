// Scenario 2 — Cookie / consent banner.
// Detect the banner, accept it, and verify it is actually gone before
// proceeding (per MASTER_SPEC §4.3 Phase 2.4).

import { selectors } from '../selectors.js';
import { registerHandler } from './index.js';

const handler = {
  name: 'cookie_banner',
  type: 'overlay',
  priority: 10,

  async detect(ctx) {
    return ctx.page.isVisible(selectors.chaos.cookie.banner).catch(() => false);
  },

  async recover(ctx) {
    const { page } = ctx;

    await page.click(selectors.chaos.cookie.accept).catch(() => {});
    if (await waitForBannerGone(page)) {
      return { outcome: 'resolved', detail: 'accepted' };
    }

    // Fall back to Reject if Accept did not clear it.
    await page.click(selectors.chaos.cookie.reject).catch(() => {});
    if (await waitForBannerGone(page)) {
      return { outcome: 'resolved', detail: 'rejected' };
    }

    return { outcome: 'error', detail: 'cookie banner still visible after accept+reject' };
  },
};

async function waitForBannerGone(page, timeoutMs = 3000) {
  try {
    await page.waitForSelector(selectors.chaos.cookie.banner, { state: 'hidden', timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

registerHandler(handler);
export default handler;
