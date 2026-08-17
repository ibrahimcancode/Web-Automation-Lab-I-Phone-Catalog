# Master Specification — Resilient Web Automation Lab
### AI-Assisted Development Internship — Permanent Project Blueprint

**Document type:** Master architecture & delivery specification
**Source of truth:** `Resilient Web Automation Lab — Internship Project Brief` (official brief, all four weeks)
**Status of this document:** Living specification, versioned. This file supersedes all prior planning notes and is the single specification file for the repository.
**Primary consumer:** An AI coding agent (OpenCode) implementing the repository week by week, plus the intern and any human reviewer.

---

## 0. How This Document Must Be Used

This is **not** a progress report or a weekly status update. It is the **permanent blueprint** for the entire repository, split into four immutable-once-completed stages. It is written so that an AI coding agent can open this single file at the start of any session and know exactly what to build, in what order, and what NOT to touch.

### 0.1 Operating Rules for the Implementing Agent

1. **Read the whole document before acting**, but only ever *implement* the week explicitly requested by the human operator in that session.
2. **Completed weeks are immutable.** A week marked `STATUS: COMPLETED` describes work that already exists in the repository. Do not rewrite, refactor, restyle, or "improve" it unless the human operator gives an explicit, separate instruction to modify a completed week. Treat completed-week code as a stable dependency, not a draft.
3. **Never start a future week early.** A week marked `STATUS: NOT STARTED` or `STATUS: FUTURE WORK` must not be touched until the human operator explicitly instructs "begin Week N." Do not pre-build Week 3 handlers while working on Week 2, even if it looks efficient.
4. **Respect the dependency chain.** Each week's phases are ordered; do not implement Phase N+1 of a week before Phase N is verified working (see each week's Acceptance Criteria).
5. **When a week is completed, this document should be updated** (status flipped from `NOT STARTED`/`FUTURE WORK` to `COMPLETED`, and the "as implemented" details filled in) rather than replaced. The four-week skeleton and cross-week rules stay stable across the whole internship.
6. **All cross-week standing rules in Section 7 apply at all times**, regardless of which week is currently being implemented (commit hygiene, ethics/legality rules, decoupling rules, testing command, AI usage logging).
7. If an instruction from the human operator conflicts with the underlying internship brief, the brief wins — flag the conflict rather than silently resolving it.

### 0.2 Legend

| Status | Meaning |
|---|---|
| `COMPLETED` | Exists in the repo today. Immutable unless explicitly instructed otherwise. |
| `NOT STARTED` | Specified in detail; implementation has not begun; this is the **next** week to build. |
| `FUTURE WORK` | Specified for continuity/context; must not be started until its own week arrives. |

---

## 1. Project Overview

Build two connected pieces in **one repository**:

- **Part A — Sandbox listing site**: a small, deliberately unstyled local website (Flask/Python or Express/Node) serving a JSON-backed listing + detail pages, fronted by a **chaos engine** that can inject reproducible disruptions (pop-ups, outages, redirects, DOM drift, etc.) on command or at random.
- **Part B — Automation bot**: a Playwright-driven bot (the star of the project) that completes a defined workflow against the sandbox site and **must keep completing it correctly** no matter which disruptions the chaos engine throws at it — detecting each disruption, recovering deliberately, logging evidence, and reporting a run summary.

The project is evaluated primarily on **breadth and quality of disruption-scenario handling**, not on visual polish or feature count. Ugly-but-resilient beats pretty-but-brittle at every stage.

### 1.1 Program Logistics (From the Official Brief)

- **Duration**: 4 weeks total. The core scope (all 8 required scenarios, working end-to-end) is explicitly designed to be **achievable in 3 weeks**; Week 4 is buffer/stretch/polish, not a week to start core work.
- **Format**: remote, individual work, on the intern's own machine, using the intern's own personal GitHub account. There is no shared infrastructure and no team component — every deliverable in this document is produced solo.
- **Support**: a weekly 30-minute group call plus a shared async Q&A channel (see Section 8 for the cadence this implies).

### 1.2 Learning Objectives (Why the Project Is Shaped This Way)

The brief frames the whole exercise around six skill areas, and every week below is designed to build toward them, not just to produce a working repo:

- **Planning with AI** — turning a problem statement into a written spec, scenario list, and technical design before writing any code (this is why `PLANNING.md` is a Week 1 gate, not an afterthought).
- **Web fundamentals** — how a site serves pages, how the DOM works, and what actually happens when things go wrong (timeouts, redirects, errors) — the sandbox's whole purpose is to make these failure modes observable.
- **Browser automation** — driving a real browser with Playwright: navigating, extracting data, clicking, waiting correctly.
- **Resilience engineering** — detecting unexpected states, recovering gracefully, retrying intelligently, logging evidence — the actual skills behind production scrapers, RPA, and AI browser agents.
- **Testing & reproducibility** — making every failure scenario reproducible on demand via `chaos.json`, and proving handling works with tests rather than anecdote.
- **Professional delivery** — a clean repository, meaningful commits, and documentation other people can actually follow.

### 1.3 Non-Negotiable Ground Rules (apply to every week)

- **Local & free only**: no cloud hosting, no paid services, no API keys required to run the project. Everything runs on `localhost` with Python/Node, Playwright, Git, GitHub.
- **Playwright only** for the bot — no Selenium, Puppeteer, or raw `requests`-based scraping.
- **Bot/site decoupling**: the bot may only interact with the site the way a human would, through the rendered browser DOM. No reading `items.json` directly from disk, no backdoor endpoints, no shared code that leaks answers to the bot.
- **Ethics/legality**: this bot only ever targets the sandbox site the intern owns. Never point it at real third-party sites. The captcha is *simulated* and must never be adapted into a real CAPTCHA bypass — that is explicitly out of scope and against the spirit of the internship.
- **Reproducibility first**: every disruption must be triggerable on demand via `chaos.json`, not just "sometimes happens" — this is the foundation the whole testing strategy depends on.
- **Scope discipline**: a modest workflow with all eight core scenarios handled excellently beats an elaborate workflow with only three. Depth of handling wins over breadth of workflow features — this governs every trade-off decision across all four weeks, including whether to add stretch scenarios or workflow steps in Week 4.

---

## 2. Target End-State Architecture (Where All Four Weeks Are Heading)

By the end of Week 4, the repository contains:

- A **sandbox site** (`sandbox_site/`) that can simulate all 8 core disruption scenarios (plus any stretch scenarios chosen), individually or in a weighted-random "chaos gauntlet" mode with a fixed seed for reproducibility.
- A **bot** (`bot/`) that runs a defined extraction/interaction workflow end-to-end, detects and recovers from every enabled disruption, and never hangs or crashes with an unhandled exception.
- A **structured evidence trail**: JSON/line-based logs of every event and action, automatic screenshots on anomalies, and a run summary (items processed, disruptions hit, resolution + retry counts, data completeness/correctness).
- A **test suite** (`tests/`) covering scenario-level behavior, unit-level pure logic (retry/backoff, selector fallback, data validation), and one "gauntlet" end-to-end test — runnable with a single documented command.
- **Documentation** (`docs/PLANNING.md`, `docs/SCENARIOS.md`, `docs/AI_LOG.md`) and a top-level `README.md` sufficient for a stranger to clone the repo and run everything, plus a 3–5 minute demo.

This target state is the backdrop against which each week's "Architecture Additions" are described — each week adds a layer onto the same skeleton; nothing is thrown away between weeks.

### 2.1 Full Target Repository Structure

*(Python/Flask naming shown, matching the current implementation; if the stack were Node.js/Express instead, the brief's own guidance is to adapt file names accordingly — e.g. `app.js`/`server.js` for `app.py`, `package.json` for `requirements.txt` — while keeping the same folder roles.)*

```
web-automation-lab/
├── README.md                  # overview, setup, how to run site + bot + tests
├── docs/
│   ├── PLANNING.md            # spec, scenario list, architecture, risks (Week 1)
│   ├── SCENARIOS.md           # scenario coverage matrix — KEY DELIVERABLE (Weeks 1–4, living doc)
│   └── AI_LOG.md              # AI usage log, 2–3 entries/week (Weeks 1–4)
├── sandbox_site/
│   ├── app.py                 # Flask server + chaos middleware
│   ├── chaos.json             # per-scenario toggles, probabilities, seed
│   ├── data/items.json        # dummy listing data (20–40 items)
│   └── templates/              # listing.html, detail.html, popups, captcha page
├── bot/
│   ├── run.py                  # entry point: runs the workflow
│   ├── handlers/                # one module per scenario type
│   ├── selectors.py             # all selectors + fallbacks, centralized
│   └── reporting.py             # logging, screenshots, run summary
├── tests/                       # unit + scenario tests + gauntlet
├── runs/                        # logs + screenshots (gitignored; 1–2 samples committed)
├── requirements.txt              # or package.json
└── .gitignore                    # venv, __pycache__, runs/, node_modules
```

### 2.2 Evaluation Rubric (drives priority across all weeks)

| Area | Weight | What "good" looks like |
|---|---|---|
| Scenario coverage & strategies | 35% | All 8 core scenarios reliably detected and handled with deliberate strategies; honest, complete `SCENARIOS.md`; stretch/original scenarios earn extra credit. |
| Working software | 20% | Both parts run from a fresh clone; gauntlet passes repeatedly; extracted data complete/correct; useful logs, screenshots, summaries. |
| Code quality & structure | 15% | Clear organization, one handler per concern, centralized selectors, readable naming, no dead code, fully explainable. |
| Testing | 15% | Reproducible scenario tests, meaningful unit tests, all green with one command. |
| AI workflow & process | 15% | Thoughtful AI usage log, committed planning docs, steady commit history, evidence of verification/iteration. |

**Why this matters to the implementing agent:** scenario coverage and working software together are 55% of the grade — every week's plan below is sequenced to protect those two areas first, with polish (styling, extra features) always coming last.

---

## 3. WEEK 1 — Sandbox Site & Chaos Engine Foundation

### STATUS: **COMPLETED** (immutable — see Section 0.1, rule 2)

> **Confirmed by the human operator** (this was previously an assumption; it is now confirmed fact and the "flagged assumption" language below has been resolved): the three scenarios implemented in Week 1 are **Scenario 2 (Cookie/consent banner)**, **Scenario 3 (Simulated captcha gate)**, and **Scenario 1 (Random pop-up/modal)** — specifically implemented as a **newsletter signup modal that requires an email address to be entered and submitted before it will dismiss** (i.e., it is not a simple "click X to close" modal; the sandbox forces an actual form interaction). This detail matters for Week 2's handler design — see Section 4.3, Phase 2.4.

### 3.1 Objectives (Why This Week Exists)

- Establish a working, reproducible "lab rig" — a site that misbehaves *on command* — before any bot code is written, because a bot cannot be tested against disruptions that aren't reproducible yet.
- Force early AI-assisted planning discipline: a written spec (`PLANNING.md`) exists before code, so that scope and architecture decisions are deliberate rather than improvised mid-build.
- Prove out the chaos-engine mechanism (config-driven, toggle-able, seedable) early, since every later week's testing strategy depends on it.

### 3.2 Functional Requirements (As Implemented)

- **Data**: a local JSON file (`sandbox_site/data/items.json`) with 20–40 dummy items, each with `id`, `name`, `price`, 3–4 additional attributes, and a `description`. Generated with AI assistance, not hand-written.
- **Pages**:
  - A listing page showing all items with basic pagination or a "load more" control.
  - A detail page per item.
  - Optionally one interaction element (search box, filter, or an "add to cart" / "contact seller" action) — present if implemented, not required to be elaborate.
- **Stack**: a minimal Flask server rendering plain HTML templates from the JSON data. No database, no login/auth system, no frontend framework.
- **Chaos engine**: `sandbox_site/chaos.json` defines, per scenario, an on/off toggle and (for random mode) a trigger probability and a random seed, so that:
  - Any individual scenario can be forced on deterministically for a scenario test.
  - A "random mode" can run all enabled scenarios probabilistically for realistic end-to-end runs.
- **Scenarios implemented this week**: 3 of the 8 core scenarios — cookie/consent banner, simulated captcha gate, and a newsletter signup pop-up/modal (see confirmed detail above: this modal requires a dummy email to be entered and submitted to dismiss it, not just a close button) — wired into the Flask chaos middleware so they are already triggerable, even though the bot does not yet handle them (bot handling begins Week 2).

### 3.3 Non-Functional Requirements

- **Zero visual polish** — unstyled HTML is explicitly acceptable and expected; time must not be spent on CSS.
- **Fully local & offline** — no external services, no network calls beyond `localhost`.
- **Deterministic reproducibility** — every scenario must be triggerable the same way every time via config, not just "eventually happens" in random mode.
- **Decoupled from the bot** — the site must expose no shortcuts (no debug JSON endpoint, no shared modules) that a bot could exploit instead of interacting via the DOM.

### 3.4 Architecture (As Built)

- Flask app (`app.py`) with:
  - Standard request handlers for listing/detail pages, rendering Jinja templates from `items.json`.
  - A **chaos middleware/layer** that intercepts requests or response rendering and, based on `chaos.json`, injects the enabled disruptions (e.g., serving a modal partial, injecting a cookie-banner partial, redirecting to a captcha template) before or alongside the normal response.
- `chaos.json` acts as the single source of runtime configuration for which disruptions are live and how likely each is to fire in random mode, including the random seed for reproducibility.
- Templates directory holds the normal pages (`listing.html`, `detail.html`) plus the disruption-specific partials/pages (popup markup, captcha page, etc.) for the scenarios implemented so far.

### 3.5 Modules Delivered

| Module | Responsibility |
|---|---|
| `sandbox_site/app.py` | Flask routes, page rendering, chaos middleware wiring |
| `sandbox_site/chaos.json` | Per-scenario toggles, probabilities, seed |
| `sandbox_site/data/items.json` | Dummy listing dataset (20–40 items) |
| `sandbox_site/templates/` | Listing/detail pages + disruption templates for the 3 implemented scenarios |

### 3.6 Folder Structure (Current State)

```
web-automation-lab/
├── docs/
│   └── PLANNING.md
├── sandbox_site/
│   ├── app.py
│   ├── chaos.json
│   ├── data/items.json
│   └── templates/
├── requirements.txt
└── .gitignore
```
(`bot/`, `tests/`, `runs/`, `docs/SCENARIOS.md`, `docs/AI_LOG.md` do not exist yet — they begin in Weeks 2–4 per the sections below.)

### 3.7 Scenarios Implemented This Week

| # | Scenario | Sandbox behavior | Status |
|---|---|---|---|
| 1 | Random pop-up / modal | A newsletter signup modal appears (random or forced), blocking the page; requires a dummy email to be entered and submitted in the modal's form field to dismiss it — no simple close/X button | Implemented (confirmed) |
| 2 | Cookie / consent banner | A banner overlays top/bottom on first visit | Implemented (confirmed) |
| 3 | Simulated captcha gate | A fake challenge page interrupts navigation | Implemented (confirmed) |
| 4–8 | Remaining core scenarios | Not yet built | Deferred to Weeks 2–3 |

### 3.8 Milestones Achieved

- Repository created; `PLANNING.md` committed (spec, scenario list, chaos-engine design, architecture, risks captured via AI-assisted planning conversation).
- Sandbox site runs locally from a fresh clone.
- Chaos config (`chaos.json`) works and at least 2–3 scenarios are triggerable on demand.

### 3.9 Deliverables Completed

- ☑ Working local sandbox site (listing + detail pages).
- ☑ `sandbox_site/data/items.json` with 20–40 AI-generated dummy items.
- ☑ `sandbox_site/chaos.json` chaos engine config.
- ☑ 3 core disruption scenarios simulatable on demand.
- ☑ `docs/PLANNING.md` committed.

### 3.10 Acceptance Criteria (Met)

- [x] Fresh clone + documented setup command runs the sandbox site successfully.
- [x] Each of the 3 implemented scenarios can be forced on individually via `chaos.json` and observed in the browser.
- [x] No scenario requires code changes to trigger — config only.
- [x] Site contains zero styling investment beyond default browser rendering.
- [x] `PLANNING.md` exists and reflects an AI-assisted planning conversation (not written in isolation).

### 3.11 Immutability Notice

Everything above is **frozen**. Week 2 work must build strictly on top of this — extending `chaos.json`, adding new templates for new scenarios, and starting the `bot/` package — without modifying the existing Flask routes, existing chaos logic for the 3 already-built scenarios, or `items.json` structure, unless the human operator explicitly requests a Week 1 change.

---

## 4. WEEK 2 — Baseline Bot, Evidence Infrastructure, First Recoveries

### STATUS: **NOT STARTED** ← next week to implement

### 4.1 Objectives (Why This Week Exists)

- Prove the **happy path** works before layering resilience on top of it — a bot that can't complete the workflow chaos-free has no foundation to make resilient.
- Stand up the **evidence infrastructure** (structured logging, screenshots, run summary) early, because every later resilience feature (Weeks 2–4) is only verifiable through this evidence trail.
- Deliver the first real resilience wins: survive the scenarios the sandbox already simulates (per Section 3.7), so the intern experiences the full detect → recover → log → verify loop at small scale before scaling to all 8 scenarios in Week 3.

### 4.2 Dependencies From Week 1 (must already exist and pass their acceptance criteria)

- Sandbox site running locally with the 3 scenarios from Section 3.7 triggerable via `chaos.json`.
- `docs/PLANNING.md` committed, since the bot's workflow choice and architecture should trace back to it.

### 4.3 Implementation Phases (Strict Order)

**Phase 2.1 — Happy-path bot skeleton (chaos fully OFF)**
- Stand up `bot/run.py` as the entry point.
- Implement one clearly defined workflow end-to-end against the *undisturbed* sandbox site — either:
  - (a) walk all listing pages → visit every item's detail page → extract fields → save to `results.json`/CSV, or
  - (b) search/filter → open top results → perform a small action sequence (e.g., "contact seller" + dummy form submit) per item.
- Use Playwright's **sync or async API consistently** (pick one, do not mix — a documented classic AI failure mode per the brief).
- Use explicit waits (`expect`, `wait_for_selector`, etc.) — never fixed `sleep()` calls, even in this "everything works" phase, since Week 2's later phases depend on this habit being established now.
- **Exit condition**: the bot completes the chosen workflow correctly with chaos entirely disabled, repeatably.

**Phase 2.2 — Evidence infrastructure (`bot/reporting.py`)**
- Structured event/action logging (e.g., JSON-lines or structured text) capturing: timestamp, step, action taken, outcome.
- Automatic screenshot capture triggered specifically on *unexpected* state (not on every step) — wired in now even though few anomalies exist yet, since Phase 2.4 (first recoveries) needs it immediately.
- Run summary generation: items processed, disruptions encountered, how each was resolved, total retries, and a pass/fail verdict on data completeness/correctness. Implement this as its own function so it can be reused unchanged for the rest of the internship.

**Phase 2.3 — Centralized selectors (`bot/selectors.py`)**
- Move every selector used by the bot into one module now, even though only the happy path exists — this is the foundation Week 3's "resilient selectors with fallback chains" (Scenario 7) depends on, and retrofitting it later is far more error-prone than starting centralized.

**Phase 2.4 — First disruption handlers (`bot/handlers/`)**
- Enable the 3 scenarios already simulated in the sandbox (Section 3.7) plus at least one additional core scenario to reach the brief's "first 3–4 core scenarios" target for this week. Recommended 4th scenario: **Scenario 4 (Site down / server errors)**, since it is a pure bot-side + minimal sandbox-side addition (forcing intermittent 500/503) and pairs naturally with the retry/backoff logic this phase needs anyway.
  - **Scenario 1 (newsletter pop-up)**: implement a global watcher that detects the modal, enters a dummy/placeholder email address into its form field, and submits it to dismiss the modal (the sandbox has no simple close/X button for this one — confirmed by the human operator); then verify the modal is actually gone before proceeding. This is a distinct recovery action from Scenario 2, since it requires a form-fill-and-submit rather than a single dismiss click.
  - **Scenario 2 (cookie banner)**: implement a global watcher pattern that checks for and dismisses the banner before/alongside each step (a straightforward accept/dismiss click, no form input needed), then verifies the page is clear before proceeding.
  - **Scenario 3 (simulated captcha)**: detect the gate; either solve the fake challenge programmatically or pause and prompt the human operator to clear it manually, then resume from the exact step it left off — do not restart the whole run.
  - **Scenario 4 (site down / server errors)**: implement exponential backoff with a hard retry cap; on success, resume from the last completed item rather than restarting the workflow from scratch.
- One handler module per scenario type, each with a single clear responsibility (detect → recover → log), never a single catch-all "if anything weird, retry" function — that hides which scenario actually happened, which is exactly the "silently swallow every exception" failure mode the brief warns against.

**Phase 2.5 — First tests**
- Scenario tests (one per handled scenario): force the scenario on via `chaos.json`, run the bot/handler, assert the workflow still completes with correct data.
- Unit tests for pure logic introduced this week: retry/backoff calculator, run-summary generation.
- All new tests runnable via the same single documented command that will grow throughout the internship (e.g., `pytest`).

### 4.4 Module Responsibilities (New This Week)

| Module | Responsibility |
|---|---|
| `bot/run.py` | Entry point; orchestrates the workflow, calls handlers, invokes reporting |
| `bot/handlers/popup_handler.py` (naming illustrative) | Detect newsletter modal; enter + submit a dummy email to dismiss it (Scenario 1) — a distinct action shape from Scenario 2 |
| `bot/handlers/cookie_banner_handler.py` | Detect + accept/dismiss cookie banner (Scenario 2), verified gone before continuing |
| `bot/handlers/captcha_handler.py` | Detect gate, solve or pause-for-human, resume (Scenario 3) |
| `bot/handlers/server_error_handler.py` | Exponential backoff + retry cap + resume-from-last-item (Scenario 4) |
| `bot/selectors.py` | All selectors + any fallback logic, centralized |
| `bot/reporting.py` | Logging, screenshot capture on anomaly, run summary generation |

### 4.5 Architecture Additions

- Introduction of the `bot/` package as a peer to `sandbox_site/`, sharing the repository but with **no code-level coupling** (per the decoupling rule in Section 1.3) — the bot only ever talks to the sandbox through the rendered browser.
- Introduction of a lightweight **handler registration pattern** (each handler exposes a "detect" check and a "recover" action) so that adding Scenarios 5–8 in Week 3 is a matter of adding new handler modules, not restructuring `run.py`.
- Introduction of `runs/` as the evidence output directory (gitignored per Section 7.1, with 1–2 sample runs committed as proof).

### 4.6 Functional Requirements

- Bot completes the chosen workflow with chaos off, every time.
- Bot survives Scenarios 1–4 (or whichever 3–4 correspond to Section 3.7 plus one addition) with correct extracted data, a clean log, and a truthful run summary.
- Every handler's detection is specific (it identifies *which* disruption occurred) — evidenced in the log, not inferred after the fact.

### 4.7 Non-Functional Requirements

- No fixed `sleep()` calls anywhere in the bot code — explicit waits only.
- No bare `except:`/catch-all exception swallowing — catch specific exceptions (e.g., `TimeoutError`) and log everything else loudly rather than hiding it.
- Consistent Playwright API usage (sync or async, not mixed) throughout `bot/`.
- Bot must never hang indefinitely or crash with an unhandled exception, even when a handled scenario is forced on.

### 4.8 Folder Structure Changes (Additions Only)

```
web-automation-lab/
├── bot/
│   ├── run.py
│   ├── handlers/
│   │   ├── popup_handler.py
│   │   ├── cookie_banner_handler.py
│   │   ├── captcha_handler.py
│   │   └── server_error_handler.py
│   ├── selectors.py
│   └── reporting.py
├── tests/
│   ├── test_scenarios_week2.py   # naming illustrative
│   └── test_unit_week2.py
├── runs/                          # gitignored, 1–2 samples committed
```

### 4.9 Risks & Mitigations

| Risk | Mitigation |
|---|---|
| AI-generated handler swallows all exceptions, hiding real bugs | Explicit code review rule: only catch named exceptions; log unknowns loudly (see brief §6) |
| Mixed sync/async Playwright APIs from AI-assisted code | Pick one API mode in Phase 2.1 and enforce it in every subsequent handler |
| Fixed `sleep()` calls creep in "to make a flaky test pass" | Treat any `sleep()` in a PR/commit as a defect; replace with explicit waits before merging |
| Retry logic without a cap causes infinite loops on Scenario 4 | Hard retry cap enforced in the backoff calculator, unit-tested directly |
| Scope creep into Week 3/4 scenarios before Week 2 is solid | Enforce the phase order in Section 4.3; do not start Scenario 5+ handlers this week |
| Newsletter modal rejects the dummy email (client-side validation on format) and never dismisses, hanging the workflow | Use an obviously well-formed placeholder address (e.g. `test@example.com`) and add an explicit post-submit check that the modal actually closed, with one bounded retry using a second placeholder before treating it as a genuine failure |

### 4.10 Milestones

- Bot completes the full workflow chaos-free.
- Bot survives Scenarios 1–4 (per Section 4.3, Phase 2.4) with clean logs and evidence (screenshots + run summary).

### 4.11 Deliverables

- ☐ `bot/run.py` implementing the chosen workflow.
- ☐ `bot/reporting.py` producing structured logs, anomaly screenshots, and a run summary.
- ☐ `bot/selectors.py` centralizing all selectors.
- ☐ 4 working handlers (Scenarios 1–4 per Section 4.3).
- ☐ Scenario tests for all 4 handled scenarios + relevant unit tests, passing via the documented test command.
- ☐ `docs/SCENARIOS.md` created and populated for the 4 scenarios covered so far (scenario → simulation → detection → strategy → evidence).
- ☐ `docs/AI_LOG.md` entries for this week's AI-assisted work.

### 4.12 Acceptance Criteria

- [ ] Fresh clone → documented setup → bot completes the workflow with chaos off, producing correct `results.json`/CSV.
- [ ] Each of Scenarios 1–4 can be forced on individually and the bot completes the workflow anyway, evidenced by log + screenshot + run summary.
- [ ] No unhandled exceptions or infinite hangs occur when any single scenario (or combination of the 4) is forced on.
- [ ] All Week 2 tests pass via the single documented test command.
- [ ] `docs/SCENARIOS.md` accurately reflects only the scenarios actually handled so far (no aspirational entries).

---

## 5. WEEK 3 — Full Core Scenario Coverage & the Chaos Gauntlet

### STATUS: **FUTURE WORK** (do not begin until Week 2's acceptance criteria are met and the human operator explicitly instructs starting Week 3)

### 5.1 Objectives (Why This Week Exists)

- Reach **100% core scenario coverage** (all 8), since scenario coverage is the single largest evaluation weight (35%) and the brief's explicit "key metric."
- Prove the bot's resilience holistically, not just scenario-by-scenario, via the **chaos gauntlet**: random mode, all scenarios enabled simultaneously, multiple seeds — this is the strongest evidence that handlers don't just work in isolation but compose correctly when several disruptions overlap in one run.
- Keep `docs/SCENARIOS.md` a living, accurate document throughout, since a stale or incomplete matrix directly costs evaluation points.

### 5.2 Dependencies From Week 2 (must already exist and pass their acceptance criteria)

- Working happy-path bot, evidence infrastructure (`reporting.py`), centralized selectors (`selectors.py`), and 4 working handlers.
- Passing scenario tests + unit tests for Week 2's 4 scenarios.

### 5.3 Implementation Phases (Strict Order)

**Phase 3.1 — Remaining sandbox-side scenario simulation**
- Extend `sandbox_site/chaos.json` and templates/middleware to simulate whichever of Scenarios 5–8 are not yet built in the sandbox (i.e., beyond the 3 from Week 1 and any sandbox-side work done incidentally in Week 2 for Scenario 4):
  - **5 — Slow responses/timeouts**: random multi-second delays on page/element load.
  - **6 — Unexpected redirection**: navigation randomly lands on a promo/interstitial instead of the target page.
  - **7 — DOM change/selector drift**: alternate layout served for the same content (different ids/classes/order).
  - **8 — Blocked/intercepted clicks**: an overlay/sticky banner/misplaced element sits on top of the needed button.
- Each new scenario must be individually toggleable in `chaos.json`, consistent with the Week 1 pattern — no special-casing.

**Phase 3.2 — Bot-side handling for Scenarios 5–8**
- **Scenario 5 (slow/timeouts)**: explicit waits with sane, scenario-appropriate timeouts; logic must distinguish "slow but arriving" from "dead," rather than one generic timeout value everywhere.
- **Scenario 6 (redirection)**: verify URL/page identity after every navigation step; on mismatch, detect the detour and route back to the intended page before continuing.
- **Scenario 7 (DOM drift)**: extend `selectors.py` with fallback chains (text/role/attribute-based selectors) rather than brittle CSS paths, so that when the alternate layout is served the bot still resolves the same logical element.
- **Scenario 8 (blocked clicks)**: detect interception (e.g., click intercepted by an overlay), remove/scroll past the obstruction or use a safe alternative action, then verify the click actually took effect before moving on.
- Each of these is its own handler module, following the same detect → recover → log pattern established in Week 2 — no shortcuts that special-case Week 3 scenarios differently from Week 2 ones.

**Phase 3.3 — Full coverage verification**
- With all 8 core scenarios now both simulated and handled, run each individually forced-on and confirm correct behavior, before combining them.

**Phase 3.4 — The chaos gauntlet**
- Implement one command/test that runs the full workflow in **random mode**, all 8 scenarios enabled, with a **fixed seed**, and asserts a complete and correct result end-to-end. This is the project's strongest single piece of evidence and must be re-runnable deterministically.
- Run the gauntlet with multiple different fixed seeds to catch handler interactions that a single seed might miss; fix whatever breaks before moving to Week 4.

**Phase 3.5 — Scenario matrix completion**
- Update `docs/SCENARIOS.md` so all 8 core scenarios have complete rows (scenario → sandbox simulation → bot detection → handling strategy → evidence/log excerpt or screenshot). This document must stay accurate as of the end of Week 3, since Week 4 only adds stretch scenarios on top, not further core-scenario work.

### 5.4 Module Responsibilities (New This Week)

| Module | Responsibility |
|---|---|
| `bot/handlers/slow_response_handler.py` | Distinguish slow vs. dead; scenario-appropriate explicit waits (Scenario 5) |
| `bot/handlers/redirect_handler.py` | Verify page identity post-navigation; detect/recover from detours (Scenario 6) |
| `bot/selectors.py` (extended) | Fallback-chain resolution logic for DOM drift (Scenario 7) |
| `bot/handlers/blocked_click_handler.py` | Detect intercepted clicks; obstruction removal/alternative action; verify effect (Scenario 8) |
| `tests/test_gauntlet.py` (illustrative) | Random-mode, all-scenarios, fixed-seed end-to-end assertion |

### 5.5 Architecture Additions

- `selectors.py` evolves from a flat selector list (Week 2) into a **fallback-chain resolver**: for each logical element, an ordered list of selector strategies is tried until one succeeds, with the result logged so DOM-drift recoveries are visible in evidence, not silent.
- The handler registry (introduced Week 2) now covers all 8 scenario types; `run.py`'s orchestration logic should not need structural changes to accommodate them — if it does, that's a signal Week 2's registry pattern needs revisiting (flag to human operator rather than silently deviating from Week 2's immutable code).
- Test suite grows a distinct **gauntlet test tier** on top of the existing scenario/unit tiers from Week 2.

### 5.6 Functional Requirements

- All 8 core scenarios independently forceable and independently survived, with correct extracted data each time.
- Gauntlet run (random mode, all 8 enabled, fixed seed) completes with a correct, complete result, repeatably across at least 2–3 different seeds.
- `docs/SCENARIOS.md` fully populated for all 8 core scenarios with real evidence (not placeholder text).

### 5.7 Non-Functional Requirements

- Same discipline as Week 2 carries forward: no fixed sleeps, no catch-all exception handling, consistent Playwright API usage, centralized selectors.
- Handlers for Scenarios 5–8 must be independently testable (scenario test per handler), not only verifiable via the gauntlet.

### 5.8 Folder Structure Changes (Additions Only)

```
web-automation-lab/
├── bot/
│   └── handlers/
│       ├── slow_response_handler.py
│       ├── redirect_handler.py
│       └── blocked_click_handler.py
├── tests/
│   ├── test_scenarios_week3.py   # scenario tests for 5–8
│   └── test_gauntlet.py          # random-mode, fixed-seed, all-scenario test
```

### 5.9 Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Handlers that pass individually fail when combined in the gauntlet (e.g., a redirect during a captcha pause) | Run the gauntlet early and often during the week, not only at the end; fix interaction bugs as they surface |
| DOM-drift fallback chains become another brittle single-path selector in disguise | Require at least 2 independent selector strategies per fallback chain, reviewed for genuine independence |
| `docs/SCENARIOS.md` drifts out of sync with actual handler behavior | Update the matrix in the same commit as the handler that changes its described behavior |
| Time pressure causes stretch-scenario work to leak into Week 3 | Explicitly defer all stretch scenarios to Week 4 per Section 0.1 rule 3 |

### 5.10 Milestones

- All 8 core scenarios detected, handled, and documented.
- Gauntlet runs pass repeatedly across multiple seeds.
- Extracted data verified complete and correct under full chaos.

### 5.11 Deliverables

- ☐ Sandbox-side simulation for Scenarios 5–8 added to `chaos.json`/templates.
- ☐ Bot-side handlers for Scenarios 5–8.
- ☐ Extended fallback-chain selector resolution in `selectors.py`.
- ☐ Gauntlet test (random mode, all scenarios, fixed seed) passing across multiple seeds.
- ☐ `docs/SCENARIOS.md` complete for all 8 core scenarios.
- ☐ `docs/AI_LOG.md` entries for this week's AI-assisted work.

### 5.12 Acceptance Criteria

- [ ] Each of Scenarios 5–8 individually forced-on and survived, with evidence.
- [ ] All 8 scenarios combined (gauntlet, random mode, fixed seed) pass with correct, complete data across at least 2–3 seeds.
- [ ] No unhandled exceptions or hangs under any single scenario or the full gauntlet.
- [ ] `docs/SCENARIOS.md` has a complete, accurate row for every core scenario.
- [ ] All Week 2 and Week 3 tests pass together via the single documented test command.

---

## 6. WEEK 4 — Stretch Scenarios, Polish, Documentation & Submission

### STATUS: **FUTURE WORK** (do not begin until Week 3's acceptance criteria are met and the human operator explicitly instructs starting Week 4)

### 6.1 Objectives (Why This Week Exists)

- This is **buffer, stretch, and polish** time — explicitly not the week to start core scenario work, per the brief's week-by-week plan. Its purpose is to convert a working-but-rough project into a submittable, explainable, professionally delivered one.
- Add differentiated value (stretch/original scenarios) only once the required core is airtight, since stretch scenarios earn "extra credit" but core coverage is the majority of the grade.
- Prove the whole deliverable works for someone who has never seen it before — the fresh-clone test — since "works on my machine" is not sufced for the evaluation.

### 6.2 Dependencies From Week 3 (must already exist and pass their acceptance criteria)

- All 8 core scenarios simulated, handled, tested, and documented in `docs/SCENARIOS.md`.
- Passing gauntlet across multiple seeds.

### 6.3 Implementation Phases (Strict Order)

**Phase 4.1 — Stretch scenarios (choose based on remaining time)**
Candidates, per the brief (implement as many as time allows; do not sacrifice core-scenario quality to add these):
- Session/state expiry mid-run.
- Pagination switching to "load more" or infinite scroll.
- Stale element references.
- Random logout / "session timed out" pages.
- Duplicate or missing items in listings (data integrity checks).
- Rate-limit responses (HTTP 429) requiring the bot to slow down.
- One original, well-handled scenario of the intern's own invention.
Each stretch scenario chosen follows the exact same discipline as core scenarios: sandbox-side simulation → bot-side detect/recover handler → scenario test → `docs/SCENARIOS.md` row (in a clearly separated "Stretch Scenarios" section, not mixed into the core table).

**Phase 4.2 — Documentation finalization**
- Finalize `docs/SCENARIOS.md`: core scenarios complete (frozen from Week 3), stretch scenarios appended in their own section.
- Finalize `README.md`: overview, setup instructions for both the sandbox site and the bot, how to run a demo of any single scenario, how to run the full test suite with one command, and known limitations.
- Finalize `docs/PLANNING.md` if anything material changed since Week 1 (should be rare, since Week 1 is immutable — this is about closing the loop, not rewriting it).
- Finalize `docs/AI_LOG.md` with this week's entries, ensuring the whole log reads as an honest, critical account across all four weeks (what AI got right/wrong, what was changed, what was learned).

**Phase 4.3 — Fresh-clone verification**
- Clone the repository into a genuinely clean folder (not the working directory) and follow the `README.md` exactly, step by step, with no undocumented manual fixes. Any friction found here must be fixed in the README or the code, not worked around silently.

**Phase 4.4 — Demo preparation**
- Prepare a 3–5 minute demo (live in the final group call, or recorded and linked from the README) showing at least two disruption scenarios being triggered live and survived by the bot, plus a glimpse of the evidence trail (log + run summary).

**Phase 4.5 — Final submission checklist pass**
- Walk the full checklist in Section 6.7 below and confirm every item before considering the project done.

### 6.4 Architecture Additions

- No new core architecture — Week 4 adds stretch-scenario handler modules following the exact same handler pattern established in Weeks 2–3, plus documentation/tooling polish. No structural changes to `run.py`, `reporting.py`, or `selectors.py` beyond what stretch handlers require.

### 6.5 Functional Requirements

- Chosen stretch scenarios simulated, handled, tested, and documented to the same standard as core scenarios.
- Full repository (site + bot + tests + docs) runs correctly from a genuinely fresh clone using only the README.
- Demo clearly shows real-time detection and recovery, not just a description of it.

### 6.6 Non-Functional Requirements

- Documentation must be understandable by someone who has not seen the project before — this is the actual test applied in Phase 4.3.
- No new "AI failure modes" (invented methods, mixed async/sync, fixed sleeps, silent exception swallowing) introduced while building stretch scenarios — same review discipline as every prior week.

### 6.7 Deliverables (Final Submission Checklist)

- ☐ Public GitHub repository, clean structure, meaningful commit history throughout (not one giant final commit).
- ☐ Sandbox site runs locally from a fresh clone via the README alone; every scenario (core + stretch) triggerable via `chaos.json`.
- ☐ Bot completes its workflow with chaos off and with all core scenarios enabled, producing correct extracted data, structured logs, failure screenshots, and a run summary.
- ☐ `docs/SCENARIOS.md`: complete coverage matrix — all core scenarios, stretch scenarios listed separately.
- ☐ Test suite (scenario tests + unit tests + gauntlet) passing with one documented command.
- ☐ `README.md`: overview, setup for both parts, single-scenario demo instructions, known limitations.
- ☐ `docs/PLANNING.md` and `docs/AI_LOG.md` complete and honest across all four weeks.
- ☐ 3–5 minute demo delivered live or recorded and linked in the README, showing at least two scenarios triggered and survived.

### 6.8 Acceptance Criteria

- [ ] A genuinely fresh clone, following only the README, results in a working sandbox site and a working bot with no undocumented manual steps.
- [ ] All stretch scenarios added this week are individually testable and documented, without weakening any core-scenario test.
- [ ] The full test suite (unit + scenario + gauntlet, core and stretch) passes via the single documented command.
- [ ] `docs/SCENARIOS.md`, `docs/PLANNING.md`, `docs/AI_LOG.md`, and `README.md` are all internally consistent with the actual code in the repository (no aspirational or stale claims).
- [ ] The demo, live or recorded, shows real triggered disruptions and real bot recovery, not a narrated description.

---

## 7. Cross-Week Standing Rules (Apply at All Times, Every Week)

These rules from the brief are not tied to any single week — the implementing agent must respect them continuously, regardless of which week is currently active.

### 7.1 Version Control Discipline

- Commit small and often — at least a few commits per working day, each doing one focused thing.
- Commit messages describe *why*/*what changed* in substance (e.g., "Add popup watcher with auto-dismiss"), never vague messages like "updates."
- Never commit: virtual environments, browser downloads, bulky logs/screenshots (`runs/` is gitignored; commit only 1–2 representative samples), or any secrets/API keys — ever, in any repo, for life.
- Push to GitHub daily; commit history is itself part of the evaluation (a single giant final commit is a red flag).

### 7.2 Testing Discipline

- Every disruption scenario has a corresponding automated scenario test that forces it on via `chaos.json` and asserts correct completion — this reproducibility requirement is the whole point of the chaos config and must never be treated as optional.
- Pure logic (retry/backoff calculator, selector-fallback resolution, data validation, run-summary generation) gets unit tests independent of any live scenario.
- The chaos gauntlet (random mode, fixed seed, full workflow) is the ultimate end-to-end proof and must be runnable as part of the same single documented suite command.
- A new failure discovered at any point should first be made *reproducible* via `chaos.json` + a test, then fixed — never fixed ad hoc without a reproducing test.
- AI-generated tests must be read and verified to assert real behavior; a test that cannot fail is treated as worse than no test at all.

### 7.3 AI Usage Logging (`docs/AI_LOG.md`)

- Two or three entries per week, every week, no exceptions — this is a required deliverable, not optional color commentary.
- Each entry captures: what was being attempted; which tool was used and roughly how it was prompted; what the AI got right/wrong and what was changed; what was learned.
- The log should read as a genuinely critical account (including AI mistakes and corrections) — using AI heavily is expected and encouraged; using it *uncritically* is what would cost points.

### 7.4 AI-Assisted Development Discipline (Applies Whenever the Agent or Intern Uses AI Tools)

- Plan before prompting; never ask for "the whole bot" in one shot.
- Work in small, individually verifiable steps; run and verify each generated change before requesting the next.
- Give real context in prompts (file structure, actual code, framework/version, exact error text or HTML) rather than vague descriptions.
- Constrain generated output explicitly (exact function signature, exact API mode, "no new dependencies," etc.).
- Treat first AI answers as drafts; explicitly iterate ("what are the weaknesses/edge cases here?").
- Use AI as a tutor, not a vending machine — ask "explain this line by line" and "why wait for the selector instead of sleeping?"; understanding the code is a deliverable in itself, not just the code.
- **Debug methodically**: when asking AI for help with a failure, paste the full traceback, the failing code, and the page HTML or screenshot at the moment of failure (this is exactly what the `runs/` evidence trail exists for); state what was expected, what actually happened, and what has already been tried.
- **Restart stale chats**: long AI conversations drift in quality; when answers start degrading, start a fresh conversation with a clean, current summary of the state instead of continuing to push a tired thread.
- **Learn Playwright's own free diagnostic tools early**: `codegen` (records manual clicks/actions as starter code) and the **trace viewer** (replays a failed run step by step) — both save significant debugging time and should be reached for before asking an AI assistant to guess at a failure blind.
- Watch for the brief's named classic failure modes at all times: invented Playwright methods, mixed sync/async APIs, fixed `sleep()` calls, and silent catch-all exception handling. Check the official Playwright docs when in doubt.
- "Proof beats promises" — a claimed capability is not real until it has been demonstrated against a forced-on scenario in the sandbox and observed in the evidence trail.
- Never paste real personal data or credentials into any AI tool, and never commit secrets to the repo.

### 7.5 Ethics & Legality (Reaffirmed for Every Week)

- Bot targets only the intern's own local sandbox — never a real third-party site.
- The captcha handler is a simulated-challenge solver only; it must never be adapted or repurposed toward bypassing genuine anti-bot/CAPTCHA protections on real services. Resilient automation and evading others' defenses are treated as distinct skills, and only the former is in scope here.

---

## 8. Program Cadence & Communication (Human Process — Informational, Not a Coding Task)

This section exists for completeness with the official brief's §10. It describes the **human** support structure around the internship. It is not something an AI coding agent implements in the repository, but it governs when and how work should be shared, and the agent should be aware of it when the human operator references "the call" or "the weekly update."

### 8.1 Weekly Group Call

- One 30-minute group call per week; attendance is required.
- Format: a quick round-robin (progress, plan, blockers — roughly 2 minutes each intern), followed by open Q&A and one or two volunteer demos.
- **Scenario demos are the preferred show-and-tell**: triggering a disruption live via `chaos.json` and watching the bot survive it, in real time, is more convincing than describing it.

### 8.2 Async Communication Between Calls

- Before each call, post a three-line async update in the shared channel: what was done, what's next, what's blocking.
- Blockers posted in advance get answered first, so surfacing them early is worth doing even if a fix isn't needed yet.
- Between calls, the expected default is to try to unblock independently first — roughly 30–60 minutes with the docs (this specification, `PLANNING.md`) and an AI assistant — before escalating.
- If still stuck after that, post in the shared channel with screenshots and what was already tried, so the answer benefits others too. Direct messages are reserved for genuinely private matters.

### 8.3 Weekly Milestones

- Push work and share the repository link at the end of every week — this is how progress is actually tracked, independent of the call.
- Feedback on pushed work is asynchronous, via GitHub issues/comments, as needed.

### 8.4 Why This Section Is Here

None of the above changes what gets built in `sandbox_site/`, `bot/`, or `tests/`. It's included so this document is a complete mirror of the official brief and so the human operator can point an AI agent at "prepare my update for tomorrow's call" or "what should I push before end of week" and have the agent reason from a document that actually contains that context, rather than silently omitting it.

---

## 9. Document Change Log

| Version | Scope of Change |
|---|---|
| 1.0 | Initial master specification generated from the official internship brief. Week 1 documented as completed (with one flagged assumption re: which 3 scenarios were implemented — see Section 3, header note). Weeks 2–4 fully specified as Not Started / Future Work. |
| 1.1 | Added Section 1.1 (Program Logistics) and 1.2 (Learning Objectives) to mirror the brief's summary table and "What You Will Learn" section. Added missing AI-workflow guidance to Section 7.4 (debug methodically, restart stale chats, Playwright codegen/trace viewer). Added new Section 8 (Program Cadence & Communication) to mirror the brief's §10. Renumbered the Change Log to Section 9. No changes to any week's technical scope, phases, or acceptance criteria. |
| 1.2 | Fixed stale internal cross-references left over from the 1.1 renumbering (operating rule 6, Week 2 architecture note, Program Logistics note — all now point to the correct section numbers). Added the missing "Scope discipline" ground rule from brief §2.4 to Section 1.3. Added a note to Section 2.1 clarifying the repo tree is the brief's Python/Flask variant and how to adapt it for Node.js/Express. No changes to any week's technical scope, phases, or acceptance criteria. |
| 1.3 | Resolved the Week 1 scenario assumption with human-operator-confirmed fact: the three scenarios implemented are cookie/consent banner, simulated captcha gate, and a newsletter signup pop-up that specifically requires entering and submitting a dummy email to dismiss (no simple close button). Updated Section 3.7's table, the Week 1 header note, Week 2's Phase 2.4 handler descriptions (Scenario 1 and Scenario 2 now described as distinct recovery actions — form-fill-and-submit vs. simple dismiss click), the `popup_handler.py` module responsibility row, and added a corresponding risk/mitigation row for the email-validation edge case. |

> **Maintenance instruction for the implementing agent:** when a week is completed, update that week's `STATUS` line and fill in any "as implemented" details (mirroring how Section 3 documents Week 1), append a new row to this change log, but do not alter the overall four-week skeleton or the cross-week standing rules in Section 7.
