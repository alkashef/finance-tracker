# Minimal static file server for local use — no Node, no Python, no install.
#
#   powershell -ExecutionPolicy Bypass -File serve.ps1
#
# Then open http://localhost:8723/ and press Ctrl+C here to stop.
#
# Why this exists: Google OAuth will not sign in from a file:// page (its origin is
# "null", which cannot be added to Authorized JavaScript origins). Serving over
# http://localhost:<port> gives you a real origin you can register.

param([int]$Port = 8723)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://localhost:$Port/"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
  '.md'   = 'text/markdown; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Could not listen on $prefix - $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Another program may already be using port $Port. Try: serve.ps1 -Port 8080"
  exit 1
}

Write-Host "Serving $root"
Write-Host "  at $prefix" -ForegroundColor Green
Write-Host "Add this origin in Google Cloud Console -> Credentials -> your OAuth client"
Write-Host "  -> Authorized JavaScript origins:  http://localhost:$Port" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop."

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }

    $path = Join-Path $root $rel
    # Refuse anything that escapes the served directory.
    $full = [System.IO.Path]::GetFullPath($path)
    if (-not $full.StartsWith([System.IO.Path]::GetFullPath($root), [StringComparison]::OrdinalIgnoreCase)) {
      $context.Response.StatusCode = 403
      $context.Response.Close()
      continue
    }

    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      if ($mime.ContainsKey($ext)) { $type = $mime[$ext] } else { $type = 'application/octet-stream' }
      $context.Response.ContentType = $type
      # Never cache during local development.
      $context.Response.Headers.Add('Cache-Control', 'no-store')
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host "200 /$rel"
    } else {
      $context.Response.StatusCode = 404
      Write-Host "404 /$rel" -ForegroundColor DarkGray
    }
    $context.Response.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
