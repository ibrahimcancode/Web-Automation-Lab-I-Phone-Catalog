# CHAOS_ENGINE_SPEC.md

> Project: Resilient Web Automation Lab
>
> Component: Sandbox Website
>
> Version: 1.1 (polished)
>
> Status: Week 1 Implementation Specification

---

> **Revision notes (v1.1).** The structure, scope (3 scenarios), and design goals of v1.0 were sound
> and are unchanged. Twelve gaps that would have caused an implementer (human or AI) to guess wrong
> were closed: (1) a determinism bug risk in how the seeded RNG is used, (2) no rule preventing a
> single request from consuming randomness twice, (3) no specified mechanism for injecting banner/
> popup HTML into pages without touching business templates, (4) no server-side determinism for the
> client-side popup delay, (5) no mechanism for "once per session," (6) `registry.py`'s contract was
> never defined, (7) no hook-type taxonomy separating delay-type from injection-type handlers, (8) no
> log format or file location, (9) no upper-bound safety cap on delays, (10) no test-friendly config
> override, (11) no static asset location for required JS behavior, (12) no rule for banner/popup
> collision. Two new sections were added (§10 Determinism & Randomness Contract, §20 Known
> Implementation Pitfalls) — everything else is the original content with the gaps closed inline. Section
> numbers shifted accordingly from v1.0.

---

# 1. Overview

## Purpose

The Chaos Engine is the core testing component of the sandbox website.

Instead of building a perfect website, the sandbox intentionally introduces realistic failures that an automation bot must detect and recover from.

The Chaos Engine must be completely configurable and deterministic.

The automation bot should never know whether chaos is enabled.

---

# 2. Design Goals

The Chaos Engine must be

- Config Driven
- Modular
- Extensible
- Deterministic
- Reproducible
- Safe
- Independent of business logic

Changing chaos behavior should never require modifying application code — this includes never adding chaos markup, chaos imports, or chaos conditionals to any business template, route, or view function. See §8 for how this is achieved mechanically, not just as a principle.

Only `chaos.json` (or the file pointed to by `CHAOS_CONFIG_PATH`, see §6) should control runtime behavior.

---

# 3. Supported Week 1 Scenarios

Week 1 implements only three scenarios.

| Scenario         | Status   | Maps to brief scenario                               |
| ---------------- | -------- | ---------------------------------------------------- |
| Cookie Banner    | Required | #2 Cookie / consent banner                           |
| Newsletter Popup | Required | #1 Random pop-up / modal                             |
| Slow Response    | Required | #5 Slow responses / timeouts (delay only — see note) |

**Note on Slow Response scope:** the brief's scenario #5 also asks the bot to "distinguish slow from dead." A true never-responds ("hang") mode belongs conceptually to the "Site down / server errors" scenario (#4), which is explicitly out of scope for Week 1 (§19). Do not add a hang mode now — it's called out here only so it isn't forgotten when #4 is implemented in a later week.

Future scenarios must plug into the same architecture (§17).

---

# 4. Project Structure

```
sandbox_site/

chaos/
│
├── __init__.py
├── engine.py          # orchestrator: initialize(), reload(), should_trigger(), lifecycle wiring
├── config.py           # load + validate chaos.json (or CHAOS_CONFIG_PATH)
├── registry.py          # scenario registration — see §17 for the exact contract
├── middleware.py        # Flask before_request / after_request hooks — see §8
├── logger.py            # structured event logging — see §14
├── randomizer.py         # the ONE shared seeded RNG instance — see §10
│
├── handlers/
│   ├── cookie_banner.py
│   ├── newsletter_popup.py
│   └── slow_response.py
│
├── templates/
│   ├── cookie_banner.html      # fragment only — never a full page
│   └── newsletter_popup.html    # fragment only — never a full page
│
└── static/
    ├── chaos.css               # shared styling for injected widgets
    └── chaos.js                 # ESC / outside-click / X-button / dismissal-cookie logic

chaos.json
```

`templates/` in this tree holds **fragments** injected into responses (§8), not pages the app routes to. They are never `{% include %}`'d by business templates — the middleware inserts them directly into the outgoing HTML string.

---

# 5. Responsibilities

## Chaos Engine

Responsible for

- Loading configuration
- Validating configuration
- Initializing handlers
- Determining active scenarios **once per request** and caching that decision for the lifetime of the request (see §10 — this prevents re-triggering or re-rolling randomness if more than one part of the pipeline asks "is this active")
- Logging events
- Executing handlers
- Supporting future scenarios

The Chaos Engine must never contain business logic.

---

## Scenario Handlers

Every scenario must exist as an independent handler.

Handlers must never directly communicate.

Each handler owns its own behavior, and each handler declares its own **hook type** (§8) so the engine knows _when_ in the request/response cycle to run it.

---

# 6. Configuration

Location

```
sandbox_site/chaos.json
```

An environment variable `CHAOS_CONFIG_PATH` may override this path (default: `chaos.json` in the sandbox root). **This is required for automated scenario tests** (brief §5): each test starts the sandbox pointed at a small fixture config (e.g. `tests/fixtures/chaos_cookie_only.json`) with exactly one scenario forced on, rather than mutating the shared `chaos.json`. No other mechanism is needed to "force" a scenario — setting only that scenario's `enabled` true, the rest false, and `random_mode` false already guarantees deterministic activation (§7).

---

Example

```json
{
  "enabled": true,

  "random_mode": false,

  "seed": 42,

  "scenarios": {
    "cookie_banner": {
      "enabled": true,

      "probability": 1.0
    },

    "newsletter_popup": {
      "enabled": true,

      "probability": 0.35,

      "min_delay_seconds": 2,

      "max_delay_seconds": 6
    },

    "slow_response": {
      "enabled": true,

      "probability": 0.4,

      "min_delay_ms": 2500,

      "max_delay_ms": 5000
    }
  }
}
```

---

# 7. Configuration Rules

If

```
enabled=false
```

No scenario executes.

---

If

```
random_mode=false
```

Every enabled scenario activates.

Probability values are ignored, and **no randomness is consumed** — see §10. This mode is what test fixtures use to force a scenario deterministically.

---

If

```
random_mode=true
```

Each scenario uses

```
probability
```

to determine activation, drawing from the single shared RNG described in §10.

---

The same

```
seed
```

must always produce the same sequence of activation decisions across a run (§10).

---

# 8. Engine Lifecycle & Hook Types

Every incoming request follows this pipeline. There are exactly two hook types — every current and future handler must declare which one it is, because they run at different points:

- **`PRE_RESPONSE` (delay-type):** runs before the route's normal response body is generated or sent. Only changes _timing_. **Slow Response is `PRE_RESPONSE`.**
- **`POST_RESPONSE` (injection-type):** runs after the route has generated its normal HTML response, and mutates the outgoing response body/headers before it's sent to the browser. Never touches the route handler or its templates. **Cookie Banner and Newsletter Popup are `POST_RESPONSE`.**

```
HTTP Request
  ↓
Chaos Engine: load + validate config (cached after first load; re-read only on reload())
  ↓
Determine active scenarios for THIS request (once — cache the result, see §10)
  ↓
Run all PRE_RESPONSE handlers (e.g. Slow Response: sleep before the route executes)
  ↓
Flask route executes normally, produces HTML — completely unaware chaos exists
  ↓
Run all POST_RESPONSE handlers (e.g. inject cookie-banner / newsletter-popup fragments
  before `</body>` in the response body — only for text/html responses; static assets
  and non-HTML responses pass through untouched)
  ↓
Return Response
  ↓
Log the request's chaos outcome (§14)
```

**Concurrency note:** because Slow Response blocks synchronously before the route runs, the Flask dev server must run with `threaded=True` (or an equivalent multi-worker setup) so one slow request doesn't stall every other concurrent request — otherwise a single triggered delay would make the _whole sandbox_ look dead, not just one page.

**Injection mechanism, concretely:** in the `POST_RESPONSE` hook (Flask `after_request`), check `response.mimetype == "text/html"`; if so, decode the body, find the last `</body>` (case-insensitive), and insert the rendered fragment(s) — HTML + a `<link>`/`<script>` reference to `static/chaos.css` / `static/chaos.js` — immediately before it, then re-encode. If no `</body>` is found, skip injection and log a warning rather than corrupting the response.

---

# 9. Public Interface

The Chaos Engine should expose methods similar to

```
initialize()

reload()

is_enabled()

should_trigger(name)

get_configuration(name)

log(event)
```

Additionally:

```
render_chaos_widgets()   # returns the concatenated HTML fragments for all POST_RESPONSE
                          # scenarios active on the current request — this is what the
                          # after_request hook calls; nothing else should call it
```

No other module should directly read `chaos.json`, and **no business template or route should ever call any Chaos Engine method directly** — the only touchpoint with application code is the `after_request`/`before_request` registration done once, in one place, when the Flask app is created.

`should_trigger(name)` must be idempotent within a single request (§10) — calling it five times for the same scenario in the same request must return the same answer and must not consume additional randomness.

---

# 10. Determinism & Randomness Contract

This section exists because "deterministic" is easy to claim and easy to accidentally break. Follow it exactly.

1. **One instance, created once.** `randomizer.py` holds a single `random.Random(seed)` instance, created in `engine.initialize()`. No other module ever does `random.random()` or creates its own `Random()` object.
2. **`reload()` resets it.** Calling `reload()` re-reads config and **re-creates** the shared RNG with the (possibly new) seed, restarting the sequence from the beginning. This is the only thing that resets the sequence.
3. **`random_mode=false` never touches the RNG.** If random mode is off, activation is a pure function of `enabled` — zero calls to the shared instance, zero sequence advancement. This keeps forced-scenario tests (§6) completely unaffected by draws happening elsewhere.
4. **One draw per scenario per request, in a fixed order.** When `random_mode=true`, for each request, iterate scenarios in the order they appear in `chaos.json`, drawing exactly one value per enabled scenario to compare against its `probability`. This is what makes "same seed → same sequence" true and testable.
5. **Cache the decision per request.** Store the request's activation decisions (which scenarios are active, and for scenarios with a delay/range, the exact drawn delay value) on the request-scoped context (e.g. Flask's `g`) the first time they're computed. Every subsequent read in the same request — including the client-facing delay value described in §12 — reads the cached value. Never recompute mid-request.
6. **Client-side randomness is never allowed.** Any random value the browser needs (e.g. the newsletter's delay-before-appearing) must be drawn server-side from the shared RNG and passed to the client as a fixed number (e.g. embedded in the injected fragment as `data-delay-ms="4200"`), never generated by `Math.random()` in `chaos.js`. This is the single most common way this contract gets silently broken — see §20.

---

# 11. Cookie Banner

## Purpose

Simulate GDPR cookie consent.

---

## Activation

```
cookie_banner.enabled=true
```

---

## Behaviour

Appears

- first page load
- fixed to bottom
- overlays page
- blocks interaction underneath

---

Text

```
We use cookies to improve your browsing experience.
```

Buttons

```
Accept

Reject
```

Either button removes banner.

---

Requirements

- visible until dismissed
- high z-index
- keyboard accessible
- role="dialog"
- id="cookie-banner"
- data-chaos="cookie"

---

**"Once per session" mechanism (concrete):** on Accept or Reject, `chaos.js` sets a real HTTP cookie, e.g. `chaos_cookie_seen=1` (not just `localStorage` — a real cookie fits the theme and lets the server-side `POST_RESPONSE` hook decide whether to inject the banner at all, keeping the decision server-side rather than a client-only hide). The engine's injection check is: _scenario is active this request (§10) AND `chaos_cookie_seen` cookie is absent._ A fresh browser/incognito session has no cookie, so the banner reappears — matching "once per browser session" exactly.

---

# 12. Newsletter Popup

## Purpose

Interrupt user workflow unexpectedly.

---

Activation

```
newsletter_popup.enabled=true
```

---

Delay

Random between

```
min_delay_seconds

max_delay_seconds
```

Drawn **server-side** from the shared RNG (§10) once per request, embedded in the injected fragment (e.g. `<div id="newsletter-popup" data-delay-ms="4200" ...>`), and used by `chaos.js` purely as the `setTimeout` duration. The client never generates this number itself.

---

Popup contains

- Title
- Email input
- Subscribe button
- Close button

---

Popup must

- darken background
- block interaction
- support ESC
- support X button
- support outside click

---

DOM

```
id="newsletter-popup"

role="dialog"

data-chaos="popup"
```

---

Only one popup may exist at a time.

**Collision rule with Cookie Banner:** if the cookie banner is present and not yet dismissed when the newsletter's timer would fire, `chaos.js` holds the popup and re-checks once the banner is dismissed (listen for the banner's dismiss event), rather than showing both overlays at once. This keeps the two disruptions realistic and sequential instead of visually stacked.

---

# 13. Slow Response

Purpose

Simulate slow server response.

---

Activation

```
slow_response.enabled=true
```

---

Behavior

Delay server response. Hook type: `PRE_RESPONSE` (§8) — the delay happens before the route produces its HTML, not after.

Delay range

```
2500

5000 ms
```

---

Requirements

Must delay

before HTML is returned.

Must not

- freeze browser
- corrupt HTML
- throw exceptions

**Safety cap:** regardless of configuration, no computed delay may ever exceed **15000 ms**. Validation (§15) must clamp any configured `max_delay_ms` above this down to 15000 before it can ever be drawn — this protects the sandbox from a typo'd config (e.g. an extra zero) making the site look permanently dead.

---

# 14. Logging

Every chaos event must be logged.

**Format:** one JSON object per line (JSON Lines), written to `sandbox_site/logs/chaos.log` (create the directory if missing) and mirrored to stdout in development. JSON Lines is required — not free-form text — so tests and `docs/SCENARIOS.md` evidence-gathering can parse events reliably instead of scraping log strings.

Each line must include at minimum:

```json
{
  "timestamp": "...",
  "scenario": "newsletter_popup",
  "action": "triggered",
  "duration_ms": null,
  "result": "displayed",
  "request_path": "/listing"
}
```

Example sequence (conceptually, not literal file format):

```
[CHAOS] Engine Started, Seed = 42
[CHAOS] Cookie Banner Displayed
[CHAOS] Newsletter Popup Displayed (delay_ms=4200)
[CHAOS] Slow Response 3812 ms
[CHAOS] Engine Finished
```

Logs should include

- timestamp
- scenario
- action
- duration
- result

---

# 15. Validation

If configuration is missing

↓

Load defaults.

---

If probability < 0

↓

Use 0.

---

If probability > 1

↓

Use 1.

---

If delay is negative

↓

Use 0.

---

**If a configured `max_delay_ms` (or `max_delay_seconds`) exceeds the §13 safety cap (15000 ms)**

↓

Clamp it down to the cap, and log a validation warning (distinct from normal chaos events, e.g. tagged `[CHAOS][WARN]`).

---

If JSON is invalid

↓

Disable Chaos Engine.

Continue serving website.

Never crash application.

---

# 16. Error Handling

Scenario failures must never stop the website.

If a handler throws an exception

- log exception
- disable handler
- continue request

---

# 17. Extensibility

Adding a scenario should require

1. Create a handler in `handlers/`, declaring its **hook type** (`PRE_RESPONSE` or `POST_RESPONSE`, §8) and, if `POST_RESPONSE`, a `render()` method returning its HTML fragment.
2. Register it in `registry.py` — a single decorator-based registration, e.g. `@register_scenario("scenario_name", hook=HookType.POST_RESPONSE)` on the handler class/function. `registry.py`'s only job is keeping a name → handler + hook-type mapping that `engine.py` iterates each request; it contains no scenario-specific logic itself.
3. Add its block to `chaos.json` under `scenarios`.

Nothing else. Existing handlers, `engine.py`'s request flow, and `middleware.py`'s hook wiring must not need to change when step 1–3 are followed — if they do, that's a sign the new scenario needs a third hook type, which should be raised as a design question rather than special-cased silently.

---

Future handlers

- captcha
- redirect
- server error
- DOM mutation
- blocked click
- session expiry
- rate limiting
- infinite scroll

must follow the same interface. (Anticipated hook types for these, for planning purposes only — not built now: redirect/server error/rate limiting are likely `PRE_RESPONSE`-adjacent — response _status/location_ mutators rather than body mutators; DOM mutation and blocked click are `POST_RESPONSE` body mutators like the current two; captcha is closer to a full alternate route. This may justify a third hook type later — do not build it speculatively in Week 1.)

---

# 18. Non-Functional Requirements

The Chaos Engine must

- be lightweight
- add no more than **5ms** of overhead per request when `enabled=false` (concrete target — measure it, don't just assert it)
- not expose internal configuration
- not require external services
- work completely offline
- be deterministic when seeded (§10)
- be easy to maintain

---

# 19. Out of Scope

Week 1 does NOT include

- Captcha
- Redirects
- Server errors (including a "hang forever" / never-responds mode — see the note in §3)
- DOM mutation
- Infinite scroll
- Session expiry
- Login
- Databases
- APIs

These will be added in future weeks.

---

# 20. Known Implementation Pitfalls

A short, concrete checklist — if any of these are true, something is wrong even if the app "looks" like it works:

- ❌ A new `random.Random(seed)` is created inside `should_trigger()` or any per-request code path → breaks the sequence guarantee (§10 #1).
- ❌ `chaos.js` calls `Math.random()` anywhere → breaks determinism for anything client-visible (§10 #6).
- ❌ Any business template contains `{% include "chaos/..." %}`, an `if chaos` conditional, or an import from the `chaos` package → violates the decoupling goal (§2, §8).
- ❌ The cookie banner or newsletter popup only ever appears/disappears via client-side JS state (e.g. `localStorage` only, no cookie, no server check) → the server-side "once per session" rule (§11) isn't actually enforced, and a test that clears client storage but keeps the same server run can't distinguish sessions.
- ❌ `should_trigger("x")` gives a different answer when called twice in the same request → violates idempotency (§9, §10 #5).
- ❌ A misconfigured `chaos.json` (e.g. `max_delay_ms: 999999`) can make a request hang far past 15 seconds → missing the safety cap (§13, §15).
- ❌ Tests mutate the shared `chaos.json` in place to force scenarios → should use `CHAOS_CONFIG_PATH` fixtures instead (§6).
- ❌ The Flask dev server isn't threaded, so one slow-response request blocks every other concurrent request → §8's concurrency note.

---

# 21. Acceptance Criteria

The implementation is complete when

- Chaos Engine exists.
- Configuration is centralized (and `CHAOS_CONFIG_PATH` override works).
- Cookie Banner works, including the once-per-session cookie mechanism.
- Newsletter Popup works, including server-computed, client-embedded delay.
- Slow Response works, including the 15s safety cap.
- Scenarios can be enabled independently.
- Random mode works.
- Seeded randomness works — verified by running the same seed twice and diffing the two `chaos.log` files (they must match exactly).
- No business template, route, or view function references the `chaos` package.
- Logging works and is valid JSON Lines.
- Website behaves normally when Chaos Engine is disabled (measured overhead < 5ms).
- New scenarios can be added by following only the 3 steps in §17, with no edits to `engine.py` or existing handlers.

---

# 22. Definition of Done

The Week 1 Chaos Engine is complete when

✓ Configuration file (or `CHAOS_CONFIG_PATH` override) controls all scenarios.

✓ Three scenarios are implemented, each with a declared hook type.

✓ Each scenario is modular and independently toggleable.

✓ Chaos can be turned off globally with near-zero overhead.

✓ Random mode is supported, with all randomness flowing through the single seeded instance in `randomizer.py`.

✓ Seeded execution is reproducible — same seed produces byte-identical `chaos.log` output across runs.

✓ Event logging exists, as JSON Lines, in `sandbox_site/logs/chaos.log`.

✓ Validation exists, including the delay safety cap.

✓ No business logic depends on chaos, and no business code imports or references the `chaos` package.

✓ Future scenarios can be added as plugins via §17's 3 steps alone.
