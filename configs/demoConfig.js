// Demo-mode configuration loader + validator.
//
// The demo (`npm run demo:all`) uses a dedicated chaos config, separate from the
// sandbox's normal config (iphone-catalog/src/chaos/chaos.json, random mode) and
// from the random-mode gauntlet configs (tests/test_gauntlet.spec.js). It forces
// ALL ten scenarios with random_mode=false, so every scenario is
// deterministically triggered during a single run — no probability, no seed luck.
//
// Kept dependency-free so both scripts/demo-all.js and tests/test_demo_mode.spec.js
// can share it, and so it is directly unit-testable.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEMO_CONFIG_PATH = path.join(__dirname, 'chaos.demo.json');

// All ten chaos scenarios, in the order the bot must prove them. Covers the 8
// client/overlay scenarios plus the 2 Vite server-side stretch scenarios
// (rate_limiting, session_expiry) added in Week 4.
export const DEMO_SCENARIOS = [
  'cookie_banner',
  'newsletter_popup',
  'simulated_captcha',
  'server_errors',
  'slow_responses',
  'unexpected_redirect',
  'dom_drift',
  'blocked_clicks',
  'rate_limiting',
  'session_expiry',
];

// Full dataset size the demo must extract (catalog ships 43 models).
export const DEMO_CATALOG_SIZE = 43;

// Where each scenario is forced to fire, at its controlled point, in the demo.
export const DEMO_SCENARIO_POINTS = {
  cookie_banner: 'home page load (once per session, dismissed via Accept)',
  newsletter_popup: 'shortly after the cookie banner is dismissed (re-arms on each page)',
  simulated_captcha: 'first page load +1s (once per session, solved via math challenge)',
  server_errors: 'first 2 HTML navigations return 503 (fail_first_n, bounded backoff retries)',
  slow_responses: 'every SPA navigation delayed ~2s (classified slow, recovered in place)',
  unexpected_redirect: 'every intended navigation detours to /promo (recovered via noredirect=1)',
  dom_drift: 'session-wide alternate DOM variant (fallback selector chains resolve it)',
  blocked_clicks: 'catalog "Load more" clicks intercepted by a re-arming overlay (removed + click verified)',
  rate_limiting: 'first HTML navigation returns 429 with Retry-After (backoff + reload)',
  session_expiry: '4th HTML navigation returns interstitial (Continue restores session)',
};

export function loadDemoConfig() {
  return JSON.parse(readFileSync(DEMO_CONFIG_PATH, 'utf8'));
}

// Pure validation: the demo config must be deterministic (random_mode=false) and
// force all ten scenarios on, so a single run is guaranteed to exercise every
// scenario without relying on probability or a seed. Returns an array of issue
// strings (empty = valid).
export function validateDemoConfig(config) {
  const issues = [];
  if (!config) {
    issues.push('demo config is missing');
    return issues;
  }
  if (config.enabled !== true) issues.push('demo config must have enabled=true');
  if (config.random_mode !== false) issues.push('demo config must have random_mode=false (deterministic)');
  if (typeof config.seed !== 'number') issues.push('demo config must fix a numeric seed');

  const scenarios = config.scenarios ?? {};
  for (const name of DEMO_SCENARIOS) {
    const sc = scenarios[name];
    if (!sc || sc.enabled !== true) {
      issues.push(`scenario "${name}" must be present and enabled`);
    }
  }
  return issues;
}
