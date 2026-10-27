# Generates Duezy's PNG icons (calendar-check glyph) with GDI+.
# Run from the repo root:  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/gen-icons.ps1

Add-Type -AssemblyName System.Drawing

$teal = [System.Drawing.Color]::FromArgb(255, 13, 148, 136)
$white = [System.Drawing.Color]::White
$outDir = Join-Path $PSScriptRoot "..\public\icons"

function New-RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

# Draws the glyph into $g. $scale shrinks it around the canvas center
# (0.62 for maskable safe zone, 1.0 otherwise).
function Draw-Glyph([System.Drawing.Graphics]$g, [int]$s, [float]$scale) {
  $cx = 0.5 * $s
  $cy = 0.5 * $s
  # Local helper mapping glyph-space (fx, fy) → device pixels.
  $map = {
    param($fx, $fy)
    $x = $cx + (($fx - 0.5) * $s * $scale)
    $y = $cy + (($fy - 0.5) * $s * $scale)
    return [System.Drawing.PointF]::new($x, $y)
  }

  $pen = New-Object System.Drawing.Pen($white, (0.055 * $s * $scale))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen = New-Object System.Drawing.Pen($white, (0.065 * $s * $scale))
  $checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  # Calendar body (rounded rect outline).
  $body = & $map 0.22 0.30
  $bodySize = 0.56 * $s * $scale
  $bodyPath = New-RoundedRectPath $body.X $body.Y $bodySize (0.48 * $s * $scale) (0.09 * $s * $scale)
  $g.DrawPath($pen, $bodyPath)

  # Header separator.
  $h1 = & $map 0.22 0.435
  $h2 = & $map 0.78 0.435
  $g.DrawLine($pen, $h1, $h2)

  # Binding pins.
  foreach ($fx in 0.36, 0.64) {
    $p1 = & $map $fx 0.215
    $p2 = & $map $fx 0.38
    $g.DrawLine($pen, $p1, $p2)
  }

  # Check mark.
  $pts = @(
    (& $map 0.345 0.565),
    (& $map 0.455 0.67),
    (& $map 0.66 0.49)
  )
  $g.DrawLines($checkPen, $pts)

  $pen.Dispose(); $checkPen.Dispose(); $bodyPath.Dispose()
}

function New-Icon([int]$size, [string]$fileName, [string]$style) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  if ($style -eq 'rounded') {
    $path = New-RoundedRectPath 0 0 $size $size ($size * 0.22)
    $brush = New-Object System.Drawing.SolidBrush($teal)
    $g.FillPath($brush, $path)
    $brush.Dispose(); $path.Dispose()
  } else {
    $g.Clear($teal)
  }

  $glyphScale = if ($style -eq 'maskable') { 0.62 } else { 1.0 }
  Draw-Glyph $g $size $glyphScale

  $outPath = Join-Path $outDir $fileName
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "wrote $outPath"
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Icon 192 'icon-192.png' 'rounded'
New-Icon 512 'icon-512.png' 'rounded'
New-Icon 512 'maskable-512.png' 'maskable'
New-Icon 180 'apple-touch-icon.png' 'square'
Write-Host 'done'
