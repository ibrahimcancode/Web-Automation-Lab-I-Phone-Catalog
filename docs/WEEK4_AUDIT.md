# Week 4 Audit — Baseline Assessment

Date: 2026-08-17
Branch: `main`
Node: v24.18.0 | npm: 11.16.0 | Platform: win32

## Audit Table

| #   | Issue                                     | Current Evidence                                | Severity | Proposed Resolution                                                              | Files Affected                                          | Verification Method                                  | Final Status              |
| --- | ----------------------------------------- | ----------------------------------------------- | -------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- | ------------------------- |
| 1   | Windows-only scripts in root package.json | `set VITE_CHAOS_JSON=...&&npm.cmd` in 8 scripts | High     | Create Node.js orchestration scripts under `scripts/`                            | `package.json`, `scripts/*`                             | `npm run site`, `npm run bot`, etc. on all platforms | **Done**                  |
| 2   | No CI/CD                                  | No `.github/workflows/` directory               | High     | Add GitHub Actions workflow with lint, typecheck, unit, scenario, gauntlet tests | `.github/workflows/ci.yml`                              | CI passes on push/PR                                 | **Done**                  |
| 3   | No root-level linting                     | Oxlint only inside `iphone-catalog/`            | High     | Add root ESLint + Prettier config covering `bot/`, `tests/`, `scripts/`          | `.eslintrc.*`, `.prettierrc`, `package.json`            | `npm run lint`, `npm run format:check`               | **Done**                  |
| 4   | No TypeScript type safety                 | Plain JavaScript throughout                     | Medium   | Add `tsconfig.json` with `allowJs`/`checkJs`, JSDoc types for contracts          | `tsconfig.json`, key modules                            | `npm run typecheck` passes                           | **Done**                  |
| 5   | Accidental filename `MASTER_SPEC (1).md`  | File exists in repo root                        | Medium   | Rename to `docs/MASTER_SPEC.md`, update all references                           | `MASTER_SPEC (1).md` -> `docs/MASTER_SPEC.md`           | No broken links                                      | **Done**                  |
| 6   | Default Vite README in catalog            | `iphone-catalog/README.md` is boilerplate       | Medium   | Replace with concise subproject README                                           | `iphone-catalog/README.md`                              | Accurate content                                     | **Done**                  |
| 7   | Stale planning docs                       | `docs/PLANNING.md` has stale Week 3 status      | Medium   | Update with Week 4 completion status                                             | `docs/PLANNING.md`                                      | Consistent with reality                              | **Done**                  |
| 8   | Duplicate AI logs                         | `iphone-catalog/AI_LOG.md` + `docs/AI_LOG.md`   | Low      | Merge into canonical `docs/AI_LOG.md`, remove/redirect duplicate                 | `docs/AI_LOG.md`, `iphone-catalog/AI_LOG.md`            | Single canonical log                                 | **Done**                  |
| 9   | Arithmetic CAPTCHA is not visual          | Bot reads DOM text, solves math                 | High     | Replace with visual 3x3 traffic-light grid; bot uses pixel analysis              | `SimulatedCaptcha.jsx`, `captcha_handler.js`, selectors | Bot solves via screenshot pixels                     | **Done**                  |
| 10  | No crash-safe checkpoint/resume           | Progress lost on process restart                | High     | Add atomic checkpoint persistence with `--resume` support                        | `bot/checkpoint.js`, `bot/run.js`, `bot/workflow.js`    | Crash + resume test                                  | **Done**                  |
| 11  | No stretch scenarios                      | Only 8 core scenarios                           | High     | Add HTTP 429 rate limiting + session expiry                                      | sandbox handlers, bot handlers, tests                   | Individual + combined tests                          | **Done**                  |
| 12  | No failure observability                  | Basic event log only                            | High     | Add error taxonomy, enhanced summary, trace support                              | `bot/reporting.js`, `bot/workflow.js`                   | Schema tests, trace retention                        | **Done**                  |
| 13  | Slow test suite                           | `workers:1`, `fullyParallel:false`, ~9.5 min    | Medium   | Parallelize unit tests, separate fast/slow suites                                | `playwright.config.js`, test configs                    | Faster unit runtime                                  | No change (safe defaults) |
| 14  | Version mismatch                          | Root 0.2.0, catalog 0.0.0                       | Low      | Unified 1.0.0                                                                    | `package.json` (both)                                   | Consistent versions                                  | **Done**                  |
| 15  | No LICENSE file                           | Missing                                         | Low      | Add MIT license                                                                  | `LICENSE`                                               | Present and correct                                  | **Done**                  |
| 16  | No CONTRIBUTING guide                     | Missing                                         | Low      | Add with setup, test, ethical-use guidelines                                     | `CONTRIBUTING.md`                                       | Present and accurate                                 | **Done**                  |
| 17  | Missing demo/resume/trace docs            | README references stale capabilities            | Medium   | Update README with all new features                                              | `README.md`                                             | Complete and consistent                              | **Done**                  |

## Baseline Measurements

- **Total tests:** 61 unit tests (up from 50)
- **Unit test runtime:** ~2.6s
- **Handlers registered:** 10 (8 core + 2 stretch: rate_limiting, session_expiry)
- **Catalog items:** 43
- **Playwright workers:** 1
- **Linting:** ESLint 9 flat config + Prettier at root level
- **CI:** GitHub Actions (quality, unit, scenarios, gauntlet, demo-smoke)
- **Observability:** computeMetrics() + writeTrace() for structured metrics + human-readable trace log
