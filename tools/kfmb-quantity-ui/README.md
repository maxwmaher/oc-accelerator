# KFMB quantity UI update (Saudi first)

This changes **local storefront source only**. Nothing is automatically deployed.
The existing catalog, products, pricing, logins, admin fixes, Functions code,
`ProductCard.tsx`, `formatPrice.ts`, and `.env.local` files remain unchanged.

## Apply

Extract this folder under your existing repository's `tools` directory. In PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Apply-QuantityUI.ps1
```

An optional `-RepoRoot` argument selects a non-default checkout location.
The installer checks every source block before making changes, backs up changed
files under `backups`, and refuses to overwrite unexpected local edits.
Reapplying the same update does not duplicate the changes.

Then, in `apps/storefront`, run `npm.cmd run build` and deploy the new `dist`
to your existing storefront application. No package install is needed.

## Behavior

- Product detail initializes the quantity after the shopper PriceSchedule loads.
- Shows the applicable min/max range. Counts other cart lines when the schedule's
  `UseCumulativeQuantity` is true, as it is in this demo's seeded schedules.
- Checks fresh shopper product pricing and all pages of saved order lines before
  add/update. No seller token or client secret is used.
- Cart editing is explicit: change the number, then use **Update** or **Cancel**.
  Invalid/empty/fractional edits are not sent to the line-item API.
- The normal Place Order handler checks for uncommitted edits and rechecks saved
  product totals using current shopper rules before calling the existing submit
  flow. This does not repair the shipping/payment flow or submit test orders.
- RestrictedQuantity is handled as allowed quantity breakpoints, not pack multiples.
- Product descriptions/images and the previous price-formatting fix are preserved.

## Important scope

This is **browser-side validation**, including fresh API reads. It is not a
server-side enforcement boundary and does not claim to fix native OrderCloud
validation. Direct API callers and concurrent writes from other browser sessions
still require the planned .NET server-side submission guard. Pickup checkout,
payment, promotion application, anonymous checkout gating, Kuwait import,
and country switching are separate tasks.

The helpers use one pack as one Quantity unit, consistent with the seeded products
(QuantityMultiplier=1). General bundles, configurable variants and arbitrary
QuantityMultiplier behavior are outside this demo patch.

No settings/credentials are read by the installer. It reads only the target
storefront package.json and listed source files.

## Rollback

The installer prints a timestamped backup folder. Its manifest.json lists the
files changed and whether each existed previously. To roll back, restore the
four original components from that backup, and remove only the three new
`kfmb...` utility files listed in the manifest. Preserve any later edits before
rolling back. Do not reset the full Git checkout.

## Validation

Local automated checks cover pure quantity rules, current-cart helper reads,
edit/submission gating and installer conflict/idempotency behavior. The full
React build and live browser flow have not been run in this environment.
Use `npm.cmd run build` before deployment and the small acceptance check in chat.
