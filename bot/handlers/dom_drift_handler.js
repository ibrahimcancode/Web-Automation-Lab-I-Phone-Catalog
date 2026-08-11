// Scenario 7 — DOM / Selector Drift handler.
//
// Detects when the page DOM structure has changed (selector drift) and records
// which fallback selector recovered the logical element. The actual recovery is
// automatic: the workflow uses fallback chains (`waitForSelectorChain` /
// `findFirstMatchingSelector` in bot/selectors.js), so once drift is identified
// the run simply continues with the alternate selector.
//
// Detection is cheap: `findFirstMatchingSelector` uses non-blocking `page.$`
// lookups, never `waitForSelector` sleeps, so the obstacle sweep stays fast even
// on pages that do not contain the tested logical elements.

import { registerHandler } from './index.js';
import { findFirstMatchingSelector, getSelectorChain } from '../selectors.js';

// Keys whose primary selector must exist on the page the bot is about to work
// on. Order matters: the first key that shows "primary fails / fallback works"
// is reported as the drift evidence.
const DRIFT_KEYS = [
  'catalog.page',
  'catalog.card',
  'catalog.loadMore',
  'detail.page',
  'detail.title',
  'detail.priceValue',
];

// Track whether drift was already detected in this session. The alternate DOM is
// permanent for the session, so re-detecting it on every page would loop forever.
let driftDetected = false;
let driftDetail = null;

const handler = {
  name: 'dom_drift',
  type: 'overlay',
  priority: 300,

  async detect(ctx) {
    const { page } = ctx;
    if (!page || driftDetected) return false;

    for (const key of DRIFT_KEYS) {
      const chain = getSelectorChain(key);
      if (chain.length < 2) continue; // no fallback chain to compare against

      // findFirstMatchingSelector returns the FIRST selector that exists.
      // If that selector is not the primary, the primary genuinely failed under
      // the alternate DOM and a fallback is in use → drift.
      const matched = await findFirstMatchingSelector(page, key);
      if (matched && matched.usedFallback) {
        driftDetected = true;
        driftDetail = {
          key,
          primary: chain[0],
          fallback: matched.selector,
        };
        return true;
      }
    }
    return false;
  },

  async recover(ctx) {
    if (!driftDetected || !driftDetail) {
      return { outcome: 'resolved', detail: 'no drift detected on recheck' };
    }
    const detail = `selector drift: ${driftDetail.key} (primary: ${driftDetail.primary}) → fallback: ${driftDetail.fallback}`;
    return {
      outcome: 'resolved',
      detail,
      retry: false,
    };
  },
};

registerHandler(handler);
export default handler;
