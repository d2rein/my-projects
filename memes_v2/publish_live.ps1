$ErrorActionPreference = "Stop"

$appRoot = (Resolve-Path $PSScriptRoot).Path
$deployRoot = Join-Path $env:TEMP "meme-search-v2-pages-deploy"
$preloadPath = Join-Path $env:TEMP "wrangler-undici-preload.js"
$wranglerBase = Join-Path $env:APPDATA "npm\node_modules\wrangler"
$wranglerCli = Join-Path $wranglerBase "wrangler-dist\cli.js"
$projectName = "meme-search-v2-d2rei"
$liveUrl = "https://meme-search-v2-d2rei.pages.dev/"

if (-not (Test-Path -LiteralPath $wranglerCli)) {
  throw "Wrangler CLI not found at $wranglerCli"
}

if (Test-Path -LiteralPath $deployRoot) {
  Remove-Item -LiteralPath $deployRoot -Recurse -Force
}

try {
  New-Item -ItemType Directory -Path $deployRoot | Out-Null

  Copy-Item -LiteralPath (Join-Path $appRoot "index.html") -Destination $deployRoot

  @"
const path = require('path');
const base = path.join(process.env.APPDATA, 'npm', 'node_modules', 'wrangler');
const undici = require(path.join(base, 'node_modules', 'undici'));
undici.setGlobalDispatcher(new undici.Agent({ headersTimeout: 0, bodyTimeout: 0 }));
"@ | Set-Content -LiteralPath $preloadPath -Encoding ascii

  Write-Host "Deploying standalone memes_v2 site..."
  & node --require $preloadPath $wranglerCli pages deploy $deployRoot --project-name $projectName
  if ($LASTEXITCODE -ne 0) {
    throw "Pages deploy failed"
  }

  Write-Host "Live URL: $liveUrl"
}
finally {
  if (Test-Path -LiteralPath $deployRoot) {
    Remove-Item -LiteralPath $deployRoot -Recurse -Force
  }
  if (Test-Path -LiteralPath $preloadPath) {
    Remove-Item -LiteralPath $preloadPath -Force
  }
}
