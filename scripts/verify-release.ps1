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

function Invoke-ReleaseCheck {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  $checkStarted = Get-Date
  & $Action
  $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
  $checks.Add([pscustomobject]@{
    name = $Name
    passed = ($exitCode -eq 0)
    exit_code = $exitCode
    duration_ms = [int]((Get-Date) - $checkStarted).TotalMilliseconds
  })
}

Invoke-ReleaseCheck 'python-evaluator-and-quality-gates' {
  python -m pytest backend/python/tools -q
}
Invoke-ReleaseCheck 'backend-api-contract-and-security' {
  Push-Location backend
  npm exec -- tsx --test tests/**/*.test.ts
  Pop-Location
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
  Invoke-ReleaseCheck 'browser-desktop-and-mobile' {
    npm --prefix frontend run test:e2e -- --project=chromium --project=mobile-chromium
  }
}

if ($RunRuntimeSmoke) {
  Invoke-ReleaseCheck 'full-rag-runtime-smoke' {
    python backend/python/tools/run_runtime_smoke.py `
      --api-base http://127.0.0.1:8010 `
      --require-llm `
      --require-vector `
      --require-no-fallback
  }
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
