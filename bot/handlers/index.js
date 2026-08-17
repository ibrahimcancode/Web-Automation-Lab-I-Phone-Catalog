// Handler registry.
//
// Each scenario handler exposes the same shape:
//   {
//     name: 'cookie_banner',
//     type: 'overlay' | 'navigation',
//     priority: number,          // lower runs first within the obstacle sweep
//     detect(ctx),               // returns true when the disruption is present
//     recover(ctx),              // performs the recovery, returns { outcome, detail }
//   }
//
// The obstacle sweep (workflow.js) iterates overlay handlers by priority and
// calls detect/recover until none are present. The navigation guard calls
// navigation-type handlers after a page load with the response/error.
//
// Handlers register themselves by importing this module and calling
// registerHandler(). Because that is a circular import, registration is done
// lazily via ensureHandlersLoaded() (dynamic imports) to avoid TDZ issues, and
// every workflow entry point awaits it before touching the registry.
//
// Adding a handler in Week 3 = create the module + add it to the loader here.
// Nothing else in run.js/workflow.js needs to change.

const registry = [];

let handlersLoaded = false;

export async function ensureHandlersLoaded() {
  if (handlersLoaded) return;
  await import('./cookie_banner_handler.js');
  await import('./popup_handler.js');
  await import('./captcha_handler.js');
  await import('./server_error_handler.js');
  await import('./slow_response_handler.js');
  await import('./redirect_handler.js');
  await import('./dom_drift_handler.js');
  await import('./blocked_clicks_handler.js');
  await import('./rate_limit_handler.js');
  await import('./session_expiry_handler.js');
  handlersLoaded = true;
}

export function registerHandler(handler) {
  if (!handler || !handler.name || typeof handler.detect !== 'function' || typeof handler.recover !== 'function') {
    throw new Error(`Invalid handler registration: ${JSON.stringify(handler?.name)}`);
  }
  if (!registry.some((h) => h.name === handler.name)) {
    registry.push(handler);
  }
  return handler;
}

export function getOverlayHandlers() {
  return registry
    .filter((h) => h.type === 'overlay')
    .sort((a, b) => a.priority - b.priority);
}

export function getNavigationHandlers() {
  return registry
    .filter((h) => h.type === 'navigation')
    .sort((a, b) => a.priority - b.priority);
}

export function getHandlers() {
  return [...registry];
}

export { registry };