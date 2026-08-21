# Demo Script

## Quick Demo (2–3 minutes) — `npm run demo:quick`

```bash
# Visible, paced Chromium; boots the sandbox itself; extracts 2 phones;
# forces and recovers ALL 10 scenarios. No second terminal needed.
npm run demo:quick
```

Point out each scenario as it appears in the console output:

1. `server_errors` — first HTML navigation gets a 503, bot retries with backoff
2. `rate_limiting` — home retry gets a 429 with Retry-After header, bot backs off
3. `cookie_banner` — detected and accepted
4. `simulated_captcha` — pixel analysis solves the visual traffic-light gate (local sandbox simulation only)
5. `newsletter_popup` — subscribed and dismissed
6. `unexpected_redirect` — catalog navigation detours to /promo, bot recovers via noredirect=1
7. `slow_responses` — catalog load delayed ~2s, classified slow and recovered in place
8. `dom_drift` — fallback selectors resolve drifted DOM
9. `blocked_clicks` — overlay removed, click verified
10. `session_expiry` — interstitial detected, Continue clicked, resumes

Show the final checklist ("all ten scenarios detected and resolved") and the verification
report: verdict PASS, 2/2 phones extracted, 0 failures.

For an automated smoke check use `node scripts/demo-all.js --headless --limit 3`.

## Full Demo (`npm run demo:all`)

```bash
# Headed browser, all 43 items, all 10 scenarios
npm run demo:all
```

This opens a visible Chromium window so the audience can watch the bot work through
the full catalog (longer run — prefer `demo:quick` for live presentations). Evidence
saved to `runs/demo-<run-id>/`.

## Controlled Failure Demo

```bash
# Start sandbox with heavy server errors
npm run site

# In another terminal, run the bot — it will exhaust retries and fail
node bot/run.js --limit 3
```

Show that even on fatal error, `summary.json` is written with
`verdict: "FAIL"` and `trace.zip` captures the Playwright trace.

## Checkpoint/Resume Demo

```bash
# Start sandbox
npm run site

# First run — extract 2 items, then Ctrl+C to kill
node bot/run.js --limit 2 --run-dir runs/partial

# Resume from checkpoint
node bot/run.js --resume runs/partial
```

Show the bot skips the 2 already-extracted items and continues with
the remaining catalog.
