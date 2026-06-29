<#
.SYNOPSIS
Safely deletes RAI DevWorld demo products from the RAI snapshot.

.DESCRIPTION
Reads the RAI DevWorld snapshot, derives OrderCloud product IDs from products[].ocId,
backs up each full product JSON, and deletes only product IDs that match the RAI DevWorld
product prefix. This script intentionally does not delete price schedules, categories,
catalogs, or buyers. Use -WhatIf to preview without deleting.
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter()]
    [string]$Data = (Join-Path $PSScriptRoot '../data/rai-devworld.snapshot.json'),

    [Parameter()]
    [string]$BackupDir = (Join-Path $PSScriptRoot (Join-Path '../backups/rai-products' (Get-Date -Format 'yyyyMMdd-HHmmss')))
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-FirstEnvironmentValue {
    param([Parameter(Mandatory = $true)][string[]]$Names)
    foreach ($name in $Names) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
    }
    return $null
}

function Require-EnvironmentValue {
    param(
        [Parameter(Mandatory = $true)][string]$DisplayName,
        [Parameter(Mandatory = $true)][string[]]$Names
    )
    $value = Get-FirstEnvironmentValue -Names $Names
    if ([string]::IsNullOrWhiteSpace($value)) { throw "$DisplayName is required. Set one of: $($Names -join ', ')." }
    return $value
}

function Join-OrderCloudUrl {
    param(
        [Parameter(Mandatory = $true)][string]$ApiUrl,
        [Parameter(Mandatory = $true)][string]$Path
    )
    return ('{0}/{1}' -f $ApiUrl.TrimEnd('/'), $Path.TrimStart('/'))
}

function Get-SnapshotProductIds {
    param([Parameter(Mandatory = $true)][psobject]$Snapshot)
    if ($null -eq $Snapshot.products) { throw 'Snapshot does not contain a products array.' }

    @(
        $Snapshot.products |
            ForEach-Object { $_.ocId } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Where-Object { $_ -match '^rai-devworld-product-' } |
            Sort-Object -Unique
    )
}

$resolvedData = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Data)
if (-not (Test-Path -LiteralPath $resolvedData -PathType Leaf)) { throw "RAI DevWorld snapshot not found: $resolvedData" }

$snapshot = Get-Content -LiteralPath $resolvedData -Raw | ConvertFrom-Json
$productIds = @(Get-SnapshotProductIds -Snapshot $snapshot)
if ($productIds.Count -eq 0) { throw "Snapshot contains no RAI DevWorld product IDs with prefix 'rai-devworld-product-': $resolvedData" }

$apiUrl = Require-EnvironmentValue -DisplayName 'OrderCloud API URL' -Names @('ORDERCLOUD_API_URL', 'ocApiUrl')
$clientId = Require-EnvironmentValue -DisplayName 'OrderCloud client ID' -Names @('ORDERCLOUD_CLIENT_ID', 'ocFunctionsClientId')
$clientSecret = Require-EnvironmentValue -DisplayName 'OrderCloud client secret' -Names @('ORDERCLOUD_CLIENT_SECRET', 'ocFunctionsClientSecret')

Write-Host "Using OrderCloud API URL: $apiUrl"
Write-Host "Using OrderCloud client ID: $clientId"
Write-Host 'Using OrderCloud client secret: [redacted]'
Write-Host "Loaded $($productIds.Count) RAI DevWorld product IDs from $resolvedData"
Write-Host "Product backups will be written to: $BackupDir"
Write-Host 'This script deletes products only. It does not delete price schedules, categories, catalogs, or buyers.'

$tokenUrl = Join-OrderCloudUrl -ApiUrl $apiUrl -Path '/oauth/token'
$tokenBody = @{ grant_type = 'client_credentials'; client_id = $clientId; client_secret = $clientSecret; scope = 'FullAccess' }
$tokenResponse = Invoke-RestMethod -Method Post -Uri $tokenUrl -Body $tokenBody -ContentType 'application/x-www-form-urlencoded'
if ([string]::IsNullOrWhiteSpace($tokenResponse.access_token)) { throw 'OrderCloud authentication succeeded without returning an access_token.' }
$headers = @{ Authorization = "Bearer $($tokenResponse.access_token)" }

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$deleted = 0; $skipped = 0; $failed = 0

foreach ($productId in $productIds) {
    $encodedId = [Uri]::EscapeDataString($productId)
    $productUrl = Join-OrderCloudUrl -ApiUrl $apiUrl -Path "/v1/products/$encodedId"
    try {
        $product = Invoke-RestMethod -Method Get -Uri $productUrl -Headers $headers
        $backupPath = Join-Path $BackupDir "$productId.json"
        $product | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $backupPath -Encoding UTF8

        if ($PSCmdlet.ShouldProcess($productId, 'DELETE RAI DevWorld product')) {
            Invoke-RestMethod -Method Delete -Uri $productUrl -Headers $headers | Out-Null
            $deleted++
            Write-Host "Deleted $productId (backup: $backupPath)"
        } else {
            $skipped++
            Write-Host "WhatIf $productId - would delete after backup: $backupPath"
        }
    } catch {
        $failed++
        Write-Warning "Failed $productId - $($_.Exception.Message)"
    }
}

Write-Host "Delete RAI products complete. Deleted: $deleted; skipped: $skipped; failed: $failed."
