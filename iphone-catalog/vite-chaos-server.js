// Vite dev-server chaos middleware — Scenario 4 (site down / server errors).
//
// The sandbox is a client-side React SPA, so there is no Flask route that can
// return a real 500/503. Instead, this Vite plugin intercepts HTML navigations
// in the dev server and, when the `server_errors` scenario is active, returns a
// genuine error status so the bot's navigation guard + retry/backoff logic is
// exercised against a real network failure.
//
// Config source: the same VITE_CHAOS_JSON override used by the app (set at
// dev-server start by tests), falling back to src/chaos/chaos.json. Behaviour
// mirrors the client chaos engine: `fail_first_n` is deterministic for tests,
// otherwise `probability` (with the shared seed) is used.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// SPA routes the middleware may intercept. Anything else (Vite internals,
// assets, /src/*) passes through untouched.
const SPA_ROUTES = /^\/($|catalog|model\/|compare|favorites)/;

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

export default function chaosServerErrors() {
  let hits = 0;
  let config = null;
  let enabled = false;
  let rng = null;

  const syncConfig = () => {
    config = loadConfig();
    enabled = Boolean(config?.enabled) && Boolean(config?.scenarios?.server_errors?.enabled);
    rng = makeRng(config?.seed ?? 42);
  };

  return {
    name: 'chaos-server-errors',
    configureServer(server) {
      syncConfig();
      server.middlewares.use((req, res, next) => {
        if (!enabled || !isHtmlRequest(req)) {
          return next();
        }

        const sc = config.scenarios.server_errors;
        const status = sc.status_code || 503;
        let fail = false;

        if (sc.fail_first_n > 0) {
          fail = hits < sc.fail_first_n;
          hits += 1;
        } else {
          fail = rng() < (sc.probability ?? 0.5);
        }

        if (!fail) return next();

        res.statusCode = status;
        res.setHeader('Content-Type', 'text/html');
        res.end(
          `<!doctype html><html><head><title>${status} Service Unavailable</title></head>` +
            `<body><h1>${status} Service Unavailable</h1><p>Simulated by the sandbox chaos engine.</p></body></html>`,
        );
        return undefined;
      });
    },
  };
}
