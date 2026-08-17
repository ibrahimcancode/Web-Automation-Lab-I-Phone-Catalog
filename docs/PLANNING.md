# Planning Document — Resilient Web Automation Lab

> Concise planning reference. Consolidates the relevant planning content from `docs/MASTER_SPEC.md`
> (master blueprint + acceptance criteria) and `CHAOS_ENGINE_SPEC.md` (sandbox disruption design).
> It is a living summary, not a replacement for either spec — see those files for the full detail.

## 1. Project Scope

Build two connected pieces in **one repository**, entirely local:

- **Part A — Sandbox listing site** (`iphone-catalog/`): a React/Vite listing + detail site (iPhone
  catalog theme) fronted by a configurable **Chaos Engine** that injects reproducible disruptions.
- **Part B — Automation bot** (`bot/`): a Playwright-driven bot that completes a defined extraction
  workflow and **keeps completing it correctly** no matter which disruptions the chaos engine throws
  at it — detecting each disruption, recovering deliberately, logging evidence, and reporting a run
  summary.

The project is evaluated primarily on **breadth and quality of disruption-scenario handling**, not on
visual polish or feature count (MASTER_SPEC §1).

## 2. Architecture

```
docs/MASTER_SPEC.md    # Master plan + per-week acceptance criteria (source of truth)
CHAOS_ENGINE_SPEC.md   # Chaos Engine design contract (determinism, hook types, validation)
iphone-catalog/        # Part A: React/Vite sandbox + Chaos Engine (client-side + Vite middleware)
  src/chaos/           #   engine, seeded randomizer, logger, per-scenario handlers, chaos.json
  vite-chaos-server.js #   server-side Scenario 4 middleware (genuine 5xx responses)
  vite-chaos-slow.js   #   server-side Scenario 5 middleware (delayed responses)
  vite-chaos-rate-limit.js    # server-side Scenario 9 middleware (HTTP 429)
  vite-chaos-session-expiry.js # server-side Scenario 10 middleware (session expired)
bot/                   # Part B: Playwright bot
  run.js               #   entry point (CLI with --resume support)
  workflow.js          #   orchestration: happy path, obstacle sweep, navigation guard
  handlers/            #   one detect -> recover module per scenario + registry (index.js)
  reporting.js         #   JSON-lines events, anomaly screenshots, run summary, metrics, trace
  selectors.js         #   all selectors centralized (with fallback chains)
  backoff.js           #   pure exponential-backoff calculator
  timeouts.js          #   navigation duration classification
  checkpoint.js        #   crash-safe checkpoint persistence
  validate.js          #   pure extracted-data validation
tests/                 # Playwright test tiers (unit / happy-path / scenarios / all-four / gauntlet)
configs/               # Chaos configuration presets (demo, off, etc.)
scripts/               # Cross-platform orchestration scripts
runs/                  # run evidence (gitignored; sample runs committed)
docs/                  # PLANNING.md, SCENARIOS.md, AI_LOG.md, MASTER_SPEC.md, WEEK4_AUDIT.md
```

Key structural rules (MASTER_SPEC §1.3, §7):

- **Bot/site decoupling** — the bot only interacts with the rendered DOM like a human would. No
  reading data files directly, no backdoor endpoints, no shared code.
- **Handler registry** — each handler is `{ name, type, priority, detect(ctx), recover(ctx) }`
  registered through `bot/handlers/index.js`. Adding a scenario = add a module; `run.js`/
  `workflow.js` do not need restructuring.
- **Determinism** — every disruption must be triggerable on demand via `chaos.json`/`VITE_CHAOS_JSON`,
  never just "sometimes happens". Seeded randomness runs through one shared RNG (CHAOS_ENGINE_SPEC §10).
- **Discipline** — no fixed `sleep()` for correctness (explicit Playwright waits only), no catch-all
  exception swallowing, consistent async Playwright API, centralized selectors.

## 3. Bot Workflow

Chosen workflow (MASTER_SPEC §4.3, Phase 2.1 — option a): *catalog extraction*.

1. Home page — navigate (navigation guard: detect 5xx/network failure → backoff retry).
2. Catalog page — navigate; reveal all items via "Load more" (overlay-aware clicks).
3. Collect card links + names.
4. Visit each detail page → extract `name`, `tier`, `year`, `price`, `color`, `storageGBs`.
5. Before/after each step, sweep overlays (cookie banner, newsletter popup, simulated captcha).
6. Write evidence + run summary (`buildSummary`: PASS/FAIL verdict, per-scenario disruption counts,
   validation stats).

## 4. Ten-Scenario Plan

| # | Scenario | Week | Bot handling (detect → recover) |
|---|---|---|---|
| 1 | Random pop-up / modal (newsletter signup) | 1 / 2 | Fill + submit a placeholder email, verify success state, dismiss; bounded retries |
| 2 | Cookie / consent banner | 1 / 2 | Accept (fallback Reject), verify banner hidden |
| 3 | Simulated captcha gate | 1 / 2 / 4 | Visual 3x3 traffic-light grid; bot screenshots tiles, analyzes pixel colors (R/Y/G channels), selects correct tiles |
| 4 | Site down / server errors | 2 | Navigation guard: detect 5xx/network error, exponential backoff retry with hard cap, resume from current item |
| 5 | Slow responses / timeouts | 3 | Navigation guard: classify load duration (pure `bot/timeouts.js`); on "slow but loaded" record the recovery in place |
| 6 | Unexpected redirection | 3 | Verify URL/page identity post-navigation; route back |
| 7 | DOM change / selector drift | 3 | Fallback-chain selectors instead of brittle CSS paths |
| 8 | Blocked / intercepted clicks | 3 | Detect interception, remove obstruction or alternative action, verify effect |
| 9 | HTTP 429 rate limiting | 4 | Navigation guard: detect 429, extract Retry-After header, back off, retry |
| 10 | Session expiry | 4 | Navigation guard: detect interstitial page, click "Continue" to restore session |

Scenarios 5–8 must NOT be started until Week 3 (MASTER_SPEC §0.1, rule 3).

## 5. Chaos Configuration

Single source: `iphone-catalog/src/chaos/chaos.json`, overridable at dev-server start via the
`VITE_CHAOS_JSON` env var (used by every automated test and by the `site:*` npm scripts — the
committed file is never mutated).

```json
{
  "enabled": true,
  "random_mode": false,
  "seed": 42,
  "scenarios": { "cookie_banner": {...}, "newsletter_popup": {...}, "simulated_captcha": {...}, "server_errors": {...} }
}
```

Rules (CHAOS_ENGINE_SPEC §7, §10):

- `enabled=false` → no scenario executes.
- `random_mode=false` → every enabled scenario activates deterministically; probabilities ignored and
  **no randomness consumed** (this is how tests force scenarios).
- `random_mode=true` → one seeded draw per enabled scenario per request; same seed → same sequence.
- The newsletter delay and captcha delay are drawn server-side (deterministic mode falls back to a
  fixed delay) and never generated by `Math.random()` in the client (CHAOS_ENGINE_SPEC §10 #6).
- Server errors: `fail_first_n` (deterministic, for tests) or `probability` (seeded random);
  `status_code` defaults to 503.
- Config is validated defensively: negative probabilities/delays clamp to 0, `max_delay_ms` is capped
  at 15000 ms, invalid JSON disables chaos without crashing the site.

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Handler swallows all exceptions, hiding real bugs | Catch only named exceptions; log unknowns loudly (MASTER_SPEC §4.9) |
| Mixed sync/async Playwright APIs | One API mode (async) enforced across `bot/` |
| Fixed `sleep()` creeps in to make a flaky test pass | Treated as a defect; replaced with explicit waits |
| Retry without a cap → infinite loop on Scenario 4 | Hard cap in `backoff.js`, unit-tested |
| Newsletter modal rejects the dummy email → hang | Well-formed placeholder + post-submit check + one bounded retry, then fallback close/ESC |
| Combined scenarios race (delayed popup intercepting clicks) | `clickThroughObstacles()` in `workflow.js`: cheap re-sweep + bounded retry on click failure |
| Timing-coupled scenarios are flaky to test | Deterministic forced-on config (`random_mode=false`) + targeted flows for delayed popups |
| Docs drift out of sync with handlers | Update `docs/SCENARIOS.md` in the same commit as the handler |
| Scope creep into Weeks 3–4 | Enforce phase order; completed weeks are immutable unless instructed |

## 7. Constraints

- **Local & free only**: no cloud, no paid services, no API keys; everything on `localhost`.
- **Playwright only** for the bot — no Selenium, Puppeteer, or raw `requests` scraping.
- **No fixed sleeps** in bot code; explicit waits only (the single exception is the bounded retry
  backoff used by the navigation guard).
- **Reproducibility first**: every scenario triggerable on demand via config.
- **Scope discipline**: a modest workflow with all 8 core scenarios handled excellently beats an
  elaborate workflow with only three.
- **Commit hygiene**: small focused commits; `runs/` gitignored with 1–2 sample runs committed; never
  commit secrets, browser downloads, or bulky logs.

## 8. Ethics

- The bot targets **only the intern's own local sandbox** — never a real third-party site.
- The captcha handler solves only the sandbox's **simulated** visual traffic-light challenge via pixel
  analysis. It must never be adapted or repurposed toward bypassing genuine anti-bot/CAPTCHA
  protections on real services (MASTER_SPEC §7.5). Resilient automation and evading others' defenses
  are distinct skills; only the former is in scope.
- Never paste real personal data or credentials into AI tools; never commit secrets.
