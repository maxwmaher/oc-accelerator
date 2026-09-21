# KFMB Demo — Saudi catalog import

Prepared 21 September 2026. This is a new, separate tool. It does not replace the
foundation seed, change the accelerator source, or redeploy Azure applications.

## Included data

The manifest contains **52 product/pack-size combinations from 38 product families**
linked by the five public English category pages reviewed on Masarat Al Joud:

| Category | Product records |
| --- | ---: |
| Flour | 11 |
| Pasta | 15 |
| Rice | 8 |
| Halawa & Tahina (source category: Seedawi) | 16 |
| Edible Oils | 2 |

The original source heading, product page, source image URL, brand and pack size
are retained. Display names are normalized, and short descriptions are paraphrased.
Each advertised size is modeled as a separate Product record, not as a native
OrderCloud variant. Product IDs are generated for this demo, not supplier SKUs.
This is coverage of the reviewed linked web pages, not a claim that the supplier's
full inventory or downloadable PDF catalog has been exhausted.

**Saudi Arabia only.** This import adds to the existing `sa-catalog` and `sa-buyers`.
Kuwait catalog extraction and verified matching of identical SKUs remain separate.
The product IDs are country-neutral so a genuinely identical product can be shared
with Kuwait later without duplicating its master record.

## Commercial assumptions — not scraped prices

No published sale prices were extracted from the reviewed Saudi product pages.
Every SAR price in `sa-catalog.json` is an illustrative demo assumption. Per item,
the Wholesale base price is 10% below the Standard price. The existing `KFMB5`
promotion is not changed, removed, or applied by this importer.

- Standard: minimum 1 pack, maximum 10 packs per product/order.
- Wholesale: minimum 5 packs, maximum 50 packs per product/order.
- Both: `UseCumulativeQuantity=true`, `RestrictedQuantity=false`.
- PriceSchedules: `Currency=SAR`, `ApplyTax=false`, `ApplyShipping=false`.
- A quantity of 1 means one labeled pack (for example, one 40 kg bag), not 1 kg.

These are configured fields, **not evidence of server-side enforcement**. The
previously observed native quantity behavior is not fixed or retested here.
The storefront and server-side enforcement work remains separate.

## Images

The manifest uses `xp.Images: [{ "Url": "..." }]`, as read by this accelerator.
Images stay on the supplier's host; no image binaries are bundled or uploaded to
Azure Storage. All 38 family-image URLs were opened during preparation, but future
availability, loading from the deployed storefront and caching have not been tested.
Some supplier pages provide one family image for several sizes. The Organic Tahina
and Rahshilla With Hazelnut pages use generic-looking photographs; those mismatches
are recorded in `imageNotes`, not silently treated as exact pack photographs.

Source-file snapshots are in `sa-catalog.json`; original copyrighted marketing
paragraphs are not bundled.

## Target and credentials

- API root: `https://westeurope-sandbox.ordercloud.io`
- Marketplace: `_nfhvLBeikC2yF1a6f6v0w` (KFMB Demo)
- Backend API client: `0BAD0F65-D294-448E-8819-98F713696BB9`
- Buyer / catalog: `sa-buyers` / `sa-catalog`
- Pricing UserGroups: `standard`, `wholesale`
- Locale: `kfmb-en-SA-SAR`, explicitly assigned to both groups.

The runner prompts for the existing backend client secret and requests `FullAccess`.
It does not assume that the backend default-context username is `demo-integration`;
using `admin` as configured is supported. No shopper password is required. Secrets
are supplied through a temporary process environment variable, restored afterward,
and are not written into source files, reports or command-line arguments.

## Run on Windows

Requirements: Node.js 22 or newer, Windows PowerShell 5.1 or PowerShell 7, and network
access to the OrderCloud sandbox. There are no npm packages to install.

From this extracted folder:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Run-SaCatalog.ps1 -Mode Import
```

Type `IMPORT`, then enter the existing Functions/seeding client secret.

The Import command runs a preflight before making changes. It checks the marketplace
OwnerID against an existing foundation PriceSchedule, verifies Saudi prerequisites
(including explicit group Locales), and rejects conflicting existing records or
assignments. Expected resources in an untouched foundation: **161 resource creates
and 208 assignments** (5 categories, 52 products, 104 price schedules).

For a no-write preflight instead:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Run-SaCatalog.ps1 -Mode Preview
```

Existing matching resources are kept; existing conflicting values are not overwritten.
Resource creates use POST with stable IDs rather than PUT/PATCH. Catalog memberships
are established before category/product-group assignments. No API clients, users,
passwords, security profiles, promotions, orders, payments, integration events,
webhooks, Azure settings or application files are changed. Existing foundation and
Kuwait resources, including the synthetic flour product, remain in place.

Do not run concurrently with other writers. This is not an atomic transaction. If a
network or API error stops a run, partial additions remain. Do not delete or reseed;
a subsequent run can inspect and retain matching additions. Uncertain writes are not
automatically retried. The report shows additions completed before the stop.

Completion includes:

```text
SAUDI CATALOG IMPORT COMPLETE - 52 products, 104 price schedules, 5 categories; seller-side readback passed. Checkout enforcement and buyer UI are not tested by this import.
```

`sa-catalog-import-results.local.json` contains public IDs and results, not tokens.
After success, refresh the Saudi storefront and browse its catalog as
`kfmb-sa-standard` or `kfmb-sa-wholesale`. These are live OrderCloud data changes, so
there is no application rebuild in this step. Formatting, country switching,
checkout integration and image presentation are separate application work.

## Tests and limitations

Run `node --test tests/import.test.mjs` for 17 offline tests covering plan counts,
source metadata, target guards, locale prerequisites, existing-record conflicts,
idempotent retries, partial-run recovery, assignment order, and pagination.

These tests passed in Node 22 on Linux during preparation. They use mock API data;
this import has **not** been executed against the live KFMB marketplace. The
PowerShell wrapper has been reviewed but not executed on Windows here. No claim
is made that mock tests prove native OrderCloud validation or checkout behavior.

## Source references

Product-specific page and image URLs are included on every manifest record.
Category sources:

```text
https://www.mjcs.com.sa/products/flour?lang=en
https://www.mjcs.com.sa/products/pasta?lang=en
https://www.mjcs.com.sa/products/rice?lang=en
https://www.mjcs.com.sa/products/seedawi?lang=en
https://www.mjcs.com.sa/products/oils?lang=en
```

Implementation references inspected:

```text
https://github.com/maxwmaher/oc-accelerator/blob/development/apps/storefront/src/components/product/ProductCard.tsx
https://github.com/maxwmaher/oc-accelerator/blob/development/apps/storefront/src/components/product/product-detail/ProductImageGallery.tsx
https://github.com/ordercloud-api/ordercloud-javascript-sdk/blob/master/src/api/Categories.ts
https://github.com/ordercloud-api/ordercloud-javascript-sdk/blob/master/src/models/CategoryProductAssignment.ts
```
