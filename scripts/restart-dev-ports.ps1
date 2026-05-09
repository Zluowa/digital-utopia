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
$engineDir = Join-Path $root 'engine'
$frontendDir = Join-Path $root 'frontend-new'
$logDir = Join-Path $root '.dev'

if (-not (Test-Path $engineDir)) { throw "Engine directory not found: $engineDir" }
if (-not (Test-Path $frontendDir)) { throw "Frontend directory not found: $frontendDir" }

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Stop-PortProcess([int]$Port) {
  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $proc = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    if (-not $proc) { continue }
    Write-Host "Stopping port $Port listener PID=$($proc.Id) $($proc.ProcessName)"
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  }
}

function Stop-ProjectProcess() {
  $needle = 'projects\digital-utopia'
  $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      ($_.Name -eq 'node.exe' -or $_.Name -eq 'esbuild.exe') -and
      $_.CommandLine -and
      $_.CommandLine.Contains($needle)
    }
  foreach ($proc in $procs) {
    Write-Host "Stopping project process PID=$($proc.ProcessId) $($proc.Name)"
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Wait-ForEndpoint([string]$Label, [string]$Url) {
  $deadline = (Get-Date).AddSeconds($StartupTimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-RestMethod -Uri $Url -UseBasicParsing -TimeoutSec 5 | Out-Null
      Write-Host "$Label is reachable: $Url"
      return
    } catch {
      Write-Host "$Label not ready yet, retrying in $CheckIntervalSec seconds..."
      Start-Sleep -Seconds $CheckIntervalSec
    }
  }
  throw "Timeout waiting for $Label ($Url) after $StartupTimeoutSec seconds"
}

Stop-ProjectProcess
Stop-PortProcess $BackendPort
Stop-PortProcess $FrontendPort

$backendUrl = "http://localhost:$BackendPort/api/info"
$frontendUrl = "http://localhost:$FrontendPort/api/info"

$engineOut = Join-Path $logDir "engine-$BackendPort.out.log"
$engineErr = Join-Path $logDir "engine-$BackendPort.err.log"
$frontendOut = Join-Path $logDir "frontend-$FrontendPort.out.log"
$frontendErr = Join-Path $logDir "frontend-$FrontendPort.err.log"
Remove-Item -LiteralPath $engineOut,$engineErr,$frontendOut,$frontendErr -Force -ErrorAction SilentlyContinue

$env:NODE_DISABLE_COMPILE_CACHE = '1'
$env:FRONTEND_PORT = [string]$FrontendPort
$env:DU_ENGINE_PORT = [string]$BackendPort

$tsxCli = Join-Path $engineDir 'node_modules\tsx\dist\cli.mjs'
if (-not (Test-Path $tsxCli)) { throw "tsx CLI not found: $tsxCli" }

Write-Host "Using project root: $root"
Write-Host "Starting Backend: $tsxCli src/start.ts $World $BackendPort"
$engineProcess = Start-Process -FilePath 'node.exe' `
  -ArgumentList @($tsxCli, 'src/start.ts', $World, [string]$BackendPort) `
  -WorkingDirectory $engineDir `
  -RedirectStandardOutput $engineOut `
  -RedirectStandardError $engineErr `
  -WindowStyle Hidden `
  -PassThru

Wait-ForEndpoint 'Backend' $backendUrl

Write-Host "Starting Frontend: npm run dev"
$frontendProcess = Start-Process -FilePath 'cmd.exe' `
  -ArgumentList @('/c', 'npm run dev') `
  -WorkingDirectory $frontendDir `
  -RedirectStandardOutput $frontendOut `
  -RedirectStandardError $frontendErr `
  -WindowStyle Hidden `
  -PassThru

Wait-ForEndpoint 'Frontend' $frontendUrl

Write-Host "Services are healthy. Backend PID=$($engineProcess.Id); Frontend launcher PID=$($frontendProcess.Id)"
Write-Host "Backend log: $engineOut"
Write-Host "Frontend log: $frontendOut"
