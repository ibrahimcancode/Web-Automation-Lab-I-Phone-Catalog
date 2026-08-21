# Fresh Clone Verification

This document records clean-clone verifications. The first section is the historical
full-suite record (2026-08-18, eight-scenario era). The second section is the final
targeted verification (2026-08-21) using the current two-command README setup and the
ten-scenario demo.

## Verification 2026-08-21 (final deliverable — targeted)

The repository was cloned to a fresh temporary directory from the committed `main`
(`git clone <repo>`), and the **current** README process was followed exactly:

```bash
npm install
npm run setup
npm run test:unit
node scripts/demo-all.js --headless --limit 3   # run exactly once
```

| Step                          | Result                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `npm install`                 | OK (94 packages, 0 vulnerabilities)                                          |
| `npm run setup`               | OK — iphone-catalog deps via lockfile + Playwright Chromium, SUCCESS message |
| `npm run test:unit`           | **75/75 passed** (1.8s)                                                      |
| Demo (`--headless --limit 3`) | **verdict=PASS**, 3/3 phones, exit code 0, ~2 min                            |

Demo checklist from this run — all ten scenarios detected **and** resolved:
`cookie_banner`, `newsletter_popup`, `simulated_captcha`, `server_errors`,
`slow_responses`, `unexpected_redirect`, `dom_drift`, `blocked_clicks`,
`rate_limiting`, `session_expiry` (0 failed / 0 invalid / 0 duplicates).

Not re-run in this pass (previously verified and unchanged in scope): full E2E suite,
chaos gauntlet seeds, and the full 43-phone demo. The historical results below remain
the last recorded full-suite run.

---

## Historical verification 2026-08-18 (full suite, eight-scenario era)

This document records the results of a clean-clone verification performed on
2026-08-18. The repository was copied to a fresh directory (no `node_modules`,
no `runs/`, no `.git` history), and the README setup instructions of that time were
followed exactly. (Note: the demo result below predates the ten-scenario demo
scheduler; see the 2026-08-21 section above for the current ten-scenario demo.)

## Environment

- **OS**: Windows (PowerShell)
- **Node.js**: v24.18.0
- **npm**: 11.16.0
- **Playwright**: latest (installed via `npm run install:browsers`)

## Setup Steps (from README)

```bash
# 1. Install root deps
npm install
npm run install:browsers

# 2. Install sandbox deps
npm.cmd --prefix iphone-catalog install
```

All three steps completed without errors.

## Verification Results

### Unit Tests

```bash
npm run test:unit
```

**66/66 passed** (1.7s)

### Happy Path E2E

```bash
npm run test:happy
```

**1/1 passed** (28.7s) — bot extracts 3 items with no disruptions.

### Demo (headless, limit 3)

```bash
node scripts/demo-all.js --headless --limit 3
```

**verdict=PASS**, items_processed=3, items_failed=0, invalid=0.
All 8 chaos scenarios detected and resolved.

### Full E2E Suite

```bash
npx playwright test
```

**91/91 passed** (12.1m)

| Test Tier                                   | Count  | Status   |
| ------------------------------------------- | ------ | -------- |
| Unit (week 2 + week 3)                      | 66     | PASS     |
| Happy path                                  | 1      | PASS     |
| Per-scenario (week 2)                       | 4      | PASS     |
| Per-scenario (week 3)                       | 4      | PASS     |
| All-four combination                        | 1      | PASS     |
| Week 4 (CAPTCHA, rate, session, checkpoint) | 5      | PASS     |
| Demo mode                                   | 8      | PASS     |
| Chaos gauntlet (seed 42)                    | 1      | PASS     |
| Chaos gauntlet (seed 99)                    | 1      | PASS     |
| **Total**                                   | **91** | **PASS** |

### Lint / Format

```bash
npx eslint .          # 0 errors, 6 warnings (all in generate-images.cjs)
npx prettier --check .  # All files formatted
```

## Conclusion

The repository builds, installs, and passes all 91 tests from a clean clone
using only the instructions documented in the README.
