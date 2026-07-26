import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page-404 container">
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist or has been moved.</p>
      <Link to="/catalog" className="btn btn-primary">Back to Catalog</Link>
    </div>
  );
}
