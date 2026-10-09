[CmdletBinding()]
param(
    [ValidateSet('Plan','Preflight','Apply')][string]$Mode = 'Plan',
    [string]$Snapshot,
    [string]$Report
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22 or newer is required.' }
$major = (& node -p "process.versions.node.split('.')[0]")
if ($LASTEXITCODE -ne 0 -or [int]$major -lt 22) { throw 'Node.js 22 or newer is required.' }
$nodeArgs = @((Join-Path $PSScriptRoot 'import-kw-catalog.mjs'), ('--' + $Mode.ToLowerInvariant()))
if ($Snapshot) { $nodeArgs += @('--snapshot', $Snapshot) }
if ($Report) { $nodeArgs += @('--report', $Report) }
if ($Mode -eq 'Plan') {
    & node @nodeArgs
    if ($LASTEXITCODE -ne 0) { throw 'Offline plan failed.' }
    exit 0
}
if ($Mode -eq 'Apply') {
    Write-Host 'Adds Kuwait catalog resources and KWD demo price/group assignments in the KFMB sandbox.'
    Write-Host 'Review the offline plan first. Wholesale discount and quantity limits are illustrative.'
    $confirm = Read-Host 'Type APPLY kw-catalog to request writes'
    if ($confirm -cne 'APPLY kw-catalog') { Write-Host 'Canceled.'; exit 0 }
    $nodeArgs += @('--confirm-marketplace', '_nfhvLBeikC2yF1a6f6v0w')
}
$secret = Read-Host 'Existing sandbox Functions/seeding client secret' -AsSecureString
$bstr = [IntPtr]::Zero
$oldValue = $env:KFMB_CATALOG_CLIENT_SECRET
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $env:KFMB_CATALOG_CLIENT_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    & node @nodeArgs
    if ($LASTEXITCODE -ne 0) { throw 'Kuwait tool stopped. Review the report and existing state before rerunning.' }
} finally {
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $env:KFMB_CATALOG_CLIENT_SECRET = $oldValue
    if ($secret) { $secret.Dispose() }
}
