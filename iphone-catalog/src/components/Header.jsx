import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../state/ThemeContext';
import { useStore } from '../state/useStore';

export default function Header() {
  const { mode, toggleTheme } = useTheme();
  const location = useLocation();
  const favorites = useStore((s) => s.favorites);
  const compare = useStore((s) => s.compare);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const isActive = (path) => location.pathname === path;

  return (
    <header className="site-header">
      <div className="header-inner container">
        <Link to="/" className="logo">iPhone Catalog</Link>

        <nav className="desktop-nav" aria-label="Main navigation">
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>Home</Link>
          <Link to="/catalog" className={`nav-link ${isActive('/catalog') ? 'active' : ''}`}>Catalog</Link>
          <Link to="/compare" className={`nav-link compare-link ${isActive('/compare') ? 'active' : ''}`}>
            Compare
            {compare.length > 0 && <span className="badge">{compare.length}</span>}
          </Link>
          <Link to="/favorites" className={`nav-link favorites-link ${isActive('/favorites') ? 'active' : ''}`}>
            Favorites
            {favorites.length > 0 && <span className="badge">{favorites.length}</span>}
          </Link>
        </nav>

        <div className="header-actions">
          <button
            className="btn-icon theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
          >
            {mode === 'light' ? '🌙' : '☀️'}
          </button>

          <button
            className="btn-icon hamburger"
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={drawerOpen}
          >
            {drawerOpen ? '×' : '☰'}
          </button>
        </div>
      </div>

      {drawerOpen && (
        <>
          <div className="drawer-scrim" onClick={() => setDrawerOpen(false)} />
          <nav className="mobile-drawer" aria-label="Mobile navigation">
            <Link to="/" className="drawer-link">Home</Link>
            <Link to="/catalog" className="drawer-link">Catalog</Link>
            <Link to="/compare" className="drawer-link">
              Compare
              {compare.length > 0 && <span className="badge">{compare.length}</span>}
            </Link>
            <Link to="/favorites" className="drawer-link">
              Favorites
              {favorites.length > 0 && <span className="badge">{favorites.length}</span>}
            </Link>
          </nav>
        </>
      )}
    </header>
  );
}
