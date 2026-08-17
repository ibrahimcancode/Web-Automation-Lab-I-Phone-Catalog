// Scenario 3 — Visual traffic-light CAPTCHA gate.
//
// Detect the overlay, locate the 3x3 grid, screenshot each tile, analyze
// pixel colors to find traffic lights (vertical red/yellow/green signal
// pattern), select confident tiles, submit, and verify the gate clears.
//
// This only ever solves the sandbox's simulated challenge on the intern's
// own site — it must never be adapted toward real CAPTCHA bypass.
//
// Fail-safe: only tiles above the confidence threshold are selected. When
// no tile meets the threshold the handler refreshes the challenge (bounded
// retry) or fails safely — it never guesses.

import { registerHandler } from './index.js';

const OVERLAY_SEL = '#simulated-captcha-overlay';
const GRID_SEL = '.chaos-captcha-grid';
const TILE_SEL = '.chaos-captcha-tile';
const VERIFY_BTN_SEL = '.chaos-captcha-submit';

// Confidence threshold: only tiles scoring >= this are selected.
export const CONFIDENCE_THRESHOLD = 0.5;

// Maximum number of challenge refresh retries before failing safely.
export const MAX_CAPTCHA_RETRIES = 3;

// Traffic light color ranges for pixel detection (RGB ranges).
export function isRedPixel(r, g, b) {
  return r > 180 && g < 100 && b < 100;
}
export function isYellowPixel(r, g, b) {
  return r > 180 && g > 140 && b < 80;
}
export function isGreenPixel(r, g, b) {
  return r < 100 && g > 130 && b < 100;
}

/**
 * Analyze a tile's pixel data to determine if it contains a traffic light.
 * Returns a confidence score 0-1.
 *
 * All three colors present = strong signal (0.95).
 * Two of three colors = moderate (0.7).
 * One or zero colors = weak / distractor (0.2).
 */
export function analyzeTilePixels(imageData, width, height) {
  const data = imageData.data;
  let redCount = 0;
  let yellowCount = 0;
  let greenCount = 0;
  const totalPixels = width * height;

  // Sample pixels across the tile (every 2nd pixel for speed)
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      if (isRedPixel(r, g, b)) redCount++;
      if (isYellowPixel(r, g, b)) yellowCount++;
      if (isGreenPixel(r, g, b)) greenCount++;
    }
  }

  const sampledPixels = Math.floor(totalPixels / 4);

  const hasRed = redCount > sampledPixels * 0.02;
  const hasYellow = yellowCount > sampledPixels * 0.02;
  const hasGreen = greenCount > sampledPixels * 0.02;

  if (hasRed && hasYellow && hasGreen) return 0.95;
  if ((hasRed && hasYellow) || (hasRed && hasGreen) || (hasYellow && hasGreen)) return 0.7;
  return 0.2;
}

/**
 * Analyze all 9 tiles and return their confidence scores.
 * Each entry: { index, confidence }.
 */
export async function analyzeAllTiles(page) {
  const tiles = await page.$$(TILE_SEL);
  if (tiles.length !== 9) {
    return { tiles, confidences: [], error: `expected 9 tiles, found ${tiles.length}` };
  }

  const confidences = [];
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    try {
      const screenshot = await tile.screenshot();
      const analysis = await page.evaluate(async (buf) => {
        const uint8 = new Uint8Array(buf);
        const blob = new Blob([uint8], { type: 'image/png' });
        const bmp = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bmp, 0, 0);
        const imageData = ctx.getImageData(0, 0, bmp.width, bmp.height);
        return { data: Array.from(imageData.data), width: bmp.width, height: bmp.height };
      }, Array.from(screenshot));

      const imgData = { data: new Uint8ClampedArray(analysis.data) };
      const confidence = analyzeTilePixels(imgData, analysis.width, analysis.height);
      confidences.push({ index: i, confidence });
    } catch (_err) {
      confidences.push({ index: i, confidence: 0 });
    }
  }

  return { tiles, confidences, error: null };
}

/**
 * Attempt to solve a single CAPTCHA challenge. Returns { outcome, detail, selected }.
 * Does NOT retry — the caller handles bounded retries.
 */
export async function attemptSolve(page, reporter) {
  const startTime = Date.now();

  // Wait for the grid
  try {
    await page.waitForSelector(GRID_SEL, { state: 'visible', timeout: 5000 });
  } catch {
    return { outcome: 'error', detail: 'captcha grid not visible', selected: [] };
  }

  const { tiles, confidences, error } = await analyzeAllTiles(page);
  if (error) {
    return { outcome: 'error', detail: error, selected: [] };
  }

  // Log each tile analysis
  for (const { index, confidence } of confidences) {
    await reporter
      ?.event?.({
        scenario: 'simulated_captcha',
        action: 'captcha_tile_analyzed',
        outcome: confidence >= CONFIDENCE_THRESHOLD ? 'confident' : 'below_threshold',
        detail: `tile ${index}: confidence=${confidence.toFixed(2)}`,
      })
      .catch(() => {});
    console.log(`[bot] captcha tile ${index}: confidence=${confidence.toFixed(2)}`);
  }

  // Select ONLY tiles above the threshold — never guess
  const selectedTiles = confidences.filter((c) => c.confidence >= CONFIDENCE_THRESHOLD);

  if (selectedTiles.length === 0) {
    console.log('[bot] captcha: no tiles above confidence threshold — refreshing challenge');
    await reporter
      ?.event?.({
        scenario: 'simulated_captcha',
        action: 'captcha_confidence_insufficient',
        outcome: 'insufficient',
        detail: `best confidence=${Math.max(...confidences.map((c) => c.confidence)).toFixed(2)}, threshold=${CONFIDENCE_THRESHOLD}`,
      })
      .catch(() => {});
    return { outcome: 'insufficient', detail: 'no tiles above confidence threshold', selected: [] };
  }

  console.log(`[bot] captcha: selecting ${selectedTiles.length} tiles above threshold`);

  // Click selected tiles
  for (const { index } of selectedTiles) {
    await tiles[index].click().catch(() => {});
  }

  // Evidence screenshot
  await reporter?.screenshot?.(page, 'captcha-selections').catch(() => {});

  // Click verify
  try {
    await page.click(VERIFY_BTN_SEL, { timeout: 3000 });
  } catch {
    return { outcome: 'error', detail: 'verify button not clickable', selected: selectedTiles };
  }

  await reporter
    ?.event?.({
      scenario: 'simulated_captcha',
      action: 'captcha_selection_submitted',
      outcome: 'submitted',
      detail: `selected ${selectedTiles.length} tiles`,
    })
    .catch(() => {});

  // Wait for overlay to disappear (success) or error to appear
  try {
    await page.waitForSelector(OVERLAY_SEL, { state: 'hidden', timeout: 6000 });
    const duration = Date.now() - startTime;
    return {
      outcome: 'resolved',
      detail: `solved in ${duration}ms (${selectedTiles.length} tiles)`,
      selected: selectedTiles,
    };
  } catch {
    await reporter
      ?.event?.({
        scenario: 'simulated_captcha',
        action: 'captcha_verification_failed',
        outcome: 'failed',
        detail: 'overlay still visible after submission',
      })
      .catch(() => {});
    return { outcome: 'error', detail: 'captcha not cleared after submission', selected: selectedTiles };
  }
}

const handler = {
  name: 'simulated_captcha',
  type: 'overlay',
  priority: 30,

  async detect(ctx) {
    const visible = await ctx.page.isVisible(OVERLAY_SEL).catch(() => false);
    if (visible) {
      await ctx.reporter
        ?.event?.({
          scenario: 'simulated_captcha',
          action: 'captcha_detected',
          outcome: 'detected',
        })
        .catch(() => {});
    }
    return visible;
  },

  async recover(ctx) {
    const { page, reporter } = ctx;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= MAX_CAPTCHA_RETRIES; attempt += 1) {
      console.log(`[bot] captcha: attempt ${attempt}/${MAX_CAPTCHA_RETRIES}`);

      await reporter
        ?.event?.({
          scenario: 'simulated_captcha',
          action: 'captcha_retry',
          outcome: 'retrying',
          detail: `attempt ${attempt}/${MAX_CAPTCHA_RETRIES}`,
        })
        .catch(() => {});

      const result = await attemptSolve(page, reporter);

      if (result.outcome === 'resolved') {
        const duration = Date.now() - startTime;
        console.log(`[bot] captcha: resolved in ${duration}ms (attempt ${attempt})`);
        return { outcome: 'resolved', detail: result.detail };
      }

      if (result.outcome === 'error') {
        return { outcome: 'error', detail: result.detail };
      }

      // 'insufficient' — no tiles above threshold, retry by refreshing
      if (attempt < MAX_CAPTCHA_RETRIES) {
        // Click the verify button with no selections to trigger a refresh
        try {
          await page.click(VERIFY_BTN_SEL, { timeout: 2000 });
          await page.waitForTimeout(1000);
        } catch {
          // refresh may not be supported — try reload of the overlay
        }
        // Wait for grid to reappear
        try {
          await page.waitForSelector(GRID_SEL, { state: 'visible', timeout: 5000 });
        } catch {
          return { outcome: 'error', detail: 'captcha grid did not reappear after refresh' };
        }
      }
    }

    // All retries exhausted — fail safely
    console.log('[bot] captcha: retries exhausted, failing safely');
    await reporter
      ?.event?.({
        scenario: 'simulated_captcha',
        action: 'captcha_retry_exhausted',
        outcome: 'failed',
        detail: `exhausted ${MAX_CAPTCHA_RETRIES} attempts`,
      })
      .catch(() => {});

    return { outcome: 'error', detail: `captcha retries exhausted after ${MAX_CAPTCHA_RETRIES} attempts` };
  },
};

registerHandler(handler);
export default handler;
