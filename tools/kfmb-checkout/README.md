# KFMB pickup checkout deployment

The checkout uses the application-owned `Order.xp.KFMBCheckout` namespace. `Pickup` stores the configured location ID/country/label, contact name/contact information, and optional notes; `Fulfillment` is `Pickup`. Existing order xp is merged in the browser rather than replaced.

## Server-only settings

Set these on **gzdear-api-zz2d3twpf7h5c** before deploying Functions:

- `OrderCloudSettings__ApiUrl=https://westeurope-sandbox.ordercloud.io` (existing)
- `OrderCloudSettings__MiddlewareClientID=0BAD0F65-D294-448E-8819-98F713696BB9` (existing)
- `OrderCloudSettings__MiddlewareClientSecret` (existing secret; never expose to the browser)
- `DemoCheckout__Enabled=true` (demo environments only)
- `DemoCheckout__MarketplaceID=_nfhvLBeikC2yF1a6f6v0w`
- `DemoCheckout__HashKey=<strong random server-only value>`
- `DemoCheckout__StorefrontClientIDs__0=31FC66C6-15F6-49D4-86AE-B611ED584EB4`
- `DemoCheckout__StorefrontClientIDs__1=57D4DE3B-255E-44E2-B9B4-AEBED7DF70A2`

The Function App CORS allow-list must contain exactly the deployed storefront origin, `https://gzdear-storefront-zz2d3twpf7h5c.azurewebsites.net` (no path and no wildcard). Configure storefront `VITE_APP_CHECKOUT_API_URL=https://gzdear-api-zz2d3twpf7h5c.azurewebsites.net`.

The OrderCheckout integration base is
`https://gzdear-api-zz2d3twpf7h5c.azurewebsites.net/api/integrationevent`. OrderCloud appends its
predefined operation names, producing these deployed callbacks:

- `POST /api/integrationevent/OrderCalculate`
- `POST /api/integrationevent/OrderSubmit`

Both callbacks validate `X-oc-hash` over the unmodified request body. The demo returns zero tax from
calculation and acknowledges submit so that OrderCloud—not the callback—performs native submission.

## Sequence and commands

1. Configure the settings above, then deploy Functions using the repository's existing pipeline (local package check: `dotnet build apps/api/Accelerator.Api.sln -c Release`).
2. Securely export `ORDERCLOUD_MIDDLEWARE_CLIENT_SECRET` and the identical `KFMB_CHECKOUT_HASH_KEY`. Review the default dry run with `node tools/kfmb-checkout/configure-checkout.mjs`, then explicitly apply with `node tools/kfmb-checkout/configure-checkout.mjs --apply`. Before any write, the script authenticates, verifies that the existing `kfmb-demo-flour-sa-standard` PriceSchedule is owned by `_nfhvLBeikC2yF1a6f6v0w`, and verifies all three expected API clients. It changes only the OrderCheckout integration, its two storefront-client associations, and the two-route signed pre-webhook. The before-request webhook retains both storefront clients, both explicit-order and cart submit routes, and `BeforeProcessRequest=true`; it sets `ElevatedRoles` to exactly `["Shopper"]` so quantity validation can perform its shopper-context reads without granting `FullAccess` or changing a shopper security profile. Existing unrelated webhook properties are retained. Dry-run output describes intended configuration; it does not invoke or claim to test a live callback.
3. Build with `npm --prefix apps/storefront run build`, then deploy `apps/storefront/dist` to the existing storefront app. No admin deployment is needed.
4. Run the smoke test below.

### Windows PowerShell (secure prompts)

Run this from the repository root. The plaintext values exist only in the current process environment
and are removed in `finally`; PowerShell does not echo either prompt.

```powershell
$middlewareSecret = Read-Host "OrderCloud middleware client secret" -AsSecureString
$checkoutHashKey = Read-Host "KFMB checkout hash key" -AsSecureString
try {
    $secretPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($middlewareSecret)
    $hashPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($checkoutHashKey)
    $env:ORDERCLOUD_MIDDLEWARE_CLIENT_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPtr)
    $env:KFMB_CHECKOUT_HASH_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($hashPtr)

    # Default is read-only. Inspect this output before applying.
    node tools/kfmb-checkout/configure-checkout.mjs
    node tools/kfmb-checkout/configure-checkout.mjs --apply
}
finally {
    Remove-Item Env:ORDERCLOUD_MIDDLEWARE_CLIENT_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:KFMB_CHECKOUT_HASH_KEY -ErrorAction SilentlyContinue
    if ($secretPtr) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPtr) }
    if ($hashPtr) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($hashPtr) }
}
```

## One-order Saudi sandbox smoke test

1. Sign in as `kfmb-sa-wholesale`, add one real Saudi product at a quantity within its displayed effective PriceSchedule range, and open the cart.
2. Apply `KFMB5`; verify the real OrderCloud promotion appears and the SAR worksheet total changes. (Optionally confirm a Standard shopper gets an ineligibility error, without submitting.)
3. Enter pickup contact details, confirm **Saudi Arabia demo pickup point**, zero shipping, and “Tax not calculated in this demo.”
4. Choose **Approve and submit order** once. Confirm the page appears only after submission and shows the real order ID, SAR totals/items, pickup metadata, and simulated-payment status.
5. In the existing admin, find that exact order ID and verify it is submitted with the accepted CreditCard payment/authorization transaction. This is a manual sandbox test and performs one real submission; automated tests do not.
