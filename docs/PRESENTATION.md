# Presentation Script

## Opening (30s)

"This is the Resilient Web Automation Lab. It demonstrates how an AI-built
Playwright bot can detect and recover from 10 different kinds of real-world
web disruptions — from server errors and rate limiting to DOM drift, blocked
clicks, and session expiry — all without any human intervention."

## Architecture (1min)

"The system has two halves:

1. **Sandbox** — a React/Vite iPhone catalog with a configurable Chaos Engine
   that injects disruptions either deterministically (fixed seed, every scenario
   fires every time) or randomly (seeded PRNG, probability-weighted).

2. **Bot** — a Playwright workflow that scrapes all 43 product pages while
   encountering these disruptions. Each scenario has a dedicated handler
   with a detect -> recover -> verify pipeline."

## Live Demo (3min)

Run: `node scripts/demo-all.js --headless --limit 3`

"We'll run with `--limit 3` for speed. Watch the console output:

- Home page: **server errors** (503s) retry with backoff, **rate limiting**
  (429) backs off 1s, **cookie banner** detected and accepted, **captcha**
  solved via pixel analysis of traffic-light colors, second **cookie
  banner** accepted.
- Catalog page: **newsletter popup** subscribed and dismissed, **DOM drift**
  detected via fallback selectors, **blocked clicks** removed overlay and
  verified the click took effect.
- Detail pages: each gets a **newsletter popup** cleared.
- Second detail: **session expiry** interstitial detected, bot clicks
  Continue, and resumes scraping.

All 10 scenarios detected and resolved. Summary shows PASS with zero
failures."

## Key Technical Points

- **Pixel analysis CAPTCHA**: No arithmetic. Samples red/yellow/green
  traffic-light pixels from each tile. Confidence threshold 0.5, max 3
  retries.
- **Deterministic demo**: `random_mode: false`, fixed seed, every scenario
  forced to fire at its controlled point.
- **Checkpoint/resume**: Bot writes checkpoints after each item. If the
  process dies, `--resume` picks up where it left off.
- **Fatal-run observability**: Even on fatal errors, summary.json, trace.zip,
  and checkpoint are written. Verdict correctly set to FAIL.
- **91/91 tests pass** from a clean clone following only the README.

## Closing (15s)

"The full test suite — 66 unit tests and 25 E2E tests — runs in about
12 minutes. The bot recovers from every disruption type, extracts clean
structured data, and produces a complete evidence trail: events log,
screenshots, summary, and Playwright traces."
