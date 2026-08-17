# iPhone Catalog — Sandbox Site

Local React/Vite listing site serving as the sandbox for the Resilient Web Automation Lab.

## What This Is

A deterministic iPhone catalog (43 models) with a configurable **Chaos Engine** that simulates real-world web disruptions: cookie banners, newsletter popups, visual CAPTCHA gates, server errors, slow responses, redirects, DOM drift, blocked clicks, rate limiting, and session expiry.

## How It Relates to the Root Project

This is the sandbox target. The Playwright bot (in the root `bot/` directory) automates this site, detecting and recovering from every simulated disruption.

**Root README is the primary entry point for the project.**

## Starting

```bash
# From the project root:
npm run site          # chaos ON (random_mode, seed 42)
npm run site:off      # chaos OFF (happy path)
npm run site:all      # all core scenarios forced deterministically
```

Or directly:

```bash
npm run dev           # uses bundled chaos.json
```

The dev server runs at `http://localhost:5173` by default.

## Chaos Configuration

Override chaos config via the `VITE_CHAOS_JSON` environment variable (set by root `npm run site*` scripts). The config is read once at dev-server startup.

## Documentation

See the root `README.md` and `docs/` directory for full project documentation.
