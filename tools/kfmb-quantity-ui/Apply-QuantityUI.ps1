param([string]$RepoRoot = "$env:USERPROFILE\Documents\Repos\oc-accelerator")
$ErrorActionPreference = "Stop"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is not available on PATH." }
& node (Join-Path $PSScriptRoot "apply-quantity-ui.mjs") $RepoRoot
if ($LASTEXITCODE -ne 0) { throw "Source update stopped. Review the preceding message before building." }
