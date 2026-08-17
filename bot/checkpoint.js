// Crash-safe checkpoint persistence for the bot workflow.
//
// Checkpoints are written atomically (temp file + rename) so a crash mid-write
// never corrupts the checkpoint. The checkpoint tracks:
//   - schema version, run ID, timestamps
//   - base URL and configuration fingerprint
//   - current workflow phase
//   - browser-observed item IDs/URLs (never read from source JSON)
//   - completed items, extracted results
//   - failed items with attempt counts
//   - scenario counts, retry counts
//   - last recoverable action
//   - finalization status
//
// Resume: reads a valid checkpoint, skips completed items, continues from next.

import { writeFile, readFile, rename, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const CHECKPOINT_VERSION = 1;
export const CHECKPOINT_FILE = 'checkpoint.json';
export const CHECKPOINT_TEMP = 'checkpoint.json.tmp';

/**
 * @typedef {Object} CheckpointState
 * @property {number} schema_version
 * @property {string} run_id
 * @property {string} run_dir
 * @property {string} base_url
 * @property {string} config_fingerprint
 * @property {string} phase
 * @property {string[]} observed_item_ids
 * @property {string[]} observed_item_urls
 * @property {string[]} completed_item_ids
 * @property {Object[]} results
 * @property {Object[]} failed_items
 * @property {Object} scenario_counts
 * @property {number} total_retries
 * @property {string} last_action
 * @property {boolean} finalized
 * @property {string} started_at
 * @property {string} updated_at
 * @property {string|null} resumed_from
 */

/**
 * Create a fresh checkpoint state for a new run.
 */
export function createCheckpoint({ runId, runDir, baseUrl, config = {} }) {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ baseUrl, ...config }))
    .digest('hex')
    .slice(0, 16);

  return {
    schema_version: CHECKPOINT_VERSION,
    run_id: runId,
    run_dir: runDir,
    base_url: baseUrl,
    config_fingerprint: fingerprint,
    phase: 'started',
    observed_item_ids: [],
    observed_item_urls: [],
    completed_item_ids: [],
    results: [],
    failed_items: [],
    scenario_counts: {},
    total_retries: 0,
    last_action: 'run_started',
    finalized: false,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    resumed_from: null,
  };
}

/**
 * Write a checkpoint atomically (temp file + rename).
 */
export async function writeCheckpoint(runDir, checkpoint) {
  await mkdir(runDir, { recursive: true });
  const cp = { ...checkpoint, updated_at: new Date().toISOString() };
  const tmpPath = path.join(runDir, CHECKPOINT_TEMP);
  const finalPath = path.join(runDir, CHECKPOINT_FILE);
  await writeFile(tmpPath, JSON.stringify(cp, null, 2) + '\n', 'utf8');
  await rename(tmpPath, finalPath);
  return cp;
}

/**
 * Read and validate a checkpoint from disk. Returns null if invalid/missing.
 */
export async function readCheckpoint(runDir) {
  try {
    const raw = await readFile(path.join(runDir, CHECKPOINT_FILE), 'utf8');
    const cp = JSON.parse(raw);
    if (!validateCheckpoint(cp)) return null;
    return cp;
  } catch {
    return null;
  }
}

/**
 * Validate checkpoint schema. Returns true if valid and compatible.
 */
export function validateCheckpoint(cp) {
  if (!cp || typeof cp !== 'object') return false;
  if (typeof cp.schema_version !== 'number') return false;
  if (cp.schema_version !== CHECKPOINT_VERSION) return false;
  if (typeof cp.run_id !== 'string') return false;
  if (typeof cp.base_url !== 'string') return false;
  if (!Array.isArray(cp.completed_item_ids)) return false;
  if (!Array.isArray(cp.results)) return false;
  if (!Array.isArray(cp.observed_item_ids)) return false;
  return true;
}

/**
 * Update checkpoint after observing a new item from the catalog.
 */
export function observeItem(checkpoint, itemId, itemUrl) {
  const cp = { ...checkpoint };
  if (!cp.observed_item_ids.includes(itemId)) {
    cp.observed_item_ids = [...cp.observed_item_ids, itemId];
    cp.observed_item_urls = [...cp.observed_item_urls, itemUrl];
  }
  cp.updated_at = new Date().toISOString();
  return cp;
}

/**
 * Update checkpoint after successfully extracting an item.
 */
export function completeItem(checkpoint, itemId, result) {
  const cp = { ...checkpoint };
  if (!cp.completed_item_ids.includes(itemId)) {
    cp.completed_item_ids = [...cp.completed_item_ids, itemId];
    cp.results = [...cp.results, result];
  }
  cp.updated_at = new Date().toISOString();
  return cp;
}

/**
 * Update checkpoint after a failed item extraction.
 */
export function failItem(checkpoint, itemId, error, attempt = 1) {
  const cp = { ...checkpoint };
  const existing = cp.failed_items.find((f) => f.item_id === itemId);
  if (existing) {
    existing.attempts = attempt;
    existing.last_error = error;
    existing.updated_at = new Date().toISOString();
  } else {
    cp.failed_items = [
      ...cp.failed_items,
      { item_id: itemId, attempts: attempt, last_error: error, updated_at: new Date().toISOString() },
    ];
  }
  cp.updated_at = new Date().toISOString();
  return cp;
}

/**
 * Update scenario counts in checkpoint.
 */
export function updateScenarioCounts(checkpoint, scenario, action) {
  const cp = { ...checkpoint };
  if (!cp.scenario_counts[scenario]) {
    cp.scenario_counts[scenario] = { detected: 0, resolved: 0, retries: 0 };
  }
  if (action === 'detected') cp.scenario_counts[scenario].detected += 1;
  if (action === 'resolved') cp.scenario_counts[scenario].resolved += 1;
  if (action === 'retry') cp.scenario_counts[scenario].retries += 1;
  cp.total_retries = Object.values(cp.scenario_counts).reduce((sum, s) => sum + s.retries, 0);
  cp.updated_at = new Date().toISOString();
  return cp;
}

/**
 * Update checkpoint phase.
 */
export function setPhase(checkpoint, phase, lastAction = null) {
  const cp = { ...checkpoint };
  cp.phase = phase;
  if (lastAction) cp.last_action = lastAction;
  cp.updated_at = new Date().toISOString();
  return cp;
}

/**
 * Mark checkpoint as finalized.
 */
export function finalizeCheckpoint(checkpoint) {
  const cp = { ...checkpoint };
  cp.finalized = true;
  cp.phase = 'completed';
  cp.last_action = 'run_completed';
  cp.updated_at = new Date().toISOString();
  return cp;
}

/**
 * Mark checkpoint as resumed from a previous run.
 */
export function markResumed(checkpoint, previousRunId) {
  const cp = { ...checkpoint };
  cp.resumed_from = previousRunId;
  cp.updated_at = new Date().toISOString();
  return cp;
}

/**
 * Find the latest checkpoint in a run directory or a specific path.
 * Supports --resume <path> or --resume latest.
 */
export async function findResumeCheckpoint(baseRunsDir, resumeArg) {
  if (!resumeArg) return null;

  if (resumeArg === 'latest') {
    return findLatestCheckpoint(baseRunsDir);
  }

  // Specific path
  const cp = await readCheckpoint(resumeArg);
  return cp ? { checkpoint: cp, runDir: resumeArg } : null;
}

async function findLatestCheckpoint(runsDir) {
  try {
    const entries = await readdir(runsDir);
    const dirs = [];
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const full = path.join(runsDir, entry);
      const s = await stat(full).catch(() => null);
      if (s?.isDirectory()) {
        const cp = await readCheckpoint(full);
        if (cp && !cp.finalized) {
          dirs.push({ checkpoint: cp, runDir: full, mtime: s.mtimeMs });
        }
      }
    }
    if (dirs.length === 0) return null;
    dirs.sort((a, b) => b.mtime - a.mtime);
    return dirs[0];
  } catch {
    return null;
  }
}

/**
 * Get item IDs that have already been completed from a checkpoint.
 */
export function getCompletedIds(checkpoint) {
  return new Set(checkpoint?.completed_item_ids ?? []);
}

/**
 * Get items that still need to be processed given observed + completed IDs.
 */
export function getRemainingItems(checkpoint, allObservedIds) {
  const completed = getCompletedIds(checkpoint);
  return allObservedIds.filter((id) => !completed.has(id));
}
