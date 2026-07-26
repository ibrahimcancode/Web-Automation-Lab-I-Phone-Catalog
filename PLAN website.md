---
title: "iPhone Catalog Website — Implementation Plan"
subtitle: "PLAN.md · v1.1 (realigned to SPEC.md v1.1)"
---

> **Alignment notes (v1.1).** The original PLAN.md was written against a different section-numbering
> scheme than the SPEC.md it shipped with — every `§` reference in this document has been re-checked
> against SPEC.md v1.1's actual headings and corrected. Concretely: Visual design system and
> Responsive behavior were cited backwards (§9/§10 swapped); Modal, Empty State, Color Swatch, and
> several other components cited the wrong sub-section entirely (e.g. Modal was cited as §7.6, which
> is actually "Filter chip" — Modal is §7.18); Technical constraints and Acceptance criteria were
> cited as §12/§13 when they are actually §13/§15; and two references (§8.6, §8.7) pointed at
> sub-sections that don't exist in the spec. The phase structure, dependency order, and validate/defer
> logic below are unchanged from the original plan — that structure was sound. Only the citations, and
> a handful of task details that depended on spec gaps since closed in SPEC.md v1.1 (dark/light mode,
> the similar-models rule, the Load More batch size), were updated.

Maps 1:1 to SPEC.md. Each phase lists: what it depends on, the concrete tasks (small and ordered),
what to validate before moving on, what's explicitly deferred, and which files/components it touches.
No code is written yet — this is the build order.

---

## Phase 0 — Project Setup & Tooling
**Depends on:** nothing. **Spec ref:** §4 (Information architecture), §13 (Technical constraints).

1. Initialize the project (framework choice is an open decision — plan assumes a component-based
   front end, e.g. React, but every task below is framework-agnostic in intent).
2. Set up folder structure:
   ```
   /src
     /data          → models.json, data-validation script
     /components     → shared UI (Card, Button, Modal, etc.)
     /pages           → Home, Catalog, ModelDetail, Compare, Favorites, NotFound
     /styles          → design tokens (color, type, spacing, shadow)
     /state           → favorites + compare store, storage adapter
     /utils           → search/filter/sort logic, formatters
   ```
3. Set up linting/formatting so all later AI- or human-generated code is consistent from the start.
4. Set up a basic router with the exact URLs from SPEC §4 (deep-linkable, refresh-safe, per §13's
   "URLs must be real and shareable" / "must support deep linking").
5. Create a placeholder page for each route so navigation can be smoke-tested before any real UI
   exists.

**Validate:** every route in SPEC §4 loads a (blank) page without errors; refreshing on any route
works.
**Defer:** nothing — this phase is a hard prerequisite for everything else.

---

## Phase 1 — Design System Foundations
**Depends on:** Phase 0. **Spec ref:** §10 (Visual design system), §1 + §7.1 (light/dark mode
requirement).

1. Define color tokens for light + dark mode (§10.1) as CSS variables or a theme object — base,
   accent, semantic colors, both modes.
2. Define typography scale tokens (§10.2) — desktop + mobile step-down.
3. Define spacing tokens (§10.3), the 4/8/12/16/24/32/48/64/96 scale.
4. Define shape/shadow/border tokens (§10.4) — radius scale (16px cards, 10px inputs/buttons, full
   radius pills/swatches), shadow scale, hairline border color.
5. Define motion tokens (§10.5) — durations/easings for hover/focus (180ms), modal/drawer enter/exit
   (240ms/180ms), and image cross-fade (200ms) — plus a `prefers-reduced-motion` override layer per
   §10.6.
6. Build a light/dark mode provider: reads `prefers-color-scheme` by default and exposes the manual
   override toggle required by §1 and §7.1 — no visual components depend on this yet, just the
   mechanism.
7. Build one throwaway "tokens preview" page (not part of the final site) to visually sanity-check
   every token, and both modes, before components consume them. Delete this page before ship (tracked
   in Phase 13).

**Validate:** toggling light/dark flips every token and satisfies the §1/§7.1 requirement; reduced-
motion setting is detectable and wired to the override layer (even with nothing animated yet).
**Defer:** nothing — every later component depends on these tokens existing first, so this phase must
be complete (not just started) before Phase 4.

---

## Phase 2 — Data Layer
**Depends on:** Phase 0. **Spec ref:** §0 (Source of truth and verification), §5.1–§5.6 (Data
contract).

1. Encode the `IPhoneModel` TypeScript-style shape from SPEC §5.1 as the actual data schema
   (TS type / JSON schema / validation function, whatever the stack uses).
2. Create `models.json` with all **43 entries** from the SPEC §0 canonical lineup table (id,
   displayName, tier, generationYear at minimum, to unblock Phase 5/6 UI work early).
3. **[VERIFY — open]** task: source exact per-model chip, camera, display, dimensions, weight, colors,
   and variant/pricing data from Apple's official spec pages for each of the 43 models, and backfill
   `models.json`. Per §0, older-generation color/storage availability specifically still needs
   verification against Apple's official comparison archive. Do this in small batches (e.g. one
   generation-year at a time) rather than one giant pass, so each batch can be spot-checked before
   moving to the next.
4. **[VERIFY — resolved]** the "iPhone Air" naming question is settled by SPEC §0: use `"iPhone Air"`
   as the `displayName` verbatim. No further research needed on this point — just make sure the entry
   is encoded exactly that way.
5. Write the data-validation script from SPEC §5.3's rules (unique/lowercase/URL-safe `id`, non-empty
   `displayName`, valid `tier` enum, ISO-8601 `releaseDate`, ≥1 color, ≥1 variant, positive
   `launchPriceUSD`, 3–5 `keyFeatures`); on failure, exclude the record and emit a visible development
   warning per §5.3 — not a silent skip.
6. Implement the §5.4 fallback rules (omit missing battery row; fall back gallery → hero image; label
   missing color-specific assets; neutral fallback text for non-critical copy) as part of the same
   data-access layer, so pages never have to special-case missing fields themselves.
7. Source or generate placeholder imagery for `heroImage`/`gallery` per model (original photography/
   renders or clearly-licensed stand-ins — never scraped Apple product photos, per §13's asset rules).
8. Write short original `summary` and `keyFeatures` copy per model (not copied from Apple marketing,
   per §5.3 and §13).

**Validate:** validation script passes on the full 43-entry file; spot-check 5 models across different
eras (one from 2014–15, one from 2017–18, one from 2020–21, one from 2023–24, one from 2025) against
their real specs to confirm the sourcing process is accurate before doing the rest.
**Defer:** full per-model copywriting polish can lag behind — ship with terser placeholder summaries
for less-critical (very old) models first if time-constrained, backfill later. Every model still needs
a valid schema entry, though; "defer" applies to copy quality, not data completeness.

---

## Phase 3 — Global Layout: Header & Footer
**Depends on:** Phase 1 (tokens). **Spec ref:** §7.1 (Header), §7.2 (Footer).

1. Build static Footer first (simplest, no state) — three-column layout, collapses to stacked on
   mobile per §7.2's Should and §9's breakpoint rules.
2. Build Header: logo, nav links, and the light/dark toggle required by §1/§7.1, wired to Phase 1's
   provider.
3. Add Compare/Favorites nav badges as static placeholders (real counts wait for Phase 7 state store);
   zero-count states render as disabled, not "0," per §4's global navigation rules.
4. Implement sticky-header behavior (§7.1) and the mobile hamburger drawer (§9), including the
   drawer's scroll-lock and focus trap (§7.19, Slide-in drawer).
5. Wire Header/Footer into every page shell from Phase 0.

**Validate:** header sticks on every page; hamburger drawer opens/closes correctly on mobile widths,
traps focus, and locks background scroll per §7.19; the light/dark toggle actually flips the site.
**Defer:** live badge counts (needs Phase 7 state).

---

## Phase 4 — Core Reusable Components
**Depends on:** Phase 1. **Spec ref:** §7.3 (Product Card), §7.12 (Color swatches), §7.15–§7.18
(Skeleton, Toast, Empty state, Modal), §8.5 (Global state matrix).

Build in this order, each is a dependency for later ones:

1. **Button** — not individually named in the component contracts, but its states are governed by
   §8.5's global state matrix (default/hover/focus/active/disabled/loading) — implement generically so
   every other component can reuse it.
2. **Badge/Pill** — used for tier labels (§7.3), filter counts, and nav badges (§7.1); same §8.5 state
   rules apply.
3. **Skeleton** (§7.15) — generic block skeleton primitive matching product-card geometry, reused by
   Card and any future loading state.
4. **Toast** (§7.16) — including the `aria-live` region required by §11, auto-dismiss + manual
   dismiss.
5. **Modal** (§7.18) — focus trap, Escape-to-close, scrim-click-to-close, focus-return-on-close, per
   §7.18 and the focus-trap requirement in §11. Covers both of §7.18's named use cases (clear-favorites
   confirmation, add-another-model chooser).
6. **Empty State** (§7.17) — icon + message + one clear action slot, reused across §6.2 (no results),
   §6.5 (no favorites), and §6.4 (fewer than 2 compare selections).
7. **Product Card** (§7.3) — image, name, tier badge, year, price, hover lift, favorite icon, compare
   control, skeleton variant. This is the most-reused component in the app — get it right here before
   Phase 5 wires it into a grid.
8. **Color Swatch** (§7.12) — circular chip, selected-state ring/check (never color-only, per §7.12
   and §11's non-color-indicator rule).

**Validate:** each component gets a quick isolated check (Storybook-style or a scratch page) against
every state listed in §8.5, including keyboard-only operation, before being used elsewhere.
**Defer:** nothing here is deferrable — Phases 5–8 all consume these components directly.

---

## Phase 5 — Catalog Page
**Depends on:** Phase 2 (data), Phase 3 (layout), Phase 4 (Card, Skeleton, Empty State). **Spec ref:**
§6.2 (Catalog), §7.4–§7.9 (Search input, Filter group, Filter chip, Sort dropdown, Compare toggle,
Favorite toggle), §7.21 (Load more button), §8.1–§8.3 (Search/Filtering/Sorting interaction rules).

1. Render a static grid of Product Cards from `models.json`, no search/filter/sort yet — confirm the
   responsive column counts from §9's breakpoint table work first.
2. Implement Search (§7.4, §8.1): debounced ~250ms, matches name/tier/year/chip/color per §5.6 and
   §8.1's match rules, wired to a `?q=` URL param.
3. Implement Sort (§7.7, §8.3): dropdown, all 5 required options, wired to a `?sort=` URL param,
   persists across "Load more" and across refresh.
4. Implement Filter Panel (§7.5, §7.6, §8.2): tier, year, storage, color family, chip family — each
   wired to its own URL param, AND-across-categories / OR-within-category logic, live result count,
   invalid params ignored and normalized.
5. Implement mobile filter drawer variant of the same panel (reuse the Modal/drawer pattern from
   Phase 4 / §7.19, don't fork a second implementation).
6. Implement "Load more" pagination per §7.21: **12 cards per click** (or the remainder if fewer than
   12 are left), with skeleton cards appended during each load — not a full-page reload of the
   skeleton state.
7. Wire the Empty State (§7.17) for zero-result search/filter combinations, including its "clear all
   filters" action (§6.2 May).
8. Wire Favorite toggle (§7.9) and Compare toggle (§7.8) on each card to the state store (**stub the
   store first** with an in-memory placeholder if Phase 7 isn't done yet, so UI work isn't blocked).

**Validate:** every filter/sort/search combination produces correct, URL-reflected results; refreshing
mid-filter restores the same state from the URL; zero-result state renders correctly; keyboard-only
users can operate search, filters, sort, and card actions.
**Defer:** cross-page state sync (needs Phase 7's real store, not the stub).

---

## Phase 6 — Model Detail Page
**Depends on:** Phase 2, Phase 4 (Card, Color Swatch). **Spec ref:** §6.3 (Model detail), §7.10–§7.14
(Breadcrumb, Image gallery, Color swatches, Storage selector, Price display).

1. Route param → model lookup, 404 redirect if the slug doesn't match any model (ties into the
   NotFound page from Phase 0 and §6.6).
2. Breadcrumb component (§7.10): Home → Catalog → current model, each level clickable, semantic nav
   markup.
3. Image gallery + color swatches (§7.11, §7.12): swatch click cross-fades the hero image (200ms per
   §10.5), updates `alt` text to match the new color (§11), never shifts layout during the swap.
4. Storage selector (§7.13) updating the Price display (§7.14) live — the shown price must always
   correspond to the active variant.
5. Spec sheet: grouped tables (Display / Chip / Camera / Battery / Design / Colors / Storage &
   Pricing) driven directly off the `IPhoneModel` schema (§5.1) — one render function per group so
   adding a new spec field later doesn't require touching layout code. Apply §5.4 fallback rules
   (e.g., omit the battery row entirely if `batteryVideoPlaybackHours` is absent).
6. Key features highlight list near the top (§6.3 Should).
7. Add-to-Compare / Add-to-Favorites buttons (§7.8, §7.9) wired to the same state store as the
   Catalog cards.
8. "Similar models" module (§6.3's Must — selection rule now defined in spec): up to 4 models,
   same `tier` first, then ±1 `generationYear`, excluding the current model, backfilled by nearest
   year if fewer than 4 match — rendered as mini Product Cards.

**Validate:** every one of the 43 models resolves to a working detail page with no missing/undefined
fields rendered; swatch and variant interactions never cause layout shift; Compare/Favorite state
matches what's shown on the Catalog page for the same model; similar-models output matches the §6.3
selection rule exactly.
**Defer:** nothing in this phase is spec-optional anymore — the similar-models rule is now a Must
(§6.3), not a nice-to-have, since SPEC v1.1 defines it explicitly. If time-constrained, ship it with a
smaller candidate pool rather than skipping it.

---

## Phase 7 — Favorites & Compare State + Pages
**Depends on:** Phase 4, Phase 5 (stubbed), Phase 6 (stubbed). **Spec ref:** §6.4 (Compare), §6.5
(Favorites), §7.17 (Empty state), §7.18 (Modal), §7.20 (Compare table), §8.4 (Compare and favorites
state), §13 (Persistence).

1. Build the real state store (favorites: a Set of model ids; compare: an ordered list, max 4, per
   §8.4) as a single module consumed by Header badges, Catalog cards, and Detail page buttons —
   replacing the Phase 5/6 stubs.
2. Build the storage-adapter interface named in §13's Persistence rule and mirrored in §8.4 — an
   in-memory implementation for this sandbox environment, with the adapter boundary shaped so a real
   browser-storage implementation can be swapped in later without touching component code.
3. Wire Header badges (Phase 3 placeholders) to real live counts.
4. Build the Compare page (§6.4, §7.20): table layout with rows grouped by spec category, spec-row
   grouping reused from Phase 6's spec-sheet groups (don't duplicate that logic), column headers as
   mini Cards with remove buttons, "add another model" popover/modal (desktop popover, mobile modal
   per §9's responsive rules and §7.18's Modal use case), 4-model cap with the toast warning required
   by §8.4 and §7.8.
5. Build the "Highlight differences" toggle (§6.4 Should — implement after the base table works).
6. Build the Favorites page (§6.5): reuse the Catalog grid rendering logic filtered to favorited ids,
   Empty State (§7.17) when empty, "Clear all" with a Modal confirmation (§7.18, §8.4's clear-all
   rule).

**Validate:** favoriting/comparing from any of the three surfaces (Catalog, Detail, Home featured
cards) is instantly reflected everywhere else, per §8.4; the 5th compare attempt is blocked with the
correct toast; clearing favorites requires confirmation and actually clears; removing the last compare
item shows the empty state rather than redirecting (§8.4).
**Defer:** "Highlight differences" toggle (explicitly marked Should/nice-to-have in §6.4).

---

## Phase 8 — Home Page
**Depends on:** Phase 4 (Card), Phase 2 (data). **Spec ref:** §6.1 (Home).

1. Hero section with original headline/subhead copy and primary CTA to `/catalog` (§6.1 Must).
2. Generation timeline strip (2014→2025), clicking a year navigates to `/catalog?year=YYYY` (§6.1
   Must/Should).
3. Featured model cards section (latest Pro Max, an iconic historical pick, a "most affordable" pick,
   per §6.1's "surface one iconic older model and one recent high-end model") reusing the Phase 4
   Product Card.

**Validate:** timeline year-clicks land on a correctly pre-filtered Catalog page; featured cards behave
identically (favorite/compare/hover) to Catalog cards since they're the same component.
**Defer:** this entire page can slip behind Phases 5–7 if needed — Catalog is the functional core of
the site per §4; Home is a funnel into it, not a blocker for the rest of the app being usable.

---

## Phase 9 — Responsive Pass
**Depends on:** Phases 3–8 functionally complete at desktop width. **Spec ref:** §9 (Responsive
behavior).

1. Audit every page at the three breakpoints from §9's table — grid columns (1 / 2 / 3–4), filter
   panel mode (drawer / drawer / sidebar), nav mode (hamburger / hamburger / inline).
2. Convert the Compare table to horizontal-scroll-with-frozen-label-column on mobile/tablet per §7.20
   — verify it does **not** silently fall back to a stacked layout (explicitly disallowed by §7.20's
   responsive-behavior rule).
3. Audit touch target sizes (44×44px minimum, §9's rules) on every icon/checkbox/swatch at
   mobile/tablet widths.
4. Re-test the mobile filter drawer and modal patterns specifically on small viewports for scroll-lock
   and focus behavior (§7.19).

**Validate:** manual pass at 375px, 768px, 1280px, 1920px minimum, for every page/state built so far,
against §9's breakpoint table exactly.
**Defer:** nothing — this must complete before Phase 12 sign-off.

---

## Phase 10 — Accessibility Pass
**Depends on:** Phases 3–9. **Spec ref:** §11 (Accessibility).

1. Keyboard-only walkthrough of every user flow in SPEC §15's acceptance criteria — no mouse.
2. Screen-reader spot-check (e.g. VoiceOver/NVDA) on: search + live result count, toast
   announcements, modal open/close, filter changes — all per §11's `aria-live` and focus-trap
   requirements.
3. Contrast audit (automated + spot-check) across light and dark mode for all text/UI tokens from
   Phase 1, against §11's WCAG AA target and §15's light/dark acceptance criterion.
4. Confirm `prefers-reduced-motion` collapses every animated transition as specified in §10.6.
5. Confirm color is never the sole indicator anywhere selection state exists (swatches, active
   filters, sort selection), per §11's specific rules.

**Validate:** every item above passes; fix and re-test rather than deferring — accessibility is listed
as a first-class spec section, not a stretch goal.
**Defer:** nothing.

---

## Phase 11 — Performance Pass
**Depends on:** Phase 2 (final imagery), Phases 5–8. **Spec ref:** §13 (Technical constraints — asset
rules), §12 (Error, empty, and loading states), §15 (Acceptance criteria — layout shift).

1. Convert/serve images in modern formats with responsive `srcset` per §13's asset rules, confirm
   lazy-loading below the fold on Catalog/Compare/Favorites grids (§7.11).
2. Confirm explicit dimensions/`aspect-ratio` on every image slot to prevent layout shift — ties
   directly to §13 ("avoid layout shift") and §15's "no layout shift is introduced by image loading"
   acceptance criterion.
3. Check bundle size / code-splitting per route if the framework supports it, so Home doesn't load
   Compare-page code and vice versa.
4. Re-run the "Load more" (§7.21) and color-swap (§7.11) interactions under throttled network
   conditions to confirm skeletons (§7.15, §12's Loading rules) and cross-fades still feel correct
   when slow.

**Validate:** Lighthouse (or equivalent) pass on Catalog and Detail pages with no major CLS/LCP
regressions; visually confirm no pop-in of unstyled content.
**Defer:** nothing structural — this is the last technical gate before QA.

---

## Phase 12 — QA Against Acceptance Criteria
**Depends on:** all prior phases. **Spec ref:** §15 (Acceptance criteria — verbatim checklist).

1. Walk the SPEC §15 checklist item by item, in order, marking each pass/fail with a note.
2. Any failing item gets a scoped fix task and a re-check — do not ship with a known-failing
   acceptance item silently dropped.
3. Full data spot-check: confirm all 43 models render on Catalog, resolve on Detail, and are
   selectable in Compare/Favorites without console errors.

**Validate:** 100% of §15 checklist passes.
**Defer:** nothing — this is the definition of "done" for the project.

---

## Phase 13 — Polish & Handoff
**Depends on:** Phase 12 passing. **Spec ref:** whole document.

1. Remove the Phase 1 "tokens preview" scratch page and any other dev-only debug UI.
2. Final content pass on Home hero copy, footer "about this project" text, and any remaining
   placeholder summaries flagged in Phase 2, checked against §14's tone and copy rules.
3. Confirm the open `[VERIFY]` item from SPEC §0 was actually resolved (older-model launch-color and
   storage sourcing) and is not still placeholder/assumed data. The iPhone Air naming item is already
   resolved in SPEC v1.1 — just confirm the encoded `displayName` matches.
4. Write a short internal changelog/README noting the storage-adapter swap point (§13) for whoever
   wires up real persistence later.

**Validate:** a fresh read-through of SPEC.md against the live site, section by section, with no
open TODOs remaining.

---

## Summary: Build Order at a Glance

```
0 Setup → 1 Design Tokens → 2 Data Layer ─┐
                                            ├─→ 3 Header/Footer → 4 Core Components
                                            │        │                    │
                                            │        └────────┬───────────┘
                                            │                 ▼
                                            │        5 Catalog Page ──→ 6 Detail Page
                                            │                 │                │
                                            │                 └───────┬────────┘
                                            │                         ▼
                                            └───────────────→ 7 Favorites/Compare State+Pages
                                                                      │
                                                              8 Home Page
                                                                      │
                                                     9 Responsive → 10 Accessibility → 11 Performance
                                                                      │
                                                              12 QA vs Acceptance Criteria
                                                                      │
                                                                13 Polish & Handoff
```

---

## Appendix: Spec section quick-reference

For fast lookup while implementing — verified against SPEC.md v1.1:

| § | Title |
|---|---|
| 0 | Source of truth and verification |
| 1 | Product definition |
| 2 | Scope |
| 3 | Audience and user goals |
| 4 | Information architecture |
| 5.1–5.6 | Data contract (shape, required fields, validation, fallback, display, search) |
| 6.1–6.6 | Home, Catalog, Model detail, Compare, Favorites, 404 |
| 7.1–7.22 | Component contracts (Header through Back to top button) |
| 8.1–8.5 | Search, Filtering, Sorting, Compare/favorites state, Global state matrix |
| 9 | Responsive behavior |
| 10.1–10.6 | Visual design system (color, type, spacing, shape, motion, reduced motion) |
| 11 | Accessibility |
| 12 | Error, empty, and loading states |
| 13 | Technical constraints |
| 14 | Content rules |
| 15 | Acceptance criteria |
