// Bot entry point. Runs the catalog extraction workflow against the sandbox
// site and produces a run summary + evidence in runs/<run-id>/.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSession, closeSession, DEFAULT_BASE_URL } from './browser.js';
import { Reporter, makeRunId } from './reporting.js';
import { runWorkflow } from './workflow.js';
import { getHandlers, ensureHandlersLoaded } from './handlers/index.js';
import {
  readCheckpoint,
  writeCheckpoint,
  createCheckpoint,
  findResumeCheckpoint,
  markResumed,
} from './checkpoint.js';

function parseArgs(argv) {
  const args = {
    baseUrl: null,
    limit: null,
    runDir: null,
    headless: true,
    resume: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base-url' || arg === '--base-url=') {
      args.baseUrl = arg === '--base-url' ? argv[++i] : arg.slice('--base-url='.length);
    } else if (arg.startsWith('--base-url=')) {
      args.baseUrl = arg.slice('--base-url='.length);
    } else if (arg === '--limit') {
      args.limit = Number(argv[++i]);
    } else if (arg.startsWith('--limit=')) {
      args.limit = Number(arg.slice('--limit='.length));
    } else if (arg === '--run-dir') {
      args.runDir = argv[++i];
    } else if (arg.startsWith('--run-dir=')) {
      args.runDir = arg.slice('--run-dir='.length);
    } else if (arg === '--resume') {
      args.resume = argv[++i];
    } else if (arg.startsWith('--resume=')) {
      args.resume = arg.slice('--resume='.length);
    } else if (arg === '--headed') {
      args.headless = false;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node bot/run.js [options]

Options:
  --base-url <url>       Sandbox base URL (default: ${DEFAULT_BASE_URL})
  --limit <n>            Only process the first n items (fast runs / tests)
  --run-dir <path>       Evidence output directory (default: runs/<run-id>)
  --resume <path|latest> Resume from a previous checkpoint
  --headed               Run with a visible browser (default: headless)
  -h, --help             Show this help`);
}

export async function main(argv = process.argv) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }

  const startedAt = new Date();
  await ensureHandlersLoaded();
  const baseUrl = args.baseUrl ?? DEFAULT_BASE_URL;
  const handlers = getHandlers();

  let runDir = args.runDir;
  let checkpoint = null;
  let resumedFrom = null;

  // Handle resume
  if (args.resume) {
    const resumeResult = await findResumeCheckpoint('runs', args.resume);
    if (resumeResult) {
      checkpoint = resumeResult.checkpoint;
      runDir = resumeResult.runDir;
      resumedFrom = checkpoint.run_id;
      console.log(`[bot] resuming from checkpoint: ${resumedFrom} (${checkpoint.completed_item_ids.length} items completed)`);
    } else {
      console.error(`[bot] no valid checkpoint found for: ${args.resume}`);
      return 1;
    }
  }

  if (!runDir) {
    runDir = path.join('runs', makeRunId());
  }

  console.log(`[bot] base_url=${baseUrl} limit=${args.limit ?? 'full'} run_dir=${runDir} handlers=${handlers.map((h) => h.name).join(',') || 'none'}`);

  const reporter = new Reporter({ runDir, baseUrl });
  await reporter.init();

  // Create or update checkpoint
  if (!checkpoint) {
    checkpoint = createCheckpoint({
      runId: path.basename(runDir),
      runDir,
      baseUrl,
      config: { limit: args.limit },
    });
    await writeCheckpoint(runDir, checkpoint);
  } else {
    checkpoint = markResumed(checkpoint, resumedFrom);
    await writeCheckpoint(runDir, checkpoint);
  }

  reporter.event({ scenario: 'workflow', action: 'run_started', outcome: 'started', detail: `limit=${args.limit ?? 'full'}${resumedFrom ? ` resumed_from=${resumedFrom}` : ''}` });

  let session = null;
  try {
    session = await createSession({ headless: args.headless, baseUrl });
    const { results, summary } = await runWorkflow({
      session,
      reporter,
      limit: args.limit,
      startedAt,
      checkpoint,
      runDir,
    });

    console.log(`[bot] items_processed=${summary.items_processed} items_failed=${summary.items_failed} verdict=${summary.verdict}`);
    for (const [name, d] of Object.entries(summary.disruptions)) {
      if (d.detected > 0) {
        console.log(`[bot] disruption ${name}: detected=${d.detected} resolved=${d.resolved} retries=${d.retries}`);
      }
    }
    if (summary.failure_reasons.length > 0) {
      console.error(`[bot] failure reasons: ${summary.failure_reasons.join('; ')}`);
    }
    if (resumedFrom) {
      console.log(`[bot] run was resumed from: ${resumedFrom}`);
    }
    console.log(`[bot] evidence written to ${runDir}`);
    return summary.verdict === 'PASS' ? 0 : 1;
  } catch (err) {
    console.error('[bot] fatal error:', err);
    reporter.event({ scenario: 'workflow', action: 'run_failed', outcome: 'error', detail: String(err) });
    if (session?.page) {
      await reporter.screenshot(session.page, 'fatal-error');
    }
    return 2;
  } finally {
    await closeSession(session);
  }
}

// Only run as the main entry point (not when imported by tests).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().then((code) => process.exit(code));
}
