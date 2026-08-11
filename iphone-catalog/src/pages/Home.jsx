import { Link } from 'react-router-dom';
import { getModelBySlug } from '../data/models';
import { getCurrentDomDriftVariant } from '../chaos/handlers/DomDrift.jsx';
import { useState, useEffect } from 'react';

const FEATURED_SLUGS = ['iphone-17-pro-max', 'iphone-x', 'iphone-se-3rd-gen'];

const tierColors = {
  'SE': '#636366',
  'Standard': '#007AFF',
  'Mini': '#5856D6',
  'Plus': '#FF9500',
  'Air': '#AF52DE',
  'Pro': '#FF2D55',
  'Pro Max': '#C8102E',
};

export default function Home() {
  const featured = FEATURED_SLUGS.map(getModelBySlug).filter(Boolean);
  const [domVariant, setDomVariant] = useState('primary');

  useEffect(() => {
    setDomVariant(getCurrentDomDriftVariant());
  }, []);

  const formatPrice = (model) => {
    const min = Math.min(...model.variants.map((v) => v.launchPriceUSD));
    return `$${min.toLocaleString()}`;
  };

  const isAlt1 = domVariant === 'alt1';
  const isAlt2 = domVariant === 'alt2';

  return (
    <div className={isAlt1 ? 'page-home-alt1' : isAlt2 ? 'page-home-alt2' : 'page-home'}>
      <section className="hero">
        <div className="container">
          <h1>The Complete iPhone Lineup</h1>
          <p>Browse, compare, and find the right iPhone — from the original SE to the latest Pro Max.</p>
          <Link to="/catalog" className="btn btn-primary">Browse All Models</Link>
        </div>
      </section>

      <section className="timeline container">
        <h2>iPhone Through the Years</h2>
        <div className="timeline-strip">
          {[2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((year) => (
            <Link key={year} to={`/catalog?year=${year}`} className="timeline-year">
              {year}
            </Link>
          ))}
        </div>
      </section>

      <section className="featured container">
        <h2>Featured Models</h2>
        <p className="section-sub">Explore iconic and current flagship iPhones.</p>
        <div className={isAlt2 ? 'placeholder-grid-alt2' : isAlt1 ? 'placeholder-grid-alt1' : 'placeholder-grid'}>
          {featured.map((model) => (
            <Link key={model.id} to={`/model/${model.id}`} className="product-card featured-card">
              <div className="card-image">
                <img
                  src={model.heroImage}
                  alt={model.displayName}
                  loading="lazy"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="card-image-fallback">{model.displayName}</div>
              </div>
              <div className="card-body">
                <div className="card-meta">
                  <span className="tier-badge" style={{ background: `${tierColors[model.tier]}18`, color: tierColors[model.tier] }}>
                    {model.tier}
                  </span>
                  <span className="card-year">{model.generationYear}</span>
                </div>
                <h3 className="card-name">{model.displayName}</h3>
                <p className="card-price">From {formatPrice(model)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
