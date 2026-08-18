# Test Performance

Recorded on 2026-08-18, Windows, Node v24.18.0.

## Unit Tests

| Suite                | Tests  | Duration |
| -------------------- | ------ | -------- |
| test_unit_week2.spec | 34     | ~1.5s    |
| test_unit_week3.spec | 32     | ~1.5s    |
| **Total**            | **66** | **~2s**  |

Unit tests run headless with no browser or server. Pure function coverage:
backoff, pixel analysis, handler registry, selector map, validation,
buildSummary, duration classification, dom_drift, blocked_clicks,
rate_limiting, session_expiry.

## E2E Tests (per-scenario, limit 2–3)

| Test                       | Items | Duration |
| -------------------------- | ----- | -------- |
| Happy path (chaos off)     | 3     | ~27s     |
| cookie_banner              | 2     | ~15s     |
| simulated_captcha          | 2     | ~19s     |
| server_errors              | 2     | ~27s     |
| newsletter_popup           | 2     | ~6s      |
| slow_responses             | 2     | ~53s     |
| unexpected_redirect        | 2     | ~18s     |
| dom_drift                  | 2     | ~72s     |
| blocked_clicks             | 2     | ~23s     |
| Visual CAPTCHA (fail-safe) | 2     | ~20s     |
| HTTP 429 rate-limiting     | 2     | ~23s     |
| Session expiry             | 2     | ~22s     |
| Checkpoint + resume        | 6     | ~52s     |

E2E tests each boot a Vite dev server on a unique port via `startSite()`.

## Gauntlet + Demo Tests

| Test                             | Seed | Duration |
| -------------------------------- | ---- | -------- |
| All-four gauntlet                | 42   | ~49s     |
| All-eight gauntlet (seed 42)     | 42   | ~49s     |
| All-eight gauntlet (seed 99)     | 99   | ~1.8m    |
| Demo mode (8 scenarios, limit 3) | 42   | ~2.7m    |
| Full demo (43 items, headless)   | 42   | ~27m     |

## Full Suite

| Command               | Tests | Duration |
| --------------------- | ----- | -------- |
| `npm run test:unit`   | 66    | ~2s      |
| `npx playwright test` | 91    | ~12m     |

The 91-test E2E suite includes all unit, happy-path, per-scenario,
combination, gauntlet, demo, and week-4 tests. Each test runs serially
in a single worker with its own Vite server instance.
