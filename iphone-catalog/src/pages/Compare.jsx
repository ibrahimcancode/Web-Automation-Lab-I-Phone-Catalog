import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/useStore';
import { getModelBySlug, getAllModels } from '../data/models';

export default function Compare() {
  const compareIds = useStore((s) => s.compare);
  const removeFromCompare = useStore((s) => s.removeFromCompare);
  const [highlightDiffs, setHighlightDiffs] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState('');

  const models = compareIds.map((id) => getModelBySlug(id)).filter(Boolean);

  const specGroups = [
    {
      name: 'Display',
      rows: [
        { label: 'Size', key: 'displayInches', format: (v) => `${v} inches` },
        { label: 'Type', key: 'displayType' },
      ],
    },
    {
      name: 'Chip',
      rows: [
        { label: 'Processor', key: 'chip', format: (v) => v.name },
        { label: 'CPU Cores', key: 'chip', format: (v) => v.cpuCores },
        { label: 'GPU Cores', key: 'chip', format: (v) => v.gpuCores },
        {
          label: 'Neural Engine',
          key: 'chip',
          format: (v) => (v.neuralEngineCores ? `${v.neuralEngineCores} cores` : '—'),
        },
      ],
    },
    {
      name: 'Camera',
      rows: [
        { label: 'System', key: 'camera', format: (v) => v.system },
        { label: 'Lenses', key: 'camera', format: (v) => v.lenses.join(', ') },
        { label: 'Front Camera', key: 'camera', format: (v) => `${v.frontCameraMP} MP` },
        { label: 'Optical Zoom', key: 'camera', format: (v) => v.maxOpticalZoom || '—' },
      ],
    },
    {
      name: 'Design',
      rows: [
        { label: 'Weight', key: 'weightGrams', format: (v) => `${v}g` },
        { label: 'Dimensions', key: 'dimensionsMM', format: (v) => `${v.height}×${v.width}×${v.depth} mm` },
        { label: 'Materials', key: 'materials' },
      ],
    },
    {
      name: 'Battery',
      rows: [{ label: 'Video Playback', key: 'batteryVideoPlaybackHours', format: (v) => (v ? `${v} hours` : '—') }],
    },
    {
      name: 'Colors & Pricing',
      rows: [
        { label: 'Colors', key: 'colors', format: (v) => v.map((c) => c.name).join(', ') },
        {
          label: 'Starting Price',
          key: 'variants',
          format: (v) => `$${Math.min(...v.map((x) => x.launchPriceUSD)).toLocaleString()}`,
        },
      ],
    },
  ];

  const getValue = (model, row) => {
    const val = model[row.key];
    return row.format ? row.format(val) : val;
  };

  const allValuesDiffer = (row) => {
    if (models.length < 2) return false;
    const vals = models.map((m) => getValue(m, row));
    return new Set(vals).size > 1;
  };

  const availableToAdd = getAllModels()
    .filter((m) => !compareIds.includes(m.id))
    .filter((m) => m.displayName.toLowerCase().includes(addSearch.toLowerCase()));

  if (models.length < 2) {
    return (
      <div className="page-compare container">
        <h1>Compare Models</h1>
        <div className="empty-state">
          <h3>Select at least 2 models to compare</h3>
          <p>Add models from the catalog or detail pages to start comparing.</p>
          <Link to="/catalog" className="btn btn-primary">
            Browse Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-compare container">
      <h1>Compare Models</h1>

      <div className="compare-toolbar">
        <label className="highlight-toggle">
          <input type="checkbox" checked={highlightDiffs} onChange={(e) => setHighlightDiffs(e.target.checked)} />
          Highlight differences
        </label>
        {compareIds.length < 4 && (
          <button className="btn btn-secondary" onClick={() => setShowAddModal(true)}>
            + Add another model
          </button>
        )}
      </div>

      <div className="compare-table-wrapper">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="spec-label-header">Specification</th>
              {models.map((m) => (
                <th key={m.id} className="model-header">
                  <div className="model-header-card">
                    <img src={m.heroImage} alt={m.displayName} />
                    <h3>{m.displayName}</h3>
                    <span className="tier-badge">{m.tier}</span>
                    <button
                      className="btn-icon remove"
                      onClick={() => removeFromCompare(m.id)}
                      aria-label={`Remove ${m.displayName} from comparison`}
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specGroups.map((group) => (
              <>
                <tr key={group.name} className="group-header">
                  <td colSpan={models.length + 1}>{group.name}</td>
                </tr>
                {group.rows.map((row) => {
                  const differs = highlightDiffs && allValuesDiffer(row);
                  return (
                    <tr key={row.label} className={differs ? 'differs' : ''}>
                      <td className="spec-label">{row.label}</td>
                      {models.map((m) => (
                        <td key={m.id}>{getValue(m, row)}</td>
                      ))}
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add model to compare">
            <h2>Add a model</h2>
            <input
              type="search"
              placeholder="Search models..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              autoFocus
            />
            <div className="modal-list">
              {availableToAdd.slice(0, 10).map((m) => (
                <button
                  key={m.id}
                  className="modal-option"
                  onClick={() => {
                    useStore.getState().addToCompare(m.id);
                    setShowAddModal(false);
                    setAddSearch('');
                  }}
                >
                  {m.displayName} <span className="tier-badge">{m.tier}</span>
                </button>
              ))}
            </div>
            <button className="btn btn-text" onClick={() => setShowAddModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
