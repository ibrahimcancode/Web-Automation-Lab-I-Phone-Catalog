// ChaosProvider — integrates the chaos engine into the React app
// Wraps the application and manages the lifecycle of all chaos scenarios

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { initialize, should_trigger, resetDecisionCache } from './engine.js';
import { CookieBanner } from './handlers/CookieBanner.jsx';
import { NewsletterPopup } from './handlers/NewsletterPopup.jsx';
import { SimulatedCaptcha } from './handlers/SimulatedCaptcha.jsx';
import './chaos.css';

// Default config — loaded from chaos.json, but an explicit VITE_CHAOS_JSON
// override (set at dev-server start) takes precedence. Used by the Week 2
// automated scenario tests to force a single scenario on deterministically
// without mutating the committed chaos.json. When the env var is absent,
// behavior is unchanged: the bundled chaos.json is used.
import baseConfig from './chaos.json';

export function ChaosProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [cookieDismissed, setCookieDismissed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const initialized = useRef(false);

  // §10 #2: reset decision cache on navigation
  useEffect(() => {
    resetDecisionCache();
  }, [location.pathname, location.search]);

  // Initialize engine once with dynamic override resolution
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let cfg = baseConfig;
    const override =
      typeof window !== 'undefined' && window.__CHAOS_CONFIG__
        ? JSON.stringify(window.__CHAOS_CONFIG__)
        : import.meta.env.VITE_CHAOS_JSON;
    if (override) {
      try {
        cfg = typeof override === 'string' ? JSON.parse(override) : override;
      } catch (err) {
        console.error('[CHAOS] Invalid override, using baseConfig:', err);
      }
    }

    try {
      initialize(cfg);
    } catch (err) {
      console.error('[CHAOS] Failed to initialize:', err);
    }
    setReady(true);
  }, []);

  // Scenario 6: Unexpected redirects — intercept navigation and redirect to promo
  useEffect(() => {
    if (!ready) return;
    const isPromo = location.pathname === '/promo';
    const hasNoRedirect = location.search.includes('noredirect=1') || location.search.includes('dest=');
    const trigger = should_trigger('unexpected_redirect');
    if (!isPromo && !hasNoRedirect && trigger) {
      const dest = encodeURIComponent(location.pathname + location.search);
      navigate(`/promo?dest=${dest}`, { replace: true });
    }
  }, [location.pathname, location.search, ready, navigate]);

  const handleCookieComplete = useCallback(() => {
    setCookieDismissed(true);
  }, []);

  if (!ready) return null;

  const showCookieBanner = should_trigger('cookie_banner');
  const showNewsletter = should_trigger('newsletter_popup');
  const showCaptcha = should_trigger('simulated_captcha');

  return (
    <>
      {children}
      {showCookieBanner && <CookieBanner onComplete={handleCookieComplete} />}
      {showNewsletter && <NewsletterPopup cookieDismissed={cookieDismissed} />}
      {showCaptcha && <SimulatedCaptcha />}
    </>
  );
}
