// Scenario 4 — Site down / server errors.
// A navigation-type handler: after each page load, the workflow passes the
// response/error here. On a 5xx status or a network-level failure, we apply
// exponential backoff and retry (hard cap enforced by the workflow guard),
// characterising the disruption specifically rather than swallowing it.
//
// Resume-from-last-item is handled by the workflow's per-item loop: a failed
// navigation is retried, and only after the cap is an item marked failed while
// the run continues.

import { nextRetryDelayMs, maxRetries } from '../backoff.js';
import { registerHandler } from './index.js';

const handler = {
  name: 'server_errors',
  type: 'navigation',
  priority: 100,

  detect({ response, error }) {
    if (error) return true;
    if (response && response.status() >= 500) return true;
    return false;
  },

  recover({ attempt }) {
    return {
      retry: true,
      waitMs: nextRetryDelayMs(attempt),
      maxAttempts: maxRetries(),
    };
  },
};

registerHandler(handler);
export default handler;