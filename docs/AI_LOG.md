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

---

*(Add 2–3 entries per week going forward, per the brief's cadence.)*
