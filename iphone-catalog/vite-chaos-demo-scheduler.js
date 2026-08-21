// Shared demo scheduler — coordinates the four SERVER-SIDE chaos middlewares so
// each server scenario fires exactly ONCE at a controlled navigation point.
//
// Root cause of the original demo crash:
//   chaos.demo.json has random_mode=false, which makes `should_trigger` return
//   true for EVERY scenario on EVERY navigation. The server middlewares then
//   fired their disruptions on overlapping navigation attempts — server_errors
//   (503) and rate_limiting (429) both targeted the "first" navigation, slow
//   delayed every request, and session_expiry fired every N navigations
//   including the bot's own retry/recover gotos. Combined with the bot's
//   maxAttempts cap (4) the catalog navigation was exhausted before it loaded.
//
// This module is the single source of truth for the DEMO run only. It is active
// exactly when the config looks like the demo config: random_mode=false with all
// four server scenarios enabled. In every other mode (individual scenario tests,
// the random-mode gauntlet, site presets) it is INACTIVE and each middleware
// keeps its original, self-contained logic — so nothing else changes.
//
// Schedule (per real HTML SPA navigation, excluding noredirect / session_restored
// /promo and other non-SPA traffic):
//
//   nav #1 -> server_errors     (503, bot retries)
//   nav #2 -> rate_limiting     (429 + Retry-After, bot backs off + retries)
//   nav #3 -> (home success — cookie/banner/captcha handled client-side)
//   nav #4 -> slow_responses    (2.5s delay, catalog navigation)
//   nav #5 -> session_expiry    (interstitial, first detail navigation)
//   nav #6 -> (detail #2 success)
//
// Each scenario is mutually exclusive per request and strictly one-shot, so no
// two server disruptions ever collide on the same attempt and the 4-retry budget
// is never exhausted by overlapping failures.

const SPA_ROUTES = /^\/($|catalog|model\/|compare|favorites)/;

// Ordered schedule. `at` is the 1-based real-navigation index that triggers it.
const SCHEDULE = [
  { name: 'server_errors', at: 1 },
  { name: 'rate_limiting', at: 2 },
  { name: 'slow_responses', at: 4 },
  { name: 'session_expiry', at: 5 },
];

const SERVER_SCENARIOS = SCHEDULE.map((s) => s.name);

let _demo = false;
let _navCount = 0;
const _fired = new Set();

// Active when the demo config signature is present: deterministic mode with
// every server scenario forced on (the committed chaos.demo.json).
export function isDemoMode(config) {
  if (!config || config.enabled !== true) return false;
  if (config.random_mode !== false) return false;
  const sc = config.scenarios || {};
  return SERVER_SCENARIOS.every((n) => sc[n] && sc[n].enabled === true);
}

function isCountedRequest(req) {
  if (req.url.includes('noredirect=1')) return false;
  if (req.url.includes('session_restored=1')) return false;
  const pathname = req.url.split('?')[0];
  if (!SPA_ROUTES.test(pathname)) return false;
  return true;
}

// Called by each server middleware on each HTML request. Assigns exactly one
// demo scenario to this request (or null), incrementing the shared navigation
// counter once per real SPA navigation. Uses a per-request stamp so the four
// middlewares agree on a single assignment for the same request.
export function assignScenario(req, config) {
  if (!isDemoMode(config)) return null;

  // Stamp so the counter advances once per request across all middlewares.
  if (req._chaosDemoAssigned === true) return req._chaosDemoScenario;
  req._chaosDemoAssigned = true;

  if (!isCountedRequest(req)) {
    req._chaosDemoScenario = null;
    return null;
  }

  _navCount += 1;
  const scheduled = SCHEDULE.find((s) => s.at === _navCount && !_fired.has(s.name));
  const scenario = scheduled && !_fired.has(scheduled.name) ? scheduled.name : null;
  if (scenario) _fired.add(scenario);
  req._chaosDemoScenario = scenario;
  return scenario;
}

// Read-only access for diagnostics / the bot side.
export function getSchedulerState() {
  return { demo: _demo, navCount: _navCount, fired: [..._fired] };
}

export function resetDemoScheduler() {
  _navCount = 0;
  _fired.clear();
}
