# Resilient Web Automation Lab

A local sandbox listing site (iPhone catalog theme) with a configurable **Chaos Engine**, plus a
resilient **Playwright bot** (Part B) that detects and recovers from the simulated disruptions. Built
as the Resilient Web Automation Lab internship.

## Status

- **Week 1 — Sandbox + Chaos Engine** (`iphone-catalog/`): complete. React/Vite listing site with a
  deterministic, config-driven disruption layer (Cookie Banner, Newsletter Popup, Simulated Captcha,
  Server Errors). Design in `CHAOS_ENGINE_SPEC.md`; implementation notes in `iphone-catalog/AI_LOG.md`.
- **Week 2 — Baseline bot, evidence infra, first recoveries** (`bot/`): complete. Happy-path catalog
  extraction, structured run evidence, and working recovery handlers for the **4 scenarios** above.
  Coverage matrix: `docs/SCENARIOS.md`. Week 2 test results: 34/34 passing (unit + happy path +
  per-scenario + all-four combination).
- **Week 3 —** scenarios 5–8 + the chaos gauntlet: **Scenarios 5 (slow responses/timeouts), 6 (unexpected redirects), 7 (DOM/selector drift), and 8 (blocked/intercepted clicks) complete**. Scenario 5 adds sandbox-side delayed-response middleware (`vite-chaos-slow.js`), bot-side duration classification (`bot/timeouts.js`) + navigation handler (`bot/handlers/slow_response_handler.js`), and a deterministic scenario test (`site:slow`). Scenario 6 adds a sandbox `/promo` interstitial redirect with `dest` preservation, bot-side `redirect_handler.js` that detects the wrong destination and recovers via `noredirect=1`, and a deterministic scenario test. Scenario 7 adds sandbox alternate DOM variants (`document.body.dataset.chaosDomDrift`), fallback selector chains in `bot/selectors.js`, and `bot/handlers/dom_drift_handler.js` — every logical selector resolves through its chain (bounded per-attempt waits) and each fallback use is logged as `dom_drift` `fallback_used` evidence (`site:drift`). Scenario 8 adds an invisible pointer-blocking overlay (`BlockedClicks.jsx`) over the load-more button plus `bot/handlers/blocked_clicks_handler.js` (rect-overlap detection, removal, then a bounded **verify-the-click-took-effect** check) (`site:blocked`). The **all-eight chaos gauntlet** (`tests/test_gauntlet.spec.js`) runs the real workflow in random mode with all 8 scenarios enabled and two fixed seeds, asserting a complete and correct result with per-seed recovery evidence. See `docs/SCENARIOS.md`.

## Repository layout

```
docs/MASTER_SPEC.md     # Master plan + acceptance criteria per week
CHAOS_ENGINE_SPEC.md   # Chaos Engine design contract
docs/
  SCENARIOS.md         # Scenario coverage matrix (only handled scenarios, kept accurate)
  AI_LOG.md            # Week 2+ AI usage log
iphone-catalog/        # Sandbox site (React/Vite) + Chaos Engine (client-side + Vite middleware)
bot/                   # Playwright automation bot (Week 2)
  run.js               #   entry point (CLI)
  workflow.js          #   orchestration: happy path, obstacle sweep, navigation guard
  handlers/            #   one detect → recover module per scenario + registry (index.js)
  reporting.js         #   JSON-lines events, anomaly screenshots, run summary
  selectors.js         #   all selectors centralized
  backoff.js           #   pure exponential-backoff calculator
  timeouts.js          #   pure navigation-duration classification (Scenario 5)
  validate.js          #   pure extracted-data validation
tests/                 # Playwright test tiers (unit / happy-path / scenarios)
runs/                  # run evidence (gitignored; sample runs committed)
```

The bot never touches the sandbox's internals — it only drives the rendered browser (decoupling rule
in `docs/MASTER_SPEC.md` §1.3).

## Setup

Prerequisites: **Node.js 18+** and **Git**. Windows (PowerShell) is assumed below; the sandbox and
bot are plain Node scripts otherwise.

```bash
# 1. Install root deps (Playwright test runner + chromium)
npm install
npm run install:browsers      # playwright install chromium

# 2. Install sandbox deps
npm.cmd --prefix iphone-catalog install
```

## Running

Start the sandbox (chaos on by default; uses the bundled `src/chaos/chaos.json`):

```bash
npm run site          # chaos ON  (random_mode, seed 42)
npm run site:off      # chaos OFF (happy path)
npm run site:all      # all four Week 2 scenarios forced on deterministically (random_mode false, seed 42)
npm run site:slow     # Scenario 5 forced on: every page load delayed 2500–4000ms (random_mode false, seed 42)
npm run site:drift    # Scenario 7 forced on: every page renders alternate DOM class names (random_mode false, seed 42)
npm run site:blocked  # Scenario 8 forced on: invisible overlay blocks "Load more" clicks, re-arms after dismissal (random_mode false, seed 42)
```

`site:all` enables **cookie banner + newsletter popup + simulated captcha + server errors** with a
fixed seed and `random_mode: false`, so every enabled scenario fires every time — the deterministic
"all-four" environment the combination test and sample run use. (The sandbox server errors are
driven by `fail_first_n: 2`, so exactly the first two navigations return a 503 and are retried.)

`site:slow` enables **Scenario 5 (slow responses)** deterministically: the dev server delays the HTML
response for every SPA navigation by the configured `min_delay_ms`–`max_delay_ms` window (clamped to a
safe 2–5s). Run the bot against it with a small limit to watch it classify and record each slow load
without retrying or hanging.

`site:drift` enables **Scenario 7 (DOM / selector drift)** deterministically: the sandbox tags the
session with an alternate DOM variant (`alt1`/`alt2`) and every page renders different class names /
structure for the same logical content. Run the bot against it to watch its fallback selector chains
resolve every element and log each `fallback_used` drift event.

`site:blocked` enables **Scenario 8 (blocked/intercepted clicks)** deterministically: an invisible
overlay blocks the catalog's "Load more" button, and it re-arms `rearm_after_dismissal_ms` after the
bot removes it. Run the bot against it to watch it detect the blocker, remove it, and **verify the
click took effect** (bounded card-count growth check) before moving on.

### Deterministic all-eight live demo (`npm run demo:all`)

`npm run demo:all` starts the Vite sandbox with a **dedicated demo chaos config**
(`configs/chaos.demo.json`, separate from the normal `chaos.json` and the gauntlet's random-mode
configs), opens a **visible headed Chromium**, then runs the full bot workflow once — extracting all
**43 iPhone models** while every one of the **eight core chaos scenarios is forced to fire at its
controlled point** (`random_mode: false`, fixed seed — probability is ignored, so nothing is left to
seed luck):

| Scenario | Forced at |
|---|---|
| `cookie_banner` | home page load (once per session) |
| `newsletter_popup` | shortly after the cookie banner is dismissed (re-arms each page) |
| `simulated_captcha` | first page load +1s (once per session) |
| `server_errors` | first 2 HTML navigations return 503 (bounded backoff retries) |
| `slow_responses` | every SPA navigation delayed ~2s (classified slow, recovered in place) |
| `unexpected_redirect` | every intended navigation detours to `/promo` (recovered via `noredirect=1`) |
| `dom_drift` | session-wide alternate DOM variant (fallback selector chains) |
| `blocked_clicks` | catalog "Load more" clicks intercepted by a re-arming overlay |

The demo reuses the exact detect → recover → verify pipeline and bounded retries of a normal run; it
just guarantees every scenario actually happens. Evidence is saved to `runs/demo-<run-id>/`
(`results.json`, `summary.json`, `events.jsonl`, `screenshots/`, plus `demo.config.json`), and the
run finishes with a verification report that asserts all 8 scenarios were **detected ≥ 1 and
resolved ≥ 1**, `items_processed = 43`, `items_failed = 0`, `invalid = 0`, `duplicates = 0`, and
`verdict = PASS` (exit 0). Expected duration is roughly 15–20 minutes because all eight disruptions
overlap deterministically. Use `--limit <n>` for a fast spot-check, `--headless` for CI-style runs,
or `npm run demo:all:watch` for visible pacing.

```bash
npm run demo:all                # full deterministic all-eight live demo (headed)
npm run demo:all:watch          # same, with visible pacing between steps
node scripts/demo-all.js --headless --limit 3   # fast headless verification
```

Run the bot against it (default base URL `http://localhost:5173`):

```bash
node bot/run.js                       # full run
node bot/run.js --limit 5             # first 5 items (fast runs)
node bot/run.js --headed              # visible browser
node bot/run.js --base-url http://127.0.0.1:5173 --run-dir runs/my-run
```

Evidence is written to `runs/<run-id>/` (gitignored): `events.jsonl` (structured log),
`screenshots/` (captured on anomalies), `results.json` (extracted data), `summary.json` (per-scenario
disruption counts + pass/fail verdict).

## Tests

One documented command runs everything:

```bash
npm test                # all tiers: unit (Week 2 + Week 3) + happy path + scenarios + all-eight gauntlet
npm run test:unit       # pure unit tests only (fast, no browser/site)
npm run test:happy      # happy path (chaos off)
npm run test:scenarios  # one scenario forced on at a time
```

The scenario tests boot the real Vite sandbox with a per-test `VITE_CHAOS_JSON` override, so the
committed `chaos.json` is never mutated. `tests/test_all_four.spec.js` forces all four Week 2
scenarios on at once (`random_mode: false`, seed 42) and asserts one run still passes with every
disruption detected and recovered. `tests/test_gauntlet.spec.js` is the all-eight chaos gauntlet:
**random mode**, all 8 scenarios enabled, fixed seeds (42 and 99), asserting a complete and correct
run (`PASS`, zero failures, no invalid/duplicate data) plus per-seed recovery evidence — including
seed 99, where cookie banner, unexpected redirects, DOM drift, and blocked clicks all fire in a
single overlapping run and are all handled.

`tests/test_demo_mode.spec.js` is the **deterministic demo-mode test**: it proves the demo config is
deterministic and forces all eight scenarios (`random_mode: false`), the catalog ships 43 models,
and a real workflow run against the demo config detects **and** resolves all eight scenarios with
zero invalid/duplicate data. It also covers the reporter screenshot-failure regression (a capture
failure must never replace the real root-cause error).

## Known limitations

- **Local sandbox only** — the bot targets the intern's own `localhost` sandbox and must never be
  pointed at real third-party sites (ethics rule, `docs/MASTER_SPEC.md` §7.5).
- **Dataset size** — the catalog ships 43 models, slightly above the brief's suggested 20–40 range.
- **Progress does not survive process restart** — the bot has no persistence layer; a new run always
  starts from the beginning, and the sandbox's "once per session" overlays reset with the browser
  session.
- **`chaos.json` changes require restarting Vite** — the sandbox reads the config at dev-server
  startup (bundled `src/chaos/chaos.json`, or a `VITE_CHAOS_JSON` override). Edit the file, then
  restart `npm run site*` for the change to take effect.

## Documentation

- Master plan + acceptance criteria: `docs/MASTER_SPEC.md`
- Chaos Engine contract: `CHAOS_ENGINE_SPEC.md`
- Scenario coverage matrix: `docs/SCENARIOS.md`
- AI usage log: `docs/AI_LOG.md`
