# Demo Script

## Quick Demo (2–3 minutes)

```bash
# Start with all 8 scenarios forced on, headless, 3 items
node scripts/demo-all.js --headless --limit 3
```

Point out each scenario as it appears in the console output:

1. `server_errors` — first 2 navigations get 503, bot retries
2. `rate_limiting` — 429 with Retry-After header, bot backs off
3. `cookie_banner` — detected and accepted
4. `simulated_captcha` — pixel analysis solves the gate
5. `newsletter_popup` — subscribed and dismissed on each page
6. `dom_drift` — fallback selectors resolve drifted DOM
7. `blocked_clicks` — overlay removed, click verified
8. `session_expiry` — interstitial detected, Continue clicked, resumes

Show the final summary: all scenarios detected >= 1, resolved >= 1,
verdict PASS, 0 failures.

## Full Demo (15–20 minutes)

```bash
# Headed browser, all 43 items, all 8 scenarios
npm run demo:all
```

This opens a visible Chromium window so the audience can watch the bot
work through the catalog. Evidence saved to `runs/demo-<run-id>/`.

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
