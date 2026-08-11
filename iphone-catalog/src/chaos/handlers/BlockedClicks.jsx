// Blocked Clicks handler — Scenario 8.
//
// Renders a transparent overlay directly on top of the catalog "Load more"
// button so pointer events land on the overlay instead of the button. When the
// bot removes the overlay (its recovery step), this component re-mounts it after
// `rearm_after_dismissal_ms` — a single dismissal is not enough, matching the
// spec ("a transparent overlay that re-mounts after the click misses").
//
// The overlay is created imperatively and appended to <body> (React never owns
// the node), so the bot's `el.remove()` recovery cannot fight React's
// reconciliation. Position is refreshed on scroll/resize AND every animation
// frame so it stays pixel-synced with the button even while Playwright scrolls
// it into view — the click's hit-target check then reliably sees the blocker.
//
// Self-limiting: with no button on the page (home/detail) nothing is visible.

import { useEffect } from 'react';
import { get_configuration } from '../engine.js';

const DEFAULT_COVER_SELECTOR =
  '.catalog-grid button.load-more, ' +
  '.catalog-grid-alt1 button.load-more-alt1, ' +
  '.product-list.alt2 button.load-more.alt2';
const DEFAULT_REARM_MS = 1500;

export function BlockedClicks() {
  const cfg = get_configuration('blocked_clicks') || {};
  const coverSelector = cfg.cover_selector || DEFAULT_COVER_SELECTOR;
  const rearmMs = cfg.rearm_after_dismissal_ms ?? DEFAULT_REARM_MS;

  useEffect(() => {
    let el = null;
    let rafId = 0;
    let watcher = 0;
    let removedAt = null;

    const createBlocker = () => {
      el = document.createElement('div');
      el.className = 'chaos-click-blocker';
      el.setAttribute('data-chaos', 'blocked_clicks');
      el.setAttribute('data-testid', 'chaos-click-blocker');
      el.style.cssText =
        'position:fixed;top:0;left:0;width:0;height:0;display:none;' +
        'z-index:9990;pointer-events:auto;cursor:not-allowed;background:transparent;';
      document.body.appendChild(el);
    };

    const measure = () => {
      if (!el) return;
      const target = document.querySelector(coverSelector);
      if (!target) {
        el.style.display = 'none';
        return;
      }
      const r = target.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        el.style.display = 'none';
        return;
      }
      el.style.top = `${r.top}px`;
      el.style.left = `${r.left}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      el.style.display = 'block';
    };

    createBlocker();
    measure();

    const refresh = () => measure();
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    const tick = () => {
      measure();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Re-arm after dismissal: when the bot removes the overlay from the DOM,
    // mount a fresh one after `rearmMs`.
    watcher = setInterval(() => {
      if (el && !document.contains(el)) {
        if (removedAt === null) removedAt = Date.now();
      }
      if (removedAt !== null && Date.now() - removedAt >= rearmMs) {
        removedAt = null;
        createBlocker();
        measure();
      }
    }, 250);

    return () => {
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
      cancelAnimationFrame(rafId);
      clearInterval(watcher);
      if (el && document.contains(el)) el.remove();
    };
  }, [coverSelector, rearmMs]);

  return null;
}
