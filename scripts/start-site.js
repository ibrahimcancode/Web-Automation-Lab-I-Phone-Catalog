// Cross-platform site launcher. Sets VITE_CHAOS_JSON programmatically and
// spawns the Vite dev server. Replaces Windows-only `set ... && npm.cmd` scripts.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, '..', 'iphone-catalog');
const viteBin = path.join(siteRoot, 'node_modules', 'vite', 'bin', 'vite.js');

function parseArgs(argv) {
  const args = { preset: null, chaosJson: null, port: 5173 };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--preset') {
      args.preset = argv[++i];
    } else if (arg.startsWith('--preset=')) {
      args.preset = arg.slice('--preset='.length);
    } else if (arg === '--port') {
      args.port = Number(argv[++i]);
    } else if (arg.startsWith('--port=')) {
      args.port = Number(arg.slice('--port='.length));
    } else if (arg === '--chaos-json') {
      args.chaosJson = argv[++i];
    } else if (arg.startsWith('--chaos-json=')) {
      args.chaosJson = arg.slice('--chaos-json='.length);
    }
  }
  return args;
}

const PRESETS = {
  off: { enabled: false, random_mode: false, seed: 42, scenarios: {} },
  all: {
    enabled: true,
    random_mode: false,
    seed: 42,
    scenarios: {
      cookie_banner: { enabled: true, probability: 1.0 },
      newsletter_popup: { enabled: true, probability: 1.0, min_delay_seconds: 2, max_delay_seconds: 6 },
      simulated_captcha: { enabled: true, probability: 1.0, delay_seconds: 1 },
      server_errors: { enabled: true, probability: 1.0, status_code: 503, fail_first_n: 2 },
    },
  },
  slow: {
    enabled: true,
    random_mode: false,
    seed: 42,
    scenarios: { slow_responses: { enabled: true, probability: 1.0, min_delay_ms: 2500, max_delay_ms: 4000 } },
  },
  drift: {
    enabled: true,
    random_mode: false,
    seed: 42,
    scenarios: { dom_drift: { enabled: true, probability: 1.0 } },
  },
  blocked: {
    enabled: true,
    random_mode: false,
    seed: 42,
    scenarios: { blocked_clicks: { enabled: true, probability: 1.0, rearm_after_dismissal_ms: 1000 } },
  },
};

const args = parseArgs(process.argv);

let chaosConfig = null;
if (args.preset) {
  if (!PRESETS[args.preset]) {
    console.error(`[site] Unknown preset: ${args.preset}. Available: ${Object.keys(PRESETS).join(', ')}`);
    process.exit(1);
  }
  chaosConfig = PRESETS[args.preset];
} else if (args.chaosJson) {
  chaosConfig = JSON.parse(args.chaosJson);
}

const env = { ...process.env };
if (chaosConfig) {
  env.VITE_CHAOS_JSON = JSON.stringify(chaosConfig);
}

const port = args.port;
const child = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: siteRoot,
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});
process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
