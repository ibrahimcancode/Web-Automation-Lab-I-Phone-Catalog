# Fresh Clone Verification

This document records the results of a clean-clone verification performed on
2026-08-18. The repository was copied to a fresh directory (no `node_modules`,
no `runs/`, no `.git` history), and the README setup instructions were followed
exactly.

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
