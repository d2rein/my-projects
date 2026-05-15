$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path $PSScriptRoot).Path
$deployRoot = Join-Path $env:TEMP "my-site-pages-deploy"
$tarPath = Join-Path $env:TEMP "my-site-pages-deploy.tar"
$preloadPath = Join-Path $env:TEMP "wrangler-undici-preload.js"
$wranglerBase = Join-Path $env:APPDATA "npm\node_modules\wrangler"
$wranglerCli = Join-Path $wranglerBase "wrangler-dist\cli.js"
$projectName = "my-projects"

if (-not (Test-Path -LiteralPath $wranglerCli)) {
  throw "Wrangler CLI not found at $wranglerCli"
}

if (Test-Path -LiteralPath $deployRoot) {
  Remove-Item -LiteralPath $deployRoot -Recurse -Force
}
if (Test-Path -LiteralPath $tarPath) {
  Remove-Item -LiteralPath $tarPath -Force
}

New-Item -ItemType Directory -Path $deployRoot | Out-Null

try {
  Write-Host "Creating tracked-files-only deploy bundle from HEAD..."
  & git -C $repoRoot archive --format=tar -o $tarPath HEAD
  if ($LASTEXITCODE -ne 0) {
    throw "git archive failed"
  }

  & tar -xf $tarPath -C $deployRoot
  if ($LASTEXITCODE -ne 0) {
    throw "tar extract failed"
  }

  @"
const path = require('path');
const base = path.join(process.env.APPDATA, 'npm', 'node_modules', 'wrangler');
const undici = require(path.join(base, 'node_modules', 'undici'));
undici.setGlobalDispatcher(new undici.Agent({ headersTimeout: 0, bodyTimeout: 0 }));
"@ | Set-Content -LiteralPath $preloadPath -Encoding ascii

  Write-Host "Deploying Cloudflare Pages from clean tracked snapshot..."
  & node --require $preloadPath $wranglerCli pages deploy $deployRoot --project-name $projectName
  if ($LASTEXITCODE -ne 0) {
    throw "Pages deploy failed"
  }
}
finally {
  if (Test-Path -LiteralPath $deployRoot) {
    Remove-Item -LiteralPath $deployRoot -Recurse -Force
  }
  if (Test-Path -LiteralPath $tarPath) {
    Remove-Item -LiteralPath $tarPath -Force
  }
  if (Test-Path -LiteralPath $preloadPath) {
    Remove-Item -LiteralPath $preloadPath -Force
  }
}
