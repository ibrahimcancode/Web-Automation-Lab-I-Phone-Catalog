// Runs the full bot workflow once against a live sandbox and returns the
// results + summary. Evidence goes to a throwaway temp run directory so the
// repo's runs/ folder stays clean during tests.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSession, closeSession } from '../../bot/browser.js';
import { runWorkflow } from '../../bot/workflow.js';
import { Reporter } from '../../bot/reporting.js';

export async function runBotOnce({ baseUrl, limit = null }) {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-test-run-'));
  const reporter = new Reporter({ runDir, baseUrl });
  await reporter.init();

  const session = await createSession({ headless: true, baseUrl });
  try {
    const { results, summary } = await runWorkflow({
      session,
      reporter,
      limit,
      startedAt: new Date(),
    });
    return { results, summary, reporter, runDir };
  } finally {
    await closeSession(session);
  }
}