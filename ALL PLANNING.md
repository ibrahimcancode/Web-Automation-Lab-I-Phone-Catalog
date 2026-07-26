# PLANNING.md

> Resilient Web Automation Lab — Internship Project
> Part A: Sandbox Listing Site (theme: iPhone catalog) + Chaos Engine
> Status: Week 1 — site + 4 scenarios complete, docs in progress

---

## 1. Problem Statement

Build a local sandbox listing website that can misbehave on command (the Chaos Engine), then — in
Part B — an automation bot that completes a workflow on that site no matter how it misbehaves. The
site is the test rig; the bot is the graded deliverable. This document covers Part A.

## 2. Scope Decisions

- **Listing theme:** iPhone catalog (smartphones — one of the brief's suggested themes). Dataset:
  local JSON, dummy/public data, no live pricing.
- **Stack:** Flask (Python), server-rendered Jinja2 templates. No database, no login, no external
  framework. This supersedes an earlier React-SPA assumption from an initial catalog plan draft —
  the Chaos Engine's design (response-body injection via `before_request`/`after_request`, session
  cookies, server-side seeded randomness) requires a server-rendered app, not a client-side SPA.
- **Everything runs locally**, no cloud services, no API keys, per the brief's rules of the game.

### Scope-discipline note

The original catalog spec (43 models, Compare + Favorites pages, full light/dark theming with WCAG AA
audits, a complete responsive/accessibility/performance pass) is considerably richer than the brief
asks for Part A ("keep it simple," "appearance does not matter — at all," "the site earns zero marks
for looks"). None of that catalog richness is in the grading rubric (§9 of the brief: scenario coverage
35%, working software 20%, code quality 15%, testing 15%, AI process 15%). It's kept in the phase list
below for completeness since it's already built, but it's marked **low priority** — no further time
should go into it. All remaining time should go to closing the last 4 core scenarios and then to the
bot (Part B), which is where the actual grade lives.

## 3. Architecture Summary

Full contract lives in `CHAOS_ENGINE_SPEC.md` (v1.1) — this is a summary, not a replacement.

- `chaos/` package: `engine.py` (orchestrator), `config.py` (load/validate `chaos.json`),
  `registry.py` (scenario registration), `middleware.py` (Flask hooks), `logger.py` (JSON Lines
  events), `randomizer.py` (the one shared seeded RNG).
- Two hook types: `PRE_RESPONSE` (delay-type — e.g. Slow Response) and `POST_RESPONSE`
  (injection-type — e.g. Cookie Banner, Newsletter, Captcha gate).
- One `chaos.json` controls every scenario: `enabled`, `random_mode`, `seed`, per-scenario
  `enabled`/`probability`/timing.
- Determinism contract: one seeded `random.Random` instance created at `initialize()`, one draw per
  scenario per request in a fixed order, cached per-request so nothing double-triggers.
- Business templates and routes never import or reference the `chaos` package — the only touchpoint
  is the hook registration at app creation.

## 4. Build Phases

Status legend: ✅ Done · 🔲 To do · ⏸ Deprioritized (low grading value, see §2 note)

| Phase | What | Status |
|---|---|---|
| 0 | Flask project setup, folder structure, `.gitignore` | ✅ |
| 1 | Dummy data: `data/items.json`, 20–40 iPhone models (id, name, price, attributes, description) | ✅ |
| 2 | Listing page + detail page, basic pagination/load-more | ✅ |
| 3 | Chaos Engine core: `engine.py`, `config.py`, `registry.py`, `middleware.py`, `logger.py`, `randomizer.py` | ✅ |
| 4 | Cookie Banner scenario (once-per-session cookie, dismiss Accept/Reject) | ✅ |
| 5 | Newsletter Popup scenario (server-computed random delay, ESC/X/outside-click dismiss) | ✅ |
| 6 | Slow Response scenario — **fixed to a strict 2–5 second range** after an earlier bug let it run far longer; delay was briefly removed entirely to unblock testing, then restored with the hard cap | ✅ |
| 7 | Simulated Captcha gate (checkbox/math-question interstitial — no real auth, no real CAPTCHA) | ✅ |
| 8 | Home page featured-models images (previously missing, now generated) | ✅ |
| 9 | Compare page, Favorites page, full dark/light theming polish | ⏸ deprioritized |
| 10 | Responsive/accessibility/performance passes on the catalog UI | ⏸ deprioritized |
| 11 | Remaining core chaos scenarios: Site down/server errors, Unexpected redirection, DOM change/selector drift, Blocked/intercepted clicks | 🔲 next |
| 12 | Automation bot (Playwright) — Part B, the core deliverable | 🔲 next |
| 13 | Test suite: scenario tests, unit tests, the chaos gauntlet | 🔲 |
| 14 | Docs: `SCENARIOS.md`, `README.md`, `AI_LOG.md`, demo recording | ✅ this batch |

## 5. Scenario List (brief §2.3, 8 core scenarios)

| # | Scenario | Sandbox side | Bot side |
|---|---|---|---|
| 1 | Random pop-up / modal (Newsletter) | ✅ Done | 🔲 Not started |
| 2 | Cookie / consent banner | ✅ Done | 🔲 Not started |
| 3 | Simulated captcha gate | ✅ Done | 🔲 Not started |
| 4 | Site down / server errors | 🔲 Not started | 🔲 Not started |
| 5 | Slow responses / timeouts | ✅ Done (2–5s) | 🔲 Not started |
| 6 | Unexpected redirection | 🔲 Not started | 🔲 Not started |
| 7 | DOM change / selector drift | 🔲 Not started | 🔲 Not started |
| 8 | Blocked / intercepted clicks | 🔲 Not started | 🔲 Not started |

Bot-side work for scenarios 1/2/3/5 hasn't started yet — that's the Week 2 focus (brief's Part B).

## 6. Risks

- **Long AI chat sessions degrading in quality/hallucinating** — already hit this once; mitigation is
  switching models and restarting chats with a fresh state summary rather than pushing a long thread
  further (see `AI_LOG.md`).
- **Timing bugs in chaos scenarios** — already hit an unbounded Slow Response delay; mitigation is
  hard-coded safety caps in validation, not just in the happy path.
- **Scope creep into catalog polish** — real risk given how much richer the site is than required;
  mitigation is the deprioritization in §2/§4 above.
- **Flask dev server blocking on delay** — Slow Response sleeps synchronously; server must run
  threaded so one slow request doesn't stall concurrent ones.

## 7. Next Steps

1. Wire up the remaining 4 core scenarios in the chaos engine (Phase 11).
2. Start the Playwright bot (Phase 12) — happy-path workflow first, chaos off.
3. Enable scenarios one at a time against the bot, fixing recoveries as they break.
4. Keep `docs/SCENARIOS.md` and `docs/AI_LOG.md` updated as each scenario's bot side lands.
