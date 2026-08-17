// Scenario 3 — Visual traffic-light CAPTCHA gate.
//
// Detect the overlay, locate the 3x3 grid, screenshot each tile, analyze
// pixel colors to find traffic lights (vertical red/yellow/green signal
// pattern), select confident tiles, submit, and verify the gate clears.
//
// This only ever solves the sandbox's simulated challenge on the intern's
// own site — it must never be adapted toward real CAPTCHA bypass.

import { registerHandler } from './index.js';

const OVERLAY_SEL = '#simulated-captcha-overlay';
const GRID_SEL = '.chaos-captcha-grid';
const TILE_SEL = '.chaos-captcha-tile';
const VERIFY_BTN_SEL = '.chaos-captcha-submit';
const ERROR_SEL = '.chaos-captcha-overlay p[style*="color: rgb(255, 59, 56)"]';

// Traffic light color ranges for pixel detection (RGB ranges).
// Red light: R > 200, G < 80, B < 80
// Yellow light: R > 200, G > 150, B < 80
// Green light: R < 80, G > 150, B < 80
function isRedPixel(r, g, b) { return r > 180 && g < 100 && b < 100; }
function isYellowPixel(r, g, b) { return r > 180 && g > 140 && b < 80; }
function isGreenPixel(r, g, b) { return r < 100 && g > 130 && b < 100; }

/**
 * Analyze a tile's pixel data to determine if it contains a traffic light.
 * Returns a confidence score 0-1.
 */
function analyzeTilePixels(imageData, width, height) {
  const data = imageData.data;
  let redCount = 0;
  let yellowCount = 0;
  let greenCount = 0;
  const totalPixels = width * height;

  // Sample pixels across the tile
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

  // Traffic light has all three colors in meaningful quantities
  // Distractors may have one or two but rarely all three in the right arrangement
  const hasRed = redCount > sampledPixels * 0.02;
  const hasYellow = yellowCount > sampledPixels * 0.02;
  const hasGreen = greenCount > sampledPixels * 0.02;

  // All three colors present = strong traffic light signal
  if (hasRed && hasYellow && hasGreen) return 0.95;
  // Two out of three = moderate confidence
  if ((hasRed && hasYellow) || (hasRed && hasGreen) || (hasYellow && hasGreen)) return 0.7;
  // Only one color = weak signal (could be distractor)
  return 0.2;
}

const handler = {
  name: 'simulated_captcha',
  type: 'overlay',
  priority: 30,

  async detect(ctx) {
    return ctx.page.isVisible(OVERLAY_SEL).catch(() => false);
  },

  async recover(ctx) {
    const { page } = ctx;
    const startTime = Date.now();

    // Wait for the grid to be visible
    try {
      await page.waitForSelector(GRID_SEL, { state: 'visible', timeout: 5000 });
    } catch {
      return { outcome: 'error', detail: 'captcha grid not visible' };
    }

    // Get all tiles
    const tiles = await page.$$(TILE_SEL);
    if (tiles.length !== 9) {
      return { outcome: 'error', detail: `expected 9 tiles, found ${tiles.length}` };
    }

    console.log(`[bot] captcha: analyzing ${tiles.length} tiles via pixel screenshot`);

    // Analyze each tile by screenshotting it
    const confidences = [];
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      try {
        const screenshot = await tile.screenshot();
        // Use page.evaluate to create an ImageData from the screenshot buffer
        const analysis = await page.evaluate(async (buf) => {
          const blob = new Blob([buf], { type: 'image/png' });
          const bmp = await createImageBitmap(blob);
          const canvas = new OffscreenCanvas(bmp.width, bmp.height);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bmp, 0, 0);
          const imageData = ctx.getImageData(0, 0, bmp.width, bmp.height);
          return { data: Array.from(imageData.data), width: bmp.width, height: bmp.height };
        }, Array.from(screenshot));

        // Reconstruct Uint8ClampedArray in Node
        const imgData = { data: new Uint8ClampedArray(analysis.data) };
        const confidence = analyzeTilePixels(imgData, analysis.width, analysis.height);
        confidences.push({ index: i, confidence });
        console.log(`[bot] captcha tile ${i}: confidence=${confidence.toFixed(2)}`);
      } catch (err) {
        confidences.push({ index: i, confidence: 0 });
        console.log(`[bot] captcha tile ${i}: analysis failed (${err.message})`);
      }
    }

    // Select tiles with confidence > 0.5
    const THRESHOLD = 0.5;
    const selectedTiles = confidences.filter((c) => c.confidence >= THRESHOLD);

    if (selectedTiles.length === 0) {
      // Fallback: select top 3 by confidence
      confidences.sort((a, b) => b.confidence - a.confidence);
      selectedTiles.push(...confidences.slice(0, 3));
    }

    console.log(`[bot] captcha: selecting ${selectedTiles.length} tiles`);

    // Click selected tiles
    for (const { index } of selectedTiles) {
      await tiles[index].click().catch(() => {});
    }

    // Take screenshot of selections for evidence
    await ctx.reporter?.screenshot?.(ctx.page, 'captcha-selections').catch(() => {});

    // Click verify
    try {
      await page.click(VERIFY_BTN_SEL, { timeout: 3000 });
    } catch {
      return { outcome: 'error', detail: 'verify button not clickable' };
    }

    // Wait for overlay to disappear (success) or error to appear
    try {
      await page.waitForSelector(OVERLAY_SEL, { state: 'hidden', timeout: 6000 });
      const duration = Date.now() - startTime;
      return { outcome: 'resolved', detail: `solved visual captcha in ${duration}ms (${selectedTiles.length} tiles)` };
    } catch {
      // Check for error state
      return { outcome: 'error', detail: 'captcha not cleared after submission' };
    }
  },
};

registerHandler(handler);
export default handler;

// Legacy arithmetic parser retained for backward-compatible unit tests.
// Not used by the visual CAPTCHA solver.
export function parseMathQuestion(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/What is (-?\d+)\s*([+-])\s*(-?\d+)\?/);
  if (!match) return null;
  const a = parseInt(match[1], 10);
  const op = match[2];
  const b = parseInt(match[3], 10);
  const answer = op === '+' ? a + b : a - b;
  return { a, op, b, answer };
}
