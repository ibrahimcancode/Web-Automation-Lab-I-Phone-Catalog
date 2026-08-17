// Pure validation for extracted catalog data.
// Independent of Playwright/DOM so it is directly unit-testable and reused by
// the run-summary verdict.

export const VALID_TIERS = ['SE', 'Standard', 'Mini', 'Plus', 'Air', 'Pro', 'Pro Max'];
export const YEAR_MIN = 2014;
export const YEAR_MAX = 2030;

const REQUIRED_FIELDS = ['id', 'name', 'tier', 'year', 'price'];

export function validateExtractedItem(item) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    const value = item[field];
    if (value === undefined || value === null || value === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (item.id !== undefined && !/^[a-z0-9-]+$/.test(String(item.id))) {
    errors.push('id must be lowercase and URL-safe');
  }

  if (item.tier !== undefined && !VALID_TIERS.includes(item.tier)) {
    errors.push(`Invalid tier: ${item.tier}`);
  }

  if (item.year !== undefined) {
    const year = Number(item.year);
    if (!Number.isFinite(year) || year < YEAR_MIN || year > YEAR_MAX) {
      errors.push(`Year out of range: ${item.year}`);
    }
  }

  if (item.price !== undefined) {
    const price = typeof item.price === 'number' ? item.price : Number(String(item.price).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(price) || price <= 0) {
      errors.push(`Invalid price: ${item.price}`);
    }
  }

  return errors;
}

export function validateExtractedItems(items) {
  const results = items.map((item) => ({
    id: item.id,
    errors: validateExtractedItem(item),
  }));
  const ids = items.map((item) => item.id).filter((id) => id != null);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);

  return {
    items: results,
    total: items.length,
    validCount: results.filter((r) => r.errors.length === 0).length,
    invalidCount: results.filter((r) => r.errors.length > 0).length,
    duplicates: [...new Set(duplicates)],
    ok: results.every((r) => r.errors.length === 0) && duplicates.length === 0,
  };
}
