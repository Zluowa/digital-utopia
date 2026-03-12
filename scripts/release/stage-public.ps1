param(
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $ProjectRoot ".tmp-public-release"
}
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)

if (Test-Path $OutputDir) {
  Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Path $OutputDir | Out-Null

$IncludePaths = @(
  ".github",
  "engine",
  "frontend-new",
  "shared",
  "templates",
  "packages\create-utopia",
  "scripts\release",
  "docs",
  ".dockerignore",
  ".env.example",
  ".gitignore",
  "ACKNOWLEDGEMENTS.md",
  "CONTRIBUTING.md",
  "INSTALL.md",
  "LICENSE",
  "OPEN_SOURCE_STATUS.md",
  "README.md",
  "docker-compose.yml",
  "Dockerfile",
  "Dockerfile.dashboard",
  "entrypoint.sh",
  "nginx.conf",
  "package.json",
  "package-lock.json",
  "tsconfig.json"
)

foreach ($rel in $IncludePaths) {
  $src = Join-Path $ProjectRoot $rel
  if (-not (Test-Path $src)) {
    Write-Warning "Skip missing path: $rel"
    continue
  }
  $dst = Join-Path $OutputDir $rel
  $dstParent = Split-Path -Parent $dst
  if (-not (Test-Path $dstParent)) {
    New-Item -ItemType Directory -Path $dstParent -Force | Out-Null
  }
  $item = Get-Item $src
  if ($item.PSIsContainer) {
    if (-not (Test-Path $dst)) {
      New-Item -ItemType Directory -Path $dst | Out-Null
    }
    $null = & robocopy $src $dst /E /NFL /NDL /NJH /NJS /NP /XD node_modules .git worlds logs outbox dist coverage .tmp /XF *.log *.pid
    if ($LASTEXITCODE -gt 7) {
      throw "robocopy failed for $rel with code $LASTEXITCODE"
    }
  } else {
    Copy-Item -Path $src -Destination $dst -Force
  }
}

$worldsDir = Join-Path $OutputDir "worlds"
if (-not (Test-Path $worldsDir)) {
  New-Item -ItemType Directory -Path $worldsDir | Out-Null
}
Set-Content -Path (Join-Path $worldsDir ".gitkeep") -Value ""

Write-Host "Staged public snapshot:" -ForegroundColor Green
Write-Host "  $OutputDir"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  cd `"$OutputDir`""
Write-Host "  git init"
Write-Host "  git checkout -b main"
Write-Host "  git add ."
Write-Host "  git commit -m `"Initial public staging`""
