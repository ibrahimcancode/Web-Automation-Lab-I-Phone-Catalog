// Scenario 10 — Session expiry navigation handler.
//
// When the bot detects the session-expired interstitial page, it locates
// and clicks the "Continue" button to restore the session.

import { registerHandler } from './index.js';

const INTERSTITIAL_SEL = '#session-expired-interstitial';
const CONTINUE_BTN_SEL = '#session-continue-btn';

const handler = {
  name: 'session_expiry',
  type: 'navigation',
  priority: 90,

  async detect(ctx) {
    if (!ctx.page) return false;
    try {
      return await ctx.page.isVisible(INTERSTITIAL_SEL, { timeout: 1500 }).catch(() => false);
    } catch {
      return false;
    }
  },

  async recover(ctx) {
    const { page } = ctx;
    const startTime = Date.now();

    try {
      const continueBtn = await page.waitForSelector(CONTINUE_BTN_SEL, { state: 'visible', timeout: 3000 });
      if (!continueBtn) {
        return { outcome: 'error', detail: 'continue button not found' };
      }

      await continueBtn.click();
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      const duration = Date.now() - startTime;

      return { outcome: 'resolved', detail: `clicked continue, session restored in ${duration}ms` };
    } catch (err) {
      return { outcome: 'error', detail: `session expiry recovery failed: ${err.message}` };
    }
  },
};

registerHandler(handler);
export default handler;
