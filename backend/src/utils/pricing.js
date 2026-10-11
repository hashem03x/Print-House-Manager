import { DEFAULT_QUANTITY } from '../constants/paperOptions.js';

/**
 * Pricing rule: `price` is the UNIT price and total = quantity × unit price,
 * rounded to 2 decimals. Tasks without a quantity (created before the field
 * existed) count as quantity 1, so their total equals their stored price.
 * The stored unit price is never overwritten with the total.
 */
export function computeTotal(price, quantity) {
  return Math.round((price ?? 0) * (quantity ?? DEFAULT_QUANTITY) * 100) / 100;
}

/** The same rule as a MongoDB aggregation expression (dashboard / sorting). */
export const totalExpression = {
  $multiply: ['$price', { $ifNull: ['$quantity', DEFAULT_QUANTITY] }],
};
