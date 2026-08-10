// Vite dev-server chaos middleware — Scenario 5 (slow responses / timeouts).
//
// A client-side React SPA cannot reproduce a genuinely slow server, so this Vite
// plugin delays the HTML response for SPA navigations while the `slow_responses`
// scenario is active. The delay is clamped to a safe 2-5s window: long enough
// for the bot's duration classification to observe "slow", short enough that
// the navigation still completes inside the bot's timeout.
//
// Config source: the same VITE_CHAOS_JSON override used by the app (set at
// dev-server start by tests), falling back to src/chaos/chaos.json. In
// random_mode the delay is drawn from [min_delay_ms, max_delay_ms] with the
// shared seed; in deterministic mode (tests / demo) it is exactly min_delay_ms.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// SPA routes the middleware may intercept. Anything else (Vite internals,
// assets, /src/*) passes through untouched.
const SPA_ROUTES = /^\/($|catalog|model\/|compare|favorites)/;

// Same safe delay window as the client engine's slow_response cap.
const SAFE_MIN_MS = 2000;
const SAFE_MAX_MS = 5000;

// Same mulberry32 PRNG family as the client engine, so the seed is meaningful.
function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadConfig() {
  const override = process.env.VITE_CHAOS_JSON;
  if (override) {
    try {
      return JSON.parse(override);
    } catch {
      /* fall through to file */
    }
  }
  try {
    const file = path.join(__dirname, 'src', 'chaos', 'chaos.json');
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function isHtmlRequest(req) {
  const accept = req.headers.accept || '';
  if (!accept.includes('text/html')) return false;
  const pathname = req.url.split('?')[0];
  // Skip Vite internal modules and real assets (which carry a file extension).
  if (pathname.startsWith('/@') || pathname.startsWith('/src/')) return false;
  if (pathname.includes('.')) return false;
  return SPA_ROUTES.test(pathname);
}

function clampDelay(val, fallback) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(SAFE_MIN_MS, Math.min(SAFE_MAX_MS, val));
}

export default function chaosSlowResponses() {
  let config = null;
  let enabled = false;
  let rng = null;

  const syncConfig = () => {
    config = loadConfig();
    enabled = Boolean(config?.enabled) && Boolean(config?.scenarios?.slow_responses?.enabled);
    rng = makeRng(config?.seed ?? 42);
  };

  return {
    name: 'chaos-slow-responses',
    configureServer(server) {
      syncConfig();
      server.middlewares.use((req, res, next) => {
        if (!enabled || !isHtmlRequest(req)) {
          return next();
        }

        const sc = config.scenarios.slow_responses;
        const min = clampDelay(sc.min_delay_ms, SAFE_MIN_MS);
        const max = clampDelay(sc.max_delay_ms, SAFE_MAX_MS);
        const delayMs = config.random_mode ? Math.round(min + rng() * (max - min)) : min;

        setTimeout(() => next(), delayMs);
        return undefined;
      });
    },
  };
}
