// Newsletter Popup handler — POST_RESPONSE hook type (§12)

import { useState, useEffect, useCallback, useRef } from 'react';
import { logEvent } from '../logger.js';
import { get_decision } from '../engine.js';

export function NewsletterPopup({ cookieDismissed }) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const popupRef = useRef(null);
  const pendingRef = useRef(false);

  // §12 collision rule: if cookie banner is active, hold the popup
  useEffect(() => {
    const decision = get_decision('newsletter_popup');
    if (!decision?.active) return;

    const delayMs = Math.round((decision.delay_seconds || 3) * 1000);

    if (!cookieDismissed) {
      // Cookie banner still showing — mark as pending, will show after dismiss
      pendingRef.current = true;
      return;
    }

    // Cookie banner gone (or was never active) — show after delay
    const timer = setTimeout(() => {
      setVisible(true);
      logEvent({
        scenario: 'newsletter_popup',
        action: 'triggered',
        duration_ms: delayMs,
        result: 'displayed',
      });
    }, delayMs);

    return () => clearTimeout(timer);
  }, [cookieDismissed]);

  // When cookie banner dismisses, if popup was pending, start its timer
  useEffect(() => {
    if (!pendingRef.current || !cookieDismissed) return;
    pendingRef.current = false;

    const decision = get_decision('newsletter_popup');
    if (!decision?.active) return;

    const delayMs = Math.round((decision.delay_seconds || 3) * 1000);

    const timer = setTimeout(() => {
      setVisible(true);
      logEvent({
        scenario: 'newsletter_popup',
        action: 'triggered',
        duration_ms: delayMs,
        result: 'displayed',
      });
    }, delayMs);

    return () => clearTimeout(timer);
  }, [cookieDismissed]);

  const close = useCallback(() => {
    setVisible(false);
    logEvent({ scenario: 'newsletter_popup', action: 'dismissed', result: 'closed' });
  }, []);

  // ESC key support (§12)
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, close]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    logEvent({ scenario: 'newsletter_popup', action: 'subscribed', result: email });
  };

  // Outside click (§12)
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) close();
  };

  if (!visible) return null;

  return (
    <div className="chaos-popup-overlay" data-chaos="popup" onClick={handleBackdropClick} role="presentation">
      <div
        id="newsletter-popup"
        ref={popupRef}
        role="dialog"
        aria-label="Newsletter subscription"
        aria-modal="true"
        className="chaos-popup"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="chaos-popup-close" onClick={close} aria-label="Close popup">
          ×
        </button>

        {!submitted ? (
          <>
            <h2>Stay Updated</h2>
            <p>Get the latest iPhone news and reviews delivered to your inbox.</p>
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Email address"
                className="chaos-popup-input"
              />
              <button type="submit" className="chaos-btn chaos-btn-subscribe">
                Subscribe
              </button>
            </form>
          </>
        ) : (
          <div className="chaos-popup-success">
            <h2>Thanks!</h2>
            <p>You&apos;ve been subscribed.</p>
          </div>
        )}
      </div>
    </div>
  );
}
