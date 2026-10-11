// Same rule as backend/src/utils/pricing.js: `price` is the UNIT price and
// total = quantity × unit price (2 decimals). A missing quantity counts as 1.
export function computeTotal(price, quantity = 1) {
  return Math.round((Number(price) || 0) * (quantity ?? 1) * 100) / 100;
}

/** Prefer the server-computed total; fall back to the shared rule. */
export function taskTotal(task) {
  return typeof task.total === 'number' ? task.total : computeTotal(task.price, task.quantity);
}
