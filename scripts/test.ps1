# Test runner: serves the repo, drives every test/*.html harness through headless
# Edge, prints one summary, and exits 0/1.
#
#   powershell -ExecutionPolicy Bypass -File scripts\test.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\test.ps1 -Update
#
# -Update (re)captures test/golden.json (rendered DOM) and test/crud.json (Sheets write
# payloads) from the current app.js/styles.css — the only thing allowed to rewrite those
# files. Review the diff before committing it; a baseline captured after a change
# certifies the change.
#

param([switch]$Update)

$ErrorActionPreference = 'Stop'

function Get-FreePort {
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $port = $listener.LocalEndpoint.Port
  $listener.Stop()
  return $port
}

function Find-Edge {
  $candidates = @(
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')
  )
  foreach ($c in $candidates) { if ($c -and (Test-Path -LiteralPath $c)) { return $c } }
  $cmd = Get-Command msedge -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Wait-ForServer {
  param([int]$Port, [int]$TimeoutSec = 15)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-WebRequest -Uri "http://localhost:$Port/index.html" -UseBasicParsing -TimeoutSec 2
      if ($resp.StatusCode -eq 200) { return $true }
    } catch {
      Start-Sleep -Milliseconds 300
    }
  }
  return $false
}

# Edge's --dump-dom output MUST be captured via Start-Process -RedirectStandardOutput.
# Plain `>` redirection produces a 0-byte file with exit code 0 — a silent, convincing
# failure (docs/plan.md).
function Invoke-Harness {
  param([string]$EdgePath, [string]$Url, [string]$Label, [string]$WorkDir)
  $safe = ($Label -replace '[^a-zA-Z0-9]+', '_')
  $userData = Join-Path $WorkDir ("profile_" + $safe + '_' + [guid]::NewGuid().ToString('N'))
  $outFile = Join-Path $WorkDir ($safe + '.out.html')
  $errFile = Join-Path $WorkDir ($safe + '.err.log')
  $edgeArgs = @(
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--virtual-time-budget=20000',
    "--user-data-dir=$userData",
    '--dump-dom', $Url
  )
  Start-Process -FilePath $EdgePath -ArgumentList $edgeArgs -Wait -NoNewWindow `
    -RedirectStandardOutput $outFile -RedirectStandardError $errFile
  # Edge writes the dump as UTF-8. Get-Content's encoding auto-detection (PS 5.1) can
  # misread a BOM-less UTF-8 file as the system codepage and mangle every non-ASCII
  # character (arrows, em dashes, the × in the stocks screen) — read the bytes directly.
  if (Test-Path -LiteralPath $outFile) { return [System.IO.File]::ReadAllText($outFile, [System.Text.Encoding]::UTF8) }
  return $null
}

# Every harness (smoke.html, golden.html) renders the same #report format: an
# "ALL CHECKS PASSED" / "N CHECK(S) FAILED" head line plus a JS-errors line.
function Get-ReportResult {
  param([string]$Html)
  if (-not $Html) { return [pscustomobject]@{ Ok = $false; Summary = 'no output captured (harness crashed or timed out)'; Report = '' } }
  $opts = [System.Text.RegularExpressions.RegexOptions]::Singleline
  $m = [regex]::Match($Html, '<pre id="report">(.*?)</pre>', $opts)
  if (-not $m.Success) { return [pscustomobject]@{ Ok = $false; Summary = 'no #report element found (harness did not finish)'; Report = $Html.Substring(0, [Math]::Min(500, $Html.Length)) } }
  $reportHtml = $m.Groups[1].Value
  $reportText = [System.Net.WebUtility]::HtmlDecode(($reportHtml -replace '<[^>]+>', ''))
  $passed = $reportText -match 'ALL CHECKS PASSED'
  $noErrors = $reportText -match 'no JS errors'
  $failCount = [regex]::Match($reportText, '(\d+) CHECK\(S\) FAILED')
  $summary = if ($passed) { 'checks passed' } else { ($failCount.Groups[1].Value) + ' check(s) failed' }
  if (-not $noErrors) { $summary += '; JS errors present' }
  return [pscustomobject]@{ Ok = ($passed -and $noErrors); Summary = $summary; Report = $reportText.Trim() }
}

function Get-CaptureOutput {
  param([string]$Html, [string]$OutputId)
  if (-not $Html) { return $null }
  $opts = [System.Text.RegularExpressions.RegexOptions]::Singleline
  $m = [regex]::Match($Html, ('<pre id="' + $OutputId + '">(.*?)</pre>'), $opts)
  if (-not $m.Success -or $m.Groups[1].Value.Trim() -eq '') { return $null }
  return [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
}

# Indents every line but the first by $Spaces, so a standalone JSON.stringify(...,
# null, 2) fragment can be nested one level deeper as an object value.
function Add-Indent {
  param([string]$Text, [int]$Spaces)
  $pad = ' ' * $Spaces
  $lines = $Text -split "`n"
  for ($i = 1; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -ne '') { $lines[$i] = $pad + $lines[$i] }
  }
  return ($lines -join "`n")
}

function Main {
  param([switch]$Update)

  $repoRoot = Split-Path -Parent $PSScriptRoot
  $testDir = Join-Path $repoRoot 'test'
  $goldenPath = Join-Path $testDir 'golden.json'
  $crudPath = Join-Path $testDir 'crud.json'
  $serveScript = Join-Path $PSScriptRoot 'serve.ps1'

  if (-not (Test-Path -LiteralPath $serveScript)) {
    Write-Host "Cannot find serve.ps1 at $serveScript" -ForegroundColor Red
    return 1
  }

  $edge = Find-Edge
  if (-not $edge) {
    Write-Host 'Cannot find msedge.exe - install Microsoft Edge or add it to PATH.' -ForegroundColor Red
    return 1
  }

  $port = Get-FreePort
  $work = Join-Path ([System.IO.Path]::GetTempPath()) ('finance-tracker-test-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $work | Out-Null

  $serverProc = $null
  try {
    $psExe = Join-Path $PSHOME 'powershell.exe'
    $serverProc = Start-Process -FilePath $psExe `
      -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $serveScript, '-Port', $port) `
      -PassThru -WindowStyle Hidden

    if (-not (Wait-ForServer -Port $port -TimeoutSec 15)) {
      Write-Host "Server did not come up on http://localhost:$port within 15s." -ForegroundColor Red
      return 1
    }
    $base = "http://localhost:$port"

    if ($Update) {
      $baselines = @(
        @{ Page = 'golden.html'; OutputId = 'golden-output'; Path = $goldenPath; Name = 'golden' },
        @{ Page = 'crud.html'; OutputId = 'crud-output'; Path = $crudPath; Name = 'crud' }
      )
      foreach ($b in $baselines) {
        Write-Host ("Capturing {0} baseline (scenario: populated)..." -f $b.Name) -ForegroundColor Yellow
        $popHtml = Invoke-Harness -EdgePath $edge -Url "$base/test/$($b.Page)?scenario=populated&update=1" -Label "$($b.Name)-update-populated" -WorkDir $work
        $popFragment = Get-CaptureOutput $popHtml $b.OutputId

        Write-Host ("Capturing {0} baseline (scenario: empty)..." -f $b.Name) -ForegroundColor Yellow
        $emptyHtml = Invoke-Harness -EdgePath $edge -Url "$base/test/$($b.Page)?scenario=empty&update=1" -Label "$($b.Name)-update-empty" -WorkDir $work
        $emptyFragment = Get-CaptureOutput $emptyHtml $b.OutputId

        if (-not $popFragment -or -not $emptyFragment) {
          Write-Host ("Update failed: {0} did not emit #{1} for one or both scenarios." -f $b.Page, $b.OutputId) -ForegroundColor Red
          if ($popHtml) { Write-Host (Get-ReportResult $popHtml).Report -ForegroundColor DarkGray }
          if ($emptyHtml) { Write-Host (Get-ReportResult $emptyHtml).Report -ForegroundColor DarkGray }
          return 1
        }

        $finalJson = "{`n  ""populated"": " + (Add-Indent $popFragment 2) + ",`n  ""empty"": " + (Add-Indent $emptyFragment 2) + "`n}`n"
        [System.IO.File]::WriteAllText($b.Path, $finalJson, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host ("Wrote {0}" -f $b.Path) -ForegroundColor Green
      }
      Write-Host ''
    }

    $harnesses = @(
      @{ Url = "$base/test/smoke.html"; Label = 'smoke (populated)' },
      @{ Url = "$base/test/smoke.html?scenario=empty"; Label = 'smoke (empty)' },
      @{ Url = "$base/test/smoke.html?env=1"; Label = 'smoke (env prefill)' },
      @{ Url = "$base/test/golden.html"; Label = 'golden (populated)' },
      @{ Url = "$base/test/golden.html?scenario=empty"; Label = 'golden (empty)' },
      @{ Url = "$base/test/crud.html"; Label = 'crud (populated)' },
      @{ Url = "$base/test/crud.html?scenario=empty"; Label = 'crud (empty)' }
    )

    $allOk = $true
    foreach ($h in $harnesses) {
      $html = Invoke-Harness -EdgePath $edge -Url $h.Url -Label $h.Label -WorkDir $work
      $r = Get-ReportResult $html
      if (-not $r.Ok) { $allOk = $false }
      $status = if ($r.Ok) { 'PASS' } else { 'FAIL' }
      $color = if ($r.Ok) { 'Green' } else { 'Red' }
      Write-Host ('{0,-4}  {1,-24} {2}' -f $status, $h.Label, $r.Summary) -ForegroundColor $color
      if (-not $r.Ok -and $r.Report) {
        Write-Host $r.Report -ForegroundColor DarkGray
        Write-Host ''
      }
    }

    Write-Host ''
    if ($allOk) { Write-Host 'ALL HARNESSES PASSED' -ForegroundColor Green }
    else { Write-Host 'SOME HARNESSES FAILED' -ForegroundColor Red }

    if ($allOk) { return 0 } else { return 1 }
  } finally {
    if ($serverProc -and -not $serverProc.HasExited) {
      Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
  }
}

exit (Main -Update:$Update)
