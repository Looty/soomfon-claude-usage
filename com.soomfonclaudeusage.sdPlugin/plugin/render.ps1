param(
  [Parameter(Mandatory=$true)][string]$Label,
  [Parameter(Mandatory=$true)][string]$Value,
  [Parameter(Mandatory=$true)][string]$BasePath,
  [Parameter(Mandatory=$true)][string]$OutPath
)
Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile($BasePath)
$bmp = New-Object System.Drawing.Bitmap $src
$src.Dispose()

$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$labelFont = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$valueFontSize = if ($Value.Length -gt 5) { 22 } elseif ($Value.Length -gt 4) { 28 } else { 36 }
$valueFont = New-Object System.Drawing.Font("Segoe UI", $valueFontSize, [System.Drawing.FontStyle]::Bold)
$labelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 200, 190, 180))
$valueBrush = [System.Drawing.Brushes]::White
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

# Headroom band above the mascot — matches where the reference image left clear space.
$bandH = $bmp.Height * 0.46
$labelBand = New-Object System.Drawing.RectangleF 0, ($bandH * 0.06), $bmp.Width, ($bandH * 0.34)
$valueBand = New-Object System.Drawing.RectangleF 0, ($bandH * 0.36), $bmp.Width, ($bandH * 0.64)

$g.DrawString($Label, $labelFont, $labelBrush, $labelBand, $fmt)
$g.DrawString($Value, $valueFont, $valueBrush, $valueBand, $fmt)

$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $labelFont.Dispose(); $valueFont.Dispose(); $labelBrush.Dispose()
