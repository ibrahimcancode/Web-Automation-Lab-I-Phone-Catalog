// Evidence infrastructure: structured JSON-Lines event log, anomaly
// screenshots, results output, and run-summary generation.
//
// buildSummary() is a standalone (pure-ish) function so it can be unit-tested
// and reused unchanged for the rest of the internship.

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

  async event({ scenario, action, outcome, duration_ms = null, step = null, item_id = null, url = null, detail = null }) {
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
    await page.screenshot({ path: file, fullPage: true });
    return file;
  }
}

// Aggregate events + results + run meta into a run summary. No browser needed,
// so it is fully unit-testable.
export function buildSummary({ events, results, runMeta, config = {} }) {
  const disruptions = {};
  const scenarioNames = ['cookie_banner', 'newsletter_popup', 'simulated_captcha', 'server_errors'];
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

  return {
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
    verdict,
    failure_reasons: failureReasons,
  };
}

export async function writeRunSummary(runDir, summary) {
  await writeFile(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
}

export async function writeResults(runDir, results) {
  await writeFile(path.join(runDir, 'results.json'), JSON.stringify(results, null, 2) + '\n', 'utf8');
}