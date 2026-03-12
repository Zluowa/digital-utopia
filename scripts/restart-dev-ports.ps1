[CmdletBinding()]
param(
  [string]$World = 'genesis',
  [int]$FrontendPort = 3000,
  [int]$BackendPort = 4000,
  [string]$ProjectRoot = $null,
  [int]$StartupTimeoutSec = 120,
  [int]$CheckIntervalSec = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $ProjectRoot) {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $ProjectRoot = Split-Path -Parent $scriptDir
}

$root = Resolve-Path -Path $ProjectRoot
Write-Host "Using project root: $root"

$engineDir = Join-Path $root 'engine'
$frontendDir = Join-Path $root 'frontend-new'

if (-not (Test-Path $engineDir)) {
  throw "Engine directory not found: $engineDir"
}

if (-not (Test-Path $frontendDir)) {
  throw "Frontend directory not found: $frontendDir"
}

function Start-ServiceProcess($label, $commandLine, $workingDir) {
  Write-Host ("Starting {0}: {1}" -f $label, $commandLine) -ForegroundColor Cyan
  return Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $commandLine -WorkingDirectory $workingDir -NoNewWindow -PassThru
}

function Wait-ForEndpoint($label, $url) {
  $deadline = (Get-Date).AddSeconds($StartupTimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-RestMethod -Uri $url -UseBasicParsing -TimeoutSec 5 | Out-Null
      Write-Host "$label is reachable: $url"
      return
    } catch {
      Write-Host "$label not ready yet, retrying in $CheckIntervalSec seconds..." -ForegroundColor Yellow
      Start-Sleep -Seconds $CheckIntervalSec
    }
  }
  throw "Timeout waiting for $label ($url) after $StartupTimeoutSec seconds"
}

$backendUrl = "http://localhost:$BackendPort/api/info"
$frontendUrl = "http://localhost:$FrontendPort/api/info"

$engineCmdLine = 'set "WORLD={0}" && set "PORT={1}" && npx --yes --prefix engine tsx engine/src/start.ts {0} {1}' -f $World, $BackendPort
$frontendCmdLine = 'set "PORT={0}" && npm run dev' -f $FrontendPort

$engineProcess = Start-ServiceProcess 'Backend' $engineCmdLine $root
$frontendProcess = Start-ServiceProcess 'Frontend' $frontendCmdLine $frontendDir

Start-Sleep -Seconds 2

try {
  Wait-ForEndpoint 'Backend' $backendUrl
  Wait-ForEndpoint 'Frontend' $frontendUrl
  Write-Host "Services are healthy. Backend PID=$($engineProcess.Id); Frontend PID=$($frontendProcess.Id)"
} catch {
  Write-Host "Health check failed: $_" -ForegroundColor Red
  throw $_
}

Write-Host "Restart script finished. Services continue to run in the background."
