import { useSearchParams, Link } from 'react-router-dom';

export default function PromoPage() {
  const [searchParams] = useSearchParams();
  const dest = searchParams.get('dest') || '/catalog';
  const continueUrl = dest.includes('?') ? `${dest}&noredirect=1` : `${dest}?noredirect=1`;

  return (
    <div className="page-promo" style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ background: '#1e293b', padding: '2.5rem', borderRadius: '12px', border: '1px solid #334155', color: '#f8fafc' }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🎉</span>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#38bdf8' }}>Special Promo Interstitial</h1>
        <p style={{ color: '#94a3b8', marginBottom: '2rem', fontSize: '1.1rem' }}>
          You were redirected to this promo page! Click below to return to your original destination.
        </p>
        <Link
          to={continueUrl}
          className="promo-continue-btn"
          style={{
            display: 'inline-block',
            background: '#0284c7',
            color: '#ffffff',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: '600'
          }}
        >
          Continue to Intended Destination
        </Link>
      </div>
    </div>
  );
}
