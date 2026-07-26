# Resilient Web Automation Lab

A local sandbox listing site (iPhone catalog theme) with a configurable Chaos Engine, built as Part A
of the Resilient Web Automation Lab internship. Part B (the Playwright automation bot) is in progress.

## What's here

- **`sandbox_site/`** — Flask app serving an iPhone listing/detail site from a local JSON dataset.
- **`sandbox_site/chaos/`** — the Chaos Engine: a config-driven, deterministic disruption layer that
  the site's routes and templates know nothing about. Full design in `CHAOS_ENGINE_SPEC.md`.
- **`docs/PLANNING.md`** — architecture, build phases, scenario list, risks.
- **`docs/SCENARIOS.md`** — the scenario coverage matrix (the key evaluation deliverable).
- **`docs/AI_LOG.md`** — running log of how AI tools were used.

## Status

4 of 8 core disruption scenarios are implemented on the sandbox side: Cookie Banner, Newsletter
Popup, Slow Response (2–5s), and a Simulated Captcha gate. The remaining 4 (site down/server errors,
unexpected redirection, DOM/selector drift, blocked clicks) are not yet built. The automation bot has
not been started — see `docs/PLANNING.md` §4 for the current build-phase status.

## Setup

```bash
git clone <your-repo-url>
cd web-automation-lab/sandbox_site
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Visit `http://localhost:5000`.

## Running with chaos on/off

Everything is controlled by `sandbox_site/chaos.json`.

```json
{
  "enabled": true,
  "random_mode": false,
  "seed": 42,
  "scenarios": {
    "cookie_banner": { "enabled": true, "probability": 1.0 },
    "newsletter_popup": { "enabled": true, "probability": 0.35, "min_delay_seconds": 2, "max_delay_seconds": 6 },
    "slow_response": { "enabled": true, "probability": 0.40, "min_delay_ms": 2500, "max_delay_ms": 5000 }
  }
}
```

- Set `"enabled": false` to turn the entire Chaos Engine off — the site behaves normally.
- With `"random_mode": false`, every scenario with `"enabled": true` triggers every time (useful for
  demoing one scenario in isolation).
- With `"random_mode": true`, each scenario triggers based on its `probability`, using the `seed` for
  reproducible randomness — the same seed always produces the same sequence of disruptions.
- Toggle any individual scenario's `"enabled"` flag to isolate it for a demo or a test.

## Demoing a single scenario

1. Set only the scenario you want to `"enabled": true` in `chaos.json` (others `false`), keep
   `"random_mode": false`.
2. Restart the server (or call the engine's `reload()` if wired to a dev endpoint).
3. Load the site — the scenario will trigger every time. Check `sandbox_site/logs/chaos.log` for the
   structured event log confirming it fired.

## Known limitations

- The automation bot (Part B) does not exist yet — only the sandbox site and Chaos Engine are done.
- 4 of 8 core disruption scenarios are not yet implemented (see `docs/SCENARIOS.md`).
- The catalog UI (search/filter/sort/compare/favorites/theming) is intentionally more built-out than
  this internship requires — see `docs/PLANNING.md` for why that work is now deprioritized in favor
  of the bot.
- No automated test suite yet.

## Documentation

- Full Chaos Engine contract: `CHAOS_ENGINE_SPEC.md`
- Build plan and architecture: `docs/PLANNING.md`
- Scenario coverage matrix: `docs/SCENARIOS.md`
- AI usage log: `docs/AI_LOG.md`
