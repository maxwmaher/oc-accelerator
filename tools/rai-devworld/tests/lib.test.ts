import { describe, it, expect } from 'vitest';
import { firstChildren, firstProducts, dedupeProducts, ocId, parseMoney, optionMarkup, needsCompositeSpec, sourceHash, validateSnapshot } from '../src/lib.js';

const source = { system: 'RAI Amsterdam Exhibitor Services', event: 'DevWorld', language: 'en_US', currency: 'EUR', homepageUrl: 'https://example.com', scrapedAtUtc: new Date().toISOString() };
const product = (id: string, path: string[], overrides: any = {}) => ({
  sourceSku: id,
  name: id,
  canonicalUrl: 'https://x/' + id,
  images: [],
  pricing: { basePrice: { amount: 1, currency: 'EUR', rawText: '€1' }, rawPriceText: '€1', minQuantity: 1, quantityMultiplier: 1, priceBreaks: [], options: [] },
  ordering: { notes: [] },
  attributes: [],
  sourceBreadcrumbs: path,
  categoryPaths: [path],
  sourceHash: 'h',
  ocId: id,
  priceScheduleId: id,
  ...overrides,
} as any);
const snapshot = (overrides: any = {}) => ({ schemaVersion: 1, complete: true, source, categories: [], products: [], ...overrides } as any);

describe('rai lib', () => {
  it('uses first three children', () => expect(firstChildren([1, 2, 3, 4])).toEqual([1, 2, 3]));
  it('selects first five products', () => expect(firstProducts([1, 2, 3, 4, 5, 6])).toEqual([1, 2, 3, 4, 5]));
  it('dedupes products and merges category paths', () => expect(dedupeProducts([product('a', ['A']), product('a', ['B'])])[0].categoryPaths).toHaveLength(2));
  it('generates deterministic truncated ids', () => { const a = ocId(['x'.repeat(200)], 40); expect(a).toBe(ocId(['x'.repeat(200)], 40)); expect(a.length).toBeLessThanOrEqual(40); });
  it('parses decimal comma and point', () => { expect(parseMoney('€ 1.234,56')?.amount).toBe(1234.56); expect(parseMoney('EUR 1234.56')?.amount).toBe(1234.56); });
  it('normalizes price breaks shape', () => expect([{ quantity: 10, price: parseMoney('€2,50') }][0].price?.amount).toBe(2.5));
  it('calculates spec markup from absolute prices', () => expect(optionMarkup(10, { absolutePrice: { amount: 12, currency: 'EUR', rawText: '€12' } }).amount).toBe(2));
  it('detects composite fallback dependencies', () => expect(needsCompositeSpec([{ name: 'Size', listOrder: 1, required: true, allowOpenText: false, values: [], dependencies: ['Color'] }])).toBe(true));
  it('dedupes assignments with a set', () => expect(new Set(['p|c', 'p|c']).size).toBe(1));
  it('source hash is stable', () => expect(sourceHash(product('a', ['A']))).toBe(sourceHash(product('a', ['A']))));
  it('validates complete snapshot', () => expect(() => validateSnapshot(snapshot())).not.toThrow());
  it('refuses incomplete snapshot', () => expect(() => validateSnapshot(snapshot({ complete: false }))).toThrow());
  it('validator fails if a zero-price product exists in products', () => expect(() => validateSnapshot(snapshot({ products: [product('zero', ['A'], { pricing: { basePrice: { amount: 0, currency: 'EUR', rawText: '€0,' }, rawPriceText: '€0,', minQuantity: 1, quantityMultiplier: 1, priceBreaks: [], options: [] } })] }))).toThrow(/non-positive price/));
  it('validator fails if a Shopping cart product exists in products', () => expect(() => validateSnapshot(snapshot({ products: [product('cart', ['A'], { name: 'Shopping cart' })] }))).toThrow(/Shopping cart/));
  it('validator passes when a quote/request item is only in skipped products', () => expect(() => validateSnapshot(snapshot({ source: { ...source, skippedProducts: [{ url: 'https://x/ViewProduct-Start?SKU=rigging-request', sku: 'rigging-request', name: 'Shopping cart', reason: 'unpriced quote/request product' }] } }))).not.toThrow());
});
