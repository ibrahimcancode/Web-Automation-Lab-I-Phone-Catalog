// Pure exponential-backoff calculator for the server-error handler.
// Kept free of any Playwright/DOM dependency so it can be unit-tested in
// isolation and reused unchanged for the rest of the internship.

export const DEFAULT_BACKOFF = {
  baseMs: 1000,
  factor: 2,
  maxMs: 8000,
  maxAttempts: 4,
};

// attempt is 1-based (the first retry after the initial failure is attempt 1).
// Returns the number of ms to wait before the given retry attempt.
export function nextRetryDelayMs(attempt, opts = {}) {
  const { baseMs = DEFAULT_BACKOFF.baseMs, factor = DEFAULT_BACKOFF.factor, maxMs = DEFAULT_BACKOFF.maxMs } = opts;
  if (attempt < 1) return 0;
  const raw = baseMs * Math.pow(factor, attempt - 1);
  return Math.min(Math.max(0, Math.floor(raw)), maxMs);
}

// The hard retry cap: how many retry attempts are allowed after the initial
// failure before the item is treated as genuinely failed.
export function maxRetries(opts = {}) {
  return opts.maxAttempts ?? DEFAULT_BACKOFF.maxAttempts;
}

// True when the attempt counter has been exhausted.
export function isRetryExhausted(attempt, opts = {}) {
  return attempt > maxRetries(opts);
}

// Returns the ordered list of delays for every retry attempt (useful for tests
// and for logging the plan upfront).
export function retrySchedule(opts = {}) {
  const max = maxRetries(opts);
  const delays = [];
  for (let attempt = 1; attempt <= max; attempt += 1) {
    delays.push(nextRetryDelayMs(attempt, opts));
  }
  return delays;
}
