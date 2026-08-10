// Navigation duration classification — Scenario 5 (slow responses / timeouts).
//
// Pure module so the thresholds and boundary logic are unit-testable without a
// browser. The slow-responses navigation handler uses this to classify each page
// load: "normal" (within the slow threshold), "slow" (loaded, but took too
// long), or "dead" (never completed within the deadline). The sandbox clamps its
// simulated delay into the same safe 2-5s window so a slow load is always
// observable but never hits the deadline.

export const DEFAULT_SLOW_THRESHOLD_MS = 1500;
export const DEFAULT_DEADLINE_MS = 10000;

// Classifies an observed navigation duration into 'normal' | 'slow' | 'dead'.
export function classifyNavigationDuration(
  navigationMs,
  { slowThresholdMs = DEFAULT_SLOW_THRESHOLD_MS, deadlineMs = DEFAULT_DEADLINE_MS } = {},
) {
  if (typeof navigationMs !== 'number' || !Number.isFinite(navigationMs) || navigationMs < 0) {
    return 'dead';
  }
  if (navigationMs >= deadlineMs) return 'dead';
  if (navigationMs >= slowThresholdMs) return 'slow';
  return 'normal';
}
