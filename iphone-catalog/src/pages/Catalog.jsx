import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchModels, filterModels, sortModels, getAllModels } from '../data/models';
import { useStore } from '../state/useStore';
import { getCurrentDomDriftVariant } from '../chaos/handlers/DomDrift.jsx';

const BATCH_SIZE = 12;

const ALL_TIERS = ['SE', 'Standard', 'Mini', 'Plus', 'Air', 'Pro', 'Pro Max'];
const ALL_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price-asc', label: 'Price low to high' },
  { value: 'price-desc', label: 'Price high to low' },
  { value: 'alpha', label: 'Alphabetical' },
];

// DOM drift variants render meaningfully different classes/structure so the
// bot's primary selectors genuinely fail and its fallback chains are exercised.
// The logical product content (links, names, prices) is unchanged.
function variantClasses(domVariant) {
  const isAlt1 = domVariant === 'alt1';
  const isAlt2 = domVariant === 'alt2';
  return {
    page: isAlt1 ? 'page-catalog-alt1 container' : isAlt2 ? 'page-catalog-alt2 container' : 'page-catalog container',
    main: isAlt1 ? 'catalog-grid-alt1' : isAlt2 ? 'product-list alt2' : 'catalog-grid',
    card: isAlt1 ? 'product-card-alt1' : isAlt2 ? 'product-item alt2' : 'product-card',
    cardLink: isAlt1 ? 'card-link-alt1' : isAlt2 ? 'item-link' : 'card-link',
    cardName: isAlt1 ? 'card-name-alt1' : isAlt2 ? 'item-title alt2' : 'card-name',
    grid: isAlt1 ? 'card-grid-alt1' : isAlt2 ? 'product-grid-alt2' : 'card-grid',
    loadMore: isAlt1 ? 'btn btn-secondary load-more-alt1' : isAlt2 ? 'btn btn-secondary load-more alt2' : 'btn btn-secondary load-more',
    emptyState: isAlt1 ? 'empty-state-alt1' : isAlt2 ? 'empty-state-alt2' : 'empty-state',
  };
}

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [domVariant, setDomVariant] = useState('primary');

  useEffect(() => {
    setDomVariant(getCurrentDomDriftVariant());
  }, []);

  const query = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'newest';
  const selectedTiers = searchParams.get('tier')?.split(',').filter(Boolean) || [];
  const selectedYears = searchParams.get('year')?.split(',').filter(Boolean).map(Number) || [];
  const selectedStorage = searchParams.get('storage')?.split(',').filter(Boolean).map(Number) || [];

  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const favorites = useStore((s) => s.favorites);
  const addToCompare = useStore((s) => s.addToCompare);
  const removeFromCompare = useStore((s) => s.removeFromCompare);
  const compare = useStore((s) => s.compare);

  const updateParams = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!value || (Array.isArray(value) && value.length === 0)) {
        next.delete(key);
      } else {
        next.set(key, Array.isArray(value) ? value.join(',') : value);
      }
      return next;
    });
    setVisibleCount(BATCH_SIZE);
  }, [setSearchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateParams('q', searchInput || null);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput, updateParams]);

  const filtered = useMemo(() => {
    let results = getAllModels();
    results = searchModels(query, results);
    results = filterModels({ tier: selectedTiers, year: selectedYears, storage: selectedStorage }, results);
    results = sortModels(sort, results);
    return results;
  }, [query, sort, selectedTiers, selectedYears, selectedStorage]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const toggleTier = (tier) => {
    const next = selectedTiers.includes(tier)
      ? selectedTiers.filter((t) => t !== tier)
      : [...selectedTiers, tier];
    updateParams('tier', next);
  };

  const toggleYear = (year) => {
    const next = selectedYears.includes(year)
      ? selectedYears.filter((y) => y !== year)
      : [...selectedYears, year];
    updateParams('year', next);
  };

  const formatPrice = (model) => {
    const min = Math.min(...model.variants.map((v) => v.launchPriceUSD));
    return `$${min.toLocaleString()}`;
  };

  const cls = variantClasses(domVariant);
  const isAlt2 = domVariant === 'alt2';

  return (
    <div className={cls.page}>
      <div className="catalog-header">
        <h1>Catalog</h1>
        <span className="result-count">{filtered.length} model{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="catalog-toolbar">
        <div className="search-bar">
          <label htmlFor="search" className="sr-only">Search models</label>
          <input
            id="search"
            type="search"
            placeholder="Search by name, tier, year, chip, color..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button className="search-clear" onClick={() => setSearchInput('')} aria-label="Clear search">×</button>
          )}
        </div>

        <div className="toolbar-right">
          <label htmlFor="sort-select" className="sr-only">Sort by</label>
          <select
            id="sort-select"
            value={sort}
            onChange={(e) => updateParams('sort', e.target.value)}
          >
            {ALL_SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <button className="filter-toggle" onClick={() => setShowFilters(!showFilters)}>
            Filters {(selectedTiers.length + selectedYears.length + selectedStorage.length) > 0 && (
              <span className="filter-badge">{selectedTiers.length + selectedYears.length + selectedStorage.length}</span>
            )}
          </button>
        </div>
      </div>

      <div className="catalog-body">
        <aside className={`filter-panel ${showFilters ? 'open' : ''}`}>
          <div className="filter-group">
            <h3>Tier</h3>
            {ALL_TIERS.map((tier) => (
              <label key={tier} className="filter-option">
                <input
                  type="checkbox"
                  checked={selectedTiers.includes(tier)}
                  onChange={() => toggleTier(tier)}
                />
                {tier}
              </label>
            ))}
          </div>

          <div className="filter-group">
            <h3>Year</h3>
            {[2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((year) => (
              <label key={year} className="filter-option">
                <input
                  type="checkbox"
                  checked={selectedYears.includes(year)}
                  onChange={() => toggleYear(year)}
                />
                {year}
              </label>
            ))}
          </div>

          {(selectedTiers.length > 0 || selectedYears.length > 0 || selectedStorage.length > 0) && (
            <button
              className="btn btn-text clear-filters"
              onClick={() => setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('tier');
                next.delete('year');
                next.delete('storage');
                return next;
              })}
            >
              Clear all filters
            </button>
          )}
        </aside>

        <main className={cls.main} data-variant={domVariant}>
          {visible.length === 0 ? (
            <div className={cls.emptyState}>
              <h3>No models match these filters</h3>
              <p>Try adjusting your search or filters.</p>
              <button className="btn btn-primary" onClick={() => {
                setSearchInput('');
                setSearchParams({});
              }}>
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className={cls.grid}>
                {visible.map((model) => (
                  <div key={model.id} className={cls.card} data-id={model.id}>
                    <a href={`/model/${model.id}`} className={cls.cardLink}>
                      <div className="card-image">
                        <img
                          src={model.heroImage}
                          alt={model.displayName}
                          loading="lazy"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div className="card-image-fallback">{model.displayName}</div>
                      </div>
                    </a>
                    <div className="card-body">
                      <div className="card-meta">
                        <span className="tier-badge">{model.tier}</span>
                        <span className="card-year">{model.generationYear}</span>
                      </div>
                      <h3 className={cls.cardName}>
                        <a href={`/model/${model.id}`}>{model.displayName}</a>
                      </h3>
                      <p className="card-price">From {formatPrice(model)}</p>
                      <div className="card-actions">
                        <button
                          className={`btn-icon favorite ${favorites.includes(model.id) ? 'active' : ''}`}
                          onClick={(e) => { e.preventDefault(); toggleFavorite(model.id); }}
                          aria-label={favorites.includes(model.id) ? `Remove ${model.displayName} from favorites` : `Add ${model.displayName} to favorites`}
                          aria-pressed={favorites.includes(model.id)}
                        >
                          {favorites.includes(model.id) ? '♥' : '♡'}
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
                          aria-label={compare.includes(model.id) ? `Remove ${model.displayName} from compare` : `Add ${model.displayName} to compare`}
                          aria-pressed={compare.includes(model.id)}
                        >
                          ⇄
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <button className={cls.loadMore} onClick={() => setVisibleCount((c) => c + BATCH_SIZE)}>
                  Load more ({filtered.length - visibleCount} remaining)
                </button>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
