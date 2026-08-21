// Deterministic all-ten live demonstration mode.
//
// `npm run demo:all` runs this script. In one run it:
//
//   1. Boots the sandbox with the dedicated demo chaos config
//      (configs/chaos.demo.json) — all ten scenarios forced with
//      random_mode=false, so every scenario is GUARANTEED to fire at its
//      controlled point. No probability, no seed luck.
//   2. Opens a VISIBLE headed Chromium (the point of a live demo).
//   3. Runs the full bot workflow and extracts all 43 iPhone models, reusing the
//      exact detect -> recover -> verify behaviour (bounded retries preserved).
//   4. Writes results.json, summary.json, events.jsonl and screenshots into
//      runs/<run-id>.
//   5. Verifies the demo acceptance criteria and prints a verification report,
//      exiting 0 on PASS, 1 on FAIL.
//
// Options:
//   --headless    Run without a visible browser (used by CI/automated checks)
//   --watch       Add BOT_DEMO_PAUSE_MS pacing between steps (visible demo aid)
//   --limit <n>   Only process the first n items (fast verification runs)
//   --port <n>    Sandbox port (default 5240)
//   --run-dir <p> Evidence output directory (default runs/demo-<run-id>)

import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  loadDemoConfig,
  validateDemoConfig,
  DEMO_SCENARIOS,
  DEMO_SCENARIO_POINTS,
  DEMO_CATALOG_SIZE,
} from '../configs/demoConfig.js';
import { startSite } from '../tests/helpers/site.js';
import { createSession, closeSession } from '../bot/browser.js';
import { runWorkflow } from '../bot/workflow.js';
import { Reporter, makeRunId } from '../bot/reporting.js';

const DEFAULT_PORT = 5240;

function parseArgs(argv) {
  const args = {
    headless: false,
    watch: false,
    limit: null,
    port: DEFAULT_PORT,
    runDir: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--headless') args.headless = true;
    else if (arg === '--headed') args.headless = false;
    else if (arg === '--watch') args.watch = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length));
    else if (arg === '--port') args.port = Number(argv[++i]);
    else if (arg.startsWith('--port=')) args.port = Number(arg.slice('--port='.length));
    else if (arg === '--run-dir') args.runDir = argv[++i];
    else if (arg.startsWith('--run-dir=')) args.runDir = arg.slice('--run-dir='.length);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/demo-all.js [options]

Deterministic all-ten live demo. Boots the sandbox with the demo chaos
config, opens a visible browser, runs the full 43-model workflow, recovers
from every scenario, saves evidence, and verifies PASS.

Options:
  --headless     Run without a visible browser (automated checks)
  --headed       Run with a visible browser (default; explicit for clarity)
  --watch        Pace the visible demo (BOT_DEMO_PAUSE_MS) between steps
  --limit <n>    Only process the first n items (fast verification runs)
  --port <n>     Sandbox port (default ${DEFAULT_PORT})
  --run-dir <p>  Evidence output directory (default runs/demo-<run-id>)
  -h, --help     Show this help`);
}

function printChoreography() {
  console.log('┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│  Deterministic demo — every scenario FORCED at its controlled point     │');
  console.log('│  random_mode=false · seed=42 · probability ignored · no RNG draws       │');
  console.log('└─────────────────────────────────────────────────────────────────────────┘');
  for (const name of DEMO_SCENARIOS) {
    console.log(`  • ${name.padEnd(20)} -> ${DEMO_SCENARIO_POINTS[name]}`);
  }
}

function pad(name, len) {
  return String(name).padEnd(len);
}

// Verify the demo acceptance criteria against the run summary. Returns
// { ok, failures } where failures is a list of human-readable messages.
// When `limit` is set, the item-count expectation scales to the limit so a
// bounded verification run (--limit N) is still accepted as long as every
// scenario is detected and recovered — the demo fails ONLY when a scenario is
// missing, per the acceptance criteria.
export function verifyDemoRun(summary, { limit = null } = {}) {
  const failures = [];

  if (summary.verdict !== 'PASS') failures.push(`verdict=${summary.verdict} (expected PASS)`);
  const expectedItems = limit ? limit : DEMO_CATALOG_SIZE;
  if (summary.items_processed !== expectedItems) {
    failures.push(`items_processed=${summary.items_processed} (expected ${expectedItems})`);
  }
  if (summary.items_failed !== 0) failures.push(`items_failed=${summary.items_failed} (expected 0)`);
  if (summary.data_validation.invalid !== 0) {
    failures.push(`invalid=${summary.data_validation.invalid} (expected 0)`);
  }
  if ((summary.data_validation.duplicates ?? []).length !== 0) {
    failures.push(`duplicates=${JSON.stringify(summary.data_validation.duplicates)} (expected none)`);
  }
  if ((summary.failure_reasons ?? []).length > 0) {
    failures.push(`failure_reasons=${JSON.stringify(summary.failure_reasons)}`);
  }

  // Requirement: every one of the ten core scenarios was detected AND recovered
  // during the run. A missing/unresolved scenario is a hard demo failure.
  for (const name of DEMO_SCENARIOS) {
    const d = summary.disruptions?.[name];
    if (!d) {
      failures.push(`${name}: missing from disruptions`);
      continue;
    }
    if (d.detected < 1) failures.push(`${name}: detected=${d.detected} (expected >= 1)`);
    if (d.resolved < 1) failures.push(`${name}: resolved=${d.resolved} (expected >= 1)`);
  }
  return { ok: failures.length === 0, failures };
}

export async function main(argv = process.argv) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }

  const demoConfig = loadDemoConfig();
  const configIssues = validateDemoConfig(demoConfig);
  if (configIssues.length > 0) {
    console.error('[demo] invalid demo config:');
    for (const issue of configIssues) console.error(`  - ${issue}`);
    return 1;
  }

  if (args.watch) {
    // Human-visible pacing for the live demo only; never used for correctness.
    // BOT_DEMO_PAUSE_MS may also be set directly in the environment (e.g.
    // `set BOT_DEMO_PAUSE_MS=1500`) — that is always respected as-is.
    process.env.BOT_DEMO_PAUSE_MS = String(Number(process.env.BOT_DEMO_PAUSE_MS) || 1500);
  }
  const paceMs = Number(process.env.BOT_DEMO_PAUSE_MS || 0);
  if (paceMs > 0) {
    console.log(`[demo] pacing enabled (BOT_DEMO_PAUSE_MS=${paceMs}) — watch each disruption fire and be recovered.`);
  }

  printChoreography();
  console.log(`[demo] booting sandbox with demo chaos config on port ${args.port}...`);
  const site = await startSite(demoConfig, { port: args.port, readyTimeoutMs: 60_000 });

  const startedAt = new Date();
  const runDir = args.runDir ?? path.join('runs', `demo-${makeRunId()}`);
  const reporter = new Reporter({ runDir, baseUrl: site.baseUrl });
  await reporter.init();
  await writeFile(path.join(runDir, 'demo.config.json'), JSON.stringify(demoConfig, null, 2) + '\n', 'utf8');
  reporter.event({
    scenario: 'workflow',
    action: 'demo_started',
    outcome: 'started',
    detail: `port=${args.port} headless=${args.headless} limit=${args.limit ?? 'full'}`,
  });
  console.log(`[demo] run_dir=${runDir} base_url=${site.baseUrl}`);

  let session = null;
  let exitCode = 1;
  try {
    console.log(
      `[demo] opening ${args.headless ? 'headless' : 'VISIBLE headed'} Chromium — watch every disruption fire and be recovered...`,
    );
    if (args.limit) {
      console.log(`[demo] extracting ${args.limit} models.`);
    } else {
      console.log(`[demo] extracting all ${DEMO_CATALOG_SIZE} models.`);
    }
    session = await createSession({
      headless: args.headless,
      baseUrl: site.baseUrl,
    });

    const { summary } = await runWorkflow({ session, reporter, limit: args.limit, startedAt });

    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────────────┐');
    console.log('│  Demo run summary                                                       │');
    console.log('└─────────────────────────────────────────────────────────────────────────┘');
    console.log(`  items_processed : ${summary.items_processed}`);
    console.log(`  items_failed    : ${summary.items_failed}`);
    console.log(`  invalid         : ${summary.data_validation.invalid}`);
    console.log(`  duplicates      : ${JSON.stringify(summary.data_validation.duplicates)}`);
    console.log(`  retries_total   : ${summary.retries_total}`);
    console.log(`  screenshots     : ${summary.screenshots}`);
    console.log(`  verdict         : ${summary.verdict}`);
    console.log('');
    console.log('  ── Final checklist: all ten scenarios detected and resolved ──');
    for (const name of DEMO_SCENARIOS) {
      const d = summary.disruptions?.[name] ?? { detected: 0, resolved: 0 };
      const pass = d.detected >= 1 && d.resolved >= 1;
      const mark = pass ? '✓' : '✗';
      console.log(`    ${mark} ${pad(name, 24)} detected=${d.detected}  resolved=${d.resolved}`);
    }

    const { ok, failures } = verifyDemoRun(summary, { limit: args.limit });
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────────────┐');
    console.log('│  Verification report                                                    │');
    console.log('└─────────────────────────────────────────────────────────────────────────┘');
    const extracted = summary.items_processed;
    const total = args.limit ? `${extracted}/${args.limit}` : `${extracted}/${DEMO_CATALOG_SIZE}`;
    if (ok) {
      console.log(`  PASS — all ten scenarios detected and recovered, ${total} models extracted,`);
      console.log('  zero failures, zero invalid, zero duplicates.');
      console.log(`  Evidence: ${runDir} (results.json, summary.json, events.jsonl, screenshots/)`);
    } else {
      console.log('  FAIL:');
      for (const f of failures) console.log(`    - ${f}`);
    }
    exitCode = ok ? 0 : 1;
  } catch (err) {
    console.error('[demo] fatal error:', err);
    reporter.event({ scenario: 'workflow', action: 'demo_failed', outcome: 'error', detail: String(err) });
    if (session?.page) await reporter.screenshot(session.page, 'demo-fatal-error');
    exitCode = 2;
  } finally {
    await closeSession(session);
    await site.close();
  }
  return exitCode;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().then((code) => process.exit(code));
}
