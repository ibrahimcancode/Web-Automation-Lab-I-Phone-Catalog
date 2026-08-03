// ChaosProvider — integrates the chaos engine into the React app
// Wraps the application and manages the lifecycle of all chaos scenarios

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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

const OVERRIDE_JSON = import.meta.env.VITE_CHAOS_JSON;
let defaultConfig = baseConfig;
if (OVERRIDE_JSON) {
  try {
    defaultConfig = JSON.parse(OVERRIDE_JSON);
  } catch (err) {
    console.error('[CHAOS] Invalid VITE_CHAOS_JSON override, using bundled config:', err);
  }
}

export function ChaosProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [cookieDismissed, setCookieDismissed] = useState(false);
  const location = useLocation();
  const initialized = useRef(false);

  // §10 #2: reset decision cache on navigation
  useEffect(() => {
    resetDecisionCache();
  }, [location.pathname, location.search]);

  // Initialize engine once
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      initialize(defaultConfig);
    } catch (err) {
      console.error('[CHAOS] Failed to initialize:', err);
    }
    setReady(true);
  }, []);

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
