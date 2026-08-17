// Cross-platform bot runner. Forwards all arguments to bot/run.js.
// Replaces platform-specific wrapper scripts.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const botEntry = path.resolve(__dirname, '..', 'bot', 'run.js');

const child = spawn(process.execPath, [botEntry, ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, '..'),
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
