# Air-gap transfer helper (Windows PowerShell).
# Builds a self-contained bundle of the backend + frontend dist for the
# air-gapped host. Run on the CONNECTED build machine, copy the ./airgap-bundle
# (plus the Ollama model files) onto the offline host, then run install-bundle.ps1 there.

param(
  [string]$OutDir = ".\airgap-bundle"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "==> Resolving backend deps (connected host)" -ForegroundColor Cyan
Push-Location $root
npm install --omit=dev
Pop-Location

Write-Host "==> Building frontend" -ForegroundColor Cyan
Push-Location "$root\frontend"
npm install; if ($LASTEXITCODE -ne 0) { throw "npm install (frontend) failed" }
npm run build; if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
Pop-Location

Write-Host "==> Assembling bundle -> $OutDir" -ForegroundColor Cyan
$bundle = Join-Path (Resolve-Path $root).Path $OutDir
Remove-Item -Recurse -Force $bundle -ErrorAction SilentlyContinue
$dirs = @("backend", "infrastructure", "docs", "scripts", "evaluation", "frontend\dist", "sovereign\seed")
foreach ($d in $dirs) {
  $src = Join-Path $root $d
  if (Test-Path $src) { Copy-Item -Recurse $src (Join-Path $bundle $d) }
}
Copy-Item (Join-Path $root "package.json") $bundle
Copy-Item (Join-Path $root "package-lock.json") $bundle
Copy-Item (Join-Path $root ".env.example") $bundle -ErrorAction SilentlyContinue
Copy-Item (Join-Path $root "server.js") $bundle
Push-Location $root
New-Item -ItemType Directory -Force -Path "$bundle\node_modules" | Out-Null
Copy-Item "node_modules\*" "$bundle\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Pop-Location

Write-Host "==> Writing install-bundle.ps1 (runs on the offline host)" -ForegroundColor Cyan
@"
`$ErrorActionPreference = "Stop"
Write-Host "==> Installing Sovereign Workbench bundle"
npm install --omit=dev
Write-Host "==> Seed sample KB (optional)"
node scripts/demo-seed.js
Write-Host "==> Verify:"
Write-Host "    node evaluation/run-eval.js   (self-test, ~all PASS)"
Write-Host "    node scripts/demo-run.js       (walkthrough)"
Write-Host "    node server.js                 (start, then open /workbench)"
"@ | Set-Content -Path "$bundle\install-bundle.ps1" -Encoding UTF8

Write-Host ""
Write-Host "Done. Transfer '$OutDir' to the offline host." -ForegroundColor Green
Write-Host "Also copy your Ollama models (e.g. qwen3:8b, qwen3-vl:8b, nomic-embed-text) and load container images:" 
Write-Host "  docker image save python:3.12-slim -o sandbox-image.tar"