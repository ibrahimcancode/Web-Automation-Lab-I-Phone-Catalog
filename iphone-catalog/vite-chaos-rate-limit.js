// Vite dev-server chaos middleware — HTTP 429 rate limiting scenario.
//
// Intercepts SPA HTML navigations and returns 429 Too Many Requests for the
// first N requests (fail_first_n) or with a seeded probability.
// Includes Retry-After header when configured.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SPA_ROUTES = /^\/($|catalog|model\/|compare|favorites)/;

function loadConfig() {
  const override = process.env.VITE_CHAOS_JSON;
  if (override) {
    try { return JSON.parse(override); } catch { /* fall through */ }
  }
  try {
    return JSON.parse(readFileSync(path.join(__dirname, 'src', 'chaos', 'chaos.json'), 'utf8'));
  } catch { return null; }
}

function isHtmlRequest(req) {
  const accept = req.headers.accept || '';
  if (!accept.includes('text/html')) return false;
  const pathname = req.url.split('?')[0];
  if (pathname.startsWith('/@') || pathname.startsWith('/src/')) return false;
  if (pathname.includes('.')) return false;
  return SPA_ROUTES.test(pathname);
}

export default function rateLimitMiddleware() {
  let hits = 0;
  let config = null;
  let enabled = false;

  const syncConfig = () => {
    config = loadConfig();
    enabled = Boolean(config?.enabled) && Boolean(config?.scenarios?.rate_limiting?.enabled);
  };

  return {
    name: 'chaos-rate-limit',
    configureServer(server) {
      syncConfig();
      server.middlewares.use((req, res, next) => {
        if (!enabled || !isHtmlRequest(req)) return next();

        const sc = config.scenarios.rate_limiting;
        const failFirstN = sc.fail_first_n ?? 2;
        const retryAfter = sc.retry_after_seconds ?? 1;

        hits += 1;
        if (hits <= failFirstN) {
          res.setHeader('Retry-After', String(retryAfter));
          res.statusCode = 429;
          res.setHeader('Content-Type', 'text/html');
          res.end(
            `<!doctype html><html><head><title>429 Too Many Requests</title></head>` +
            `<body><h1>429 Too Many Requests</h1><p>Rate limited. Retry after ${retryAfter}s.</p></body></html>`,
          );
          return undefined;
        }
        return next();
      });
    },
  };
}
