// Single place that launches Chromium and creates a fresh context per run.
// A fresh context = fresh sessionStorage/localStorage, so the cookie banner and
// captcha "once per session" rules fire exactly as they do for a new visitor.

import { chromium } from 'playwright';

export const DEFAULT_BASE_URL = 'http://localhost:5173';
export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Start a Playwright trace on the given context.
 * Writes a .zip trace to `tracePath` when stopTrace() is called.
 */
export async function startTrace(session, tracePath) {
  if (!session?.context || !tracePath) return null;
  try {
    await session.context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: false,
    });
    return tracePath;
  } catch {
    return null;
  }
}

/**
 * Stop the trace and save it to disk. Safe to call multiple times.
 */
export async function stopTrace(session, tracePath) {
  if (!session?.context || !tracePath) return;
  try {
    await session.context.tracing.stop({ path: tracePath });
  } catch {
    /* ignore — trace may not have been started */
  }
}

export async function createSession({ headless = true, baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);

  return {
    browser,
    context,
    page,
    baseUrl: baseUrl ?? DEFAULT_BASE_URL,
  };
}

export async function closeSession(session) {
  if (!session) return;
  try {
    await session.context.close();
  } catch {
    /* ignore */
  }
  try {
    await session.browser.close();
  } catch {
    /* ignore */
  }
}
