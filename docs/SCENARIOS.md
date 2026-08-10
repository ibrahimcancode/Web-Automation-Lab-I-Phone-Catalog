# Scenario Coverage Matrix

Status as of **Week 3 (Scenario 5 in progress)**. This matrix lists only scenarios the bot actually detects and
recovers from — no aspirational entries (per MASTER_SPEC §4.12). New scenarios are added as they are
implemented.

## Legend

- **Sandbox simulation** — how the chaos engine reproduces the disruption in `iphone-catalog/`.
- **Detection** — the bot-side check that identifies *which* disruption occurred (specific, not a
  catch-all).
- **Strategy** — the recovery action, and how success is verified.
- **Evidence** — where the run log / summary records the detection and recovery.
- **Automated test** — the test that forces the scenario on deterministically and proves handling.

## Handled scenarios (Week 3)

| # | Scenario | Sandbox simulation | Detection (`bot/handlers/`) | Handling strategy | Verification | Evidence | Automated test |
|---|---|---|---|---|---|---|---|
| 2 | Cookie / consent banner | `#cookie-banner` overlay injected ~100ms after load (once per session). | `cookie_banner_handler.js` — `isVisible('#cookie-banner')`. | Click **Accept**; if still present, fall back to **Reject**. | `waitForSelector(... { state: 'hidden' })` after each action. | `events.jsonl` `scenario=cookie_banner` `detected`/`recovered`; screenshot `cookie_banner-detected`. | `tests/test_scenarios_week2.spec.js` (cookie_banner); also `tests/test_all_four.spec.js` |
| 1 | Random pop-up / modal (newsletter signup) | `.chaos-popup-overlay[data-chaos="popup"]` appears 2–6s after load; requires a real email submit to dismiss (no simple close X). | `popup_handler.js` — `isVisible('.chaos-popup-overlay[data-chaos="popup"]')`. | Fill well-formed placeholder email (`test@example.com` → `user@example.org` bounded retry), submit, wait for success state, then dismiss and confirm gone. Fallback: close button → ESC. | Success state selector `.chaos-popup-success`; then overlay `hidden`. | `events.jsonl` `scenario=newsletter_popup`; screenshot `newsletter_popup-detected`. | `tests/test_scenarios_week2.spec.js` (newsletter_popup); also `tests/test_all_four.spec.js` |
| 3 | Simulated captcha gate | `#simulated-captcha-overlay` blocks navigation (once per session) with a checkbox → math challenge (`What is 7 + 3?`). | `captcha_handler.js` — `isVisible('#simulated-captcha-overlay')`. | Click "I'm not a robot", parse the equation (`parseMathQuestion`, pure + unit-tested), submit the answer; one bounded retry on the wrong-answer flash. | Overlay `hidden` after submit. | `events.jsonl` `scenario=simulated_captcha`; screenshot `simulated_captcha-detected`. | `tests/test_scenarios_week2.spec.js` (simulated_captcha); also `tests/test_all_four.spec.js` |
| 4 | Site down / server errors | Vite middleware (`vite-chaos-server.js`) returns a genuine 503 for HTML navigations (`fail_first_n` deterministic or probability-based). | `server_error_handler.js` (navigation type) — network error OR `response.status() >= 500`. | Exponential backoff retry (`backoff.js`) with a hard cap; on success the workflow resumes from the current item (per-item loop, never a full restart). | Retry succeeds within cap; run continues and completes. | `events.jsonl` `scenario=server_errors` `detected`/`retry`; screenshot `server-error`; summary `retries`. | `tests/test_scenarios_week2.spec.js` (server_errors); also `tests/test_all_four.spec.js` |
| 5 | Slow responses / timeouts | Vite middleware (`vite-chaos-slow.js`) delays the HTML response for SPA navigations by `min_delay_ms`–`max_delay_ms`, clamped to the safe 2–5s window (deterministic mode = exactly `min_delay_ms`). | `slow_response_handler.js` (navigation type) — `classifyNavigationDuration()` (`timeouts.js`) reports "slow" when the navigation completed in ≥ the slow threshold (1.5s) but before the deadline. | No retry — the page is already usable. The disruption is classified and recorded in place, so the run continues while the evidence still shows it happened. | Observed duration in the `recovered` event detail (`loaded in Nms`) must meet the configured threshold. | `events.jsonl` `scenario=slow_responses` `detected`/`recovered`; screenshot `slow_responses-detected`; summary counts. | `tests/test_scenarios_week3.spec.js` |

> **Combination coverage (Week 2 closeout):** `tests/test_all_four.spec.js` forces all four scenarios
> on at once (`random_mode: false`, seeded) and runs the real workflow with a small `limit`. It asserts
> a `PASS` verdict, `items_failed = 0`, all four scenarios detected, all three overlay scenarios
> resolved, `server_errors` retries, and anomaly screenshots — evidence that the handlers compose
> correctly, not just in isolation.

## Handled scenario details

### Detection is specific

Each overlay handler identifies its own disruption and nothing else; the navigation guard routes only
5xx/network failures to the server-error handler and only slow-but-loaded navigations to the
slow-responses handler. The run summary aggregates per-scenario `detected` /
`resolved` / `retries` counts, so the evidence shows *which* scenario happened rather than a generic
"something went wrong".

### Recovery is verified

- **Cookie banner**: the banner must be gone before the step proceeds (`state: hidden`).
- **Newsletter modal**: the modal must reach its success state and then be dismissed and confirmed
  gone. Two placeholders are tried before the fallback close/ESC path, per MASTER_SPEC §4.9 (bounded
  retry for client-side email validation — never an unbounded loop).
- **Captcha**: only the sandbox's simulated math challenge is solved (never adapted toward real
  CAPTCHA bypass; MASTER_SPEC §7.5).
- **Server errors**: backoff is bounded (`backoff.js` unit-tested cap); items are retried in place and
  the run resumes from the last completed item.
- **Slow responses**: no retry is attempted (the page already loaded) — the observed duration is
  measured per navigation attempt in `navigateWithGuard` (`workflow.js`), classified by the pure
  `classifyNavigationDuration()` (`timeouts.js`, unit-tested), and recorded as a `resolved` recovery
  with the duration in the event detail.
- **Overlapping disruptions**: interactive steps are overlay-aware (`clickThroughObstacles()` in
  `workflow.js`) — if a late-arriving overlay intercepts a click mid-action, it is re-swept and the
  action retried, bounded. This keeps a combination of scenarios from crashing the run (verified by
  running all four simultaneously; see `docs/AI_LOG.md` W2-4).

## Not yet handled

Scenarios 6–8 (unexpected redirection, DOM/selector drift, blocked/intercepted clicks) are still
**Week 3** work — they will be added here only once the sandbox simulation and bot handlers
exist and pass their tests.
