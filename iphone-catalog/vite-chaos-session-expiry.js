// Vite dev-server chaos middleware — Session expiry scenario.
//
// After the first N HTML navigations, intercepts the next SPA navigation
// and returns a session-expired interstitial page with a "Continue" button.
// The interstitial preserves the intended destination via a query parameter.
//
// This middleware runs LAST in the chaos chain so it only counts navigations
// that passed through all earlier middlewares (i.e., not short-circuited by
// server_errors or rate_limiting 503/429 responses).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SPA_ROUTES = /^\/($|catalog|model\/|compare|favorites)/;

function loadConfig() {
  const override = process.env.VITE_CHAOS_JSON;
  if (override) {
    try {
      return JSON.parse(override);
    } catch {
      /* fall through */
    }
  }
  try {
    return JSON.parse(readFileSync(path.join(__dirname, 'src', 'chaos', 'chaos.json'), 'utf8'));
  } catch {
    return null;
  }
}

function isHtmlRequest(req) {
  const accept = req.headers.accept || '';
  if (!accept.includes('text/html')) return false;
  const pathname = req.url.split('?')[0];
  if (pathname.startsWith('/@') || pathname.startsWith('/src/')) return false;
  if (pathname.includes('.')) return false;
  return SPA_ROUTES.test(pathname);
}

export default function sessionExpiryMiddleware() {
  let navigationCount = 0;
  let config = null;
  let enabled = false;
  let triggerAfterN = 3;

  const syncConfig = () => {
    config = loadConfig();
    enabled = Boolean(config?.enabled) && Boolean(config?.scenarios?.session_expiry?.enabled);
    triggerAfterN = config?.scenarios?.session_expiry?.trigger_after_navigations ?? 3;
  };

  return {
    name: 'chaos-session-expiry',
    configureServer(server) {
      syncConfig();
      server.middlewares.use((req, res, next) => {
        if (!enabled || !isHtmlRequest(req)) return next();

        // Vite's SPA fallback re-serves index.html with ?noredirect=1 to avoid
        // infinite redirect loops. These are not real navigations and must not
        // be counted toward the trigger threshold.
        if (req.url.includes('noredirect=1')) return next();

        navigationCount += 1;
        if (navigationCount >= triggerAfterN) {
          navigationCount = 0;
          const dest = encodeURIComponent(req.url || '/');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html');
          res.end(
            `<!doctype html><html><head><title>Session Expired</title></head>` +
              `<body>` +
              `<div id="session-expired-interstitial" data-chaos="session_expiry" style="text-align:center;padding:60px 20px;font-family:system-ui,sans-serif;">` +
              `<h1>Session Expired</h1>` +
              `<p>Your session has timed out. Please continue to restore your session.</p>` +
              `<a href="/?session_restored=1&dest=${dest}" id="session-continue-btn" ` +
              `style="display:inline-block;padding:12px 24px;background:#5856d6;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Continue</a>` +
              `</div>` +
              `</body></html>`,
          );
          return undefined;
        }
        return next();
      });
    },
  };
}
