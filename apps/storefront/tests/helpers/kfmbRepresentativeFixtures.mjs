import kwCatalog from '../../../../tools/kfmb-kw-catalog/kw-catalog.json' with { type: 'json' };
import saCatalog from '../../../../tools/kfmb-sa-catalog/sa-catalog.json' with { type: 'json' };

// Representative metadata comes from the checked-in catalog inputs. Image URLs
// remain intact; only the isolated browser response is a deliberately tall SVG
// so containment can be inspected without fetching or committing product images.
const catalogs = { kw: kwCatalog, sa: saCatalog };
const escapeXml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const selected = Object.fromEntries(Object.entries(catalogs).map(([country, catalog]) => {
  const first = country === 'kw' ? catalog.products.find((item) => item.identity === 'a.p.w wheat' && item.packValue === 50) : catalog.products[0];
  const entries = [first, ...catalog.categories.map((category) => catalog.products.find((item) => item.categoryId === category.id))].filter(Boolean);
  return [country, [...new Map(entries.map((item) => [item.id, item])).values()].slice(0, 6)];
}));

export const representativePrimary = (country) => selected[country][0];

export function representativeOptions() {
  return {
    shopper: { FirstName: 'Procurement and purchasing operations', LastName: 'Regional buyer account' },
    orderID: (country) => `${country}-mock-order-reference-for-regional-procurement-review-2026-000000123456789`,
    categories: (country) => catalogs[country].categories.map((category) => ({ ID: category.id, Name: category.name, ChildCount: 0 })),
    products: (country, username) => selected[country].map((item) => ({
      ID: item.id, Name: item.name, Description: item.description,
      xp: {
        Brand: item.brand, PackSize: item.packSize, PackValue: item.packValue, PackUnit: item.packUnit,
        ...(country === 'kw' ? { SellingUnit: item.sellingUnit, UnitsPerMultipack: item.unitsPerMultipack, UnitOfMeasure: `One ${item.sellingUnit}: ${item.unitsPerMultipack} × ${item.packSize}` } : { UnitOfMeasure: `One ${item.packSize} pack` }),
        Images: [{ Url: item.imageUrl }],
      },
      PriceSchedule: {
        ID: `${item.id}-review-schedule`, Currency: country === 'kw' ? 'KWD' : 'SAR',
        MinQuantity: username.includes('wholesale') ? 5 : 1, MaxQuantity: 50,
        PriceBreaks: [{ Quantity: 1, Price: Number(country === 'kw' ? item.demoPricing[username.includes('wholesale') ? 'wholesaleKWD' : 'standardKWD'] : item[username.includes('wholesale') ? 'demoWholesalePriceSAR' : 'demoStandardPriceSAR']) }],
      },
    })),
    imageResponses: new Map(Object.values(selected).flat().map((item) => [item.imageUrl, `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="900" viewBox="0 0 260 900"><rect x="18" y="14" width="224" height="872" rx="8" fill="#f1e8d5" stroke="#b38a43" stroke-width="4"/><path d="M20 65h220M20 835h220" stroke="#b38a43" stroke-width="3"/><text x="130" y="390" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#142d3b">Mock package</text><text x="130" y="430" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#142d3b">${escapeXml(item.packSize)}</text><text x="130" y="475" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#53636b">Image containment test</text></svg>`])),
  };
}
