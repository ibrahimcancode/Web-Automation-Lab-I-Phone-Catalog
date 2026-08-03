// Boots the Vite dev server (iphone-catalog) with a given chaos config for one
// test. The config is passed via VITE_CHAOS_JSON so the run is deterministic
// and the committed chaos.json is never mutated.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, '..', '..', 'iphone-catalog');
const viteBin = path.join(siteRoot, 'node_modules', 'vite', 'bin', 'vite.js');

// Start the dev server and wait until it answers requests. `chaosConfig` is the
// full chaos JSON object (or null to use the bundled chaos.json).
export async function startSite(chaosConfig, { port = 5173, readyTimeoutMs = 60_000 } = {}) {
  const env = { ...process.env };
  if (chaosConfig !== undefined && chaosConfig !== null) {
    env.VITE_CHAOS_JSON = JSON.stringify(chaosConfig);
  }

  const child = spawn(
    process.execPath,
    [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: siteRoot, env, stdio: 'ignore' },
  );

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForReady(baseUrl, readyTimeoutMs);
  } catch (err) {
    child.kill();
    throw err;
  }

  return {
    baseUrl,
    async close() {
      if (child.exitCode === null) {
        child.kill();
        await new Promise((resolve) => child.once('exit', resolve));
      }
    },
  };
}

async function waitForReady(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl + '/');
      if (res.ok) return;
      lastErr = new Error(`site responded with ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Vite dev server at ${baseUrl} not ready within ${timeoutMs}ms (${lastErr})`);
}