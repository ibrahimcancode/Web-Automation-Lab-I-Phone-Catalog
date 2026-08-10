// Scenario 5 — Slow responses / timeouts.
// A navigation-type handler: after each page load, the workflow passes the
// measured navigation duration here. If the page loaded but took too long
// (>= the slow threshold), we claim it and record the recovery — the page is
// already usable, so there is no retry and no navigation is repeated, but the
// disruption is surfaced in the evidence instead of being ignored.
//
// The sandbox simulates this with a delayed HTML response (safe 2-5s window),
// which is why this scenario lives server-side alongside server_errors.
//
// Errors and 5xx responses return false here so they stay owned by
// server_error_handler (which retries with bounded backoff).

import { classifyNavigationDuration } from '../timeouts.js';
import { registerHandler } from './index.js';

const handler = {
  name: 'slow_responses',
  type: 'navigation',
  priority: 200,

  detect({ response, error, navigationMs }) {
    if (error) return false;
    if (response && response.status() >= 400) return false;
    return classifyNavigationDuration(navigationMs) === 'slow';
  },

  recover({ navigationMs }) {
    return {
      retry: false,
      outcome: 'resolved',
      detail: `loaded in ${navigationMs}ms`,
    };
  },
};

registerHandler(handler);
export default handler;
