# KFMB trade storefront presentation

This proposed demo identity uses ink navy (#142D3B), warm ivory (#F6F4EF), white product surfaces, and restrained wheat gold (#B38A43). It is not an official KFMB brand guide. System fonts, a 1320px content boundary, 8–14px corners, readable labels, tabular prices, and comfortable controls form the shared presentation system.

## What changed

- Theme overrides merge after the Sitecore base, so customer presentation tokens take precedence. The theme and shared brand primitives introduce no commerce SDK imports before country runtime initialization.
- Shared header, integrated country selector, shopper/cart controls, footer, and branded login replace the generic presentation. Configured brand-logo overrides remain supported.
- Home uses assigned catalogs/categories instead of stock images and promotional placeholder copy. Listings, search/filter controls, category navigation, product imagery, details, and quantity controls share the same layout system.
- Cart places editable items and pickup/payment stages beside the order summary. Confirmation has its own lightweight brand shell, persisted pickup/contact information, submitted items, recorded totals/currency, and a clear simulated-payment notice.
- Selling-unit labels use existing metadata, with neutral “units” when absent. Quantity 1, product identity, price schedules, and all quantity calculations are unchanged.
- Test helpers reuse the existing isolated shopper mock. Optional visual review covers both countries at 1440, 768, and 390px; representative catalog metadata, long values, and a tall text SVG exist only in tests. The SVG is served by the mock at the existing image URL; it is not a replacement catalog asset.

No binary assets, generated images, fonts, catalog changes, backend/admin changes, or infrastructure changes are included. Screenshots belong under the external review directory, never in Git. Country bootstrap/session isolation, authentication rules, pricing, pickup payloads, and payment/submission/retry rules remain in place. No live OrderCloud writes or deployment are part of this change.

## Windows PowerShell validation

Run from the repository root on this feature branch, using Node.js 24 LTS. These commands preserve existing environment files. Mock tests intercept all remote requests and fail on unmatched traffic.

```powershell
if ((node -p "process.versions.node.split('.')[0]") -ne "24") {
    throw "Use Node.js 24 LTS."
}
Push-Location apps/storefront
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm test
if ($LASTEXITCODE -ne 0) { throw "Unit tests failed." }

$changedFiles = @(git diff --name-only --relative --diff-filter=ACMR origin/kfmb-demo -- '*.ts' '*.tsx')
if ($changedFiles.Count -gt 0) {
    npx --no-install eslint $changedFiles --report-unused-disable-directives --max-warnings 0
    if ($LASTEXITCODE -ne 0) { throw "Changed-file lint failed." }
}

# Install the test browser once, or set KFMB_CHROMIUM_PATH to an existing executable.
npx --no-install playwright install chromium
Remove-Item Env:KFMB_COUNTRY_DISABLED -ErrorAction SilentlyContinue
$env:VITE_APP_KFMB_COUNTRY_SELECTION = "true"
$env:VITE_APP_NAME = "KFMB Demo"
$env:VITE_APP_CHECKOUT_API_URL = "https://checkout.mock"
npm run build -- --outDir ../../../work/kfmb-mock-dist
if ($LASTEXITCODE -ne 0) { throw "Mock build failed." }
$env:KFMB_BROWSER_DIST = "../../../work/kfmb-mock-dist"
npm run test:browser
if ($LASTEXITCODE -ne 0) { throw "Browser behavior tests failed." }

# Optional screenshot + responsive review; files stay outside Git.
$env:KFMB_VISUAL_AUDIT = "true"
$env:KFMB_ASSERT_LAYOUT = "true"
$env:KFMB_REVIEW_DIR = "../../../work/kfmb-review/after"
npm run test:browser -- tests/kfmb-visual.spec.mjs
if ($LASTEXITCODE -ne 0) { throw "Visual browser review failed." }
$env:KFMB_REPRESENTATIVE_AUDIT = "true"
$env:KFMB_REVIEW_DIR = "../../../work/kfmb-review/representative-after"
npm run test:browser -- tests/kfmb-visual.spec.mjs
if ($LASTEXITCODE -ne 0) { throw "Visual browser review failed." }
Remove-Item Env:KFMB_VISUAL_AUDIT, Env:KFMB_ASSERT_LAYOUT, Env:KFMB_REPRESENTATIVE_AUDIT, Env:KFMB_REVIEW_DIR

# Restore the public checkout endpoint for the actual production artifact.
Remove-Item Env:KFMB_BROWSER_DIST
$env:VITE_APP_KFMB_COUNTRY_SELECTION = "true"
$env:VITE_APP_CHECKOUT_API_URL = "https://gzdear-api-zz2d3twpf7h5c.azurewebsites.net"
npm run build
if ($LASTEXITCODE -ne 0) { throw "Production build failed." }
Pop-Location
```

The production artifact remains `apps/storefront/dist`. These commands do not deploy it. Existing deliberate application-name or logo settings can be retained instead of the example name above. The original disabled-country regression commands remain documented in [KFMB_COUNTRY_SELECTION.md](KFMB_COUNTRY_SELECTION.md).

## Verification limits

Mocked browser tests verify presentation and existing behavior without live credentials or orders. They cannot establish current live catalog/group assignments, checkout API CORS, or deployed routing. The representative image is a deliberately simple test illustration; real package photography is not downloaded or altered. Full-project lint has a pre-existing `@typescript-eslint/no-explicit-any` error in `src/hooks/useDebounce.ts:4`; changed-file lint is the relevant gate for this presentation work. Vite's existing bundle-size warning is reported separately from build success. No dependency upgrade or unrelated audit remediation is included.

## Recorded review

The baseline was archived from `debf9a3a498a4340cda98d2ddfd6b47913fbf0c6` before presentation edits. Its 19 unit tests, country behavior tests, and production build passed; responsive screenshots showed existing horizontal overflow. The redesigned storefront passes 22 unit tests, changed-file lint across 36 TypeScript files, production builds, and all four original country behavior tests. Six representative browser journeys cover both countries at 1440/768/390px, with no horizontal page overflow or unmatched remote requests. The final review confirms ink primary actions, 8px control radii, 48px quantity actions, and contained tall imagery. A focused refinement pass corrected mobile header/login spacing, card width, inherited corner-radius aliases, and the category caller's premature `disabled: false` override of the SDK's schema-readiness guard.

Screenshots use isolated mock accounts. The matching baseline/default journeys and the richer representative journeys remain separate so reviewers can compare identical inputs and inspect long values and catalog unit metadata independently.

Final browser results: combined original country behaviors plus representative review **10 passed / 1 expected mode skip**; matching default visual review **6 passed**; the separately built disabled-country regression **1 passed**. Artifacts contain **54 baseline + 54 matching after + 70 representative after** screenshots. The 24 baseline scenes with horizontal overflow are resolved in the final reviewed scenes. The production artifact was checked for the required public checkout endpoint and absence of `https://checkout.mock`.
