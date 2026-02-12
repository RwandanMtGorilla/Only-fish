@echo off
set PORT=8080
echo Serving at http://localhost:%PORT%
start http://localhost:%PORT%

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server %PORT%
) else (
  where python3 >nul 2>nul
  if %errorlevel%==0 (
    python3 -m http.server %PORT%
  ) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$listener = [System.Net.HttpListener]::new();" ^
      "$listener.Prefixes.Add('http://localhost:%PORT%/');" ^
      "$listener.Start();" ^
      "Write-Host 'Press Ctrl+C to stop.';" ^
      "$root = (Get-Location).Path;" ^
      "$mimeTypes = @{" ^
      "  '.html'='text/html; charset=utf-8';" ^
      "  '.css'='text/css; charset=utf-8';" ^
      "  '.js'='application/javascript; charset=utf-8';" ^
      "  '.json'='application/json; charset=utf-8';" ^
      "  '.png'='image/png';" ^
      "  '.jpg'='image/jpeg';" ^
      "  '.svg'='image/svg+xml';" ^
      "  '.ico'='image/x-icon';" ^
      "  '.woff2'='font/woff2';" ^
      "};" ^
      "try { while ($listener.IsListening) {" ^
      "  $ctx = $listener.GetContext();" ^
      "  $path = $ctx.Request.Url.LocalPath;" ^
      "  if ($path -eq '/') { $path = '/index.html' };" ^
      "  $file = Join-Path $root $path.Replace('/','\');" ^
      "  if (Test-Path $file -PathType Leaf) {" ^
      "    $ext = [System.IO.Path]::GetExtension($file);" ^
      "    $ctx.Response.ContentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' };" ^
      "    $bytes = [System.IO.File]::ReadAllBytes($file);" ^
      "    $ctx.Response.ContentLength64 = $bytes.Length;" ^
      "    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length);" ^
      "  } else {" ^
      "    $ctx.Response.StatusCode = 404;" ^
      "    $msg = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found');" ^
      "    $ctx.Response.OutputStream.Write($msg, 0, $msg.Length);" ^
      "  };" ^
      "  $ctx.Response.Close();" ^
      "}} finally { $listener.Stop() }"
  )
)
