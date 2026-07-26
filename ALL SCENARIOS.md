# SCENARIOS.md

> Scenario coverage matrix — the key evaluation deliverable per the brief (§2.3, §9: 35% weight).
> Updated as of end of Week 1: sandbox-site side of 4 scenarios is done; bot side has not started
> (Part B is Week 2–3). This file will be filled in incrementally as the bot is built — do not wait
> until the end to update it.

## Core scenarios (8 required)

### 1. Random pop-up / modal (Newsletter)
- **Sandbox simulation:** `newsletter_popup` handler. Appears after a random delay (server-drawn from
  the seeded RNG, 2–6s default range), darkens background, blocks interaction. Dismiss via ESC, X
  button, or outside click. Only one popup at a time.
- **Bot detection:** *Not started.*
- **Handling strategy:** *Not started — planned: global watcher/listener that detects the modal
  whenever it appears and dismisses it before continuing the workflow.*
- **Evidence:** `chaos.log` entries confirm server-side trigger + configurable delay. No bot log yet.
- **Status:** Site ✅ · Bot 🔲

### 2. Cookie / consent banner
- **Sandbox simulation:** `cookie_banner` handler. Appears on first page load (no `chaos_cookie_seen`
  cookie present), fixed to bottom, blocks interaction underneath. Accept/Reject both dismiss and set
  the session cookie so it doesn't reappear until a fresh session.
- **Bot detection:** *Not started.*
- **Handling strategy:** *Not started — planned: detect and accept/dismiss before starting the main
  workflow, verify the banner is actually gone before proceeding.*
- **Evidence:** `chaos.log` confirms banner injection + cookie-based suppression on repeat visits.
- **Status:** Site ✅ · Bot 🔲

### 3. Simulated captcha gate
- **Sandbox simulation:** interstitial page (checkbox or simple math question) that blocks navigation
  until answered. No real CAPTCHA, no real auth — purely simulated per the brief's ethics rule.
- **Bot detection:** *Not started.*
- **Handling strategy:** *Not started — planned: detect the gate, solve the fake challenge
  programmatically (checkbox/math), or pause and prompt the human, then resume where it left off.*
- **Evidence:** Manual demo only so far (site-side).
- **Status:** Site ✅ · Bot 🔲

### 4. Site down / server errors
- **Sandbox simulation:** *Not started.*
- **Bot detection:** *Not started.*
- **Handling strategy:** *Planned: retry with exponential backoff and a retry cap; resume from the
  last completed item rather than restarting.*
- **Evidence:** none yet.
- **Status:** Site 🔲 · Bot 🔲

### 5. Slow responses / timeouts
- **Sandbox simulation:** `slow_response` handler. Delays the response before HTML is returned.
  **Strictly clamped to 2–5 seconds** — an earlier version had an unbounded/misconfigured delay that
  made requests take far too long; it was removed entirely to unblock other testing, then restored
  with a hard validation-time cap so no configuration can push it past 5s.
- **Bot detection:** *Not started.*
- **Handling strategy:** *Not started — planned: explicit waits with sane timeouts, never fixed
  `sleep()`; distinguish "slow" from "dead" once scenario 4 exists.*
- **Evidence:** `chaos.log` duration field confirms delay stays within 2000–5000ms across repeated runs.
- **Status:** Site ✅ · Bot 🔲

### 6. Unexpected redirection
- **Sandbox simulation:** *Not started.*
- **Bot detection:** *Not started.*
- **Handling strategy:** *Planned: verify URL/page identity after every navigation; detect the detour
  and route back to the intended page.*
- **Evidence:** none yet.
- **Status:** Site 🔲 · Bot 🔲

### 7. DOM change / selector drift
- **Sandbox simulation:** *Not started.*
- **Bot detection:** *Not started.*
- **Handling strategy:** *Planned: resilient selectors (text/role/attribute-based) with fallback
  chains, centralized in one selectors config rather than scattered brittle CSS paths.*
- **Evidence:** none yet.
- **Status:** Site 🔲 · Bot 🔲

### 8. Blocked / intercepted clicks
- **Sandbox simulation:** *Not started.*
- **Bot detection:** *Not started.*
- **Handling strategy:** *Planned: detect the interception, remove/scroll past the obstruction or use
  a safe alternative action, then verify the click actually took effect.*
- **Evidence:** none yet.
- **Status:** Site 🔲 · Bot 🔲

---

## Stretch scenarios (not started, listed for planning only)

Session/state expiry mid-run · pagination switching to infinite scroll · stale element references ·
random logout pages · duplicate/missing listing items · HTTP 429 rate-limiting · one original scenario
(TBD).

---

## Summary

| Core scenarios site-side complete | Core scenarios bot-side complete | Stretch scenarios complete |
|---|---|---|
| 4 / 8 | 0 / 8 | 0 |
