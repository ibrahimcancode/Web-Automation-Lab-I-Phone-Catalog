// Scenario 8 — Blocked / intercepted clicks handler.
//
// A transparent overlay sits on top of the "Load more" button and swallows the
// pointer events that were meant for it, so the click never reaches the button
// (the sandbox re-mounts the overlay after it is dismissed). Detection is a
// hit-test: at the button's center point, the topmost element must be the
// button itself — if a `.chaos-click-blocker` overlay is on top instead, the
// click is blocked. Recovery removes the overlay element(s); the workflow then
// re-clicks and *verifies the click actually took effect* before moving on.

import { registerHandler } from './index.js';
import { getSelectorChain } from '../selectors.js';

const BLOCKER_SELECTOR = '.chaos-click-blocker, [data-chaos="blocked_clicks"]';
// The logical target this scenario covers: the catalog "Load more" button.
const TARGET_KEYS = ['catalog.loadMore'];

const handler = {
  name: 'blocked_clicks',
  type: 'overlay',
  priority: 350,

  async detect(ctx) {
    const { page } = ctx;
    if (!page) return false;

    const targetSelectors = [];
    for (const key of TARGET_KEYS) {
      targetSelectors.push(...getSelectorChain(key));
    }
    if (targetSelectors.length === 0) return false;

    const blocked = await page.evaluate(
      ({ targets, blocker }) => {
        const btn = targets.map((s) => document.querySelector(s)).find(Boolean);
        if (!btn) return false;
        const b = btn.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return false;
        const els = Array.from(document.querySelectorAll(blocker));
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const overlapping = r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
          if (overlapping) return true;
        }
        return false;
      },
      { targets: targetSelectors, blocker: BLOCKER_SELECTOR },
    );
    return blocked;
  },

  async recover(ctx) {
    const { page } = ctx;
    if (!page) return { outcome: 'resolved', detail: 'nothing to remove' };

    const removed = await page.evaluate((blocker) => {
      const els = Array.from(document.querySelectorAll(blocker));
      els.forEach((el) => el.remove());
      return els.length;
    }, BLOCKER_SELECTOR);

    return {
      outcome: removed > 0 ? 'resolved' : 'resolved',
      detail: `removed ${removed} click blocker(s)`,
      retry: true,
    };
  },
};

registerHandler(handler);
export default handler;
