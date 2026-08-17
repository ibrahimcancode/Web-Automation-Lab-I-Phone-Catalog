// Scenario 9 — HTTP 429 rate limiting navigation handler.
//
// When the bot detects a 429 response, it extracts the Retry-After header,
// backs off for the specified duration, then retries the navigation.

import { registerHandler } from './index.js';

const RETRY_AFTER_HEADER = 'retry-after';

const handler = {
  name: 'rate_limiting',
  type: 'navigation',
  priority: 85,

  async detect(ctx) {
    if (!ctx.response) return false;
    return ctx.response.status() === 429;
  },

  recover(ctx) {
    const { response } = ctx;
    const retryAfter = parseInt(response.headers[RETRY_AFTER_HEADER] || '1', 10);
    const retryMs = Math.min(retryAfter * 1000, 30000);

    console.log(`[bot] rate limiting: 429 received, Retry-After=${retryAfter}s, backing off ${retryMs}ms`);

    return { retry: true, waitMs: retryMs, detail: `retried after ${retryAfter}s backoff` };
  },
};

registerHandler(handler);
export default handler;
