# Simple: copy APK + JS into the phone storage window (ASCII only)
$shell = New-Object -ComObject Shell.Application
$target = $null
foreach ($w in @($shell.Windows())) {
    try { if ($w.HWND -eq 1574118) { $target = $w.Document.Folder; break } } catch {}
}
if (-not $target) { Write-Output 'NO_WINDOW'; exit 1 }

$tmp = Join-Path $env:TEMP 'push2phone'
New-Item -ItemType Directory -Force $tmp | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'apk\AutoJs-4.1.1-armeabi-v7a-release.apk') -Destination (Join-Path $tmp 'autojs411.apk') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'douyin_bot.js') -Destination (Join-Path $tmp 'douyin_bot.js') -Force

$src = $shell.Namespace($tmp)
$target.CopyHere($src.ParseName('autojs411.apk'), 16)
$target.CopyHere($src.ParseName('douyin_bot.js'), 16)

Start-Sleep -Seconds 45
foreach ($n in @('autojs411.apk','douyin_bot.js')) {
    $f = $target.Items() | Where-Object { $_.Name -eq $n }
    if ($f) { Write-Output ($n + ' => ' + $f.Size + ' bytes') } else { Write-Output ($n + ' => MISSING') }
}