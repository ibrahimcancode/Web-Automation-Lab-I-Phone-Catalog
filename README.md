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
- **Week 3 —** scenarios 5–8 + the chaos gauntlet: **not started** (see `MASTER_SPEC (1).md`).

## Repository layout

```
MASTER_SPEC (1).md     # Master plan + acceptance criteria per week
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
  validate.js          #   pure extracted-data validation
tests/                 # Playwright test tiers (unit / happy-path / scenarios)
runs/                  # run evidence (gitignored; sample runs committed)
```

The bot never touches the sandbox's internals — it only drives the rendered browser (decoupling rule
in `MASTER_SPEC (1).md` §1.3).

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
```

`site:all` enables **cookie banner + newsletter popup + simulated captcha + server errors** with a
fixed seed and `random_mode: false`, so every enabled scenario fires every time — the deterministic
"all-four" environment the combination test and sample run use. (The sandbox server errors are
driven by `fail_first_n: 2`, so exactly the first two navigations return a 503 and are retried.)

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
npm test                # all Week 2 tiers: unit + happy path + scenarios + all-four
npm run test:unit       # pure unit tests only (fast, no browser/site)
npm run test:happy      # happy path (chaos off)
npm run test:scenarios  # one scenario forced on at a time
```

The scenario tests boot the real Vite sandbox with a per-test `VITE_CHAOS_JSON` override, so the
committed `chaos.json` is never mutated. `tests/test_all_four.spec.js` is the combination tier: it
forces all four scenarios on at once (`random_mode: false`, seed 42) and asserts one run still passes
with every disruption detected and recovered.

## Known limitations

- **Local sandbox only** — the bot targets the intern's own `localhost` sandbox and must never be
  pointed at real third-party sites (ethics rule, `MASTER_SPEC (1).md` §7.5).
- **Dataset size** — the catalog ships 43 models, slightly above the brief's suggested 20–40 range.
- **Progress does not survive process restart** — the bot has no persistence layer; a new run always
  starts from the beginning, and the sandbox's "once per session" overlays reset with the browser
  session.
- **`chaos.json` changes require restarting Vite** — the sandbox reads the config at dev-server
  startup (bundled `src/chaos/chaos.json`, or a `VITE_CHAOS_JSON` override). Edit the file, then
  restart `npm run site*` for the change to take effect.

## Documentation

- Master plan + acceptance criteria: `MASTER_SPEC (1).md`
- Chaos Engine contract: `CHAOS_ENGINE_SPEC.md`
- Scenario coverage matrix: `docs/SCENARIOS.md`
- AI usage log: `docs/AI_LOG.md`
