# Pelckmans Bundles & Offers

The Admin `/pelckmans` workspace now discovers customer-visible OrderCloud products with search and pagination, resolves prices using a dedicated **Individual Customers** shopper, saves and edits ETag-protected drafts, and supports separate editor/approver publication. Publication creates deterministic `PEL_STUDIO_` resources: isolated allocation products and price schedules plus a native bundle, or a native non-combinable line-item promotion based on the approved product-ID snapshot. Verification creates (but never submits) an identified test order, uses the native bundle-add/line-item operations, refreshes promotions, and reports OrderCloud totals and discrepancies.

## Required local configuration

Work from `C:\Users\maxm\Documents\Repos\oc-accelerator`. Copy `apps\api\Accelerator.Functions\local.settings.pelckmans.example.json` to `local.settings.json` and fill values only in the ignored copy. Copy `apps\admin\.env.pelckmans.example` to `.env.local` and set `VITE_PELCKMANS_API_BASE_URL=http://localhost:7071`.

Server settings (double underscores are valid environment equivalents):

* `OrderCloudSettings:ApiUrl`, `MiddlewareClientID`, and protected `MiddlewareClientSecret`.
* `Pelckmans:BuyerID` and `CatalogID`: the verified Individual Customers buyer/catalog; never choose the first buyer implicitly.
* `Pelckmans:StorefrontClientID`, `TestShopperUsername`, and protected `TestShopperPassword`: a dedicated active shopper in that buyer. The client must allow password-grant shopper authentication.
* `AzureWebJobsStorage=UseDevelopmentStorage=true` and `Pelckmans:StorageContainer=pelckmans-offers` locally.

The middleware service account needs read access for products, catalogs, buyers and prices, and create/update access for module-owned products, price schedules, bundles/components, promotions/assignments, and unsubmitted orders. Shopper impersonation/password-grant access must be limited to the configured test shopper. Run a read-only cumulative security-profile review: direct **and inherited** `FullAccess`, product, promotion, and order-write roles remain additive. Do not modify an existing administrator automatically.

Local Functions CORS is `http://localhost:3000` in `local.settings.json`. Azure CORS is separate: add the deployed Admin origin to the Function App allow-list; do not copy local CORS into production unnecessarily.

## Build and local run (Windows)

From `C:\Users\maxm\Documents\Repos\oc-accelerator`:

```powershell
Push-Location apps\api; dotnet build Accelerator.Api.sln -c Release; dotnet test Accelerator.Api.sln -c Release --no-build; Pop-Location
Push-Location apps\admin; npm ci; npm run lint; npm run build; Pop-Location
# Terminal 1: start Azurite
npx azurite --location .local-azurite
# Terminal 2: PowerShell's func may be an npm .ps1 shim; this cmd fallback is launchable.
Set-Location apps\api\Accelerator.Functions
cmd /c "C:\Users\maxm\AppData\Roaming\npm\func.cmd start"
# Terminal 3
Set-Location apps\admin
npm run dev
```

## Short admin/admin2 walkthrough

1. As **admin** (editor), search the live catalog, select recognizable items, configure quantities/free treatment or promotion audience, save, edit, preview, and submit.
2. Sign out completely; as **admin2** (approver), review the exact revision. Reject with a comment once; sign back in as admin, edit/resubmit; then approve as admin2.
3. As admin2 publish. Confirm the returned workflow state is `Published` (not merely HTTP 200); use **Retry publication** after an actionable partial failure.
4. Select **Verify in OrderCloud**, exercise qualifying/mixed quantities, inspect actual discounts/applied promotions and the collapsed resource IDs. Clean up only recorded `PEL_STUDIO_*_VERIFY_*` unsubmitted orders through an explicitly invoked operator procedure.
5. For the historical empty PublishFailed QA record, use **Duplicate as draft**. The original remains immutable and cannot pass completeness validation.

## Safety and demo boundaries

Eligibility is an approval-time product-ID snapshot, so later author/genre membership does not silently alter an approved promotion. Publication is resumable by deterministic IDs and protected by a persisted ETag claim; OrderCloud multi-resource writes are **not transactional**, and a failed run records owned resources for retry rather than touching seeded resources. Allocation products are labeled demo allocations; inventory/capacity synchronization, ticketing, reservations, payment, submission, Channable, and storefront work are out of scope. `HideFromBrowse` is not access control. Live validation still requires the configured sandbox credentials and should be opt-in because it creates module-owned commerce resources and unsubmitted orders.
