// Simulated Captcha handler — POST_RESPONSE hook type
// Fake "I'm not a robot" interstitial that blocks navigation until solved

import { useState, useEffect, useCallback, useRef } from 'react';
import { logEvent } from '../logger.js';
import { get_decision } from '../engine.js';

const SESSION_KEY = 'chaos_captcha_solved';

function isCaptchaSolved() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}

function markCaptchaSolved() {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
}

function generateMathProblem() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const ops = ['+', '-'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  const answer = op === '+' ? a + b : a - b;
  return { text: `${a} ${op} ${b}`, answer };
}

export function SimulatedCaptcha() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState('checkbox'); // 'checkbox' | 'math' | 'verifying' | 'done'
  const [problem] = useState(() => generateMathProblem());
  const [userAnswer, setUserAnswer] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isCaptchaSolved()) {
      console.log('[CHAOS] SimulatedCaptcha skipped — already solved this session');
      return;
    }

    const decision = get_decision('simulated_captcha');
    if (!decision?.active) return;

    const delayMs = Math.round((decision.delay_seconds || 1) * 1000);

    const timer = setTimeout(() => {
      setVisible(true);
      logEvent({
        scenario: 'simulated_captcha',
        action: 'triggered',
        duration_ms: delayMs,
        result: 'displayed',
      });
    }, delayMs);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase === 'math' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase]);

  const handleCheckboxClick = useCallback(() => {
    setPhase('math');
    logEvent({ scenario: 'simulated_captcha', action: 'checkbox_clicked', result: 'showing_math' });
  }, []);

  const handleSubmitAnswer = useCallback((e) => {
    e.preventDefault();
    const parsed = parseInt(userAnswer, 10);
    if (parsed === problem.answer) {
      setPhase('verifying');
      logEvent({ scenario: 'simulated_captcha', action: 'answer_correct', result: String(problem.answer) });
      markCaptchaSolved();
      setTimeout(() => {
        setPhase('done');
        setVisible(false);
        logEvent({ scenario: 'simulated_captcha', action: 'completed', result: 'passed' });
      }, 1200);
    } else {
      setError(true);
      logEvent({ scenario: 'simulated_captcha', action: 'answer_wrong', result: userAnswer });
      setTimeout(() => setError(false), 1500);
    }
  }, [userAnswer, problem.answer]);

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
      <div className="chaos-captcha-card">
        <div className="chaos-captcha-header">
          <div className="chaos-captcha-shield">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h2>Security Check</h2>
          <p>Please verify you are human to continue.</p>
        </div>

        {phase === 'checkbox' && (
          <button
            className="chaos-captcha-checkbox-btn"
            onClick={handleCheckboxClick}
            aria-label="I'm not a robot"
          >
            <span className="chaos-captcha-checkbox" />
            <span className="chaos-captcha-checkbox-label">I&apos;m not a robot</span>
            <img
              className="chaos-captcha-badge"
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='1.5'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 6v6l4 2'/%3E%3C/svg%3E"
              alt=""
              width="24"
              height="24"
            />
          </button>
        )}

        {phase === 'math' && (
          <form className="chaos-captcha-math" onSubmit={handleSubmitAnswer}>
            <p className="chaos-captcha-question">
              What is <strong>{problem.text}</strong>?
            </p>
            <input
              ref={inputRef}
              type="number"
              className={`chaos-captcha-input ${error ? 'chaos-captcha-input--error' : ''}`}
              value={userAnswer}
              onChange={(e) => { setUserAnswer(e.target.value); setError(false); }}
              placeholder="Your answer"
              aria-label="Math answer"
            />
            {error && <p className="chaos-captcha-error">Incorrect, try again.</p>}
            <button type="submit" className="chaos-btn chaos-btn-accept chaos-captcha-submit">
              Verify
            </button>
          </form>
        )}

        {phase === 'verifying' && (
          <div className="chaos-captcha-verifying">
            <div className="chaos-captcha-spinner" />
            <p>Verifying&hellip;</p>
          </div>
        )}
      </div>
    </div>
  );
}
