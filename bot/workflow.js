// Core workflow orchestration.
//
// Happy path (chaos off) and the per-step obstacle sweep. Overlay handlers are
// registered in bot/handlers/* and discovered through the registry, so this
// module stays stable as handlers are added.
//
// Discipline: no fixed sleep() for timing. The only programmatic delay is the
// bounded retry backoff used by the navigation guard. Everything else is an
// explicit Playwright wait.

import { getSelectorChain, waitForSelectorChain } from './selectors.js';
import { getOverlayHandlers, getNavigationHandlers, ensureHandlersLoaded } from './handlers/index.js';
import { buildSummary, writeResults, writeRunSummary, writeTrace } from './reporting.js';
import { maxRetries, nextRetryDelayMs } from './backoff.js';
import { startTrace, stopTrace } from './browser.js';
import {
  writeCheckpoint,
  observeItem,
  completeItem,
  failItem,
  setPhase,
  finalizeCheckpoint,
  getCompletedIds,
} from './checkpoint.js';

const MAX_SWEEP_PASSES = 5;
// Bounded wait (first page of a run) for a scheduled overlay such as the
// newsletter popup, which appears after a 2-6s delay.
const FIRST_ACTION_OBSTACLE_WAIT_MS = 8000;
// Short wait used on every other page load so fast overlays (cookie banner
// ~100ms, captcha ~1s) are caught without stalling the run.
const SHORT_OBSTACLE_WAIT_MS = 1500;

// Selector matching ANY overlay dialog, used to wait for a scheduled overlay.
const ANY_OVERLAY = '#cookie-banner, #newsletter-popup, #simulated-captcha-overlay';

function sleepMs(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Optional human-visible pacing for the `--headed` watch demo (BOT_DEMO_PAUSE_MS
// env var). Defaults to 0 = no pause, so normal runs (and tests, which run
// headless with the var unset) are unaffected. Read lazily at call time so the
// value is honored whether it is exported into the environment before launch or
// set later by scripts/demo-all.js (--watch), never for correctness.
function demoPause() {
  const ms = Number(process.env.BOT_DEMO_PAUSE_MS || 0);
  if (ms > 0) return sleepMs(ms);
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
  const handlerCtx = { ...ctx, reporter };
  for (const handler of getOverlayHandlers()) {
    let detected = false;
    try {
      detected = await handler.detect(handlerCtx);
    } catch (_err) {
      reporter.event({ scenario: handler.name, action: 'detect_error', outcome: 'error', detail: String(_err) });
      continue;
    }
    if (!detected) continue;

    acted = true;
    reporter.event({
      scenario: handler.name,
      action: 'detected',
      outcome: 'detected',
      step: ctx.step,
      item_id: ctx.itemId,
    });
    await reporter.screenshot(ctx.page, `${handler.name}-detected`);
    console.log(`[bot] detected: ${handler.name} (step ${ctx.step})`);

    let rec = {};
    try {
      rec = (await handler.recover(handlerCtx)) ?? {};
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
    console.log(
      `[bot] recovered: ${handler.name} -> ${rec.outcome ?? 'resolved'} ${rec.detail ? `(${rec.detail})` : ''}`,
    );
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
    } catch (_err) {
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
  // Navigation handlers that requested a retry. Persists across attempts so
  // that when a retried navigation finally succeeds the recovery is recorded
  // as `resolved` (the disruption was detected AND recovered), not just
  // counted as a retry. Uses a Map keyed by handler name so duplicates from
  // the same handler are deduplicated while preserving handler references.
  const retriedHandlers = new Map();

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
      reporter.event({
        scenario: 'workflow',
        action: 'navigated',
        outcome: 'ok',
        duration_ms: navigationMs,
        url,
      });
      return response;
    }

    let claimed = null;
    let retryWaitMs = null;
    for (const handler of navHandlers) {
      let detected = false;
      try {
        detected = await handler.detect({ page, response, error, attempt, navigationMs, url });
      } catch {
        detected = false;
      }
      if (!detected) continue;

      let decision;
      try {
        decision = await handler.recover({ page, response, error, attempt, url, navigationMs, reporter });
      } catch (err) {
        decision = { outcome: 'error', detail: String(err) };
      }

      // A navigation handler claimed this state — record it as detected so the
      // run summary reflects the disruption, not just the retry.
      reporter.event({
        scenario: handler.name,
        action: 'detected',
        outcome: 'detected',
        step: ctx?.step,
        url,
      });
      await reporter.screenshot(page, `${handler.name}-detected`);

      if (decision.retry) {
        retryWaitMs = decision.waitMs ?? nextRetryDelayMs(attempt);
        retriedHandlers.set(handler.name, handler);
        reporter.event({
          scenario: handler.name,
          action: 'retry',
          outcome: 'retrying',
          detail: `attempt ${attempt}/${cap}`,
          url,
        });
        if (attempt >= cap) {
          throw new Error(`Navigation to ${url} failed after ${attempt} attempt(s)`);
        }
        break;
      }

      // Non-retry claim (e.g. slow but loaded): surface the recovery, but keep
      // checking the remaining navigation handlers so a disruption that appears
      // after a slow load (e.g. a late client-side redirect) is still caught.
      claimed = claimed ?? { name: handler.name, decision };
      reporter.event({
        scenario: handler.name,
        action: 'recovered',
        outcome: decision.outcome ?? 'resolved',
        detail: decision.detail ?? null,
        step: ctx?.step,
        url,
      });
    }

    if (retryWaitMs !== null) {
      await sleepMs(retryWaitMs);
      continue;
    }

    // No retry needed. If a handler claimed a non-retry state the recovery was
    // already surfaced; otherwise surface the raw error/navigation result.
    if (!claimed && error) throw error;

    // Previously retried navigation(s) now succeeded — record recovery for each
    // so the summary counts every disruption as detected AND resolved.
    for (const [, handler] of retriedHandlers) {
      reporter.event({
        scenario: handler.name,
        action: 'recovered',
        outcome: 'resolved',
        detail: `navigation succeeded after ${attempt} attempt(s)`,
        step: ctx?.step,
        url,
      });
    }
    retriedHandlers.clear();
    reporter.event({
      scenario: 'workflow',
      action: 'navigated',
      outcome: 'ok',
      duration_ms: navigationMs,
      url,
    });
    return response;
  }
}

// Log a selector-chain fallback (Scenario 7 DOM drift). Records the logical
// element, the failed primary selector(s), and the successful fallback selector.
// This runs in Node context — only the resolved selector strings are logged.
function logFallback(reporter, key, failed, matched, step = null) {
  if (!reporter) return;
  reporter.event({
    scenario: 'dom_drift',
    action: 'fallback_used',
    outcome: 'resolved',
    detail: `${key}: primary(s) [${failed.join(', ')}] failed → fallback [${matched}]`,
    step,
  });
}

async function waitForPageReady(page, pageSelectorKey, reporter) {
  // Bounded headroom beyond the 3s default so handled slow responses
  // (scenario delay up to 4000ms) don't trip the page-ready gate.
  await waitForSelectorChain(page, pageSelectorKey, { state: 'visible', timeout: 10000 }, (key, failed, matched) => {
    logFallback(reporter, key, failed, matched, pageSelectorKey);
  });
}

// Extract detail fields for one item from its detail page.
async function extractDetail(page, id, reporter) {
  // Bounded wait per chain attempt. Under DOM drift the primary selector does
  // not exist and textContent's 30s default would stall each extraction.
  const ATTEMPT_MS = 3000;
  const text = async (selectorKey) => {
    const chain = getSelectorChain(selectorKey);
    for (let i = 0; i < chain.length; i += 1) {
      try {
        const val = (await page.textContent(chain[i], { timeout: ATTEMPT_MS })).trim();
        if (i > 0) logFallback(reporter, selectorKey, chain.slice(0, i), chain[i]);
        return val;
      } catch {
        // try next selector in the chain
      }
    }
    return '';
  };

  // Run the text extractions in parallel so the per-attempt timeout is paid
  // once, not once per field (5 × 3s would stall every detail page under drift).
  const [name, tier, yearText, priceText, color, storageTexts] = await Promise.all([
    text('detail.title'),
    text('detail.tier'),
    text('detail.year'),
    text('detail.priceValue'),
    text('detail.colorLabel'),
    page.$$eval(getSelectorChain('detail.storageOptions').join(','), (els) => els.map((e) => e.textContent.trim())),
  ]);
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
async function processItem({ page, href, catalogName, reporter, index }) {
  const id = href.split('/model/')[1]?.replace(/\/.*$/, '') ?? href;
  const ctx = { page, step: `detail-${index}`, itemId: id };

  reporter.event({
    scenario: 'workflow',
    action: 'visit_detail',
    outcome: 'started',
    item_id: id,
    url: href,
    step: ctx.step,
  });
  console.log(`[bot] visiting detail: ${id}`);

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await navigateWithGuard(page, href, ctx, reporter);
      await waitForPageReady(page, 'detail.page', reporter);
      await clearObstacles(ctx, reporter);
      const data = await extractDetail(page, id, reporter);

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

  reporter.event({
    scenario: 'workflow',
    action: 'extract_failed',
    outcome: 'failed',
    item_id: id,
    detail: String(lastError),
    step: ctx.step,
  });
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

// Scenario 8: click a button, then VERIFY the click actually took effect by
// waiting (bounded) for the observable state change. A blocked click — a
// transparent overlay swallowing pointer events (the sandbox re-mounts it after
// dismissal) — leaves state unchanged, so sweep the blocker and retry, bounded.
// Never a fixed sleep.
async function clickLoadMoreAndVerify({ page, ctx, reporter, loadMoreSelector, cardSelector, prevCount }) {
  const VERIFY_TIMEOUT_MS = 8000;
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await clickThroughObstacles(ctx, reporter, loadMoreSelector);
    try {
      await page.waitForFunction(
        (args) => document.querySelectorAll(args.selector).length > args.prev,
        { selector: cardSelector, prev: prevCount },
        { timeout: VERIFY_TIMEOUT_MS },
      );
      return true;
    } catch {
      // The click did not take effect — a blocker intercepted it (Scenario 8)
      // or a re-armed blocker reappeared mid-flow. Remove it and retry.
      await quickSweep(ctx, reporter);
      reporter.event({
        scenario: 'blocked_clicks',
        action: 'verify_retry',
        outcome: 'retrying',
        detail: `attempt ${attempt}/${MAX_ATTEMPTS}`,
        step: ctx.step,
      });
    }
  }
  reporter.event({
    scenario: 'blocked_clicks',
    action: 'verify_failed',
    outcome: 'failed',
    detail: `card count did not grow after ${MAX_ATTEMPTS} attempts`,
    step: ctx.step,
  });
  await reporter.screenshot(page, 'blocked-clicks-unresolved');
  return false;
}

// Full workflow orchestration. Returns { results, summary }.
export async function runWorkflow({ session, reporter, limit = null, startedAt, checkpoint = null, runDir = null }) {
  await ensureHandlersLoaded();
  const { page, baseUrl } = session;

  // Start Playwright trace if runDir is available
  const tracePath = runDir ? `${runDir}/trace.zip` : null;
  await startTrace(session, tracePath);

  // Track completed items for resume support
  const completedIds = getCompletedIds(checkpoint);
  const isResumed = completedIds.size > 0;

  const results = [];
  let summary = null;
  let fatalErr = null;

  try {
    // Step 1 — home page (first action: spend a bounded window for a delayed popup).
    const homeCtx = { page, step: 'home' };
    if (checkpoint && runDir) {
      checkpoint = setPhase(checkpoint, 'home', 'navigating_home');
      await writeCheckpoint(runDir, checkpoint);
    }
    await navigateWithGuard(page, `${baseUrl}/`, homeCtx, reporter);
    await waitForPageReady(page, 'home.page', reporter);
    await clearObstacles(homeCtx, reporter, { waitMs: FIRST_ACTION_OBSTACLE_WAIT_MS });
    reporter.event({ scenario: 'workflow', action: 'visited_home', outcome: 'ok' });
    console.log('[bot] home page ready');
    await demoPause();

    // Step 2 — catalog page.
    const catalogCtx = { page, step: 'catalog' };
    if (checkpoint && runDir) {
      checkpoint = setPhase(checkpoint, 'catalog', 'navigating_catalog');
      await writeCheckpoint(runDir, checkpoint);
    }
    await navigateWithGuard(page, `${baseUrl}/catalog`, catalogCtx, reporter);
    await waitForPageReady(page, 'catalog.page', reporter);
    await clearObstacles(catalogCtx, reporter);
    reporter.event({ scenario: 'workflow', action: 'visited_catalog', outcome: 'ok' });
    console.log('[bot] catalog page ready');
    await demoPause();

    // Step 3 — reveal all items via "Load more".
    const cardSelector = getSelectorChain('catalog.card').join(',');
    const loadMoreSelector = getSelectorChain('catalog.loadMore').join(',');
    let prevCount = await page.$$eval(cardSelector, (els) => els.length);
    while (await isVisible(page, loadMoreSelector)) {
      const grew = await clickLoadMoreAndVerify({
        page,
        ctx: catalogCtx,
        reporter,
        loadMoreSelector,
        cardSelector,
        prevCount,
      });
      if (!grew) break;
      prevCount = await page.$$eval(cardSelector, (els) => els.length);
      reporter.event({ scenario: 'workflow', action: 'load_more', outcome: 'ok', detail: `cards=${prevCount}` });
    }
    const cardCount = await page.$$eval(cardSelector, (els) => els.length);
    reporter.event({ scenario: 'workflow', action: 'catalog_loaded', outcome: 'ok', detail: `cards=${cardCount}` });

    // Step 4 — collect card links + names.
    const cardLinkSelector = getSelectorChain('catalog.cardLink').join(',');
    const cardNameSelector = getSelectorChain('catalog.cardName').join(',');
    const cards = await page.$$eval(cardLinkSelector, (els) => els.map((a) => ({ href: a.getAttribute('href') })));
    const names = await page.$$eval(cardNameSelector, (els) => els.map((e) => e.textContent.trim()));
    const cardMap = new Map();
    cards.forEach((c, i) => {
      const href = c.href.startsWith('http') ? c.href : `${baseUrl}${c.href}`;
      if (!cardMap.has(href)) cardMap.set(href, names[i] ?? null);
    });
    const links = [...cardMap.keys()];

    // Observe all items for checkpoint
    if (checkpoint && runDir) {
      for (const href of links) {
        const id = href.split('/model/')[1]?.replace(/\/.*$/, '') ?? href;
        checkpoint = observeItem(checkpoint, id, href);
      }
      checkpoint = setPhase(checkpoint, 'extracting', 'catalog_loaded');
      await writeCheckpoint(runDir, checkpoint);
    }

    // Filter out already-completed items when resuming
    const itemsToProcess = links.filter((href) => {
      const id = href.split('/model/')[1]?.replace(/\/.*$/, '') ?? href;
      return !completedIds.has(id);
    });
    const limitedLinks = limit ? itemsToProcess.slice(0, limit) : itemsToProcess;

    if (isResumed) {
      console.log(`[bot] resume: ${completedIds.size} already done, ${limitedLinks.length} remaining`);
    }

    // Step 5 — visit each detail page.
    for (let i = 0; i < limitedLinks.length; i += 1) {
      const href = limitedLinks[i];
      const item = await processItem({ page, baseUrl, href, catalogName: cardMap.get(href), reporter, index: i + 1 });
      results.push(item);

      // Update checkpoint after each completed item
      if (checkpoint && runDir) {
        if (item.status === 'ok') {
          checkpoint = completeItem(checkpoint, item.id, item);
        } else {
          checkpoint = failItem(checkpoint, item.id, item.error ?? 'unknown', 1);
        }
        await writeCheckpoint(runDir, checkpoint);
      }
      await demoPause();
    }
  } catch (err) {
    fatalErr = err;
    throw err;
  } finally {
    // Record the fatal error event before building the summary so the verdict
    // reflects the failure.
    if (fatalErr) {
      reporter.event({ scenario: 'workflow', action: 'run_failed', outcome: 'error', detail: String(fatalErr) });
    }

    // Step 6 — summary + artifacts. Runs on both success and fatal error so
    // that summary.json, trace.zip, and the checkpoint are always written.
    const endedAt = new Date();
    summary = buildSummary({
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
        resumed: isResumed,
        resumed_from: checkpoint?.resumed_from ?? null,
      },
    });

    await writeResults(reporter.runDir, results);
    await writeRunSummary(reporter.runDir, summary);
    await writeTrace(reporter.runDir, reporter.events);

    // Stop Playwright trace and save to run directory
    await stopTrace(session, tracePath);

    // Finalize checkpoint
    if (checkpoint && runDir) {
      checkpoint = finalizeCheckpoint(checkpoint);
      await writeCheckpoint(runDir, checkpoint);
    }
  }

  return { results, summary };
}
