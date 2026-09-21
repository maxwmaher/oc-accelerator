[CmdletBinding()]
param([ValidateSet('Preview','Import')][string]$Mode = 'Preview')
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22 or newer is required.' }
$major = (& node -p "process.versions.node.split('.')[0]")
if ($LASTEXITCODE -ne 0 -or [int]$major -lt 22) { throw 'Node.js 22 or newer is required.' }
if ($Mode -eq 'Import') {
    Write-Host 'This adds 52 real-source products, 104 DEMO price schedules and 5 categories to Saudi Arabia in KFMB Demo.'
    Write-Host 'Prices/limits are fictional. Existing users, clients, products and Kuwait assignments are not overwritten.'
    $confirm = Read-Host 'Type IMPORT to continue'
    if ($confirm -cne 'IMPORT') { Write-Host 'Canceled. No changes.'; exit 0 }
}
$secret = Read-Host 'Existing Functions/seeding client secret' -AsSecureString
$bstr = [IntPtr]::Zero
$oldValue = $env:KFMB_CATALOG_CLIENT_SECRET
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $env:KFMB_CATALOG_CLIENT_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $arg = if ($Mode -eq 'Import') { '--import' } else { '--preview' }
    & node (Join-Path $PSScriptRoot 'import-sa-catalog.mjs') $arg
    if ($LASTEXITCODE -ne 0) { throw "Saudi import stopped with code $LASTEXITCODE. Keep the existing data; review the error above." }
} finally {
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $env:KFMB_CATALOG_CLIENT_SECRET = $oldValue
    if ($secret) { $secret.Dispose() }
}
