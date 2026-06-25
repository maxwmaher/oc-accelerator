<#
.SYNOPSIS
Removes Currency from RAI DevWorld OrderCloud price schedules found in the snapshot.

.DESCRIPTION
Reads the RAI DevWorld snapshot, finds unique products.priceScheduleId values, authenticates
with OrderCloud using the same local environment variable names supported by the RAI seeder,
GETs each price schedule, removes Currency from the full object, and PUTs the object back.
Use -WhatIf to preview without writing changes.
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
    [Parameter()]
    [string]$Data = (Join-Path $PSScriptRoot '../data/rai-devworld.snapshot.json')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-FirstEnvironmentValue {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Names
    )

    foreach ($name in $Names) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value
        }
    }

    return $null
}

function Require-EnvironmentValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DisplayName,

        [Parameter(Mandatory = $true)]
        [string[]]$Names
    )

    $value = Get-FirstEnvironmentValue -Names $Names
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "$DisplayName is required. Set one of: $($Names -join ', ')."
    }

    return $value
}

function Join-OrderCloudUrl {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ApiUrl,

        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return ('{0}/{1}' -f $ApiUrl.TrimEnd('/'), $Path.TrimStart('/'))
}

function Remove-JsonProperty {
    param(
        [Parameter(Mandatory = $true)]
        [psobject]$Object,

        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $false
    }

    $Object.PSObject.Properties.Remove($Name)
    return $true
}

$resolvedData = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Data)
if (-not (Test-Path -LiteralPath $resolvedData -PathType Leaf)) {
    throw "RAI DevWorld snapshot not found: $resolvedData"
}

$snapshot = Get-Content -LiteralPath $resolvedData -Raw | ConvertFrom-Json
if ($null -eq $snapshot.products) {
    throw "Snapshot does not contain a products array: $resolvedData"
}

$priceScheduleIds = @(
    $snapshot.products |
        ForEach-Object { $_.priceScheduleId } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Sort-Object -Unique
)

if ($priceScheduleIds.Count -eq 0) {
    throw "Snapshot contains no products with priceScheduleId values: $resolvedData"
}

$apiUrl = Require-EnvironmentValue -DisplayName 'OrderCloud API URL' -Names @('ORDERCLOUD_API_URL', 'ocApiUrl')
$clientId = Require-EnvironmentValue -DisplayName 'OrderCloud client ID' -Names @('ORDERCLOUD_CLIENT_ID', 'ocFunctionsClientId')
$clientSecret = Require-EnvironmentValue -DisplayName 'OrderCloud client secret' -Names @('ORDERCLOUD_CLIENT_SECRET', 'ocFunctionsClientSecret')

Write-Host "Using OrderCloud API URL: $apiUrl"
Write-Host "Using OrderCloud client ID: $clientId"
Write-Host 'Using OrderCloud client secret: [redacted]'
Write-Host "Loaded $($priceScheduleIds.Count) unique price schedule IDs from $resolvedData"

$tokenUrl = Join-OrderCloudUrl -ApiUrl $apiUrl -Path '/oauth/token'
$tokenBody = @{
    grant_type = 'client_credentials'
    client_id = $clientId
    client_secret = $clientSecret
    scope = 'FullAccess'
}

$tokenResponse = Invoke-RestMethod -Method Post -Uri $tokenUrl -Body $tokenBody -ContentType 'application/x-www-form-urlencoded'
if ([string]::IsNullOrWhiteSpace($tokenResponse.access_token)) {
    throw 'OrderCloud authentication succeeded without returning an access_token.'
}

$headers = @{ Authorization = "Bearer $($tokenResponse.access_token)" }

foreach ($priceScheduleId in $priceScheduleIds) {
    $encodedId = [Uri]::EscapeDataString($priceScheduleId)
    $priceScheduleUrl = Join-OrderCloudUrl -ApiUrl $apiUrl -Path "/v1/priceSchedules/$encodedId"
    $priceSchedule = Invoke-RestMethod -Method Get -Uri $priceScheduleUrl -Headers $headers
    $removed = Remove-JsonProperty -Object $priceSchedule -Name 'Currency'

    if ($PSCmdlet.ShouldProcess($priceScheduleId, 'PUT price schedule without Currency')) {
        $body = $priceSchedule | ConvertTo-Json -Depth 20
        Invoke-RestMethod -Method Put -Uri $priceScheduleUrl -Headers $headers -ContentType 'application/json' -Body $body | Out-Null
        if ($removed) {
            Write-Host "Updated $priceScheduleId - Currency removed."
        } else {
            Write-Host "Updated $priceScheduleId - Currency was already absent."
        }
    } else {
        if ($removed) {
            Write-Host "WhatIf $priceScheduleId - Currency would be removed."
        } else {
            Write-Host "WhatIf $priceScheduleId - Currency is already absent."
        }
    }
}
