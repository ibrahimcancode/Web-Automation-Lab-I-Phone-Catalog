# AI_LOG.md

> Running log of AI usage across the project, per the brief's §7 requirement. Entries are added as
> the work happens, not reconstructed at the end. Week 1 entries live in `iphone-catalog/AI_LOG.md`.

---

### Entry W2-1 — Week 2 baseline bot, evidence infra, and centralized selectors
- **Trying to do:** Stand up `bot/` as a peer package (no coupling to the sandbox): a happy-path
  workflow (home → catalog → load-more → each detail page → extract fields → `results.json`), plus
  `reporting.js` (JSON-lines events, anomaly screenshots, `buildSummary()` run summary with a
  pass/fail verdict) and `selectors.js` (all selectors centralized for Week 3's DOM-drift work).
- **Tool/prompt:** opencode, given the current-state summary and the Week 2 section of the master
  spec.
- **What it got right:** Kept `buildSummary()` and `backoff.js` pure (no Playwright dependency) so
  they are unit-testable in isolation, exactly the split the spec asked for; used only async Playwright
  API and explicit waits (no fixed `sleep()`).
- **What it got wrong / had to change:** Nothing blocking; the sandbox had since migrated from the
  Flask `sandbox_site/` described in older docs to a Vite/React `iphone-catalog/`, so the bot had to
  target the new DOM and the docs still described the old site (fixed in this milestone's doc pass).
- **What I learned:** Re-read the actual repo before trusting the README — the spec's repo map was
  stale by a full migration.

### Entry W2-2 — First disruption handlers + the handler registry
- **Trying to do:** Add the four Week 2 handlers (cookie banner, newsletter popup, simulated captcha,
  server errors) as small `detect → recover` modules registered through a shared registry, so Week 3
  adds scenarios by adding modules, not by restructuring `run.js`/`workflow.js`.
- **Tool/prompt:** opencode, given the handler contract (name/type/priority/detect/recover) and the
  sandbox DOM selectors.
- **What it got right:** The navigation guard routes only 5xx/network failures to the server-error
  handler (retry with bounded backoff), so "which disruption happened" stays specific and is recorded
  in the run summary, not swallowed.
- **What it got wrong / had to change:** The first registry attempt used static `import` statements in
  the registry module, which created a circular import (handlers import `registerHandler` from the
  registry, which imported the handlers back) and hit a temporal-dead-zone bug on the shared `registry`
  array at module-evaluation time. Reworked to lazy dynamic imports via `ensureHandlersLoaded()`,
  awaited from every entry point (`run.js`, `runWorkflow`, `clearObstacles`, `navigateWithGuard`).
- **What I learned:** Self-registering modules + a registry is a clean pattern, but with circular
  imports the shared mutable state must not be touched during module evaluation — make registration
  lazy and idempotent.

### Entry W2-3 — Week 2 tests and scenario-flake debugging
- **Trying to do:** Create the three test tiers (unit, happy-path, scenario) that boot the real Vite
  sandbox with a per-test `VITE_CHAOS_JSON` override, and get all of them green.
- **Tool/prompt:** opencode; helped author `tests/helpers/site.js` (spawn Vite, wait until ready),
  `tests/helpers/bot.js` (run the full workflow into a temp run dir), and the three spec files.
- **What it got right:** Unit tests cover `backoff.js`, `parseMathQuestion`, the registry contract,
  and selector-map completeness; each scenario test forces exactly one scenario on deterministically
  (`random_mode: false`).
- **What it got wrong / had to change:** Three real bugs surfaced by the tests: (1) Vite's default
  `localhost` binding resolved to IPv6 `::1` while the test helper probed `127.0.0.1` — fixed by
  binding the dev server to `127.0.0.1` explicitly; (2) the newsletter modal only arms ~3s *after* the
  cookie banner is dismissed (sandbox collision rule), so the full-workflow sweep left each page before
  the modal appeared — reworked that scenario into a targeted flow (clear cookie → wait for the delayed
  modal → sweep); (3) the navigation guard never emitted a `detected` event, so the server-error
  disruption count stayed 0 — added the event in `navigateWithGuard`.
- **What I learned:** Timing-coupled scenarios (delayed popups, retries) are much more reliably tested
  with a targeted flow than by hoping a full run happens to dwell long enough; and a metric that
  exists in the summary should actually be emitted somewhere in the code path.

### Entry W2-4 — Combination-run hardening (caught by §4.12 verification)
- **Trying to do:** Verify MASTER_SPEC §4.12 criterion "no unhandled exceptions or infinite hangs when
  any combination of the 4 scenarios is forced on" by running all four simultaneously
  (`random_mode: false`).
- **What happened:** With all four enabled, the newsletter popup (which re-arms ~3s after each page
  load, since the cookie banner is session-once) appeared *while* the bot was clicking "Load more" on
  the catalog page. The popup overlay intercepted the pointer events, the click timed out after 10 s,
  and the run crashed with an unhandled `TimeoutError` (exit 2).
- **What I changed:** Made the interactive step overlay-aware: `clickThroughObstacles()` in
  `workflow.js` runs a cheap, detection-based re-sweep (`quickSweep()`) after any click failure and
  retries, bounded — so a genuine non-overlay failure still throws instead of looping. Applied to the
  "Load more" button, the only pointer-interactive workflow step.
- **What I learned:** A delayed overlay can land *during* an action, not just before a step — so
  overlapping scenarios catch timing races that isolated scenario tests never will. The §4.12
  "combination forced on" check is a genuinely different (and valuable) test than the per-scenario
  suite.

### Entry W3-1 — Scenario 5: sandbox simulation + pure duration classification + navigation handler
- **Trying to do:** Start Week 3 with Scenario 5 (slow responses / timeouts) — a genuine delayed
  response the bot can observe and classify, without any fixed sleeps.
- **Tool/prompt:** opencode, given the milestone brief (add `slow_responses` to the config, simulate a
  delayed page/element response with a safe 2–5s cap, detect it specifically, recover by proceeding,
  evidence + unit tests + one forced demo run).
- **What it got right:** A client-side SPA can't be slow server-side, so I added a sibling Vite
  middleware (`vite-chaos-slow.js`) that delays only HTML SPA navigations by `min_delay_ms`–`max_delay_ms`
  (clamped to the safe 2–5s window; deterministic mode = exactly `min_delay_ms`). The bot side stays
  additive: `navigateWithGuard` now measures each navigation attempt's duration and passes it to the
  handlers, and `bot/timeouts.js` classifies it (`normal` / `slow` / `dead`) as a pure, unit-tested
  function. The new `slow_response_handler.js` claims only "slow but loaded" navigations, records a
  `resolved` recovery with the observed duration, and never retries — so the run continues and the
  evidence still shows the disruption. Registered it in the existing lazy handler loader; added
  `slow_responses` to `buildSummary`'s scenario list.
- **What it got wrong / had to change:** The engine's existing 2–5s hard-cap clamp only covered the
  singular `slow_response` key; I extended the condition to `slow_responses` so client-side config
  validation matches the new scenario name. Also, the Week 2 unit test asserted "exactly four handlers"
  and "navigation handlers are only server_errors" — both were updated to the new reality (five
  handlers; two navigation handlers).
- **What I learned:** Measuring duration around the existing `page.goto` is enough — no fixed sleeps,
  and the handler gets real observed evidence (the `loaded in Nms` detail) that a test can assert
  against the configured threshold.

### Entry W3-2 — Scenario 5 test, full-suite verification, and a pre-existing all-four flake
- **Trying to do:** Add a deterministic Scenario 5 scenario test (every page load delayed, bot must
  detect + record + continue without hanging) and keep the entire 34-test suite green.
- **Tool/prompt:** opencode; test mirrors the Week 2 scenario-tier pattern (`VITE_CHAOS_JSON` override,
  `random_mode: false`, dedicated port).
- **What it got right:** The Scenario 5 test boots the sandbox with a 2500–4000ms forced delay and
  asserts `slow_responses.detected > 0`, `resolved > 0`, `retries == 0`, `screenshots > 0`, and that
  every `recovered` event's `loaded in Nms` duration meets the configured threshold. The full suite
  passes 46/46.
- **What it got wrong / had to change:** The all-four combination test flaked twice on `newsletter_popup`
  not being detected. I confirmed it is a **pre-existing, load-dependent race**, not a regression:
  with `random_mode: false` the engine never draws `delay_seconds`, so the popup shows exactly 3s after
  each page load, and the bot catches it only when the catalog's load-more clicks span that 3s window.
  Both the baseline commit and my changes passed 3/3 in isolation; the flake only appeared under
  heavier load. I left the Week 2 test and bot behavior untouched (per the "do not rewrite completed
  Week 2" rule) and documented the timing race here instead.
- **What I learned:** A test that asserts "this scenario happened" on a timing-coupled popup is only as
  stable as the machine it runs on — worth flagging the 3s-fixed-delay quirk (deterministic mode skips
  the delay draw) as a known source of flake for the all-four tier.

### Entry W3-3 — Scenario 6: unexpected redirects — fixing the handoff and closing the test
- **Trying to do:** Complete the Week 3 Scenario 6 handoff from the previous agent (Antigravity), which
  had partially implemented the sandbox redirect (ChaosProvider + PromoPage + config) and the bot-side
  `redirect_handler.js`, but left the test failing.
- **Tool/prompt:** opencode; phase-1 audit of the partial handoff (git status, diff, run targeted test).
- **What I found:** Root cause was `bot/workflow.js` `navigateWithGuard` calling
  `handler.detect({ page, response, error, attempt, navigationMs })` **without** the `url` parameter,
  so `redirect_handler.detect` (which needs the intended destination URL to detect a wrong-page landing)
  always received `undefined` and returned `false`. The browser *did* redirect to `/promo` (evidenced by
  `cards=0` on the catalog page), but the bot never detected or recovered from it.
- **What I fixed:** Added `url` to the `detect` context in `navigateWithGuard`. Removed a debug
  `console.log`. Updated three unit tests (`test_unit_week2.spec.js` x2, `test_unit_week3.spec.js` x1)
  to include the new `unexpected_redirect` handler in their expected handler lists (legitimate assertion
  updates, not weakening). The Scenario 6 test now passes with `detected=4`, `resolved=4`,
  `items_processed=2`, `items_failed=0`, valid extraction, and anomaly screenshots — exactly matching
  the deterministic requirements (redirect detected → resolved → intended page reached → data valid →
  no item failure → evidence created).
- **What I learned:** Navigation handlers that need the intended URL must receive it from the guard — the
  `url` is available in the outer loop but was omitted from the detect context. A single-line fix
  unblocked the entire scenario. Also, config override debugging (extra browser page in the test) is
  noisy and leaks resources; the test now runs clean with only `runBotOnce`.

### Entry W3-4 — Scenario 7: DOM / selector drift — fallback chains, bounded attempts, and the waitForFunction arg trap
- **Trying to do:** Complete the Week 3 Scenario 7 handoff: sandbox-side alternate DOM variants
  (`alt1`/`alt2` class names per page, set via `document.body.dataset.chaosDomDrift` before pages
  render) and bot-side recovery through fallback selector chains, with deterministic evidence.
- **Tool/prompt:** opencode; phase-1 audit of the partial handoff, then implement + verify.
- **What I changed:** (1) `DomDrift.jsx` now picks a *non-primary* variant deterministically (before,
  it could pick `primary`, which is indistinguishable from no drift) and exposes
  `getCurrentDomDriftVariant()`; `ChaosProvider` sets the body dataset during render so every page
  reads the same variant. (2) `Catalog`/`ModelDetail`/`Home` render meaningfully different classes
  per variant. (3) `selectors.js` became fallback chains (`getSelector` stays backward-compatible as
  the primary; `getSelectorChain`, `waitForSelectorChain`, `findFirstMatchingSelector` added) with a
  3s per-attempt bound so a missing primary fails fast instead of burning Playwright's 30s default.
  (4) `dom_drift_handler.js` detects once per session via cheap `page.$` probes. (5) `workflow.js`
  threads `reporter` into `waitForPageReady`/`extractDetail` so every fallback use is logged as a
  `dom_drift` `fallback_used` event.
- **What it got wrong / had to change:** Two real stalls surfaced while driving the forced-drift test
  green: (a) `page.waitForFunction(fn, selector, prev)` — the **second positional argument is read as
  `options`, not a second function argument**, so `prev` was `undefined` and `N > undefined` is always
  false → every Load More wait timed out (and the happy path flaked the same way). Fixed by passing a
  single `{ selector, prev }` object. (b) `extractDetail` called `text()` sequentially, each paying the
  3s primary-timeout under drift (5 fields ≈ 15s/page) — parallelized with `Promise.all` so the cost is
  paid once. Also learned the read/git tool outputs in this session could be stale/garbled, so I
  verified file state via `node --check` and `Get-Content` line dumps before trusting a diff.
- **What I learned:** Bounded per-attempt timeouts are what make fallback chains fast; and
  `waitForFunction`'s `(fn, arg, options)` signature silently misroutes extra positionals, which is
  worth a unit-level check on any `waitForFunction` with two inputs.
- **Deterministic proof (forced `dom_drift`, `random_mode: false`):** Scenario 7 test passes with
  `verdict=PASS`, `items_processed>0`, `items_failed=0`, `data_validation.invalid=0`,
  `dom_drift.detected/resolved>0`, `fallback_used` events naming the failed primary(s), and anomaly
  screenshots. Full suite: 54/54 (unit + happy path + scenarios 1–7 + all-four).

---

*(Add 2–3 entries per week going forward, per the brief's cadence.)*
