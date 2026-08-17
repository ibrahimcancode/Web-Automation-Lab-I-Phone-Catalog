// Cookie Banner handler — POST_RESPONSE hook type (§11)

import { useState, useEffect, useCallback } from 'react';
import { logEvent } from '../logger.js';

const SESSION_KEY = 'chaos_cookie_seen';

function isSessionSet() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function setSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function CookieBanner({ onComplete }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const alreadySeen = isSessionSet();
    console.log(`[CHAOS] CookieBanner injection running — already_seen_this_session=${alreadySeen}`);

    if (alreadySeen) {
      console.log(`[CHAOS] CookieBanner skipped — "${SESSION_KEY}" already set this session`);
      logEvent({ scenario: 'cookie_banner', action: 'skipped', result: 'session_already_set' });
      onComplete?.('already_dismissed');
      return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
      logEvent({ scenario: 'cookie_banner', action: 'triggered', result: 'displayed' });
    }, 100);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const dismiss = useCallback(
    (choice) => {
      setSession();
      setVisible(false);
      logEvent({ scenario: 'cookie_banner', action: 'dismissed', result: choice });
      onComplete?.(choice);
    },
    [onComplete],
  );

  if (!visible) return null;

  return (
    <div
      id="cookie-banner"
      data-chaos="cookie"
      role="dialog"
      aria-label="Cookie consent"
      className="chaos-cookie-banner"
    >
      <div className="chaos-cookie-content">
        <p>We use cookies to improve your browsing experience.</p>
        <div className="chaos-cookie-actions">
          <button className="chaos-btn chaos-btn-accept" onClick={() => dismiss('accept')}>
            Accept
          </button>
          <button className="chaos-btn chaos-btn-reject" onClick={() => dismiss('reject')}>
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
