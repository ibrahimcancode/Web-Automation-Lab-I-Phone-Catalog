// Core workflow orchestration.
//
// Happy path (chaos off) and the per-step obstacle sweep. Overlay handlers are
// registered in bot/handlers/* and discovered through the registry, so this
// module stays stable as handlers are added.
//
// Discipline: no fixed sleep() for timing. The only programmatic delay is the
// bounded retry backoff used by the navigation guard. Everything else is an
// explicit Playwright wait.

import { selectors } from './selectors.js';
import { getOverlayHandlers, getNavigationHandlers, ensureHandlersLoaded } from './handlers/index.js';
import { buildSummary, writeResults, writeRunSummary } from './reporting.js';
import { maxRetries, nextRetryDelayMs } from './backoff.js';

const MAX_SWEEP_PASSES = 5;
// Bounded wait (first page of a run) for a scheduled overlay such as the
// newsletter popup, which appears after a 2-6s delay.
const FIRST_ACTION_OBSTACLE_WAIT_MS = 8000;
// Short wait used on every other page load so fast overlays (cookie banner
// ~100ms, captcha ~1s) are caught without stalling the run.
const SHORT_OBSTACLE_WAIT_MS = 1500;

// Selector matching ANY overlay dialog, used to wait for a scheduled overlay.
const ANY_OVERLAY =
  '#cookie-banner, #newsletter-popup, #simulated-captcha-overlay';

function sleepMs(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Optional human-visible pacing for the `--headed` watch demo (BOT_DEMO_PAUSE_MS
// env var). Defaults to 0 = no pause, so normal runs are unaffected. It is a
// demo aid only, never used for correctness — production timing is explicit
// waits, per the MASTER_SPEC discipline.
const DEMO_PAUSE_MS = Number(process.env.BOT_DEMO_PAUSE_MS || 0);
function demoPause() {
  if (DEMO_PAUSE_MS > 0) return sleepMs(DEMO_PAUSE_MS);
  return Promise.resolve();
}

async function isVisible(page, selector) {
  if (!selector) return false;
  try {
    return await page.isVisible(selector);
  } catch {
    return false;
  }
}

// Wait up to `timeoutMs` for ANY overlay to appear; returns immediately when
// one does. Non-fatal if nothing ever appears.
async function waitForPossibleOverlay(page, timeoutMs) {
  try {
    await page.waitForSelector(ANY_OVERLAY, { state: 'visible', timeout: timeoutMs });
  } catch {
    /* no overlay appeared within the window */
  }
}

// Run a single sweep pass over all overlay handlers; returns true if any
// handler detected and recovered a disruption.
async function sweepPass(ctx, reporter) {
  let acted = false;
  for (const handler of getOverlayHandlers()) {
    let detected = false;
    try {
      detected = await handler.detect(ctx);
    } catch (err) {
      reporter.event({ scenario: handler.name, action: 'detect_error', outcome: 'error', detail: String(err) });
      continue;
    }
    if (!detected) continue;

    acted = true;
    reporter.event({ scenario: handler.name, action: 'detected', outcome: 'detected', step: ctx.step, item_id: ctx.itemId });
    await reporter.screenshot(ctx.page, `${handler.name}-detected`);
    console.log(`[bot] detected: ${handler.name} (step ${ctx.step})`);

    let rec = {};
    try {
      rec = (await handler.recover(ctx)) ?? {};
    } catch (err) {
      rec = { outcome: 'error', detail: String(err) };
    }
    reporter.event({
      scenario: handler.name,
      action: 'recovered',
      outcome: rec.outcome ?? 'resolved',
      detail: rec.detail ?? null,
      step: ctx.step,
      item_id: ctx.itemId,
    });
    console.log(`[bot] recovered: ${handler.name} -> ${rec.outcome ?? 'resolved'} ${rec.detail ? `(${rec.detail})` : ''}`);
    await demoPause();
  }
  return acted;
}

// Sweep overlays until none remain (bounded). `waitMs` lets the caller spend a
// bounded window on the first page of a run so a delayed popup is caught.
export async function clearObstacles(ctx, reporter, { waitMs = 0 } = {}) {
  await ensureHandlersLoaded();
  if (waitMs > 0) {
    await waitForPossibleOverlay(ctx.page, waitMs);
  } else {
    // Quick non-blocking check so fast overlays are still caught.
    await waitForPossibleOverlay(ctx.page, SHORT_OBSTACLE_WAIT_MS);
  }

  let passes = 0;
  let acted = true;
  while (acted && passes < MAX_SWEEP_PASSES) {
    acted = await sweepPass(ctx, reporter);
    passes += 1;
  }
  if (acted) {
    throw new Error(`Obstacle sweep did not clear after ${MAX_SWEEP_PASSES} passes`);
  }
  return passes;
}

// Cheap, non-blocking overlay re-check: runs each overlay handler's detect and
// only invokes a full sweep when something is actually present.
async function quickSweep(ctx, reporter) {
  let present = false;
  for (const handler of getOverlayHandlers()) {
    if (await handler.detect(ctx).catch(() => false)) {
      present = true;
      break;
    }
  }
  if (present) {
    await clearObstacles(ctx, reporter);
  }
}

// Overlay-aware click for interactive steps. An overlay (e.g. the newsletter
// popup, which arms ~3s after the cookie banner is dismissed) can appear during
// the click's actionability wait and intercept pointer events. On a click
// failure, re-sweep cheaply and retry, bounded — so a genuine non-overlay
// failure still throws rather than looping forever.
async function clickThroughObstacles(ctx, reporter, selector, { attempts = 4, timeoutMs = 5000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await ctx.page.click(selector, { timeout: timeoutMs });
      return;
    } catch (err) {
      await quickSweep(ctx, reporter);
    }
  }
  // Final attempt propagates a genuine failure.
  await ctx.page.click(selector, { timeout: timeoutMs });
}

// Navigate to a URL with the navigation guard: registered navigation handlers
// (e.g. server_error_handler) get the chance to detect a 5xx/network failure
// and retry with backoff before the workflow proceeds.
export async function navigateWithGuard(page, url, ctx, reporter) {
  await ensureHandlersLoaded();
  const navHandlers = getNavigationHandlers();
  const cap = navHandlers.length > 0 ? maxRetries() : 0;
  let attempt = 0;

  while (true) {
    attempt += 1;
    let response = null;
    let error = null;
    const navigationStartedAt = Date.now();
    try {
      response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch (err) {
      error = err;
    }
    // Observed duration of the navigation, used by duration-based handlers
    // (slow_responses) to classify "slow but loaded" vs. "dead".
    const navigationMs = Date.now() - navigationStartedAt;

    if (navHandlers.length === 0) {
      if (error) throw error;
      return response;
    }

    let decision = null;
    let matchedName = null;
    for (const handler of navHandlers) {
let detected = false;
    try {
      detected = await handler.detect({ page, response, error, attempt, navigationMs, url });
    } catch {
      detected = false;
    }
      if (!detected) continue;
      decision = await handler.recover({ page, response, error, attempt, url, navigationMs });
      matchedName = handler.name;
      break;
    }

    // No handler claimed this state.
    if (decision === null) {
      if (error) throw error;
      return response;
    }

    // A navigation handler claimed this state — record it as detected so the
    // run summary reflects the disruption, not just the retry.
    reporter.event({
      scenario: matchedName,
      action: 'detected',
      outcome: 'detected',
      step: ctx?.step,
      url,
    });

    if (!decision.retry) {
      // Non-retry claim (e.g. slow but loaded): surface the recovery and keep
      // the already-present response — no navigation is repeated.
      await reporter.screenshot(page, `${matchedName}-detected`);
      reporter.event({
        scenario: matchedName,
        action: 'recovered',
        outcome: decision.outcome ?? 'resolved',
        detail: decision.detail ?? null,
        step: ctx?.step,
        url,
      });
      return response;
    }

    const waitMs = decision.waitMs ?? nextRetryDelayMs(attempt);
    reporter.event({ scenario: 'server_errors', action: 'retry', outcome: 'retrying', detail: `attempt ${attempt}/${cap}`, url });
    await reporter.screenshot(page, 'server-error');
    if (attempt >= cap) {
      throw new Error(`Navigation to ${url} failed after ${attempt} attempt(s)`);
    }
    await sleepMs(waitMs);
  }
}

async function waitForPageReady(page, pageSelector) {
  await page.waitForSelector(pageSelector, { state: 'visible' });
}

// Extract detail fields for one item from its detail page.
async function extractDetail(page, id) {
  const text = async (selector) => {
    try {
      return (await page.textContent(selector)).trim();
    } catch {
      return '';
    }
  };

  const name = await text(selectors.detail.title);
  const tier = await text(selectors.detail.tier);
  const yearText = await text(selectors.detail.year);
  const priceText = await text(selectors.detail.priceValue);
  const color = await text(selectors.detail.colorLabel);
  const storageTexts = await page.$$eval(selectors.detail.storageOptions, (els) =>
    els.map((e) => e.textContent.trim()),
  );
  const storageGBs = storageTexts
    .map((t) => t.replace(/[^0-9]/g, ''))
    .filter(Boolean)
    .map(Number);

  return {
    name,
    tier,
    year: Number(yearText) || null,
    price: Number(String(priceText).replace(/[^0-9.]/g, '')) || null,
    color,
    storageGBs,
  };
}

// Visit one item's detail page and extract its data, recovering from any
// overlay that appears mid-workflow via a bounded re-sweep + retry.
async function processItem({ page, baseUrl, href, catalogName, reporter, index }) {
  const id = href.split('/model/')[1]?.replace(/\/.*$/, '') ?? href;
  const ctx = { page, step: `detail-${index}`, itemId: id };

  reporter.event({ scenario: 'workflow', action: 'visit_detail', outcome: 'started', item_id: id, url: href, step: ctx.step });
  console.log(`[bot] visiting detail: ${id}`);

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await navigateWithGuard(page, href, ctx, reporter);
      await waitForPageReady(page, selectors.detail.page);
      await clearObstacles(ctx, reporter);
      const data = await extractDetail(page, id);

      const item = {
        id,
        name: data.name,
        tier: data.tier,
        year: data.year,
        price: data.price,
        color: data.color,
        storageGBs: data.storageGBs,
        url: href,
        catalogName,
        nameMatchesCatalog: catalogName ? data.name === catalogName : null,
        status: 'ok',
      };
      reporter.event({ scenario: 'workflow', action: 'extracted', outcome: 'ok', item_id: id, step: ctx.step });
      console.log(`[bot] extracted ${id}: ${data.name} @ $${data.price}`);
      return item;
    } catch (err) {
      lastError = err;
      // An overlay may have appeared mid-extraction; re-sweep and retry once.
      if (attempt === 1) {
        await clearObstacles(ctx, reporter);
        continue;
      }
    }
  }

  reporter.event({ scenario: 'workflow', action: 'extract_failed', outcome: 'failed', item_id: id, detail: String(lastError), step: ctx.step });
  await reporter.screenshot(page, `extract-failed-${id}`);
  return {
    id,
    name: null,
    tier: null,
    year: null,
    price: null,
    color: null,
    storageGBs: [],
    url: href,
    catalogName,
    nameMatchesCatalog: null,
    status: 'failed',
    error: String(lastError),
  };
}

// Full workflow orchestration. Returns { results, summary }.
export async function runWorkflow({ session, reporter, limit = null, startedAt }) {
  await ensureHandlersLoaded();
  const { page, baseUrl } = session;

  // Step 1 — home page (first action: spend a bounded window for a delayed popup).
  const homeCtx = { page, step: 'home' };
  await navigateWithGuard(page, `${baseUrl}/`, homeCtx, reporter);
  await waitForPageReady(page, '.page-home');
  await clearObstacles(homeCtx, reporter, { waitMs: FIRST_ACTION_OBSTACLE_WAIT_MS });
  reporter.event({ scenario: 'workflow', action: 'visited_home', outcome: 'ok' });
  console.log('[bot] home page ready');
  await demoPause();

  // Step 2 — catalog page.
  const catalogCtx = { page, step: 'catalog' };
  await navigateWithGuard(page, `${baseUrl}/catalog`, catalogCtx, reporter);
  await waitForPageReady(page, selectors.catalog.page);
  await clearObstacles(catalogCtx, reporter);
  reporter.event({ scenario: 'workflow', action: 'visited_catalog', outcome: 'ok' });
  console.log('[bot] catalog page ready');
  await demoPause();

  // Step 3 — reveal all items via "Load more".
  let prevCount = await page.$$eval(selectors.catalog.card, (els) => els.length);
  while (await isVisible(page, selectors.catalog.loadMore)) {
    // A delayed overlay (e.g. the newsletter popup, which arms ~3s after the
    // cookie banner is dismissed) can land mid-flow and intercept the click —
    // click through any such overlay, bounded. Never a fixed sleep.
    await clickThroughObstacles(catalogCtx, reporter, selectors.catalog.loadMore);
    await page.waitForFunction(
      (prev) => document.querySelectorAll('.catalog-grid .product-card').length > prev,
      prevCount,
    );
    prevCount = await page.$$eval(selectors.catalog.card, (els) => els.length);
    reporter.event({ scenario: 'workflow', action: 'load_more', outcome: 'ok', detail: `cards=${prevCount}` });
  }
  const cardCount = await page.$$eval(selectors.catalog.card, (els) => els.length);
  reporter.event({ scenario: 'workflow', action: 'catalog_loaded', outcome: 'ok', detail: `cards=${cardCount}` });

  // Step 4 — collect card links + names.
  const cards = await page.$$eval(`${selectors.catalog.cardLink}`, (els) =>
    els.map((a) => ({ href: a.getAttribute('href') })),
  );
  const names = await page.$$eval(selectors.catalog.cardName, (els) => els.map((e) => e.textContent.trim()));
  const cardMap = new Map();
  cards.forEach((c, i) => {
    const href = c.href.startsWith('http') ? c.href : `${baseUrl}${c.href}`;
    if (!cardMap.has(href)) cardMap.set(href, names[i] ?? null);
  });
  const links = [...cardMap.keys()];
  const limitedLinks = limit ? links.slice(0, limit) : links;

  // Step 5 — visit each detail page.
  const results = [];
  for (let i = 0; i < limitedLinks.length; i += 1) {
    const href = limitedLinks[i];
    const item = await processItem({ page, baseUrl, href, catalogName: cardMap.get(href), reporter, index: i + 1 });
    results.push(item);
  }

  // Step 6 — summary.
  const endedAt = new Date();
  const summary = buildSummary({
    events: reporter.events,
    results,
    runMeta: { run_id: reporter.runId },
    config: {
      baseUrl,
      limit,
      startedAt,
      endedAt,
      durationMs: endedAt.getTime() - startedAt.getTime(),
      screenshots: reporter.screenshotCount,
    },
  });

  await writeResults(reporter.runDir, results);
  await writeRunSummary(reporter.runDir, summary);

  return { results, summary };
}