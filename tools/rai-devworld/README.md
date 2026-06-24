# RAI DevWorld scraper and OrderCloud seed workflow

## Prerequisites
- Node.js 18+ and npm.
- .NET 6 SDK for the infrastructure seeder.
- OrderCloud functions client credentials with `FullAccess` for real seeding.

## Install Playwright dependencies
```bash
cd tools/rai-devworld
npm install
npx playwright install chromium
```
Linux environments that need system packages can run `npx playwright install --with-deps chromium`.

## Scrape
Headless:
```bash
cd tools/rai-devworld
npm run scrape
```
Headed for cookie/selector troubleshooting:
```bash
cd tools/rai-devworld
npm run scrape:headed
```
The scraper writes `tools/rai-devworld/data/rai-devworld.snapshot.json`. It starts at the fixed DevWorld homepage, follows the first three matching child branches recursively, stops on the first product page, and captures up to five products.

## Validate the snapshot
From the repository root:
```bash
cd tools/rai-devworld
npm run validate-data
```
Or with an explicit file:
```bash
npx tsx src/validate.ts data/rai-devworld.snapshot.json
```
Incomplete snapshots are rejected by validation and by the seeder.

## Set local OrderCloud environment variables
Do not commit secrets. Use your shell or an ignored `tools/rai-devworld/.env.local` helper file.

macOS/Linux:
```bash
export ORDERCLOUD_API_URL=https://westeurope-sandbox.ordercloud.io
export ORDERCLOUD_CLIENT_ID=your-client-id
export ORDERCLOUD_CLIENT_SECRET=your-client-secret
export RAI_BUYER_ID=buyer
export RAI_CATALOG_ID=buyer
```
PowerShell:
```powershell
$env:ORDERCLOUD_API_URL="https://westeurope-sandbox.ordercloud.io"
$env:ORDERCLOUD_CLIENT_ID="your-client-id"
$env:ORDERCLOUD_CLIENT_SECRET="your-client-secret"
$env:RAI_BUYER_ID="buyer"
$env:RAI_CATALOG_ID="buyer"
```

## Dry-run the seed
```bash
dotnet run --project infrastructure -- seed-rai-devworld --data tools/rai-devworld/data/rai-devworld.snapshot.json --dry-run
```

## Run the seed
```bash
dotnet run --project infrastructure -- seed-rai-devworld --data tools/rai-devworld/data/rai-devworld.snapshot.json
```
Add `--force-update` to re-save RAI-managed resources even when hashes are unchanged.

## Safe reruns
The workflow uses deterministic `rai-devworld-` IDs, RAI ownership markers in XP, and does not prune unrelated catalog content by default. Products are deduplicated by SKU/source ID and canonical URL in the snapshot, then assigned to the buyer catalog and every selected category level.

## Troubleshooting RAI access, cookies, and selectors
- Use `npm run scrape:headed` to inspect cookie banners or delayed rendering.
- If the site blocks the execution environment, run the same commands locally and commit the generated snapshot.
- The scraper prefers headings, links, product URLs, and visible text over generated CSS class names.

## Verify in OrderCloud
After a real seed, verify buyer `buyer`, catalog `buyer`, buyer-catalog assignment, RAI categories, product catalog assignments, category assignments, EUR price schedules, specs/options/defaults/markups, absolute RAI image URLs, and structured `xp.RAI` on sample products.

## Run storefront and tests
```bash
cd apps/storefront
npm install
npm run test
npm run build
npm run dev
```
