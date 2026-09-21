param(
  [string]$TargetDir,
  [string]$ReleaseDir,
  [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$pythonScript = Join-Path $PSScriptRoot 'audit_competition_materials.py'

$argsList = @()
if ($ReleaseDir) {
  $argsList += "--release-dir"
  $argsList += $ReleaseDir
} elseif ($TargetDir) {
  $argsList += "--target-dir"
  $argsList += $TargetDir
}
if ($Verbose) {
  $argsList += "--verbose"
}

& python $pythonScript @argsList
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
  Write-Host "`n>>> [SUCCESS] 95+ Audit Gate Passed! Zero redline violations." -ForegroundColor Green
} else {
  Write-Host "`n>>> [FAILURE] 95+ Audit Gate Failed! Fatal redline violations found." -ForegroundColor Red
}

exit $exitCode
