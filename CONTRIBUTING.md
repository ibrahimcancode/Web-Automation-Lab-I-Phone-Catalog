# Contributing

## Local Setup

```bash
git clone https://github.com/ibrahimcancode/Web-Automation-Lab-I-Phone-Catalog.git
cd Web-Automation-Lab-I-Phone-Catalog
npm install
npx playwright install --with-deps chromium
cd iphone-catalog && npm install && cd ..
```

## Running Tests

```bash
npm run test:unit        # fast unit tests (no browser)
npm run test:happy       # happy path (chaos off)
npm run test:scenarios   # individual scenario tests
npm run test:gauntlet    # all scenarios in random mode
npm test                 # full suite
```

## Code Quality

```bash
npm run lint             # ESLint
npm run format:check     # Prettier check
npm run typecheck        # TypeScript strict mode (checkJs)
npm run quality          # all three above
```

## Branch and Commit Expectations

- Create a feature branch from `main`.
- Run `npm run quality` and `npm test` before committing.
- Use conventional commit messages: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`.
- Do not commit `node_modules/`, `runs/`, `test-results/`, or browser binaries.

## Adding a Scenario

1. Add sandbox-side simulation in `iphone-catalog/src/chaos/handlers/`.
2. Add a chaos config key in `configs/chaos.demo.json`.
3. Add a bot handler in `bot/handlers/` that exposes `{ name, type, priority, detect, recover }`.
4. Register the handler in `bot/handlers/index.js`.
5. Add selectors in `bot/selectors.js` if needed.
6. Add a unit test in `tests/test_unit_week*.spec.js`.
7. Add an E2E test in `tests/test_scenarios_week*.spec.js`.
8. Update `docs/SCENARIOS.md`.

## Evidence Requirements

- Structured events in `events.jsonl`.
- Screenshots on anomalies saved to `screenshots/`.
- Run summary in `summary.json` with disruption counts and verdict.
- Checkpoint files (atomic write + rename) for crash recovery.

## Ethical Restrictions

- **Never** point the bot at real third-party websites.
- **Never** attempt to bypass real CAPTCHAs (Google reCAPTCHA, hCaptcha, Cloudflare Turnstile).
- **Never** use this project for scraping, credential stuffing, or any unauthorized automation.
- The traffic-light CAPTCHA is a local simulation for educational purposes only.
- All scenarios run against the local `localhost` sandbox only.
