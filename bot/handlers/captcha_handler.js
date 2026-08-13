// Scenario 3 — Simulated captcha gate.
// Detect the "I'm not a robot" interstitial, click the checkbox to reveal the
// math challenge, read the equation from the DOM, solve it, and verify the gate
// cleared. A bounded retry handles a transient wrong-answer state.
//
// This only ever solves the sandbox's simulated challenge on the intern's own
// site — it must never be adapted toward real CAPTCHA bypass (MASTER_SPEC §7.5).

import { selectors } from '../selectors.js';
import { registerHandler } from './index.js';

// Pure: parse "What is 7 + 3?" (or "3 - 7") into { a, op, b, answer }.
// Exported for unit testing.
export function parseMathQuestion(text) {
  const m = String(text).match(/(-?\d+)\s*([+-])\s*(-?\d+)/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  const op = m[2];
  return { a, op, b, answer: op === '+' ? a + b : a - b };
}

const handler = {
  name: 'simulated_captcha',
  type: 'overlay',
  priority: 30,

  async detect(ctx) {
    return ctx.page.isVisible(selectors.chaos.captcha.overlay).catch(() => false);
  },

  async recover(ctx) {
    const { page } = ctx;

    // Move from the checkbox step to the math step if needed. The overlay may
    // still be presenting, so wait for the checkbox to be actionable first
    // (bounded) — never block forever, and never assume the question is present
    // immediately after a click.
    const checkbox = page.locator(selectors.chaos.captcha.checkbox);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (await checkbox.isVisible().catch(() => false)) {
        await checkbox.click();
        try {
          await page.waitForSelector(selectors.chaos.captcha.input, { state: 'visible', timeout: 3000 });
        } catch {
          /* input may already be visible */
        }
        break;
      }
      try {
        await page.waitForSelector(selectors.chaos.captcha.checkbox, { state: 'visible', timeout: 1000 });
      } catch {
        /* keep waiting for the checkbox step */
      }
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      // Bounded wait for the question text to be present/parseable, so a fast
      // clearObstacles sweep that caught the overlay mid-animate still solves it.
      let question = '';
      for (let wait = 1; wait <= 3; wait += 1) {
        question = await page.textContent(selectors.chaos.captcha.question).catch(() => '');
        const parsed = parseMathQuestion(question);
        if (parsed) break;
        try {
          await page.waitForFunction(
            () => document.querySelector('#simulated-captcha-overlay .chaos-captcha-question')?.textContent?.trim(),
            { timeout: 1000 },
          );
        } catch {
          /* question not populated yet — retry reading */
        }
      }

      const parsed = parseMathQuestion(question);
      if (!parsed) {
        return { outcome: 'error', detail: `could not parse captcha question: "${question}"` };
      }

      await page.fill(selectors.chaos.captcha.input, String(parsed.answer));
      await page.click(selectors.chaos.captcha.submit);

      if (await waitForOverlayGone(page, 6000)) {
        return { outcome: 'resolved', detail: `solved ${parsed.a} ${parsed.op} ${parsed.b}` };
      }

      // Wrong-answer flash: wait for it to clear, then re-read and retry.
      if (await page.isVisible(selectors.chaos.captcha.error).catch(() => false)) {
        try {
          await page.waitForSelector(selectors.chaos.captcha.error, { state: 'hidden', timeout: 3000 });
        } catch {
          /* continue */
        }
      }
    }

    return { outcome: 'error', detail: 'captcha gate not cleared after 2 attempts' };
  },
};

async function waitForOverlayGone(page, timeoutMs = 6000) {
  try {
    await page.waitForSelector(selectors.chaos.captcha.overlay, { state: 'hidden', timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

registerHandler(handler);
export default handler;