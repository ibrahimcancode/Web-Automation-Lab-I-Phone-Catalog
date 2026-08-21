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

Run: `npm run demo:quick`

"We'll run the quick demo — a visible, paced browser that extracts just 2 phones
while every one of the ten scenarios is forced to fire. The script boots its own
sandbox; no second terminal needed. Watch the console output:

- Home page: **server errors** (503) retried with backoff, **rate limiting**
  (429 + Retry-After) backs off 1s, **cookie banner** detected and accepted,
  **captcha** solved via pixel analysis of traffic-light colors.
- Catalog navigation: **unexpected redirect** detours to /promo and is
  recovered via noredirect=1, **slow response** (~2s delay) classified in
  place, **newsletter popup** subscribed and dismissed, **DOM drift**
  detected via fallback selectors, **blocked clicks** removed overlay and
  verified the click took effect.
- Detail pages: first detail gets a **session expiry** interstitial — bot
  clicks Continue and resumes scraping.

All 10 scenarios detected and resolved. The checklist shows a tick per
scenario; summary shows PASS with zero failures."

## Key Technical Points

- **Pixel analysis CAPTCHA**: No arithmetic. Samples red/yellow/green
  traffic-light pixels from each tile. Confidence threshold 0.5, max 3
  retries. It is a **local sandbox simulation** — the bot never touches a
  real CAPTCHA or an external site.
- **Deterministic demo**: `random_mode: false`, fixed seed, every scenario
  forced to fire at its controlled point; the four server-side scenarios are
  coordinated by a shared scheduler so they never collide.
- **Checkpoint/resume**: Bot writes checkpoints after each item. If the
  process dies, `--resume` picks up where it left off (progress persists —
  only once-per-session overlays reset with the browser session).
- **Fatal-run observability**: Even on fatal errors, summary.json, trace.zip,
  and checkpoint are written. Verdict correctly set to FAIL.
- **Test suite**: 75 unit tests pass in seconds; the full suite including E2E
  was green at the last recorded clean-clone run (`docs/FRESH_CLONE_VERIFICATION.md`).

## Closing (15s)

"The full test suite — unit plus end-to-end tiers including the chaos
gauntlet — runs from a single `npm install && npm run setup`. The bot
recovers from every disruption type, extracts clean structured data, and
produces a complete evidence trail: events log, screenshots, summary, and
Playwright traces."
