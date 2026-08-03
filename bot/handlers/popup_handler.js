// Scenario 1 — Random pop-up / modal (newsletter signup).
//
// The primary recovery is a real form interaction: enter a well-formed dummy
// email and submit, confirm the form was accepted (success state), then dismiss
// the modal and verify it is actually gone. One bounded retry with a second
// placeholder is used before falling back to the close button / ESC, per the
// MASTER_SPEC §4.9 mitigation for client-side email validation.

import { selectors } from '../selectors.js';
import { registerHandler } from './index.js';

const PLACEHOLDER_EMAILS = ['test@example.com', 'user@example.org'];

const handler = {
  name: 'newsletter_popup',
  type: 'overlay',
  priority: 20,

  async detect(ctx) {
    return ctx.page.isVisible(selectors.chaos.popup.overlay).catch(() => false);
  },

  async recover(ctx) {
    const { page } = ctx;

    // Primary path: fill + submit a placeholder email.
    for (const email of PLACEHOLDER_EMAILS) {
      const accepted = await trySubscribe(page, email);
      if (accepted) {
        // Form accepted — now dismiss the modal and confirm it is gone.
        if (await dismissPopup(page)) {
          return { outcome: 'resolved', detail: `subscribed:${email}` };
        }
        return { outcome: 'error', detail: `subscribed:${email} but modal did not dismiss` };
      }
    }

    // Fallback: dismiss without submitting (close button, then ESC).
    if (await dismissPopup(page)) {
      return { outcome: 'resolved', detail: 'dismissed (fallback)' };
    }
    return { outcome: 'error', detail: 'popup could not be dismissed' };
  },
};

async function trySubscribe(page, email) {
  try {
    await page.fill(selectors.chaos.popup.input, email);
    await page.click(selectors.chaos.popup.subscribe);
    // A successful submit switches the form to the success state.
    await page.waitForSelector(selectors.chaos.popup.success, { state: 'visible', timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}

async function dismissPopup(page) {
  // Close button first.
  try {
    await page.click(selectors.chaos.popup.close, { timeout: 2000 });
  } catch {
    // Fall back to ESC.
    try {
      await page.keyboard.press('Escape');
    } catch {
      /* ignore */
    }
  }
  return waitForPopupGone(page);
}

async function waitForPopupGone(page, timeoutMs = 3000) {
  try {
    await page.waitForSelector(selectors.chaos.popup.overlay, { state: 'hidden', timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

registerHandler(handler);
export default handler;
