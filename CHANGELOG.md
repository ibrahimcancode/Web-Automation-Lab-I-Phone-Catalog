# Changelog

All notable changes to the Resilient Web Automation Lab.

## [Unreleased] — 2026-08-18

### Fixed

- **Session expiry combined activation**: Middleware now filters Vite's
  `?noredirect=1` internal redirect requests, preventing double-counting of
  navigations. Trigger lowered from 10 to 4 so session expiry fires during
  a combined all-ten-scenarios run.
- **Fatal-run observability**: `runWorkflow()` now wraps its body in
  try/finally so `summary.json`, `trace.zip`, `trace.log`, `results.json`,
  and `checkpoint.json` are always written — even on fatal errors.
  `buildSummary()` detects `run_failed` events and sets verdict to FAIL.
- **`response.status` method call**: Rate-limiting handler now calls
  `response.status()` as a method (not property).
- **CAPTCHA pixel analysis**: Fully rewritten with traffic-light color
  detection, confidence threshold 0.5, max 3 retries. No arithmetic code
  remains in production.

### Added

- `docs/FRESH_CLONE_VERIFICATION.md` — clean-clone verification record
  (91/91 tests pass from a fresh clone).
- `docs/TEST_PERFORMANCE.md` — test performance metrics.
- `docs/PRESENTATION.md` — presentation script.
- `docs/DEMO_SCRIPT.md` — demo script for live and headless demos.
- `CHANGELOG.md` — this file.
- Playwright trace support (`startTrace`/`stopTrace` in `browser.js`).

## [0.4.0] — 2026-08-17

### Added

- Scenarios 9 (HTTP 429 rate limiting) and 10 (session expiry).
- Checkpoint and resume support (`bot/checkpoint.js`).
- Cross-platform scripts (`scripts/start-site.js`, `scripts/run-bot.js`,
  `scripts/demo-all.js`).
- Gauntlet tests with two fixed seeds (42 and 99).
- Demo mode test suite (`test_demo_mode.spec.js`).

### Fixed

- `retriedHandlers` Map refactor: success path records recovery for all
  retried handlers, not just the last one.
- Demo config fixed: `server_errors.fail_first_n: 1`,
  `rate_limiting.fail_first_n: 1`.

## [0.3.0] — 2026-08-15

### Added

- Scenarios 5 (slow responses), 6 (unexpected redirects), 7 (DOM drift),
  8 (blocked clicks).
- Fallback selector chains for DOM drift resilience.
- Navigation duration classification (`bot/timeouts.js`).
- All-eight chaos gauntlet tests.

## [0.2.0] — 2026-08-12

### Added

- Baseline bot with happy-path catalog extraction.
- Handler registry and evidence infrastructure.
- Cookie banner, newsletter popup, simulated captcha, server errors
  recovery handlers.
- Per-scenario E2E tests.

## [0.1.0] — 2026-08-08

### Added

- React/Vite iPhone catalog sandbox.
- Client-side Chaos Engine with deterministic PRNG.
- Vite dev-server chaos middleware (server errors, slow responses).
