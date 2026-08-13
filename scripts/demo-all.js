// Deterministic all-eight live demonstration mode.
//
// `npm run demo:all` runs this script. In one run it:
//
//   1. Boots the sandbox with the dedicated demo chaos config
//      (configs/chaos.demo.json) — all 8 core scenarios forced with
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

Deterministic all-eight live demo. Boots the sandbox with the demo chaos
config, opens a visible browser, runs the full 43-model workflow, recovers
from every scenario, saves evidence, and verifies PASS.

Options:
  --headless     Run without a visible browser (automated checks)
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
export function verifyDemoRun(summary) {
  const failures = [];

  if (summary.verdict !== 'PASS') failures.push(`verdict=${summary.verdict} (expected PASS)`);
  if (summary.items_processed !== DEMO_CATALOG_SIZE) {
    failures.push(`items_processed=${summary.items_processed} (expected ${DEMO_CATALOG_SIZE})`);
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

  // Requirement: every core scenario was detected AND recovered during the run.
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
    process.env.BOT_DEMO_PAUSE_MS = String(Number(process.env.BOT_DEMO_PAUSE_MS) || 1500);
  }

  printChoreography();
  console.log(`[demo] booting sandbox with demo chaos config on port ${args.port}...`);
  const site = await startSite(demoConfig, { port: args.port, readyTimeoutMs: 60_000 });

  const startedAt = new Date();
  const runDir = args.runDir ?? path.join('runs', `demo-${makeRunId()}`);
  const reporter = new Reporter({ runDir, baseUrl: site.baseUrl });
  await reporter.init();
  await writeFile(
    path.join(runDir, 'demo.config.json'),
    JSON.stringify(demoConfig, null, 2) + '\n',
    'utf8',
  );
  reporter.event({ scenario: 'workflow', action: 'demo_started', outcome: 'started', detail: `port=${args.port} headless=${args.headless} limit=${args.limit ?? 'full'}` });
  console.log(`[demo] run_dir=${runDir} base_url=${site.baseUrl}`);

  let session = null;
  let exitCode = 1;
  try {
    console.log(`[demo] opening ${args.headless ? 'headless' : 'VISIBLE headed'} Chromium (43 models) — watch every disruption fire and be recovered...`);
    session = await createSession({
      headless: args.headless,
      baseUrl: site.baseUrl,
    });

    const { results, summary } = await runWorkflow({ session, reporter, limit: args.limit, startedAt });

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
    console.log(`  scenario${' '.repeat(21)}detected  resolved`);
    for (const name of DEMO_SCENARIOS) {
      const d = summary.disruptions?.[name] ?? { detected: 0, resolved: 0 };
      console.log(`  ${pad(name, 24)} ${String(d.detected).padStart(6)}  ${String(d.resolved).padStart(8)}`);
    }

    const { ok, failures } = verifyDemoRun(summary);
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────────────┐');
    console.log('│  Verification report                                                    │');
    console.log('└─────────────────────────────────────────────────────────────────────────┘');
    if (ok) {
      console.log('  PASS — all 8 scenarios detected and recovered, 43/43 models extracted,');
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
