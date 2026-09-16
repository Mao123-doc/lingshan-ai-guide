param(
  [switch]$RunBrowser,
  [switch]$RunRuntimeSmoke,
  [string]$ManifestPath = "evaluation/verification/release-manifest.json"
)

$ErrorActionPreference = 'Continue'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$startedAt = Get-Date
$commitSha = (& git rev-parse HEAD).Trim()
$branch = (& git branch --show-current).Trim()
$checks = [System.Collections.Generic.List[object]]::new()
$frontendRoot = Join-Path $repoRoot 'frontend'
$browserServerProcess = $null
$runtimeBackendProcess = $null
$runtimeDataRoot = $null
$runtimeEnvironmentBefore = $null
$formalDataSnapshot = $null

function Invoke-ReleaseCheck {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  $checkStarted = Get-Date
  $global:LASTEXITCODE = 0
  try {
    & $Action
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
  } catch {
    Write-Error $_
    $exitCode = 1
  }
  $checks.Add([pscustomobject]@{
    name = $Name
    passed = ($exitCode -eq 0)
    exit_code = $exitCode
    duration_ms = [int]((Get-Date) - $checkStarted).TotalMilliseconds
  })
}

function Import-RuntimeEnvironment {
  param([string]$Path)

  $names = @(
    'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'DEEPSEEK_BASE_URL',
    'AGNES_API_KEY', 'AGNES_MODEL', 'AGNES_BASE_URL',
    'VECTOR_SERVICE_URL', 'TTS_SERVER_URL'
  )
  $previous = @{}
  foreach ($name in $names) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
  }

  if (Test-Path -LiteralPath $Path) {
    foreach ($line in Get-Content -LiteralPath $Path) {
      if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
        $name = $Matches[1]
        if ($names -contains $name) {
          $value = $Matches[2]
          if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
              ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
          }
          [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
      }
    }
  }
  return $previous
}

function Restore-RuntimeEnvironment {
  param([hashtable]$Previous)
  if ($null -eq $Previous) { return }
  foreach ($name in $Previous.Keys) {
    if ($null -eq $Previous[$name]) {
      Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
    } else {
      [Environment]::SetEnvironmentVariable($name, $Previous[$name], 'Process')
    }
  }
}

function Get-FormalDataSnapshot {
  $snapshot = @{}
  foreach ($relativePath in @(
    'data/conversations.json',
    'data/daily_stats.json',
    'data/feedback.json'
  )) {
    $fullPath = Join-Path $repoRoot $relativePath
    if (Test-Path -LiteralPath $fullPath) {
      $snapshot[$relativePath] = (Get-FileHash -Algorithm SHA256 -LiteralPath $fullPath).Hash
    } else {
      $snapshot[$relativePath] = '<missing>'
    }
  }
  return $snapshot
}

function Assert-FormalDataUnchanged {
  param([hashtable]$Before)
  $after = Get-FormalDataSnapshot
  foreach ($relativePath in $Before.Keys) {
    if ($Before[$relativePath] -ne $after[$relativePath]) {
      throw "Runtime smoke modified formal data: $relativePath"
    }
  }
}

function Start-RuntimeBackend {
  param(
    [string]$DataRoot,
    [int]$Port
  )

  $backendRoot = Join-Path $repoRoot 'backend'
  $stdoutPath = Join-Path $DataRoot 'backend.stdout.log'
  $stderrPath = Join-Path $DataRoot 'backend.stderr.log'
  $process = Start-Process -FilePath 'node' `
    -ArgumentList @('node_modules/tsx/dist/cli.mjs', 'src/index.ts') `
    -WorkingDirectory $backendRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

  $healthUri = "http://127.0.0.1:$Port/health"
  $deadline = (Get-Date).AddSeconds(120)
  do {
    if ($process.HasExited) {
      $errorTail = if (Test-Path -LiteralPath $stderrPath) {
        (Get-Content -LiteralPath $stderrPath -Tail 40) -join "`n"
      } else { '<no backend stderr>' }
      throw "Backend exited before becoming ready (exit code $($process.ExitCode)).`n$errorTail"
    }
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUri -TimeoutSec 2
      if ($response.StatusCode -eq 200) { return $process }
    } catch {
      # Keep polling until the bounded startup deadline.
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
  throw "Backend did not become ready within 120 seconds. Logs: $stdoutPath and $stderrPath"
}

function Stop-RuntimeBackend {
  param([System.Diagnostics.Process]$Process)
  if ($null -ne $Process -and -not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
  }
}

function Start-BrowserServer {
  $process = Start-Process -FilePath 'node' `
    -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173') `
    -WorkingDirectory $frontendRoot `
    -WindowStyle Hidden `
    -PassThru

  $deadline = (Get-Date).AddSeconds(60)
  do {
    if ($process.HasExited) {
      throw "Vite exited before becoming ready (exit code $($process.ExitCode))."
    }
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/' -TimeoutSec 2
      if ($response.StatusCode -eq 200) { return $process }
    } catch {
      # Keep polling until the bounded startup deadline.
    }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)

  if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
  throw 'Vite did not become ready within 60 seconds.'
}

function Stop-BrowserServer {
  param([System.Diagnostics.Process]$Process)
  if ($null -ne $Process -and -not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
  }
}

Invoke-ReleaseCheck 'python-evaluator-and-quality-gates' {
  python -m pytest backend/python/tools -q
}
Invoke-ReleaseCheck 'backend-api-contract-and-security' {
  Push-Location backend
  npm exec -- tsx --test tests/**/*.test.ts
  Pop-Location
}
Invoke-ReleaseCheck 'backend-service-quality-benchmarks' {
  Push-Location backend
  try {
    $serviceTests = Get-ChildItem -Path 'src/services' -Filter '*.test.ts' -Recurse | Sort-Object FullName
    foreach ($serviceTest in $serviceTests) {
      npm exec -- tsx $serviceTest.FullName
      if ($LASTEXITCODE -ne 0) {
        throw "Service quality benchmark failed: $($serviceTest.FullName)"
      }
    }
  } finally {
    Pop-Location
  }
}
Invoke-ReleaseCheck 'backend-build' {
  npm --prefix backend run build
}
Invoke-ReleaseCheck 'frontend-unit' {
  npm --prefix frontend run test -- --run
}
Invoke-ReleaseCheck 'frontend-lint' {
  npm --prefix frontend run lint
}
Invoke-ReleaseCheck 'frontend-build' {
  npm --prefix frontend run build
}
Invoke-ReleaseCheck 'git-diff-check' {
  git diff --check
}

if ($RunBrowser) {
  try {
    $browserServerProcess = Start-BrowserServer
    $previousReuseFlag = $env:PLAYWRIGHT_USE_EXISTING_SERVER
    $env:PLAYWRIGHT_USE_EXISTING_SERVER = '1'
    Invoke-ReleaseCheck 'browser-desktop-and-mobile' {
      npm --prefix frontend run test:e2e -- --project=chromium --project=mobile-chromium
    }
  } finally {
    if ($null -eq $previousReuseFlag) {
      Remove-Item Env:PLAYWRIGHT_USE_EXISTING_SERVER -ErrorAction SilentlyContinue
    } else {
      $env:PLAYWRIGHT_USE_EXISTING_SERVER = $previousReuseFlag
    }
    Stop-BrowserServer $browserServerProcess
  }
}

if ($RunRuntimeSmoke) {
  $runtimePort = 8011
  $runtimeDataRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('lingshan-runtime-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $runtimeDataRoot | Out-Null
  $runtimeRawRoot = Join-Path $runtimeDataRoot 'raw'
  New-Item -ItemType Directory -Force -Path $runtimeRawRoot | Out-Null
  foreach ($knowledgeFile in @('knowledge_guide.txt', 'knowledge_dataset.txt')) {
    $sourceKnowledgeFile = Join-Path $repoRoot (Join-Path 'data/raw' $knowledgeFile)
    if (-not (Test-Path -LiteralPath $sourceKnowledgeFile)) {
      throw "Required runtime knowledge source is missing: $sourceKnowledgeFile"
    }
    Copy-Item -LiteralPath $sourceKnowledgeFile -Destination (Join-Path $runtimeRawRoot $knowledgeFile)
  }
  $formalDataSnapshot = Get-FormalDataSnapshot
  $environmentCandidates = @(
    (Join-Path $repoRoot '.env'),
    (Join-Path $repoRoot '..\.env'),
    (Join-Path $repoRoot '..\..\.env')
  )
  $runtimeEnvironmentFile = $environmentCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  $runtimeEnvironmentBefore = Import-RuntimeEnvironment $runtimeEnvironmentFile
  $previousDataRoot = [Environment]::GetEnvironmentVariable('DATA_ROOT', 'Process')
  $previousPort = [Environment]::GetEnvironmentVariable('PORT', 'Process')
  [Environment]::SetEnvironmentVariable('DATA_ROOT', $runtimeDataRoot, 'Process')
  [Environment]::SetEnvironmentVariable('PORT', "$runtimePort", 'Process')
  try {
    $runtimeBackendProcess = Start-RuntimeBackend $runtimeDataRoot $runtimePort
    Invoke-ReleaseCheck 'full-rag-runtime-smoke' {
      python backend/python/tools/run_runtime_smoke.py `
        --api-base "http://127.0.0.1:$runtimePort" `
        --require-llm `
        --require-vector `
        --require-no-fallback
    }
    $runtimeSmokeCheck = $checks | Where-Object { $_.name -eq 'full-rag-runtime-smoke' } | Select-Object -Last 1
    if (-not $runtimeSmokeCheck.passed) {
      $runtimeStderrPath = Join-Path $runtimeDataRoot 'backend.stderr.log'
      if (Test-Path -LiteralPath $runtimeStderrPath) {
        Write-Output '=== Runtime backend stderr (tail) ==='
        Get-Content -LiteralPath $runtimeStderrPath -Tail 80
      }
    }
  } finally {
    Stop-RuntimeBackend $runtimeBackendProcess
    Restore-RuntimeEnvironment $runtimeEnvironmentBefore
    if ($null -eq $previousDataRoot) {
      Remove-Item Env:DATA_ROOT -ErrorAction SilentlyContinue
    } else {
      [Environment]::SetEnvironmentVariable('DATA_ROOT', $previousDataRoot, 'Process')
    }
    if ($null -eq $previousPort) {
      Remove-Item Env:PORT -ErrorAction SilentlyContinue
    } else {
      [Environment]::SetEnvironmentVariable('PORT', $previousPort, 'Process')
    }
  }
  Invoke-ReleaseCheck 'runtime-data-isolation' {
    Assert-FormalDataUnchanged $formalDataSnapshot
  }
  Remove-Item -LiteralPath $runtimeDataRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$status = @(git status --short)
$manifest = [ordered]@{
  schema_version = 1
  kind = 'release-rehearsal'
  commit_sha = $commitSha
  branch = $branch
  started_at = $startedAt.ToUniversalTime().ToString('o')
  finished_at = (Get-Date).ToUniversalTime().ToString('o')
  options = [ordered]@{
    browser = [bool]$RunBrowser
    runtime_smoke = [bool]$RunRuntimeSmoke
  }
  checks = @($checks)
  clean_worktree = ($status.Count -eq 0)
  status = if (($checks | Where-Object { -not $_.passed }).Count -eq 0 -and $status.Count -eq 0) { 'passed' } else { 'failed' }
}

$manifestDirectory = Split-Path -Parent $ManifestPath
if ($manifestDirectory) { New-Item -ItemType Directory -Force -Path $manifestDirectory | Out-Null }
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -Path $ManifestPath
$manifest | ConvertTo-Json -Depth 8

if ($manifest.status -ne 'passed') { exit 1 }
exit 0
