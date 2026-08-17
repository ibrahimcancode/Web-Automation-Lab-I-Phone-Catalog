// Visual Traffic-Light CAPTCHA — owned local simulation.
//
// Renders a 3x3 grid of tiles. Some tiles contain traffic lights (vertical
// red/yellow/green signal pattern on a pole), others contain distractor scenes.
//
// SECURITY: The answer (which tiles contain traffic lights) exists ONLY in
// React state. There are no data attributes, alt texts, class names, hidden
// inputs, filenames, or global variables that reveal which tiles are correct.
// The bot MUST solve this by analyzing visible browser pixels (screenshots).

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { logEvent } from '../logger.js';
import { get_decision } from '../engine.js';

const SESSION_KEY = 'chaos_captcha_solved';

function isCaptchaSolved() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}

function markCaptchaSolved() {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
}

// Seeded PRNG for deterministic tile generation from chaos seed
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate a deterministic layout: which of the 9 tiles contain traffic lights.
// Returns an array of 9 booleans. At least 3, at most 5 tiles have lights.
function generateLayout(seed) {
  const rng = mulberry32(seed);
  const tiles = [false, false, false, false, false, false, false, false, false];
  // Place 3-5 traffic lights
  const count = 3 + Math.floor(rng() * 3);
  let placed = 0;
  while (placed < count) {
    const idx = Math.floor(rng() * 9);
    if (!tiles[idx]) {
      tiles[idx] = true;
      placed++;
    }
  }
  return tiles;
}

// SVG traffic light component — renders a vertical signal on a pole.
// Colors are standard traffic-light colors (red top, yellow mid, green bottom).
function TrafficLightSVG({ variant = 0 }) {
  // Slight variant offsets to avoid identical renders
  const poleHeight = 60 + (variant % 3) * 5;
  return (
    <svg viewBox="0 0 60 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      {/* Pole */}
      <rect x="26" y={poleHeight} width="8" height={100 - poleHeight} fill="#333" rx="2" />
      {/* Housing */}
      <rect x="14" y="8" width="32" height="58" rx="6" fill="#222" stroke="#444" strokeWidth="1" />
      {/* Red light */}
      <circle cx="30" cy="22" r="10" fill="#ff0000" />
      <circle cx="30" cy="22" r="7" fill="#ff3333" opacity="0.7" />
      {/* Yellow light */}
      <circle cx="30" cy="37" r="10" fill="#ffcc00" />
      <circle cx="30" cy="37" r="7" fill="#ffdd44" opacity="0.7" />
      {/* Green light */}
      <circle cx="30" cy="52" r="10" fill="#00cc00" />
      <circle cx="30" cy="52" r="7" fill="#33dd33" opacity="0.7" />
    </svg>
  );
}

// Distractor scene SVGs — simple colored scenes without traffic lights
const DISTRACTOR_SCENES = [
  // Building with windows
  () => (
    <svg viewBox="0 0 60 60" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="5" width="40" height="50" fill="#667" rx="2" />
      <rect x="15" y="10" width="8" height="8" fill="#ffd" />
      <rect x="26" y="10" width="8" height="8" fill="#ffd" />
      <rect x="37" y="10" width="8" height="8" fill="#ffd" />
      <rect x="15" y="25" width="8" height="8" fill="#ffd" />
      <rect x="26" y="25" width="8" height="8" fill="#cc8844" />
      <rect x="37" y="25" width="8" height="8" fill="#ffd" />
      <rect x="15" y="40" width="8" height="8" fill="#ffd" />
      <rect x="26" y="40" width="8" height="8" fill="#ffd" />
      <rect x="37" y="40" width="8" height="8" fill="#ffd" />
    </svg>
  ),
  // Tree
  () => (
    <svg viewBox="0 0 60 60" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect x="27" y="35" width="6" height="20" fill="#8B4513" />
      <circle cx="30" cy="22" r="18" fill="#228B22" />
      <circle cx="22" cy="28" r="12" fill="#2e8b2e" />
      <circle cx="38" cy="28" r="12" fill="#2e8b2e" />
    </svg>
  ),
  // Clouds
  () => (
    <svg viewBox="0 0 60 60" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="60" fill="#87CEEB" />
      <ellipse cx="20" cy="25" rx="14" ry="10" fill="white" />
      <ellipse cx="35" cy="22" rx="12" ry="9" fill="white" />
      <ellipse cx="45" cy="30" rx="10" ry="7" fill="#eee" />
    </svg>
  ),
  // Mountain
  () => (
    <svg viewBox="0 0 60 60" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="60" fill="#87CEEB" />
      <polygon points="30,8 50,55 10,55" fill="#666" />
      <polygon points="30,8 35,20 25,20" fill="white" />
    </svg>
  ),
  // House
  () => (
    <svg viewBox="0 0 60 60" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <polygon points="30,8 55,30 5,30" fill="#b33" />
      <rect x="12" y="30" width="36" height="25" fill="#ddd" />
      <rect x="24" y="38" width="12" height="17" fill="#8B4513" />
      <rect x="15" y="34" width="8" height="8" fill="#87CEEB" />
      <rect x="37" y="34" width="8" height="8" fill="#87CEEB" />
    </svg>
  ),
];

function DistractorScene({ index }) {
  const Scene = DISTRACTOR_SCENES[index % DISTRACTOR_SCENES.length];
  return <Scene />;
}

export function SimulatedCaptcha() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState('grid'); // 'grid' | 'verifying' | 'done' | 'error'
  const [selected, setSelected] = useState(new Set());
  const gridRef = useRef(null);

  // Generate deterministic layout from chaos seed
  const decision = useMemo(() => get_decision('simulated_captcha'), []);
  const seed = useMemo(() => {
    const baseSeed = decision?.seed ?? 42;
    return baseSeed + 1000;
  }, [decision]);
  const layout = useMemo(() => generateLayout(seed), [seed]);

  useEffect(() => {
    if (isCaptchaSolved()) {
      console.log('[CHAOS] Visual CAPTCHA skipped — already solved this session');
      return;
    }

    if (!decision?.active) return;

    const delayMs = Math.round((decision.delay_seconds || 1) * 1000);
    const timer = setTimeout(() => {
      setVisible(true);
      logEvent({
        scenario: 'simulated_captcha',
        action: 'triggered',
        duration_ms: delayMs,
        result: 'visual_grid_displayed',
      });
    }, delayMs);

    return () => clearTimeout(timer);
  }, []);

  const toggleTile = useCallback((index) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    // Check if selection matches layout
    const correct = layout.every((hasLight, i) =>
      hasLight === selected.has(i),
    );

    if (correct) {
      setPhase('verifying');
      logEvent({ scenario: 'simulated_captcha', action: 'answer_correct', result: 'visual_grid_solved' });
      markCaptchaSolved();
      setTimeout(() => {
        setPhase('done');
        setVisible(false);
        logEvent({ scenario: 'simulated_captcha', action: 'completed', result: 'passed' });
      }, 1200);
    } else {
      setPhase('error');
      logEvent({ scenario: 'simulated_captcha', action: 'answer_wrong', result: `selected=${selected.size}` });
      setTimeout(() => {
        setPhase('grid');
        setSelected(new Set());
      }, 1500);
    }
  }, [selected, layout]);

  if (!visible || phase === 'done') return null;

  return (
    <div
      id="simulated-captcha-overlay"
      data-chaos="captcha"
      className="chaos-captcha-overlay"
      role="dialog"
      aria-label="Human verification"
      aria-modal="true"
    >
      <div className="chaos-captcha-card" style={{ maxWidth: 440 }}>
        <div className="chaos-captcha-header">
          <div className="chaos-captcha-shield">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h2>Security Check</h2>
          <p>Select all squares containing traffic lights</p>
        </div>

        {phase === 'grid' && (
          <>
            <div
              ref={gridRef}
              className="chaos-captcha-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '4px',
                marginBottom: '16px',
              }}
            >
              {layout.map((_hasLight, index) => (
                <button
                  key={index}
                  className={`chaos-captcha-tile ${selected.has(index) ? 'chaos-captcha-tile--selected' : ''}`}
                  onClick={() => toggleTile(index)}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    border: selected.has(index) ? '3px solid #5856d6' : '2px solid #ddd',
                    borderRadius: '8px',
                    padding: '4px',
                    background: selected.has(index) ? 'rgba(88, 86, 214, 0.1)' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 150ms ease',
                    boxSizing: 'border-box',
                  }}
                >
                  {layout[index] ? (
                    <TrafficLightSVG variant={index} />
                  ) : (
                    <DistractorScene index={index} />
                  )}
                </button>
              ))}
            </div>
            <button
              className="chaos-btn chaos-btn-accept chaos-captcha-submit"
              onClick={handleSubmit}
              disabled={selected.size === 0}
              style={{ width: '100%', opacity: selected.size === 0 ? 0.5 : 1 }}
            >
              Verify
            </button>
          </>
        )}

        {phase === 'verifying' && (
          <div className="chaos-captcha-verifying">
            <div className="chaos-captcha-spinner" />
            <p>Verifying&hellip;</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="chaos-captcha-verifying">
            <p style={{ color: '#ff3b30', fontWeight: 600 }}>Incorrect selection. Try again.</p>
          </div>
        )}
      </div>
    </div>
  );
}
