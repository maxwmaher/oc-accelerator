# KFMB country selection

Enable the feature with the exact build-time value `VITE_APP_KFMB_COUNTRY_SELECTION=true`.
One build serves both existing buyer channels. When the flag is absent or any value other
than `true`, the previous single-client configuration, cookies, anonymous/SSO settings,
URLs, and Saudi pickup default remain in effect.

## Public configuration

`src/config/kfmbPublicConfig.json` contains only the public API base URL and storefront
fields copied from `tools/kfmb-demo-bootstrap/kfmb-public-config.local.json`. No middleware
secrets, admin credentials, or shopper passwords are included. Update this allowlisted copy
if the authoritative public configuration changes. The browser cannot select client IDs
or API endpoints using URL parameters.

| Country | Existing client ID | Buyer / catalog | Fallback currency | Locale ID |
| --- | --- | --- | --- | --- |
| Kuwait | `57D4DE3B-255E-44E2-B9B4-AEBED7DF70A2` | `kw-buyers` / `kw-catalog` | KWD, 3 decimals | `kfmb-en-KW-KWD` |
| Saudi Arabia | `31FC66C6-15F6-49D4-86AE-B611ED584EB4` | `sa-buyers` / `sa-catalog` | SAR, 2 decimals | `kfmb-en-SA-SAR` |

Both use `https://westeurope-sandbox.ordercloud.io`. In country mode the public country
configuration supplies the client and API URL, the scope is `Shopper`, anonymous login
is disabled, and OpenID Connect is disabled. Existing environment files are preserved.
OrderCloud supplies the actual shopper locale, group assignments, prices, and quantity
limits. Demo usernames are public references only; no behavior branches on usernames.

## URLs and switching

- Entry links: `/?country=kw` and `/?country=sa`.
- Canonical routes: `/kw/`, `/kw/products/<productID>`, `/kw/cart`,
  `/kw/order-confirmation?orderID=<orderID>`; the equivalent Saudi routes begin `/sa/`.
- An existing unqualified URL, including `/products/<productID>` or `/cart`, is normalized
  to the equivalent Saudi path. Invalid country query values also select Saudi.
- A country path takes precedence over a country query parameter. The query parameter
  is removed during normalization. Other query parameters, including `orderID`, survive.
- `VITE_APP_CONFIG_BASE`, if already configured, prefixes all these paths. The existing
  Web App must continue serving the SPA entry document for application routes.
- React Router's country-specific basename keeps generated links, search/filter navigation,
  cart navigation, and confirmation URLs in the active country. A catalog route for the
  other country is rejected before mounting its catalog callers.
- The selector starts a full-page navigation to the new country's home page. It clears
  only the two KFMB tab session keys and requires a new login. It performs no OrderCloud
  writes and never transfers, merges, deletes, submits, or rewrites a server cart/order.
  Signing in again to the original country resumes that shopper's existing server cart.

## Session and cache isolation

The inspected `@ordercloud/react-sdk` 0.3.0 has global SDK configuration and query client,
client-prefixed cookies, a persisted `REACT_QUERY_OFFLINE_CACHE` key, and a request
interceptor installed once per document. Changing provider props alone would leave state
and persistence in place.

`countryBootstrap.ts` runs before the dynamic import of `AppProvider`/the React SDK.
In country mode it adapts the shared JavaScript SDK's token accessors to tab-local
`sessionStorage`: `kfmb.storefront.session.kw`, `kfmb.storefront.session.sa`, and the
non-secret `kfmb.storefront.country` context marker. Access tokens must be buyer tokens
for the selected client, and anonymous tokens are rejected. `Me.Get()` must resolve the
configured buyer before any catalog, cart, or confirmation components mount. API errors
or a buyer mismatch return to login. These client checks supplement OrderCloud's server
permissions; they do not derive permissions from username labels.

Refresh in the same country restores that tab's session and refetches shopper/catalog/cart
data. The login checkbox keeps the refresh token in that tab too. Sessions are not shared
with other tabs, SDK cookies, or the admin. A duplicated tab initially copies browser
sessionStorage, then maintains its own copy; subsequent country changes cannot change
the original tab. Restoring a page from the browser's back/forward cache triggers a reload.

The SDK does not expose a persister option. A narrow localStorage adapter ignores the
SDK's shared shopper cache key and holds `OcOpenApi.*` schemas in memory, because the
SDK otherwise deletes shared schema keys. Other localStorage operations pass through;
existing admin/application data and SDK cookies are not cleared. The full-page switch
creates a fresh query client, request interceptor, and shopper state. Revisit this adapter
if upgrading the React or JavaScript SDK; the browser tests cover these integration points.

The selector is disabled for pending SDK mutations and the application action lock. The
lock covers login, quantity changes, pickup saving, promotion changes, cart deletion,
simulated payment, and submission/retry. The switch handler checks the current lock and
mutation count again before navigating. It displays a wait notice during an action and a
sign-in notice otherwise.

## Checkout and currency

Country selection supplies only a display fallback. Product PriceSchedule and Order
currency remain authoritative; values are never converted. The visible pickup location
and saved `Order.xp.KFMBCheckout.Pickup` use the active country's configured demo pickup
point. A cart with an older pickup from another country must save the selected country's
pickup before opening payment or submitting. Confirmation uses the submitted order's persisted pickup and currency, including
line prices, even if they differ from the active storefront display fallback.

The existing login requirement, group pricing/min/max rules, promotion APIs, pickup-only
fulfillment, simulated payment, and submission/retry flow remain in use. No real payment,
Civil ID SSO, branding, or shared-product demonstration is added.

## Windows PowerShell build

From the repository root, with Node.js 24 LTS and npm installed:

```powershell
npm --prefix apps/storefront ci
$env:VITE_APP_KFMB_COUNTRY_SELECTION = "true"
$env:VITE_APP_NAME = "KFMB Demo"
$env:VITE_APP_CHECKOUT_API_URL = "https://gzdear-api-zz2d3twpf7h5c.azurewebsites.net"
npm --prefix apps/storefront run build
```

The checkout API URL above is the existing public endpoint documented in
`tools/kfmb-checkout/README.md`. Preserve a deliberately different existing checkout
endpoint for another sandbox; never place a middleware secret in a `VITE_` setting.
Keep an existing `VITE_APP_NAME` value if it is already set; the command supplies the public
marketplace name when building without generated environment files. Existing `.env.local`
values for other features continue to be read by Vite. No new
country client environment settings are required. To use the old configuration instead:

```powershell
$env:VITE_APP_KFMB_COUNTRY_SELECTION = "false"
npm --prefix apps/storefront run build
```

The deployment artifact remains **`apps/storefront/dist`**. Building does not deploy.

## Automated validation

Unit tests use Node.js 24. Playwright tests serve the existing built `dist` with Vite preview
and intercept every remote request; unmatched traffic fails the tests. They do not log in
to the live marketplace or make live OrderCloud writes. Install Chromium once for tests:

```powershell
npm --prefix apps/storefront test
Push-Location apps/storefront
npx playwright install chromium
$env:VITE_APP_KFMB_COUNTRY_SELECTION = "true"
$env:VITE_APP_CHECKOUT_API_URL = "https://checkout.mock"
npm run build
npm run test:browser
Pop-Location
```

`https://checkout.mock` is only for intercepted browser tests. Restore the existing public
checkout endpoint before creating a deployment build. A preinstalled Chromium can be
selected using `KFMB_CHROMIUM_PATH` (the sandbox used `/usr/bin/chromium`).

The disabled-mode regression has a separate build so the country-enabled `dist` survives:

```powershell
Push-Location apps/storefront
$env:VITE_APP_KFMB_COUNTRY_SELECTION = "false"
$env:VITE_APP_ORDERCLOUD_CLIENT_ID = "31FC66C6-15F6-49D4-86AE-B611ED584EB4"
$env:VITE_APP_ORDERCLOUD_BASE_API_URL = "https://westeurope-sandbox.ordercloud.io"
$env:VITE_APP_CHECKOUT_API_URL = "https://checkout.mock"
npm run build -- --outDir ../../work/single-country-dist
$env:KFMB_COUNTRY_DISABLED = "true"
npm run test:browser
Remove-Item Env:KFMB_COUNTRY_DISABLED
Pop-Location
```

Coverage includes both entry links, persistent paths and refresh, legacy Saudi entry,
client selection, invalid/mismatched login, shopper gating, assigned catalog requests,
server-provided quantity minimums, currency precision, pickup display/payload, blocked
switches during pickup/payment, confirmation using persisted data, and country tabs with
independent sessions and carts. Existing quantity/current-cart tests also run.

Real authentication, current live catalog/group assignments, checkout API CORS, actual
payment/submission callbacks and retries, and deployed Web App routing remain untested
by these mocks. No merge, deployment, resource provisioning, seeding, or importer run is
part of this change.
