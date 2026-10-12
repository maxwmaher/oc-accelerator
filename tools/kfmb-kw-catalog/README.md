# KFMB Kuwait catalog extension

Prepared 9 October 2026 from public pages at https://mills.kfmb.com.kw/.
This separate tool adds to the existing one-marketplace/two-channel foundation.
It does not seed the foundation or rerun the Saudi import. **No live OrderCloud
preflight or import has been run.** No application, checkout or dependency changes.

## Coverage and provenance

| Public category | Discovered families | Reviewed family pages | Prepared sellable items |
| --- | ---: | ---: | ---: |
| Mills / flour & wheat | 15 | 15 | 25 |
| Pasta | 6 | 6 | 28 |
| Vegetable oils | 5 | 5 | 0 |
| Biscuits | 9 | 9 attempted | 0 |
| **Food total** | **35** | **34 accessible; 1 failed** | **53** |

All four food category pages linked from the home page were reviewed. Five oil
and eight biscuit family pages returned headings/navigation but **no sellable
cards, sizes or prices in the public reader**. That is an exclusion, not evidence
that the supplier has no inventory. The Ice Cream/Chocolate Biscuits family
`/Portal/ProductList?c=120&s=95897` returned HTTP 403 Forbidden. The animal-feed
page exposed one Shuar 50 kg bag at 4.750 KWD and linked a separate feed store;
feed is excluded from this food demo. No authenticated inventory, CAPTCHA/login,
PDF catalog, alternate storefront or hidden API was accessed. Coverage is limited
to the public pages recorded in the snapshot; it is not a complete inventory claim.

The executor's `curl` failed with `(7) Failed to connect to proxy port 8080`.
The public web connector provided the captured pages, including cached pages
whose crawl dates ranged from today to last month. Initial timeouts/403s on some
flour pages were followed by successful public reads. The English language link
redirected back to Arabic in this stateless reader. Arabic names are retained;
English image alt labels supply normalized names. `WHDW` is expanded to Whole
Durum Wheat using the Arabic item name. Capture date is the observation date,
not proof that a listed price is a current quote.

`source-snapshot.json` records original/English names, brand and brand evidence,
product type, pack size, selling unit/count, source category, image URL, page URL,
capture date, and published KWD price with the exact priced unit and short factual
evidence. `kw-catalog.json` is its reproducible prepared manifest.

No public product/SKU IDs were exposed by the reader: `sourceProductId` is null.
`sourceAssetIdentifier` is only the observed image filename stem, **not a supplier
SKU**. ProductIDs are generated from a normalized identity slug and a 12-character
SHA-256 source-item digest; they are stable across ordering and pricing changes.
Renaming a source item or changing its source URL/selling unit changes its key and
requires review. Descriptions paraphrase the item and its selling unit, without
adding nutritional/technical specifications. Source images remain on KFMB hosts;
53 URLs were resolved by the public reader, but deployed-storefront loading and
future availability are untested. No image binaries or marketing paragraphs are
bundled. Image alt/name evidence is not a pack-photograph verification.

## Saudi comparison

`mapping-report.json` explicitly classifies every Kuwait sellable item against the
existing 52 Saudi manifest records: **0 reused, 53 new, 0 ambiguous**. There is no
verified shared-product example in this capture. Representative rejected reuse:

| Kuwait evidence | Saudi record | Why separate ProductIDs are required |
| --- | --- | --- |
| [Patent flour: 4 × 2 kg bundle, 1.040 KWD](https://mills.kfmb.com.kw/Portal/ProductList?c=110&s=95849) | `kfmb-patent-flour-2kg`: one 2 kg pack | Multipack count and selling unit differ. |
| [Lasagna: 15 × 450 g carton, 11.250 KWD](https://mills.kfmb.com.kw/Portal/ProductList?c=100&s=1849244) | `kfmb-lasagna-450g`: one 450 g Almatahen pack | Carton differs from one pack; no KFMB/Almatahen brand equivalence asserted. |
| [Fettuccine: 20 × 500 g carton, 5.500 KWD](https://mills.kfmb.com.kw/Portal/ProductList?c=100&s=95887) | `aljoud-fettuccine-400g`: one Al Joud 400 g pack | Brand, pack size and selling unit differ. |

Names are normalized conservatively; explicitly labeled Saudi brand suffixes are
removed from the identity comparison and the brand is compared separately.
No fuzzy spelling match or image similarity authorizes reuse. Same-identity
candidates and their differences appear in the report. Exact compatible brand,
identity, size (mass/volume normalized), selling unit and count are **ambiguous**
until a local snapshot includes reviewed `reuseEvidence` with `saProductId`,
`kwSourceUrl`, `saSourceUrl`, and a substantive `note`. Unknown brand/identity
remains ambiguous. Ambiguous items block preflight/apply; offline reporting works.

A verified reuse plans no master-product write. It requires the existing Saudi
master, its marketplace ownership and its expected Saudi-managed fields, retaining
extra fields. It adds only Kuwait memberships/category assignments and two KWD
group price schedules/assignments. Kuwait provenance stays in the manifest/report
and KWD schedule metadata; it never replaces Saudi descriptions, images or xp.
Readback checks the entire reused master against its pre-run value. Shared-product
tests use explicitly synthetic evidence; they are not catalog match claims.

## Published price versus demo policy

All 53 included records have a published **whole selling-unit** KWD price. Do not
divide a bundle/carton price and import it as a single-pack SKU. Quantity 1 means
one complete bag, bundle or carton exactly as labeled.

Proposed demo policy (not supplier commercial terms): Standard's base price equals
the captured listing price; Wholesale is an illustrative 10% reduction rounded to
the nearest fils (three decimals, half up). Example: Pizza Mix, one 10 × 1 kg
bundle: published/Standard **2.275 KWD**, demo Wholesale **2.048 KWD**.
Published prices remain separate in `publishedPrice`; group values/policy are
under `demoPricing`. A snapshot with no published price needs explicit
`demoPricing.standardKWD`, `wholesaleKWD`, and a `policy` before import.

- Standard min/max: 1/10 complete selling units; Wholesale: 5/50.
- Both: `UseCumulativeQuantity=true`, `RestrictedQuantity=false`.
- Both KWD PriceSchedules: `ApplyTax=false`, `ApplyShipping=false` for pickup demo.
- Limits/discounts are fictional demo assumptions, not published supplier terms.
- Native quantity enforcement, checkout, promotions and presentation are untested.

## Target and safeguards

The tool reads `../kfmb-demo-bootstrap/kfmb-public-config.local.json` and requires
its expected sandbox/marketplace and Kuwait configuration to match fixed guards:

- API: `https://westeurope-sandbox.ordercloud.io`
- Marketplace: `_nfhvLBeikC2yF1a6f6v0w`
- Backend client: `0BAD0F65-D294-448E-8819-98F713696BB9`
- Buyer/catalog: `kw-buyers` / `kw-catalog`
- Groups: `standard`, `wholesale`; explicit locale `kfmb-en-KW-KWD`

Preflight is read-only apart from OAuth token issuance. Before writes, it checks
marketplace OwnerID using the existing Kuwait foundation PriceSchedule, active
buyer/default catalog, catalog visibility, groups, KWD locale and explicit group
locale assignments. Product and price-schedule OwnerIDs must match; managed xp
ownership and expected fields must match existing resources. Conflicts stop the
whole preflight. No repair of prerequisites is attempted.

Stable-ID resource creation uses POST, never PUT/PATCH/DELETE. Matching resources
and assignments are kept. A second run reads state and adds only missing work.
All resource conflicts are checked before the first write, with fresh reads before
creates/assignments. Catalog membership precedes category and group assignments.
Each attempted/completed write is journaled; an uncertain write remains `pending`.
Network errors, unexpected responses and uncertain writes stop without automatic
write retry. Only throttled/transient GET responses may retry. The final readback
checks all additions and reused masters. The local journal contains public IDs,
counts and redacted errors, not credentials.

**Run with one writer only.** Assignment POST is an OrderCloud upsert: a competing
writer can change an assignment between the last GET and POST. There is no atomic
transaction or API conditional assignment write here. After an interruption, keep
existing data and run Plan/Preflight again. Inspect any `pending` operation before
an explicit Apply recovery; do not delete, reseed or automatically retry writes.
No Saudi resources, users/passwords, clients, security profiles, promotions,
orders/payments, webhooks or integration events are written.

## Windows PowerShell commands

Node.js 22+; Windows PowerShell 5.1 or PowerShell 7. No npm installation. From the
repository root, offline preview (no credentials and no network):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\kfmb-kw-catalog\Run-KwCatalog.ps1 -Mode Plan
```

Read-only sandbox preflight, when requested locally:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\kfmb-kw-catalog\Run-KwCatalog.ps1 -Mode Preflight
```

Later **explicit import**, after reviewing the plan/preflight:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\kfmb-kw-catalog\Run-KwCatalog.ps1 -Mode Apply
```

Apply prompts for `APPLY kw-catalog`, then the **existing sandbox** backend secret.
Preflight prompts only for that secret. Plan never prompts for it. The secret is
held temporarily in `KFMB_CATALOG_CLIENT_SECRET`, restored afterward and never
placed in CLI arguments or reports. No production credentials are needed.
Default report: `tools/kfmb-kw-catalog/kw-catalog-results.local.json` (gitignored).
Optional `-Snapshot` and `-Report` accept paths, including spaces.

For a locally captured snapshot, use the checked-in source snapshot as the schema.
Capture public factual item metadata in that normalized JSON format, including
precise pack/count/price evidence; use null for unknown source IDs/images/prices,
and null brand/identity to request review. Do not include private HTML, tokens or
login data. The tool deliberately does not guess details from arbitrary HTML.

```powershell
node .\tools\kfmb-kw-catalog\prepare-snapshot.mjs --snapshot .\work\kuwait-source.local.json --output-dir .\work\kw-review
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\kfmb-kw-catalog\Run-KwCatalog.ps1 -Mode Plan -Snapshot .\work\kuwait-source.local.json -Report .\work\kw-plan.local.json
```

Pass the same `-Snapshot` to Preflight and a later Apply. Prepared JSON is for
review; the importer recomputes the plan from the snapshot and Saudi manifest,
rather than trusting editable generated mapping/plan files. A clean target plans
**161 creates (2 categories, 53 masters, 106 KWD schedules), 212 assignments**.
Existing Saudi/foundation resources remain intact.

## Validation and limitations

```powershell
node --test .\tools\kfmb-kw-catalog\tests\import.test.mjs
```

35 focused offline tests pass on Node 24.19.0/Linux: source validation, matching,
multipack isolation, KWD precision/rounding, target/locale/ownership guards,
conflicts, shared-master preservation, repeat runs, partial/uncertain writes,
assignment ordering, journaling, CLI confirmation and pagination. The complete
53-item plan was applied/read back **only in the in-memory simulator**. The 17
existing Saudi tests also pass. In this executor, test-worker child-process output
is suppressed; `--experimental-test-isolation=none` exposes all individual results.
Generated manifest/report reproducibility and the actual credential-free Plan CLI
were checked. PowerShell was reviewed but not executed; no PowerShell executable
is installed here. No live OrderCloud reads/writes, deployment or Azure provisioning
were performed. Mock tests do not prove native API/checkout behavior.
