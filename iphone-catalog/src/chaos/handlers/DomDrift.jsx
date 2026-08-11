// DOM Drift handler — POST_RESPONSE hook type (§11)
// Injects alternative DOM structures to simulate selector drift.
//
// When the `dom_drift` scenario is triggered, the variant switches to a
// deterministic non-primary variant ('alt1' or 'alt2'). The variant is stored
// in sessionStorage so it stays consistent across SPA navigations within a
// session. ChaosProvider applies the variant to document.body BEFORE page
// components read it, so the alternate DOM is in place on the very first render.

const SESSION_KEY = 'chaos_dom_drift_variant';

// Choose and persist a non-primary variant. Deterministic per session: the first
// call fixes the variant, later calls return the same value.
export function getDomDriftVariant() {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored === 'alt1' || stored === 'alt2') return stored;
  } catch { /* storage unavailable */ }
  const variant = 'alt1';
  try {
    sessionStorage.setItem(SESSION_KEY, variant);
  } catch { /* storage unavailable */ }
  return variant;
}

// Read the active variant for page components. Returns 'primary' when no drift
// is active (or when the data attribute has not been set yet).
export function getCurrentDomDriftVariant() {
  if (typeof document === 'undefined') return 'primary';
  return document.body?.dataset?.chaosDomDrift || 'primary';
}

// Marker component. The actual variant application happens in ChaosProvider so
// the variant is set before any page component reads it.
export function DomDrift() {
  return null;
}
