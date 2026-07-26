import modelsData from './models.json';

const REQUIRED_FIELDS = [
  'id', 'displayName', 'tier', 'generationYear', 'releaseDate',
  'discontinued', 'chip', 'displayInches', 'displayType', 'camera',
  'colors', 'variants', 'weightGrams', 'dimensionsMM', 'materials',
  'heroImage', 'summary', 'keyFeatures',
];

const VALID_TIERS = ['SE', 'Standard', 'Mini', 'Plus', 'Air', 'Pro', 'Pro Max'];

export function validateModel(model) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (model[field] === undefined || model[field] === null || model[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (model.id && !/^[a-z0-9-]+$/.test(model.id)) {
    errors.push('id must be lowercase and URL-safe');
  }

  if (model.tier && !VALID_TIERS.includes(model.tier)) {
    errors.push(`Invalid tier: ${model.tier}`);
  }

  if (model.colors && model.colors.length === 0) {
    errors.push('Must have at least one color');
  }

  if (model.variants && model.variants.length === 0) {
    errors.push('Must have at least one variant');
  }

  if (model.variants) {
    for (const v of model.variants) {
      if (!v.storageGB || v.storageGB <= 0) errors.push('Invalid storageGB');
      if (!v.launchPriceUSD || v.launchPriceUSD <= 0) errors.push('Invalid launchPriceUSD');
    }
  }

  if (model.keyFeatures && (model.keyFeatures.length < 3 || model.keyFeatures.length > 5)) {
    errors.push('keyFeatures must have 3-5 items');
  }

  return errors;
}

const allModels = modelsData.filter((model) => {
  const errors = validateModel(model);
  if (errors.length > 0) {
    console.warn(`[Data Validation] Excluding "${model.displayName || model.id}":`, errors);
    return false;
  }
  return true;
});

export function getAllModels() {
  return allModels;
}

export function getModelBySlug(slug) {
  return allModels.find((m) => m.id === slug) || null;
}

export function searchModels(query, models = allModels) {
  if (!query) return models;
  const q = query.toLowerCase().trim();
  return models.filter((m) =>
    m.displayName.toLowerCase().includes(q) ||
    m.tier.toLowerCase().includes(q) ||
    String(m.generationYear).includes(q) ||
    m.chip.name.toLowerCase().includes(q) ||
    m.colors.some((c) => c.name.toLowerCase().includes(q))
  );
}

export function filterModels(filters, models = allModels) {
  return models.filter((m) => {
    if (filters.tier?.length && !filters.tier.includes(m.tier)) return false;
    if (filters.year?.length && !filters.year.includes(m.generationYear)) return false;
    if (filters.storage?.length) {
      const modelStorage = m.variants.map((v) => v.storageGB);
      if (!filters.storage.some((s) => modelStorage.includes(s))) return false;
    }
    if (filters.colorFamily?.length) {
      const modelColors = m.colors.map((c) => c.name.toLowerCase());
      if (!filters.colorFamily.some((cf) => modelColors.some((mc) => mc.includes(cf.toLowerCase())))) return false;
    }
    if (filters.chipFamily?.length) {
      if (!filters.chipFamily.some((cf) => m.chip.name.toLowerCase().includes(cf.toLowerCase()))) return false;
    }
    return true;
  });
}

export function sortModels(sortKey, models = allModels) {
  const sorted = [...models];
  switch (sortKey) {
    case 'newest':
      return sorted.sort((a, b) => b.generationYear - a.generationYear);
    case 'oldest':
      return sorted.sort((a, b) => a.generationYear - b.generationYear);
    case 'price-asc':
      return sorted.sort((a, b) => Math.min(...a.variants.map((v) => v.launchPriceUSD)) - Math.min(...b.variants.map((v) => v.launchPriceUSD)));
    case 'price-desc':
      return sorted.sort((a, b) => Math.min(...b.variants.map((v) => v.launchPriceUSD)) - Math.min(...a.variants.map((v) => v.launchPriceUSD)));
    case 'alpha':
      return sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
    default:
      return sorted;
  }
}

export function getSimilarModels(modelId, models = allModels) {
  const model = models.find((m) => m.id === modelId);
  if (!model) return [];

  const sameTier = models
    .filter((m) => m.id !== modelId && m.tier === model.tier)
    .sort((a, b) => Math.abs(a.generationYear - model.generationYear) - Math.abs(b.generationYear - model.generationYear));

  const nearbyYear = models
    .filter((m) => m.id !== modelId && Math.abs(m.generationYear - model.generationYear) <= 1)
    .sort((a, b) => Math.abs(a.generationYear - model.generationYear) - Math.abs(b.generationYear - model.generationYear));

  const candidates = [...sameTier];
  for (const m of nearbyYear) {
    if (!candidates.find((c) => c.id === m.id)) candidates.push(m);
  }

  if (candidates.length < 4) {
    const remaining = models
      .filter((m) => m.id !== modelId && !candidates.find((c) => c.id === m.id))
      .sort((a, b) => Math.abs(a.generationYear - model.generationYear) - Math.abs(b.generationYear - model.generationYear));
    for (const m of remaining) {
      candidates.push(m);
      if (candidates.length >= 4) break;
    }
  }

  return candidates.slice(0, 4);
}

export function getUniqueValues(field) {
  const values = new Set();
  for (const m of allModels) {
    if (field === 'tier') values.add(m.tier);
    else if (field === 'year') values.add(m.generationYear);
    else if (field === 'storage') m.variants.forEach((v) => values.add(v.storageGB));
    else if (field === 'colorFamily') m.colors.forEach((c) => values.add(c.name));
    else if (field === 'chipFamily') values.add(m.chip.name);
  }
  return [...values].sort();
}
