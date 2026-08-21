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

  async recover(ctx) {
    const { response } = ctx;
    // Playwright's real API: headers() is async and returns lowercase keys.
    const headers = await response.headers();
    const retryAfter = parseInt(headers[RETRY_AFTER_HEADER] || '1', 10);
    const boundedSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1;
    const retryMs = Math.min(boundedSeconds * 1000, 30000);

    console.log(`[bot] rate limiting: 429 received, Retry-After=${boundedSeconds}s, backing off ${retryMs}ms`);

    return { retry: true, waitMs: retryMs, detail: `retried after ${boundedSeconds}s backoff` };
  },
};

registerHandler(handler);
export default handler;
