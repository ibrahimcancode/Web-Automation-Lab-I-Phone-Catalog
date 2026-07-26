---
title: "iPhone Catalog Website — Specification"
subtitle: "SPEC.md · v1.1 (polished)"
---

> **Revision notes (v1.1).** Five surgical edits were made to the original spec; nothing else was
> changed. (1) Fixed a section-numbering typo — "Product definition" was mis-numbered §11 and is
> correctly §1. (2) Resolved a self-contradiction in §0: the iPhone Air naming question was flagged
> as "requires verification" while the very same sentence gave the answer — it is now stated as
> resolved. (3) Added an explicit light/dark mode requirement to §1 and §7.1: §15's acceptance
> criteria demands both modes meet contrast targets, but no Must-have anywhere actually required the
> site to *have* a dark mode or a way to trigger it — that gap is closed. (4) Added a concrete
> selection rule for the "similar models" module (§6.3), which previously named the feature without
> defining it. (5) Added a default batch size for "Load more" (§7.21), previously "a fixed additional
> batch" with the fixed number never stated. All section numbers in this document are now the stable
> reference used by PLAN.md — every cross-reference in that document has been verified against this
> exact numbering.

## 0. Source of truth and verification

This document defines a premium iPhone catalog website that covers the full lineup from iPhone 6
through iPhone 17 Pro Max. The authoritative dataset contains 43 models. The model list is fixed for
this project and must be treated as the canonical lineup.

One data point below is resolved; one still requires verification before final JSON entry:

- **iPhone Air naming — resolved.** Use **"iPhone Air"** as the canonical `displayName`. Do not use
  "iPhone 17 Air" or any other variant.
- **Older launch-color and storage availability details — open.** Verify against Apple's official
  comparison archive or another maintained source before final JSON entry, particularly for iPhone 6
  through iPhone 12-era models, where color and storage lineups sometimes changed mid-cycle or varied
  by market.

### Canonical model lineup (43 models)

| Year | Models |
|---|---|
| 2014 | iPhone 6, iPhone 6 Plus |
| 2015 | iPhone 6s, iPhone 6s Plus |
| 2016 | iPhone SE (1st gen), iPhone 7, iPhone 7 Plus |
| 2017 | iPhone 8, iPhone 8 Plus, iPhone X |
| 2018 | iPhone XR, iPhone XS, iPhone XS Max |
| 2019 | iPhone 11, iPhone 11 Pro, iPhone 11 Pro Max |
| 2020 | iPhone SE (2nd gen), iPhone 12, iPhone 12 mini, iPhone 12 Pro, iPhone 12 Pro Max |
| 2021 | iPhone 13, iPhone 13 mini, iPhone 13 Pro, iPhone 13 Pro Max |
| 2022 | iPhone SE (3rd gen), iPhone 14, iPhone 14 Plus, iPhone 14 Pro, iPhone 14 Pro Max |
| 2023 | iPhone 15, iPhone 15 Plus, iPhone 15 Pro, iPhone 15 Pro Max |
| 2024 | iPhone 16, iPhone 16 Plus, iPhone 16 Pro, iPhone 16 Pro Max |
| 2025 (Feb) | iPhone 16e |
| 2025 (Sep) | iPhone 17, iPhone Air, iPhone 17 Pro, iPhone 17 Pro Max |

---

## 1. Product definition

### Must
- The site must be a static, front-end-only product catalog.
- All product data must live in a local JSON file.
- There must be no backend, user accounts, checkout, or live pricing.
- The site must feel like a polished consumer product, not a school demo.
- The site must support browse, search, filter, sort, compare, and shortlist flows.
- The site must support both light and dark mode. Mode defaults to the user's system preference
  (`prefers-color-scheme`) and must be overridable via a manual toggle in the header (see §7.1).

### Should
- The site should feel premium, editorial, and highly usable.
- The site should help a user move from uncertainty to a small shortlist quickly.
- The site should make comparing models simple and readable.

### May
- The site may include small quality-of-life enhancements such as difference highlighting, subtle
  motion, and timeline shortcuts, as long as they do not distort the core browsing flow.

---

## 2. Scope

### In scope
- Home page
- Catalog page
- Model detail page
- Compare page
- Favorites page
- Not-found page
- Search, filters, sort, compare, and favorites state
- Responsive layout
- Accessibility behavior
- Empty/loading/error states
- Local JSON dataset
- Client-side persistence for shortlist/compare state in the shipped build

### Out of scope
- Checkout
- Cart
- Orders
- User sign-in
- Accounts
- Live retailer pricing
- Server-side persistence
- Payments
- Inventory availability
- Third-party Apple assets or copied Apple marketing text

---

## 3. Audience and user goals

### Primary audience
A general consumer comparing iPhone models, including:
- someone deciding what to buy
- someone checking whether an older model is still relevant
- someone comparing generations, camera systems, storage, or design changes

### Secondary audience
- enthusiasts
- collectors
- users browsing the full iPhone history

### User goals
- Identify a few models that fit a need in under a minute.
- Compare 2–4 models side by side.
- Save likely candidates for later.
- Understand the key differences without reading a wall of specs.

### Content tone
concise · confident · premium · clear · consumer-friendly · not salesy · not playful · not technical
without reason

---

## 4. Information architecture

### Routes

| Route | Purpose |
|---|---|
| `/` | Home / entry point |
| `/catalog` | Main browsing page |
| `/model/:slug` | Model detail page |
| `/compare` | Side-by-side comparison page |
| `/favorites` | Saved models page |
| `/404` | Not-found page |

### Global navigation rules
- Header and footer appear on every page except the minimal 404 variant.
- The catalog is the primary working page.
- The home page is a guided entry point, not a duplicate catalog.
- Compare and Favorites must always be reachable from the header.
- The header must show counts when items exist.
- Zero-count states must be visible as disabled, not hidden.

---

## 5. Data contract

### 5.1 Dataset shape

The dataset must be a single static file: `models.json`. Each record must match the following
structure.

```typescript
type Chip = {
  name: string;
  cpuCores: number;
  gpuCores: number;
  neuralEngineCores?: number;
};

type Camera = {
  system: string;
  lenses: string[];
  maxOpticalZoom?: string;
  frontCameraMP: number;
};

type Variant = {
  storageGB: number;
  launchPriceUSD: number;
};

type ColorOption = {
  name: string;
  hex: string;
};

type IPhoneModel = {
  id: string;
  displayName: string;
  tier: "SE" | "Standard" | "Mini" | "Plus" | "Air" | "Pro" | "Pro Max";
  generationYear: number;
  releaseDate: string;
  discontinued: boolean;
  discontinuedDate?: string;
  chip: Chip;
  displayInches: number;
  displayType: string;
  camera: Camera;
  batteryVideoPlaybackHours?: number;
  colors: ColorOption[];
  variants: Variant[];
  weightGrams: number;
  dimensionsMM: { height: number; width: number; depth: number };
  materials: string;
  heroImage: string;
  gallery: string[];
  summary: string;
  keyFeatures: string[];
};
```

### 5.2 Required fields

The following are required for a model to render:
`id`, `displayName`, `tier`, `generationYear`, `releaseDate`, `discontinued`, `chip`, `displayInches`,
`displayType`, `camera`, `colors`, `variants`, `weightGrams`, `dimensionsMM`, `materials`,
`heroImage`, `summary`, `keyFeatures`.

### 5.3 Validation rules
- `id` must be unique, lowercase, and URL-safe.
- `displayName` must not be empty.
- `tier` must be one of the allowed enum values.
- `generationYear` must be a number in the supported lineup range.
- `releaseDate` must be ISO-8601.
- `colors` must contain at least one swatch.
- `variants` must contain at least one storage/price entry.
- `launchPriceUSD` must be a positive number.
- `summary` must be original copy, not copied marketing text.
- `keyFeatures` must contain 3–5 short items.
- Invalid required data must cause the record to be excluded from rendering with a visible
  development warning.

### 5.4 Fallback behavior
- Missing optional battery data: omit the battery row.
- Missing gallery images: use `heroImage` and continue rendering.
- Missing color-specific asset: use the hero image and label it clearly.
- Missing non-critical descriptive text: replace with a short neutral fallback.
- Missing critical data: exclude the record rather than rendering broken UI.

### 5.5 Display rules
- Prices must always be labeled as launch/reference prices, not current retail prices.
- Prices must show the storage basis used for that price.
- Color swatches must show both color and text label.
- Images must have meaningful alt text.
- Any displayed storage size must be shown in GB.
- Any year displayed in the UI must use the model's generation year consistently.

### 5.6 Searchable content

Search must index: `displayName`, `tier`, `generationYear`, `chip.name`, `colors[].name`.

---

## 6. Page-by-page specification

### 6.1 Home ( `/` )

**Purpose:** A high-impact landing page that directs users into the catalog.

**Must**
- Show a strong hero section with a clear value proposition.
- Include a primary CTA that leads to the catalog.
- Include a generation timeline from 2014 to 2025.
- Show a small curated set of featured models using the same product card component as the catalog.
- Include the standard footer.

**Should**
- Make the home page feel editorial and premium.
- Use the timeline as a navigation shortcut into the catalog.
- Surface one iconic older model and one recent high-end model.

**May**
- Include a small supporting strip explaining what the catalog helps users do.

### 6.2 Catalog ( `/catalog` )

**Purpose:** The main browsing and decision-making page.

**Must**
- Display a search input.
- Display a filter panel.
- Display a sort control.
- Render a responsive grid of product cards.
- Support a "Load more" pattern.
- Show the active result count.
- Show a proper empty state when there are no matches.
- Allow adding to compare and favorites from each card.

**Should**
- Keep the filter area persistent on desktop.
- Use a full-height slide-out filter drawer on mobile and tablet.
- Keep the header sticky while scrolling.
- Preserve the current search/filter/sort state in the URL.

**May**
- Include a "clear all" shortcut in the filter panel.
- Include subtle difference highlighting in card summaries if useful.

### 6.3 Model detail ( `/model/:slug` )

**Purpose:** Show one model in depth and help the user inspect specs before comparing or saving it.

**Must**
- Show breadcrumb navigation.
- Show a large hero image.
- Show color swatches.
- Show a storage selector.
- Show the current price for the selected storage option.
- Show grouped spec sections.
- Show compare and favorites actions.
- Show a similar-models module. Selection rule: choose up to 4 models, prioritizing the same `tier`
  first, then models within ±1 `generationYear`, always excluding the current model; if fewer than 4
  candidates match, backfill with the nearest generation years regardless of tier.

**Should**
- Cross-fade the image when the color changes.
- Keep the selected storage reflected in the price immediately.
- Present key features near the top for fast scanning.
- Use grouped sections instead of a single long spec dump.

**May**
- Highlight nearby models in the same tier or adjacent generation.

### 6.4 Compare ( `/compare` )

**Purpose:** Make side-by-side comparison simple and readable.

**Must**
- Support 2 to 4 selected models.
- Show a comparison table with rows grouped by spec category.
- Allow removing any selected model.
- Allow adding another model until the limit is reached.
- Show an empty prompt if fewer than 2 models are selected.
- Block adding a 5th model with a clear message.

**Should**
- Repeat a compact model header at the top of each comparison column.
- Support a difference-highlighting toggle.
- Keep row labels aligned and scannable.

**May**
- Allow a lightweight add-another search popover instead of navigation away.

### 6.5 Favorites ( `/favorites` )

**Purpose:** Show all saved models in one place.

**Must**
- Display the same product card layout used in the catalog.
- Filter to favorited models only.
- Show a proper empty state if nothing is saved.
- Support clearing all favorites with confirmation.

**Should**
- Preserve the saved order or make the ordering rule explicit and consistent.
- Make it easy to return to the catalog.

**May**
- Allow quick jump back into compare from this page.

### 6.6 404 ( `/404` )

**Purpose:** Handle unknown routes gracefully.

**Must**
- Use a minimal header.
- Show a clear not-found message.
- Offer a single action back to the catalog.

**Should**
- Keep the page simple and calm.

---

## 7. Component contracts

### 7.1 Header

**Purpose:** Provide persistent navigation and state visibility.

**Must**
- Show site name/logo linking to Home.
- Show Catalog, Compare, and Favorites navigation.
- Show badge counts when compare/favorites contain items.
- Support a mobile navigation drawer.
- Stay sticky on scroll.
- Provide a light/dark mode toggle control (see §1), reflecting the currently active mode.

**Behavior**
- Counts must update immediately when state changes.
- Zero counts must not render as "0"; the badge disappears or the control appears disabled.
- Compare/Favorites controls must remain visible and reachable across the site.

**Accessibility**
- Use real navigation elements.
- Ensure keyboard access.
- Ensure the current page is announced or visually indicated.

### 7.2 Footer

**Purpose:** Close the page with useful support and provenance.

**Must**
- Include a short description of the site.
- Include quick links.
- Include a clear note that this is an independent catalog, not an official Apple property.
- Include a data-source / last-updated note.

**Should**
- Use a three-column layout on desktop and stacked layout on smaller screens.

### 7.3 Product Card

**Purpose:** Represent one iPhone model in browsing contexts.

**Must**
- Show image, model name, tier badge, year, and starting price.
- Open the detail page when the card body is clicked.
- Provide a compare control and a favorite control directly on the card.
- Use a skeleton state during loading.

**Behavior**
- The compare and favorite controls must not trigger navigation.
- Hover should create a subtle lift and shadow change on desktop.
- The card must remain readable without hovering.

**Accessibility**
- The card link and the icon controls must be separately operable.
- Icon controls must have explicit accessible labels.

**Error behavior**
- If an image fails, use a neutral placeholder with the model name.

### 7.4 Search input

**Purpose:** Let the user find models quickly.

**Must**
- Be debounced.
- Support clearing in one action.
- Filter results live.

**Behavior**
- Search must match model name, tier, year text, chip name, and color names.
- Search must be case-insensitive.
- Search must combine with filters rather than replacing them.

**Accessibility**
- Must have an accessible label.
- Clear button must be keyboard reachable.

### 7.5 Filter group

**Purpose:** Allow structured narrowing of the catalog.

**Must**
- Support tier, year, storage, color family, and chip family filtering.
- Allow multiple active filters at once.

**Behavior**
- Filters combine with AND logic across categories.
- Within a category, multi-select choices use OR logic.
- Changing a filter updates the visible results immediately.

**Responsive behavior**
- Desktop: persistent sidebar.
- Mobile and tablet: slide-in drawer.

**Accessibility**
- Use real form controls and visible selected states.

### 7.6 Filter chip

**Purpose:** Represent one selected filter value.

**Must**
- Show the label of the selected filter.
- Be removable with keyboard and pointer.
- Reflect selected and unselected states clearly.

**Error behavior**
- If a filter value becomes invalid, it must be removed and the UI normalized.

### 7.7 Sort dropdown

**Purpose:** Let the user reorder results.

**Must**
- Support at least: Newest first, Oldest first, Price low to high, Price high to low, Alphabetical.
- Reflect the current selection visibly.

**Behavior**
- Sorting must persist while loading more results.
- Sorting must persist across refresh through the URL.

### 7.8 Compare toggle

**Purpose:** Add or remove a model from the compare set.

**Must**
- Reflect selected/unselected state.
- Update the compare count immediately.
- Enforce the 4-model maximum.

**Behavior**
- Clicking a selected toggle removes the model from compare.
- Adding a fifth model must show a clear message instead of silently replacing another item.

**Accessibility**
- Must announce state changes clearly.

### 7.9 Favorite toggle

**Purpose:** Save or unsave a model.

**Must**
- Reflect selected/unselected state.
- Update the favorites count immediately.

**Behavior**
- Favorited state must stay consistent across cards, detail pages, and favorites page.

**Accessibility**
- Must use an accessible pressed/selected pattern with a clear label.

### 7.10 Breadcrumb

**Purpose:** Show navigation context on the detail page.

**Must**
- Indicate Home → Catalog → current model.
- Allow each intermediate level to be clicked.

**Accessibility**
- Use semantic navigation markup.

### 7.11 Image gallery

**Purpose:** Show the product image and color variations.

**Must**
- Present a primary hero image.
- Allow switching images when a color swatch changes.
- Keep layout stable during image swaps.

**Behavior**
- Image changes should cross-fade rather than jump.
- Below-the-fold gallery images should lazy-load.

**Error behavior**
- Missing images must fall back to a neutral placeholder.

### 7.12 Color swatches

**Purpose:** Let the user select a visible color variant.

**Must**
- Show a swatch and a text label.
- Show the selected state clearly.
- Drive the gallery image selection.

**Accessibility**
- Never rely on color alone.
- Selected state must also be indicated by shape, ring, or icon.

### 7.13 Storage selector

**Purpose:** Switch between storage variants on the detail page.

**Must**
- Show available storage sizes.
- Update price when storage changes.

**Behavior**
- Selected storage must remain visibly active.
- The displayed price must always correspond to the active storage variant.

### 7.14 Price display

**Purpose:** Show the reference price for the active storage variant.

**Must**
- Show launch/reference price only.
- Show the currency clearly.
- Show the storage basis used for the price.

**Behavior**
- If no valid price exists for a variant, the UI must not render an incorrect number.

### 7.15 Skeleton card

**Purpose:** Represent loading content without layout shift.

**Must**
- Match the product card's geometry.
- Be used during initial load and load-more loading.

**Behavior**
- Skeletons must not be replaced by spinners unless a truly blocking action exists.
- Existing content must not jump when new content loads.

### 7.16 Toast

**Purpose:** Communicate short state changes.

**Must**
- Support confirmations such as added to favorites, added to compare, removed from compare.
- Auto-dismiss after a short delay.
- Be manually dismissible.

**Accessibility**
- Announcements must be screen-reader friendly.

### 7.17 Empty state

**Purpose:** Handle zero-content or under-content states cleanly.

**Must**
- Include a short explanation.
- Include one clear action.
- Be used for no results, no favorites, and compare with fewer than 2 models.

**Behavior**
- Empty states must never feel like broken pages.

### 7.18 Modal

**Purpose:** Handle destructive or focused decisions.

**Must**
- Trap focus.
- Close on Escape.
- Close on scrim click.
- Restore focus to the triggering element.

**Use cases**
- Clear favorites confirmation.
- Add-another-model chooser on compact screens.

### 7.19 Slide-in drawer

**Purpose:** Provide filtering and compact navigation on smaller screens.

**Must**
- Lock background scroll while open.
- Trap focus while open.
- Close cleanly and restore focus.

**Behavior**
- The drawer should feel like a first-class part of the UI, not an afterthought.

### 7.20 Compare table

**Purpose:** Support direct side-by-side evaluation.

**Must**
- Be an actual table.
- Have row labels and model columns.
- Preserve readability across screen sizes.

**Responsive behavior**
- Desktop: full side-by-side table.
- Mobile and tablet: horizontal scroll with the spec-label column remaining sticky.

**Accessibility**
- Use proper table semantics and headers.

### 7.21 Load more button

**Purpose:** Extend the current result set without infinite scroll.

**Must**
- Load a fixed additional batch each time. Default batch size is **12 cards** per click, unless
  fewer than 12 remain, in which case load the remainder.
- Preserve scroll position.
- Preserve sort/filter state.

**Behavior**
- Existing cards must remain visible while additional cards load.
- The footer must remain reachable.

### 7.22 Back to top button

**Purpose:** Let the user quickly return to the top of long browsing sessions.

**Must**
- Appear after the user has scrolled a meaningful distance on the catalog page.
- Be fixed in the bottom-right corner.
- Be keyboard accessible.

---

## 8. Interaction and state rules

### 8.1 Search

**Must**
- Debounce input at approximately 250ms.
- Update results live.
- Combine with filters.

**Search match rules** — must match: model name, tier, year text, chip name, color names.

**Behavior on clear** — clearing search must immediately restore the filtered result set.

### 8.2 Filtering

**Must**
- Update results immediately.
- Reflect active values in the URL.
- Support combined filters.

**Rules**
- Filters use AND across categories.
- Multi-select within a category uses OR.
- Invalid query parameters must be ignored and normalized.

**URL behavior**
- Search, filters, and sort should all be shareable through the URL.
- Refreshing the page must restore the current browsing state from the URL.

### 8.3 Sorting

**Must**
- Sorting must be deterministic.
- Sorting must persist across loading more.
- Sorting must persist across refresh through the URL.

### 8.4 Compare and favorites state

**Must**
- Compare maximum: 4.
- Compare minimum to show table: 2.
- Favorites and compare state must stay consistent across pages.
- Removing the last compare item must show the empty compare state rather than redirecting.

**Persistence**
- In the shipped build, persist through browser storage.
- In the development sandbox, use an in-memory adapter if browser storage is unavailable.

**Clear-all behavior**
- Clear all favorites must require confirmation.
- Clear all selected compare items must update badges and pages immediately.

### 8.5 Global state matrix

| State | Behavior |
|---|---|
| Default | Standard visible UI |
| Hover | Subtle lift/contrast change on pointer-capable devices |
| Focus | Visible focus ring with strong contrast |
| Active | Slight compression or pressed feedback |
| Loading | Skeletons or inline loading indicator; no page-wide blocking spinner unless absolutely necessary |
| Disabled | Reduced opacity, no misleading interactivity |
| Empty | Helpful explanation and one clear action |
| Error | Clear error text and recovery path |
| Success | Toast or confirmation feedback |
| Selected | Strong accent/outline/checked state |
| Unselected | Neutral state, still readable |

**Rules**
- Hover must not be the only sign of interactivity.
- Focus must be visible for keyboard users.
- Disabled controls must not look active.
- Selected controls must remain obvious even when not hovered.

---

## 9. Responsive behavior

### Breakpoints

| Breakpoint | Range | Catalog columns | Filter layout | Nav layout |
|---|---|---|---|---|
| Mobile | under 640px | 1 column | Full-height drawer | Hamburger drawer |
| Tablet | 640px to 1024px | 2 columns | Full-height drawer | Hamburger drawer |
| Desktop | above 1024px | 3 columns, then 4 columns above very wide screens | Persistent sidebar | Full inline navigation |

### Rules
- Touch targets must be at least 44×44 px.
- Cards must remain readable on one column layouts.
- Compare table must remain usable on small screens via horizontal scrolling.
- The filter drawer must be easy to close and reopen.
- The header must remain compact on small screens.

### Layout notes
- Mobile: single-column cards, stacked sections, drawer-based controls.
- Tablet: two-column cards, still drawer-based filters for consistency.
- Desktop: multi-column grid, visible sidebar, richer spacing.
- Very wide screens may expand the card grid to 4 columns.

---

## 10. Visual design system

### 10.1 Color

**Must**
- Use a restrained premium palette.
- Use a single main accent color.
- Avoid rainbow tier colors.

**Suggested tokens**
- Light background: near-white
- Dark background: near-black
- Surface: white / deep charcoal
- Accent: electric indigo
- Success: green
- Danger: red
- Borders: neutral gray

### 10.2 Typography

**Must**
- Use one consistent sans-serif system.
- Use a clear hierarchy.

**Suggested type scale**
- Display: 48 / 56
- H1: 36 / 44
- H2: 28 / 36
- H3: 22 / 30
- Body: 16 / 24
- Small: 14 / 20
- Caption: 12 / 16

### 10.3 Spacing

**Must**
- Use a strict spacing scale.
- No arbitrary one-off spacing values.

**Suggested scale:** 4, 8, 12, 16, 24, 32, 48, 64, 96

### 10.4 Shape and shadow

**Must**
- Cards should feel soft and premium.
- Inputs and buttons should use modest rounding.
- Chips and swatches should be fully rounded.

**Suggested values**
- Cards: 16px radius
- Buttons/inputs: 10px radius
- Pills/swatches: full radius

### 10.5 Motion

**Must**
- Motion must be subtle.
- Motion must not interfere with comprehension.

**Suggested timing**
- Hover/focus changes: 180ms ease-out
- Modal/drawer enter: 240ms ease-out
- Modal/drawer exit: 180ms ease-in
- Image color switch: 200ms cross-fade

### 10.6 Reduced motion
- Respect reduced-motion preferences everywhere.
- Collapse motion to near-instant state changes when requested.

---

## 11. Accessibility

**Must**
- Use semantic HTML.
- Make every control keyboard operable.
- Show visible focus states.
- Use real buttons, links, tables, navigation, and dialogs.
- Provide meaningful alt text.
- Use `aria-live` for result changes and toasts.
- Trap focus in modals and drawers.
- Use color as a supplement, not the only signal.
- Meet WCAG AA contrast targets.

**Specific rules**
- Compare/favorite icon buttons must include model-specific accessible labels.
- Table semantics must be preserved in compare.
- Decorative images must use empty alt text.
- Selected swatches must have a non-color indicator.
- Escape must close overlays where appropriate.

---

## 12. Error, empty, and loading states

**Zero search or filter results**
- Show an empty state.
- Offer a clear-all action.
- Do not show a blank grid.

**No favorites**
- Show an empty favorites state.
- Offer a return-to-catalog action.

**Fewer than 2 compare selections**
- Show a prompt to add another model.

**Missing data**
- If critical required data is missing, exclude the record.
- If optional data is missing, omit the affected UI block and use the defined fallback.

**Invalid query parameters**
- Ignore invalid values.
- Normalize the URL state rather than breaking the page.

**Image failure**
- Show a neutral fallback placeholder with the model name.

**Removed or missing model**
- Remove the missing model from compare/favorites state.
- Inform the user with a short toast or notice.

**Loading**
- Use skeletons for cards and content regions.
- Do not use blocking full-page loaders unless absolutely necessary.

---

## 13. Technical constraints

**Must**
- The site must remain static and front-end driven.
- Data must come from the local JSON dataset.
- URLs must be real and shareable.
- The site must support deep linking.

**Persistence**
- In the shipped build, browser storage may be used for favorites and compare state.
- In development or constrained environments, a small state adapter may keep the same behavior in
  memory.

**Asset rules**
- Do not use Apple-owned photography or copied Apple copy.
- Use original, licensed, or generated-safe imagery and copy only.
- Images should use modern formats and avoid layout shift.

---

## 14. Content rules

**Must**
- Keep labels short.
- Keep helper text plain and useful.
- Avoid marketing fluff.
- Avoid technical jargon when a simple label works.

**Tone:** premium · calm · precise · practical · confident

**Copy examples**
- "Browse the full lineup"
- "Compare selected models"
- "Save for later"
- "No models match these filters"
- "Clear all filters"

---

## 15. Acceptance criteria

The build is acceptable only if all of the following are true:

- All 43 models are present and render correctly.
- Home, Catalog, Detail, Compare, Favorites, and 404 routes work.
- Search, filters, and sort work individually and in combination.
- URL state restores the current browsing view on refresh.
- Compare supports 2–4 models and blocks the 5th.
- Favorites and compare selections stay consistent across pages.
- Every component has visible default, hover, focus, active, disabled, loading, selected, and
  unselected states where relevant.
- Empty states are shown for zero results, empty favorites, and underfilled compare.
- Mobile, tablet, and desktop all feel complete and usable.
- Keyboard-only navigation can reach and operate every feature.
- Light and dark modes meet contrast requirements.
- No layout shift is introduced by image loading.
- No invalid or missing data renders as broken UI.
- The catalog feels premium, readable, and worth using.
