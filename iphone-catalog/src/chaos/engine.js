// Chaos Engine — orchestrator (§5, §9)
// In a static React frontend, the engine lives client-side.
// It initializes once, caches activation decisions per "request" (navigation),
// and exposes shouldTrigger() for React components to query.

import { Randomizer } from './randomizer.js';
import { logEvent } from './logger.js';

const SAFETY_CAP_MS = 15000; // §13
const SLOW_RESPONSE_MIN_MS = 2000;
const SLOW_RESPONSE_MAX_MS = 5000;

let _config = null;
let _randomizer = null;
let _decisionCache = null; // per-navigation cache (§10 #5)
let _initialized = false;

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function validateConfig(config) {
  if (!config || typeof config !== 'object') return null;

  const validated = {
    enabled: !!config.enabled,
    random_mode: !!config.random_mode,
    seed: typeof config.seed === 'number' ? config.seed : 42,
    scenarios: {},
  };

  if (!config.scenarios || typeof config.scenarios !== 'object') return validated;

  for (const [name, scenario] of Object.entries(config.scenarios)) {
    const v = {
      enabled: !!scenario.enabled,
      probability: clamp(typeof scenario.probability === 'number' ? scenario.probability : 0.5, 0, 1),
    };

    if (scenario.min_delay_seconds != null) v.min_delay_seconds = Math.max(0, scenario.min_delay_seconds);
    if (scenario.max_delay_seconds != null) v.max_delay_seconds = Math.max(0, scenario.max_delay_seconds);
    if (scenario.min_delay_ms != null) v.min_delay_ms = Math.max(0, scenario.min_delay_ms);
    if (scenario.max_delay_ms != null) {
      v.max_delay_ms = clamp(Math.max(0, scenario.max_delay_ms), 0, SAFETY_CAP_MS);
      if (scenario.max_delay_ms > SAFETY_CAP_MS) {
        logEvent({ scenario: name, action: 'validation_warning', result: `max_delay_ms clamped from ${scenario.max_delay_ms} to ${SAFETY_CAP_MS}` });
      }
    }

    // Hard cap for slow_response: delay must be strictly between 2000ms and 5000ms
    if (name === 'slow_response') {
      const origMin = v.min_delay_ms;
      const origMax = v.max_delay_ms;
      v.min_delay_ms = Math.max(SLOW_RESPONSE_MIN_MS, Math.min(SLOW_RESPONSE_MAX_MS, v.min_delay_ms ?? SLOW_RESPONSE_MIN_MS));
      v.max_delay_ms = Math.max(SLOW_RESPONSE_MIN_MS, Math.min(SLOW_RESPONSE_MAX_MS, v.max_delay_ms ?? SLOW_RESPONSE_MAX_MS));
      if (v.min_delay_ms > v.max_delay_ms) v.min_delay_ms = v.max_delay_ms;
      if (origMin !== v.min_delay_ms || origMax !== v.max_delay_ms) {
        logEvent({ scenario: name, action: 'hard_cap_applied', result: `delay clamped to [${SLOW_RESPONSE_MIN_MS}, ${SLOW_RESPONSE_MAX_MS}]ms (was [${origMin}, ${origMax}])` });
      }
    }

    validated.scenarios[name] = v;
  }

  return validated;
}

export function initialize(config) {
  _config = validateConfig(config);
  if (!_config) {
    _initialized = false;
    return;
  }
  _randomizer = new Randomizer(_config.seed);
  _initialized = true;
  _decisionCache = null;
  logEvent({ scenario: 'engine', action: 'initialized', result: `seed=${_config.seed}, enabled=${_config.enabled}` });
}

export function reload(config) {
  _config = validateConfig(config);
  if (!_config) {
    _initialized = false;
    return;
  }
  _randomizer = new Randomizer(_config.seed); // §10 #2: re-create RNG
  _decisionCache = null;
  _initialized = true;
  logEvent({ scenario: 'engine', action: 'reloaded', result: `seed=${_config.seed}` });
}

export function is_enabled() {
  return _initialized && _config?.enabled === true;
}

// Compute activation decisions for the current "request" (navigation)
// Must be called once per navigation, cached after that (§10 #5)
function computeDecisions() {
  if (_decisionCache) return _decisionCache;

  const decisions = {};
  const scenarios = _config?.scenarios || {};

  // Fixed iteration order (§10 #4): use Object.keys insertion order from chaos.json
  const orderedNames = Object.keys(scenarios);

  for (const name of orderedNames) {
    const s = scenarios[name];
    if (!s.enabled) {
      decisions[name] = { active: false };
      continue;
    }

    if (!_config.random_mode) {
      // §7: random_mode=false → every enabled scenario activates, no RNG touched (§10 #3)
      decisions[name] = { active: true };
      continue;
    }

    // §10 #4: exactly one draw per enabled scenario
    const roll = _randomizer.next();
    const active = roll < s.probability;

    const decision = { active, roll };

    // Pre-draw delay values for scenarios that need them
    if (active) {
      if (s.min_delay_seconds != null && s.max_delay_seconds != null) {
        decision.delay_seconds = _randomizer.floatInRange(s.min_delay_seconds, s.max_delay_seconds);
      }
      if (s.min_delay_ms != null && s.max_delay_ms != null) {
        decision.delay_ms = _randomizer.intInRange(s.min_delay_ms, Math.min(s.max_delay_ms, SAFETY_CAP_MS));
      }
    }

    decisions[name] = decision;
  }

  _decisionCache = decisions;
  return decisions;
}

// §9: should_trigger — idempotent within same navigation
export function should_trigger(name) {
  if (!is_enabled()) return false;
  const decisions = computeDecisions();
  return decisions[name]?.active === true;
}

export function get_configuration(name) {
  return _config?.scenarios?.[name] || null;
}

export function get_decision(name) {
  const decisions = computeDecisions();
  return decisions[name] || null;
}

// §10 #2: reset decisions on navigation change
export function resetDecisionCache() {
  _decisionCache = null;
}

export function getConfig() {
  return _config;
}
