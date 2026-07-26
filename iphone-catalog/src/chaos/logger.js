// Structured event logging — JSON Lines format (§14)

const LOG_KEY = 'chaos_log';

function timestamp() {
  return new Date().toISOString();
}

function appendToStorage(entry) {
  try {
    const existing = JSON.parse(sessionStorage.getItem(LOG_KEY) || '[]');
    existing.push(entry);
    sessionStorage.setItem(LOG_KEY, JSON.stringify(existing));
  } catch { /* storage full or unavailable */ }
}

export function logEvent({ scenario, action, duration_ms = null, result, request_path = window.location.pathname }) {
  const entry = {
    timestamp: timestamp(),
    scenario,
    action,
    duration_ms,
    result,
    request_path,
  };

  // Console output in development
  if (import.meta.env.DEV) {
    console.log(`[CHAOS] ${scenario} ${action} (result=${result}${duration_ms != null ? `, delay_ms=${duration_ms}` : ''})`);
  }

  appendToStorage(entry);
  return entry;
}

export function getLog() {
  try {
    return JSON.parse(sessionStorage.getItem(LOG_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearLog() {
  sessionStorage.removeItem(LOG_KEY);
}
