# Test runner: serves the repo, drives every test/*.html harness through headless
# Edge, prints one summary, and exits 0/1.
#
#   powershell -ExecutionPolicy Bypass -File scripts\test.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\test.ps1 -Update
#
# -Update (re)captures test/golden.json (rendered DOM), test/crud.json (Sheets write
# payloads) and test/screenshots.json (per-screen PNG hashes) from the current
# app.js/src/css/*.css - the only thing allowed to rewrite those files. Review the
# diff before committing it; a baseline captured after a change certifies the change.
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

# Milestone 7's net for the one thing golden.html's DOM snapshot can't see: the CSS
# token/split change touches no HTML, only the rendered result. Same
# Start-Process -RedirectStandardOutput discipline as Invoke-Harness - a pinned
# --window-size is what makes the PNG (and so its hash) reproducible run to run.
function Invoke-Screenshot {
  param([string]$EdgePath, [string]$Url, [string]$Label, [string]$WorkDir)
  $safe = ($Label -replace '[^a-zA-Z0-9]+', '_')
  $userData = Join-Path $WorkDir ("shot_" + $safe + '_' + [guid]::NewGuid().ToString('N'))
  $outFile = Join-Path $WorkDir ($safe + '.png')
  $errFile = Join-Path $WorkDir ($safe + '.shot.err.log')
  if (Test-Path -LiteralPath $outFile) { Remove-Item -LiteralPath $outFile -Force }
  $edgeArgs = @(
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--virtual-time-budget=20000',
    '--window-size=1440,900',
    '--force-device-scale-factor=1',
    '--disable-lcd-text', '--disable-font-subpixel-positioning', '--font-render-hinting=none',
    "--user-data-dir=$userData",
    "--screenshot=$outFile",
    $Url
  )
  Start-Process -FilePath $EdgePath -ArgumentList $edgeArgs -Wait -NoNewWindow `
    -RedirectStandardOutput (Join-Path $WorkDir ($safe + '.shot.out.log')) -RedirectStandardError $errFile
  if (Test-Path -LiteralPath $outFile) { return $outFile }
  return $null
}

# Headless Chromium's software rasterizer is not perfectly deterministic run to run -
# a hairline border can antialias a pixel or two differently even with identical DOM
# (confirmed by hand: golden.html's byte-identical HTML check passes every time this
# flakes, and the pixel diff is a couple dozen pixels on a 1-2px-wide border, invisible
# to the eye). Retrying is the standard mitigation for this class of visual-test flake:
# a real regression mismatches every attempt, transient antialiasing jitter usually
# clears within a couple of tries.
function Test-ScreenshotMatch {
  param([string]$EdgePath, [string]$Url, [string]$Label, [string]$WorkDir, [string]$Expected, [int]$Attempts = 3)
  for ($try = 1; $try -le $Attempts; $try++) {
    $png = Invoke-Screenshot -EdgePath $EdgePath -Url $Url -Label ($Label + '_try' + $try) -WorkDir $WorkDir
    if ($png) {
      $hash = (Get-FileHash -LiteralPath $png -Algorithm SHA256).Hash
      if ($hash -eq $Expected) { return $true }
    }
  }
  return $false
}

# The same 17 screens for both scenarios, plus account-ledger for populated only -
# the empty fixture has no accounts to select one from (golden.html skips it too).
function Get-ScreenshotTargets {
  $screens = @(
    'settings', 'dashboard', 'dashboard-expanded', 'transactions-overview', 'transactions-manage',
    'gold-overview', 'gold-manage', 'certs-overview', 'certs-manage', 'stocks-overview', 'stocks-manage',
    'pf-overview', 'pf-manage', 'accounts', 'types', 'tags', 'plan'
  )
  $targets = @()
  foreach ($scenario in @('populated', 'empty')) {
    foreach ($s in $screens) { $targets += [pscustomobject]@{ Scenario = $scenario; Screen = $s } }
  }
  $targets += [pscustomobject]@{ Scenario = 'populated'; Screen = 'account-ledger' }
  return $targets
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
  $screenshotPath = Join-Path $testDir 'screenshots.json'
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

      Write-Host 'Capturing screenshot baseline (this walks every screen twice)...' -ForegroundColor Yellow
      $shotTargets = Get-ScreenshotTargets
      $shotHashes = [ordered]@{ populated = [ordered]@{}; empty = [ordered]@{} }
      $shotCaptureFailed = $false
      foreach ($t in $shotTargets) {
        $label = "shot-update-$($t.Scenario)-$($t.Screen)"
        $url = "$base/test/screenshots.html?scenario=$($t.Scenario)&land=$($t.Screen)"
        $png = Invoke-Screenshot -EdgePath $edge -Url $url -Label $label -WorkDir $work
        if (-not $png) {
          Write-Host ("  FAIL  {0}/{1} - no screenshot produced" -f $t.Scenario, $t.Screen) -ForegroundColor Red
          $shotCaptureFailed = $true
          continue
        }
        $shotHashes[$t.Scenario][$t.Screen] = (Get-FileHash -LiteralPath $png -Algorithm SHA256).Hash
      }
      if ($shotCaptureFailed) {
        Write-Host 'Screenshot baseline capture failed for one or more screens.' -ForegroundColor Red
        return 1
      }
      [System.IO.File]::WriteAllText($screenshotPath, (($shotHashes | ConvertTo-Json -Depth 5) + "`n"), (New-Object System.Text.UTF8Encoding($false)))
      Write-Host ("Wrote {0}" -f $screenshotPath) -ForegroundColor Green
      Write-Host ''
    }

    $harnesses = @(
      @{ Url = "$base/test/smoke.html"; Label = 'smoke (populated)' },
      @{ Url = "$base/test/smoke.html?scenario=empty"; Label = 'smoke (empty)' },
      @{ Url = "$base/test/smoke.html?env=1"; Label = 'smoke (env prefill)' },
      @{ Url = "$base/test/golden.html"; Label = 'golden (populated)' },
      @{ Url = "$base/test/golden.html?scenario=empty"; Label = 'golden (empty)' },
      @{ Url = "$base/test/crud.html"; Label = 'crud (populated)' },
      @{ Url = "$base/test/crud.html?scenario=empty"; Label = 'crud (empty)' },
      @{ Url = "$base/test/unit.html"; Label = 'unit' }
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

    if (-not (Test-Path -LiteralPath $screenshotPath)) {
      Write-Host ('{0,-4}  {1,-24} {2}' -f 'FAIL', 'screenshots', 'screenshots.json missing - run scripts/test.ps1 -Update first') -ForegroundColor Red
      $allOk = $false
    } else {
      $shotBaseline = Get-Content -LiteralPath $screenshotPath -Raw | ConvertFrom-Json
      $shotTargets = Get-ScreenshotTargets
      $shotMismatches = @()
      $shotMissing = @()
      foreach ($t in $shotTargets) {
        $label = "shot-verify-$($t.Scenario)-$($t.Screen)"
        $url = "$base/test/screenshots.html?scenario=$($t.Scenario)&land=$($t.Screen)"
        $scenarioBaseline = $shotBaseline.($t.Scenario)
        $expected = if ($scenarioBaseline) { $scenarioBaseline.($t.Screen) } else { $null }
        if (-not $expected) { $shotMissing += "$($t.Scenario)/$($t.Screen)"; continue }
        $matched = Test-ScreenshotMatch -EdgePath $edge -Url $url -Label $label -WorkDir $work -Expected $expected
        if (-not $matched) { $shotMismatches += "$($t.Scenario)/$($t.Screen)" }
      }
      $shotOk = ($shotMismatches.Count -eq 0 -and $shotMissing.Count -eq 0)
      if (-not $shotOk) { $allOk = $false }
      $shotStatus = if ($shotOk) { 'PASS' } else { 'FAIL' }
      $shotColor = if ($shotOk) { 'Green' } else { 'Red' }
      $shotSummary = if ($shotOk) { "$($shotTargets.Count)/$($shotTargets.Count) hashes match" }
        else { "$($shotMismatches.Count) mismatch(es), $($shotMissing.Count) missing baseline" }
      Write-Host ('{0,-4}  {1,-24} {2}' -f $shotStatus, 'screenshots', $shotSummary) -ForegroundColor $shotColor
      if ($shotMismatches.Count) { Write-Host ('        mismatched: ' + ($shotMismatches -join ', ')) -ForegroundColor DarkGray }
      if ($shotMissing.Count) { Write-Host ('        missing baseline: ' + ($shotMissing -join ', ')) -ForegroundColor DarkGray }
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
