import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/useStore';
import { getModelBySlug } from '../data/models';

export default function Favorites() {
  const favoriteIds = useStore((s) => s.favorites);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const clearFavorites = useStore((s) => s.clearFavorites);
  const compare = useStore((s) => s.compare);
  const addToCompare = useStore((s) => s.addToCompare);
  const removeFromCompare = useStore((s) => s.removeFromCompare);
  const [showClearModal, setShowClearModal] = useState(false);
  const models = favoriteIds.map((id) => getModelBySlug(id)).filter(Boolean);

  const formatPrice = (m) => {
    const min = Math.min(...m.variants.map((v) => v.launchPriceUSD));
    return `$${min.toLocaleString()}`;
  };

  if (models.length === 0) {
    return (
      <div className="page-favorites container">
        <h1>Favorites</h1>
        <div className="empty-state">
          <h3>No saved models yet</h3>
          <p>Save models you're interested in to find them here.</p>
          <Link to="/catalog" className="btn btn-primary">
            Browse Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-favorites container">
      <div className="favorites-header">
        <h1>Favorites</h1>
        <button className="btn btn-text danger" onClick={() => setShowClearModal(true)}>
          Clear all
        </button>
      </div>

      <div className="card-grid">
        {models.map((model) => (
          <div key={model.id} className="product-card">
            <a href={`/model/${model.id}`} className="card-link">
              <div className="card-image">
                <img src={model.heroImage} alt={model.displayName} loading="lazy" />
                <div className="card-image-fallback">{model.displayName}</div>
              </div>
            </a>
            <div className="card-body">
              <div className="card-meta">
                <span className="tier-badge">{model.tier}</span>
                <span className="card-year">{model.generationYear}</span>
              </div>
              <h3 className="card-name">
                <a href={`/model/${model.id}`}>{model.displayName}</a>
              </h3>
              <p className="card-price">From {formatPrice(model)}</p>
              <div className="card-actions">
                <button
                  className="btn-icon favorite active"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(model.id);
                  }}
                  aria-label={`Remove ${model.displayName} from favorites`}
                >
                  ♥
                </button>
                <button
                  className={`btn-icon compare ${compare.includes(model.id) ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (compare.includes(model.id)) {
                      removeFromCompare(model.id);
                    } else {
                      addToCompare(model.id);
                    }
                  }}
                  aria-label={
                    compare.includes(model.id)
                      ? `Remove ${model.displayName} from compare`
                      : `Add ${model.displayName} to compare`
                  }
                >
                  ⇄
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showClearModal && (
        <div className="modal-overlay" onClick={() => setShowClearModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Clear all favorites">
            <h2>Clear all favorites?</h2>
            <p>This will remove all {models.length} saved models. This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-text" onClick={() => setShowClearModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  clearFavorites();
                  setShowClearModal(false);
                }}
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
