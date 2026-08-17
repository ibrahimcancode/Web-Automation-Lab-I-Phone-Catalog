// Evidence infrastructure: structured JSON-Lines event log, anomaly
// screenshots, results output, and run-summary generation.
//
// buildSummary() is a standalone (pure-ish) function so it can be unit-tested
// and reused unchanged for the rest of the internship.
//
// M10 observability: computeMetrics() derives structured timing/nav/recovery
// metrics from events. writeTrace() produces a human-readable trace log.

import { writeFile, mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { validateExtractedItems } from './validate.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

export function makeRunId(date = new Date()) {
  const stamp =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${suffix}`;
}

export class Reporter {
  constructor({ runDir, baseUrl }) {
    this.runDir = runDir;
    this.runId = path.basename(runDir);
    this.baseUrl = baseUrl;
    this.events = [];
    this.startedAt = new Date();
    this.screenshotCount = 0;
  }

  async init() {
    await mkdir(this.runDir, { recursive: true });
    await mkdir(path.join(this.runDir, 'screenshots'), { recursive: true });
  }

  async event({
    scenario,
    action,
    outcome,
    duration_ms = null,
    step = null,
    item_id = null,
    url = null,
    detail = null,
  }) {
    const entry = {
      timestamp: new Date().toISOString(),
      scenario,
      action,
      outcome,
      duration_ms,
      step,
      item_id,
      url,
      detail,
    };
    this.events.push(entry);
    await appendFile(path.join(this.runDir, 'events.jsonl'), JSON.stringify(entry) + '\n', 'utf8');
    return entry;
  }

  async screenshot(page, name) {
    this.screenshotCount += 1;
    const seq = String(this.screenshotCount).padStart(3, '0');
    const safe = name.replace(/[^a-z0-9-_]/gi, '_').slice(0, 60);
    const file = path.join(this.runDir, 'screenshots', `${seq}-${safe}.png`);
    try {
      await page.screenshot({ path: file, fullPage: true });
      return file;
    } catch (err) {
      // A screenshot must never mask the real failure that triggered it. If the
      // page/context is gone (e.g. "Target page, context or browser has been
      // closed"), record the capture failure as evidence and return null so the
      // caller keeps its original error path.
      await this.event({
        scenario: 'workflow',
        action: 'screenshot_failed',
        outcome: 'error',
        detail: `screenshot "${safe}" could not be captured: ${String(err)}`,
      }).catch(() => {});
      return null;
    }
  }
}

// ── M10: Structured Metrics ─────────────────────────────────────────────

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function summarizeDurations(durations) {
  if (durations.length === 0) return null;
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    min_ms: sorted[0],
    max_ms: sorted[sorted.length - 1],
    avg_ms: Math.round(sum / sorted.length),
    median_ms: percentile(sorted, 50),
    p95_ms: percentile(sorted, 95),
    total_ms: sum,
  };
}

/**
 * Derive structured observability metrics from event log.
 * Pure function — no side effects, fully unit-testable.
 */
export function computeMetrics(events) {
  // Navigation metrics
  const navEvents = events.filter((e) => e.scenario === 'workflow' && e.action === 'navigated');
  const navSuccess = navEvents.filter((e) => e.outcome === 'ok');
  const navFailed = navEvents.filter((e) => e.outcome !== 'ok');
  const navDurations = navEvents.filter((e) => typeof e.duration_ms === 'number').map((e) => e.duration_ms);

  // Recovery metrics per scenario
  const scenarioRecovery = {};
  const recoveryEvents = events.filter((e) => e.action === 'recovered' && e.outcome === 'resolved');
  for (const ev of recoveryEvents) {
    if (!scenarioRecovery[ev.scenario]) scenarioRecovery[ev.scenario] = [];
    if (typeof ev.duration_ms === 'number') scenarioRecovery[ev.scenario].push(ev.duration_ms);
  }
  const recoveryMetrics = {};
  for (const [name, durations] of Object.entries(scenarioRecovery)) {
    recoveryMetrics[name] = summarizeDurations(durations);
  }

  // Item extraction metrics
  const itemEvents = events.filter((e) => e.scenario === 'workflow' && e.action === 'item_ok');
  const itemDurations = itemEvents.filter((e) => typeof e.duration_ms === 'number').map((e) => e.duration_ms);

  // Phase timing (workflow lifecycle)
  const phaseEvents = events.filter((e) => e.scenario === 'workflow' && e.action?.startsWith('visited_'));
  const phaseDurations = {};
  for (const ev of phaseEvents) {
    const phase = ev.action.replace('visited_', '');
    if (typeof ev.duration_ms === 'number') {
      if (!phaseDurations[phase]) phaseDurations[phase] = [];
      phaseDurations[phase].push(ev.duration_ms);
    }
  }
  const phaseMetrics = {};
  for (const [phase, durations] of Object.entries(phaseDurations)) {
    phaseMetrics[phase] = summarizeDurations(durations);
  }

  // Disruption summary
  const disruptionEvents = events.filter((e) => e.action === 'detected' || e.action === 'recovered');
  const disruptionCounts = {};
  for (const ev of disruptionEvents) {
    if (!disruptionCounts[ev.scenario]) disruptionCounts[ev.scenario] = { detected: 0, resolved: 0 };
    if (ev.action === 'detected') disruptionCounts[ev.scenario].detected += 1;
    if (ev.outcome === 'resolved') disruptionCounts[ev.scenario].resolved += 1;
  }

  return {
    navigations: {
      total: navEvents.length,
      success: navSuccess.length,
      failed: navFailed.length,
      timing: summarizeDurations(navDurations),
    },
    item_extraction: {
      total: itemEvents.length,
      timing: summarizeDurations(itemDurations),
    },
    recovery: recoveryMetrics,
    phases: phaseMetrics,
    disruptions: disruptionCounts,
    total_events: events.length,
    screenshot_count: events.filter((e) => e.action === 'screenshot_failed').length,
  };
}

// ── M10: Human-Readable Trace ───────────────────────────────────────────

/**
 * Write a human-readable trace log alongside the structured JSONL.
 * One line per significant event, ordered by timestamp.
 */
export async function writeTrace(runDir, events) {
  const lines = events.map((e) => {
    const ts = e.timestamp?.slice(11, 19) ?? '??:??:??';
    const scenario = (e.scenario || '').padEnd(20);
    const action = (e.action || '').padEnd(16);
    const outcome = (e.outcome || '').padEnd(10);
    const duration = e.duration_ms != null ? `${e.duration_ms}ms`.padStart(8) : '';
    const detail = e.detail ? ` | ${e.detail}` : '';
    return `${ts} ${scenario} ${action} ${outcome} ${duration}${detail}`;
  });

  const header = [
    `# Run trace — generated by buildSummary()`,
    `# ${events.length} events`,
    `#`,
    `# TIME       SCENARIO             ACTION           OUTCOME    DURATION DETAIL`,
    `# ${'─'.repeat(90)}`,
  ];

  await writeFile(path.join(runDir, 'trace.log'), [...header, ...lines, ''].join('\n'), 'utf8');
}

// ── Existing: Summary Builder ───────────────────────────────────────────

// Aggregate events + results + run meta into a run summary. No browser needed,
// so it is fully unit-testable.
export function buildSummary({ events, results, runMeta, config = {} }) {
  const disruptions = {};
  const scenarioNames = [
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
  for (const name of scenarioNames) {
    disruptions[name] = { detected: 0, resolved: 0, retries: 0 };
  }

  for (const ev of events) {
    const d = disruptions[ev.scenario];
    if (!d) continue;
    if (ev.action === 'detected') d.detected += 1;
    if (ev.outcome === 'resolved') d.resolved += 1;
    if (ev.action === 'retry') d.retries += 1;
  }

  const validation = validateExtractedItems(results);
  const itemsFailed = results.filter((r) => r.status === 'failed').length;

  let verdict = 'PASS';
  const failureReasons = [];
  if (validation.invalidCount > 0) {
    verdict = 'FAIL';
    failureReasons.push(`data validation: ${validation.invalidCount} invalid item(s)`);
  }
  if (itemsFailed > 0) {
    verdict = 'FAIL';
    failureReasons.push(`workflow: ${itemsFailed} item(s) failed`);
  }

  const summary = {
    run_id: runMeta?.run_id ?? null,
    base_url: config.baseUrl ?? null,
    limit: config.limit ?? null,
    started_at: config.startedAt?.toISOString?.() ?? config.startedAt ?? null,
    ended_at: config.endedAt?.toISOString?.() ?? config.endedAt ?? null,
    duration_ms: config.durationMs ?? null,
    items_requested: results.length,
    items_processed: results.filter((r) => r.status === 'ok').length,
    items_failed: itemsFailed,
    data_validation: {
      total: validation.total,
      valid: validation.validCount,
      invalid: validation.invalidCount,
      duplicates: validation.duplicates,
    },
    disruptions,
    retries_total: Object.values(disruptions).reduce((sum, d) => sum + d.retries, 0),
    screenshots: config.screenshots ?? 0,
    resumed: config.resumed ?? false,
    resumed_from: config.resumed_from ?? null,
    verdict,
    failure_reasons: failureReasons,
  };

  // M10: attach structured observability metrics
  summary.metrics = computeMetrics(events);

  return summary;
}

export async function writeRunSummary(runDir, summary) {
  await writeFile(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
}

export async function writeResults(runDir, results) {
  await writeFile(path.join(runDir, 'results.json'), JSON.stringify(results, null, 2) + '\n', 'utf8');
}
