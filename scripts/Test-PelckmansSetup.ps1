param([Parameter(Mandatory=$true)][string]$AdminToken,[string]$ApiUrl="https://westeurope-sandbox.ordercloud.io")
$ErrorActionPreference="Stop"; $h=@{Authorization="Bearer $AdminToken"}
$me=Invoke-RestMethod "$ApiUrl/v1/me" -Headers $h
Write-Host "Authenticated as $($me.Username); marketplace $($me.Company.ID)."
$products=@(); $page=1
do { $r=Invoke-RestMethod "$ApiUrl/v1/products?page=$page&pageSize=100" -Headers $h; $products += $r.Items; $page++ } while($page -le $r.Meta.TotalPages)
$usable=$products | Where-Object { $_.xp.EntityType -in @('Book','Event','Signing') -and -not $_.IsBundle -and -not $_.xp.PelckmansStudio }
if(-not $usable){ throw "No eligible Pelckmans source products were discovered. Do not fabricate IDs or rerun the seed." }
Write-Host "Found $($usable.Count) eligible source products (read-only)."
Write-Host "Next: create PelckmansOfferEditor and PelckmansOfferApprover custom roles/security profiles and two users in the portal. Audit all direct and inherited assignments; abort if either user has FullAccess or direct product/price/promotion/bundle writes. This diagnostic never creates or resets users."
