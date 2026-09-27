param(
  [Parameter(Mandatory = $true)]
  [string]$PptxPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputDir
)

$ErrorActionPreference = 'Stop'
$resolvedPptx = (Resolve-Path -LiteralPath $PptxPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null

$powerPoint = $null
$presentation = $null
try {
  $powerPoint = New-Object -ComObject PowerPoint.Application
  $presentation = $powerPoint.Presentations.Open($resolvedPptx, $true, $true, $false)
  $presentation.Export($resolvedOutput, 'PNG', 1920, 1080)
  Write-Output $resolvedOutput
}
finally {
  if ($presentation -ne $null) {
    $presentation.Close()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation)
  }
  if ($powerPoint -ne $null) {
    $powerPoint.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
