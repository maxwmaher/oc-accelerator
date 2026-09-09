# Pelckmans Bundles & Offers workspace

The Admin route `/pelckmans` is a custom Chakra workspace, not a generated resource form. It requests the two custom roles during OAuth, sends the current OrderCloud bearer token to Functions, and never receives a service secret. Functions validates every request by calling OrderCloud `/v1/me`; browser-provided user names or roles are ignored. Offers are JSON documents in a private Blob container and all writes use ETags.

## Configuration and setup (opt-in)

1. Copy `apps/admin/.env.pelckmans.example` to `.env.local`. Copy the Functions example to `local.settings.json` and replace placeholders locally. Never commit either file.
2. In OrderCloud create custom roles `PelckmansOfferEditor` and `PelckmansOfferApprover`, restricted security profiles, and separate editor/approver users. Assign only the matching custom role. The Functions service client needs read access to buyers/catalogs/products/categories/prices and write access to module-owned `PEL_STUDIO_` products, price schedules, bundles, promotions, assignments and unsubmitted test orders; shopper impersonation must be limited to the discovered Individual Customers buyer.
3. Inspect **direct and inherited** security-profile assignments. A FullAccess or commerce-write assignment is cumulative and makes a demo user unsafe; remove it from the new restricted account or fail setup. Never alter the owner's administrator.
4. Run the read-only diagnostic (it does not seed or write):
   `pwsh ./scripts/Test-PelckmansSetup.ps1 -AdminToken (Read-Host 'Short-lived admin token')`
5. Configure the Function App settings with `az functionapp config appsettings set -g rg-pelckmans -n amewes-api-r4vr55e7wmr6c --settings OrderCloudSettings__ApiUrl=https://westeurope-sandbox.ordercloud.io OrderCloudSettings__MiddlewareClientID=D6F22B34-2D87-4B55-98E6-4C45576480FC Pelckmans__StorageContainer=pelckmans-offers`. Set the secret and storage connection separately via protected settings/Key Vault references.
6. Set exact CORS origins: `az functionapp cors add -g rg-pelckmans -n amewes-api-r4vr55e7wmr6c --allowed-origins https://amewes-admin-r4vr55e7wmr6c.azurewebsites.net` (and `http://localhost:5173` only for development).

## Build, test, run, deploy (PowerShell-friendly)

```powershell
dotnet test ./apps/api/Accelerator.Core.Tests/Accelerator.Core.Tests.csproj
dotnet build ./apps/api/Accelerator.Api.sln -c Release
Push-Location ./apps/admin; npm ci; npm run lint; npm run build; Pop-Location
func start --script-root ./apps/api/Accelerator.Functions
dotnet publish ./apps/api/Accelerator.Functions/Accelerator.Functions.csproj -c Release -o ./artifacts/functions
Compress-Archive ./artifacts/functions/* ./artifacts/functions.zip -Force
az functionapp deployment source config-zip -g rg-pelckmans -n amewes-api-r4vr55e7wmr6c --src ./artifacts/functions.zip
Push-Location ./apps/admin; npm run build; Compress-Archive ./dist/* ../../artifacts/admin.zip -Force; Pop-Location
az webapp deployment source config-zip -g rg-pelckmans -n amewes-admin-r4vr55e7wmr6c --src ./artifacts/admin.zip
```

Deployment and live smoke tests are intentionally never part of build/test.

## Presenter walkthrough

1. Sign in as the restricted editor, choose a template, complete the four short steps, save, inspect the **Estimated preview**, and submit.
2. Sign out and sign in as the separate approver. Open Review queue, inspect the exact revision, approve, then publish.
3. After publication, run native verification with the dedicated Individual Customers shopper and show the unsubmitted order's returned lines, quantities, unit prices, promotion discount and pre-tax/shipping total. Delete only test-order IDs recorded in the module manifest.

## Explicit first-build boundaries

The workflow, role validation, ETag persistence, preview calculator, audit transitions, and failure-safe publication state are implemented. **The current publication adapter deliberately fails closed:** native OrderCloud publication, product/category discovery endpoints, and disposable-order verification still require an SDK-verified implementation and live credentials. The UI never calls that failure a success. Consequently this checkout must not yet be presented as an end-to-end live commerce demo. Allocation products must represent separate demo fixture inventory, never source stock/capacity; `HideFromBrowse` is only a storefront filtering convention. Channable remains a future inbound source-field upsert that must preserve editorial enrichment.
