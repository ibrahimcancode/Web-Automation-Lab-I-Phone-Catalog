import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner container">
        <div className="footer-col">
          <h4>About</h4>
          <p>
            An independent iPhone catalog covering the full lineup from iPhone 6 through iPhone 17 Pro Max. Not
            affiliated with Apple Inc.
          </p>
        </div>
        <div className="footer-col">
          <h4>Quick Links</h4>
          <nav aria-label="Footer navigation">
            <Link to="/">Home</Link>
            <Link to="/catalog">Catalog</Link>
            <Link to="/compare">Compare</Link>
            <Link to="/favorites">Favorites</Link>
          </nav>
        </div>
        <div className="footer-col">
          <h4>Data</h4>
          <p>
            Specs are sourced from official Apple documentation. Prices shown are launch/reference prices, not current
            retail.
          </p>
          <p className="last-updated">Last updated: July 2025</p>
        </div>
      </div>
      <div className="footer-bottom container">
        <p>This is an independent project. All product names and trademarks are property of their respective owners.</p>
      </div>
    </footer>
  );
}
