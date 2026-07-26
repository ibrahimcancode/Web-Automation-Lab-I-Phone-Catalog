import { useState, useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { getModelBySlug, getSimilarModels } from '../data/models';
import { useStore } from '../state/useStore';

export default function ModelDetail() {
  const { slug } = useParams();
  const model = getModelBySlug(slug);
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedStorage, setSelectedStorage] = useState(0);

  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const favorites = useStore((s) => s.favorites);
  const addToCompare = useStore((s) => s.addToCompare);
  const removeFromCompare = useStore((s) => s.removeFromCompare);
  const compare = useStore((s) => s.compare);

  const similar = useMemo(() => {
    if (!model) return [];
    return getSimilarModels(model.id);
  }, [model]);

  if (!model) return <Navigate to="/404" replace />;

  const activeVariant = model.variants[selectedStorage] || model.variants[0];
  const currentColor = model.colors[selectedColor];

  const formatPrice = (v) => `$${v.launchPriceUSD.toLocaleString()}`;

  return (
    <div className="page-detail container">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/catalog">Catalog</Link></li>
          <li aria-current="page">{model.displayName}</li>
        </ol>
      </nav>

      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="hero-image">
            <img
              src={model.heroImage}
              alt={`${model.displayName} in ${currentColor?.name || ''}`}
            />
          </div>
          {model.gallery?.length > 0 && (
            <div className="gallery-strip">
              {model.gallery.map((img, i) => (
                <img key={i} src={img} alt={`${model.displayName} gallery ${i + 1}`} loading="lazy" />
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <div className="detail-header">
            <span className="tier-badge">{model.tier}</span>
            <h1>{model.displayName}</h1>
            <p className="detail-year">{model.generationYear}</p>
          </div>

          <div className="color-picker">
            <h3>Color</h3>
            <div className="swatches" role="radiogroup" aria-label="Select color">
              {model.colors.map((color, i) => (
                <button
                  key={color.name}
                  className={`swatch ${i === selectedColor ? 'selected' : ''}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => setSelectedColor(i)}
                  role="radio"
                  aria-checked={i === selectedColor}
                  aria-label={color.name}
                  title={color.name}
                />
              ))}
            </div>
            <p className="color-label">{currentColor?.name}</p>
          </div>

          <div className="storage-picker">
            <h3>Storage</h3>
            <div className="storage-options" role="radiogroup" aria-label="Select storage">
              {model.variants.map((v, i) => (
                <button
                  key={v.storageGB}
                  className={`storage-btn ${i === selectedStorage ? 'selected' : ''}`}
                  onClick={() => setSelectedStorage(i)}
                  role="radio"
                  aria-checked={i === selectedStorage}
                >
                  {v.storageGB} GB
                </button>
              ))}
            </div>
          </div>

          <div className="price-display">
            <p className="price-label">Launch price ({activeVariant?.storageGB} GB)</p>
            <p className="price-value">{activeVariant ? formatPrice(activeVariant) : 'N/A'}</p>
          </div>

          <div className="detail-actions">
            <button
              className={`btn btn-primary ${favorites.includes(model.id) ? 'favorited' : ''}`}
              onClick={() => toggleFavorite(model.id)}
            >
              {favorites.includes(model.id) ? '♥ Saved' : '♡ Save'}
            </button>
            <button
              className={`btn btn-secondary ${compare.includes(model.id) ? 'comparing' : ''}`}
              onClick={() => compare.includes(model.id) ? removeFromCompare(model.id) : addToCompare(model.id)}
              disabled={!compare.includes(model.id) && compare.length >= 4}
            >
              {compare.includes(model.id) ? '⇄ In Compare' : '⇄ Compare'}
            </button>
          </div>

          {model.keyFeatures?.length > 0 && (
            <div className="key-features">
              <h3>Key Features</h3>
              <ul>
                {model.keyFeatures.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      <section className="spec-sheet">
        <h2>Specifications</h2>
        <div className="spec-groups">
          <div className="spec-group">
            <h3>Display</h3>
            <table>
              <tbody>
                <tr><td>Size</td><td>{model.displayInches} inches</td></tr>
                <tr><td>Type</td><td>{model.displayType}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="spec-group">
            <h3>Chip</h3>
            <table>
              <tbody>
                <tr><td>Processor</td><td>{model.chip.name}</td></tr>
                <tr><td>CPU Cores</td><td>{model.chip.cpuCores}</td></tr>
                <tr><td>GPU Cores</td><td>{model.chip.gpuCores}</td></tr>
                {model.chip.neuralEngineCores && (
                  <tr><td>Neural Engine</td><td>{model.chip.neuralEngineCores} cores</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="spec-group">
            <h3>Camera</h3>
            <table>
              <tbody>
                <tr><td>System</td><td>{model.camera.system}</td></tr>
                <tr><td>Lenses</td><td>{model.camera.lenses.join(', ')}</td></tr>
                <tr><td>Front Camera</td><td>{model.camera.frontCameraMP} MP</td></tr>
                {model.camera.maxOpticalZoom && (
                  <tr><td>Max Optical Zoom</td><td>{model.camera.maxOpticalZoom}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {model.batteryVideoPlaybackHours && (
            <div className="spec-group">
              <h3>Battery</h3>
              <table>
                <tbody>
                  <tr><td>Video Playback</td><td>{model.batteryVideoPlaybackHours} hours</td></tr>
                </tbody>
              </table>
            </div>
          )}
          <div className="spec-group">
            <h3>Design</h3>
            <table>
              <tbody>
                <tr><td>Weight</td><td>{model.weightGrams}g</td></tr>
                <tr><td>Dimensions</td><td>{model.dimensionsMM.height} × {model.dimensionsMM.width} × {model.dimensionsMM.depth} mm</td></tr>
                <tr><td>Materials</td><td>{model.materials}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="spec-group">
            <h3>Colors & Storage</h3>
            <table>
              <tbody>
                <tr><td>Colors</td><td>{model.colors.map((c) => c.name).join(', ')}</td></tr>
                <tr><td>Storage Options</td><td>{model.variants.map((v) => `${v.storageGB} GB`).join(', ')}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {similar.length > 0 && (
        <section className="similar-models">
          <h2>Similar Models</h2>
          <div className="card-grid">
            {similar.map((m) => (
              <div key={m.id} className="product-card mini">
                <a href={`/model/${m.id}`} className="card-link">
                  <div className="card-image">
                    <img src={m.heroImage} alt={m.displayName} loading="lazy" />
                    <div className="card-image-fallback">{m.displayName}</div>
                  </div>
                </a>
                <div className="card-body">
                  <span className="tier-badge">{m.tier}</span>
                  <h3><a href={`/model/${m.id}`}>{m.displayName}</a></h3>
                  <p className="card-year">{m.generationYear}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
