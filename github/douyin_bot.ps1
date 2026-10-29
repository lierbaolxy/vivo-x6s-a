# 抖音自动刷视频，数字参数控制互动类型，按 Ctrl+C 停止
# 用法:
#   0=只滑动  1=点赞  2=收藏  3=评论  自由组合  s=不滑动
#   .\douyin_bot.ps1 0       只滑动，不互动
#   .\douyin_bot.ps1 1       只点赞
#   .\douyin_bot.ps1 2       只收藏
#   .\douyin_bot.ps1 3       只评论
#   .\douyin_bot.ps1 12      点赞+收藏
#   .\douyin_bot.ps1 13      点赞+评论
#   .\douyin_bot.ps1 23      收藏+评论
#   .\douyin_bot.ps1 123     点赞+收藏+评论 (默认)
#   .\douyin_bot.ps1 123s    同上，不自动滑动
#   .\douyin_bot.ps1 1s      只点赞，不滑动

param(
    [string]$Mode = "123",
    [switch]$NoSwipe
)

# 末尾带 s 表示不滑动
if ($Mode -match 's$') {
    $Mode = $Mode -replace 's$', ''
    $NoSwipe = $true
}

$doLike = $Mode.Contains("1")
$doCollect = $Mode.Contains("2")
$doComment = $Mode.Contains("3")

# 右侧按钮坐标（通过uiautomator dump获取的实际坐标）
$LIKE_X = 998; $LIKE_Y = 1523        # 点赞按钮中心
$COMMENT_X = 998; $COMMENT_Y = 1694  # 评论按钮中心
$BOOKMARK_X = 997; $BOOKMARK_Y = 1863 # 收藏按钮中心
$CENTER_X = 540; $CENTER_Y = 1200    # 屏幕中央(双击点赞用)
$COMMENT_INPUT_X = 387; $COMMENT_INPUT_Y = 2317  # 评论输入框中心
$SEND_X = 982; $SEND_Y = 2206        # 发送按钮

# 评论候选语料
$comments = @(
    "不错",
    "666",
    "太棒了",
    "怎么做到的",
    "可以互相关注吗？"
)

# 构建流程描述
$flowDesc = @()
if ($doLike) { $flowDesc += "点赞" }
if ($doCollect) { $flowDesc += "收藏" }
if ($doComment) { $flowDesc += "评论" }
if ($flowDesc.Count -eq 0) { $flowDesc += "只滑动" }
$flowStr = $flowDesc -join " -> "

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  抖音自动刷视频 Bot 启动" -ForegroundColor Cyan
Write-Host "  模式: $Mode ($flowStr)" -ForegroundColor Cyan
Write-Host "  自动滑动: $(if ($NoSwipe) {'关'} else {'开'})" -ForegroundColor Cyan
Write-Host "  直播自动检测并跳过" -ForegroundColor Cyan
Write-Host "  按 Ctrl+C 停止" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

function RandomOffset($base, $range) {
    return Get-Random -Minimum ($base - $range) -Maximum ($base + $range + 1)
}

function Swipe-Up {
    $x1 = Get-Random -Minimum 480 -Maximum 600
    $y1 = Get-Random -Minimum 1900 -Maximum 2300
    $x2 = Get-Random -Minimum 480 -Maximum 600
    $y2 = Get-Random -Minimum 100 -Maximum 500
    $dur = Get-Random -Minimum 300 -Maximum 800
    Write-Host "  >> 滑动 ($x1,$y1)->($x2,$y2) ${dur}ms"
    adb shell input swipe $x1 $y1 $x2 $y2 $dur
}

function Is-LiveStream {
    # 方法1: dumpsys activity 检测 LivePlayActivity
    try {
        $act = adb shell "dumpsys activity activities 2>/dev/null" 2>$null | Out-String
        if ($act -match 'LivePlayActivity' -or $act -match '\.live\.') {
            return $true
        }
    } catch {}
    # 方法2: uiautomator dump 检测"直播"文字
    try {
        $null = adb shell uiautomator dump /sdcard/live_check.xml 2>$null
        $xml = adb shell cat /sdcard/live_check.xml 2>$null | Out-String
        if ($xml -match '"直播"') { return $true }
    } catch {}
    return $false
}

function Do-Like {
    $x = RandomOffset $CENTER_X 100
    $y = RandomOffset $CENTER_Y 150
    Write-Host "  >> 点赞 (双击 $x,$y)"
    adb shell input tap $x $y
    Start-Sleep -Milliseconds (Get-Random -Minimum 100 -Maximum 200)
    adb shell input tap $x $y
}

function Do-Collect {
    $x = RandomOffset $BOOKMARK_X 30
    $y = RandomOffset $BOOKMARK_Y 30
    Write-Host "  >> 收藏 ($x,$y)"
    adb shell input tap $x $y
}

function Do-Comment {
    $cx = RandomOffset $COMMENT_X 30
    $cy = RandomOffset $COMMENT_Y 30
    Write-Host "  >> 评论 - 点击评论图标 ($cx,$cy)"
    adb shell input tap $cx $cy
    $d1 = Get-Random -Minimum 1500 -Maximum 2500
    Write-Host "  >> 等待评论区打开 ${d1}ms..."
    Start-Sleep -Milliseconds $d1

    $ix = RandomOffset $COMMENT_INPUT_X 100
    $iy = RandomOffset $COMMENT_INPUT_Y 30
    Write-Host "  >> 评论 - 点击输入框 ($ix,$iy)"
    adb shell input tap $ix $iy
    $d2 = Get-Random -Minimum 800 -Maximum 1500
    Write-Host "  >> 等待键盘弹出 ${d2}ms..."
    Start-Sleep -Milliseconds $d2

    # 切换到ADBKeyboard输入
    Write-Host "  >> 切换输入法到ADBKeyboard..."
    adb shell ime enable com.android.adbkeyboard/.AdbIME
    adb shell ime set com.android.adbkeyboard/.AdbIME
    Start-Sleep -Milliseconds 500

    $text = Get-Random -InputObject $comments
    Write-Host "  >> 评论 - 输入: $text"
    adb shell am broadcast -a ADB_INPUT_TEXT --es msg $text
    $d3 = Get-Random -Minimum 800 -Maximum 1500
    Write-Host "  >> 等待输入完成 ${d3}ms..."
    Start-Sleep -Milliseconds $d3

    # BACK关闭键盘，此时发送按钮出现
    Write-Host "  >> 关闭键盘，露出发送按钮..."
    adb shell input keyevent BACK
    Start-Sleep -Milliseconds 1000

    # 点击发送按钮
    $sx = RandomOffset $SEND_X 30
    $sy = RandomOffset $SEND_Y 30
    Write-Host "  >> 评论 - 发送 ($sx,$sy)"
    adb shell input tap $sx $sy
    $d4 = Get-Random -Minimum 1500 -Maximum 2500
    Write-Host "  >> 等待发送完成 ${d4}ms..."
    Start-Sleep -Milliseconds $d4

    # 切回搜狗（恢复默认输入法）
    Write-Host "  >> 切换输入法回搜狗..."
    adb shell ime enable com.yushixing.accessibility/com.sohu.inputmethod.sogou.TrimeIME
    adb shell ime set com.yushixing.accessibility/com.sohu.inputmethod.sogou.TrimeIME
    Start-Sleep -Milliseconds 300

    adb shell input keyevent BACK
    $d5 = Get-Random -Minimum 800 -Maximum 1500
    Write-Host "  >> 等待返回 ${d5}ms..."
    Start-Sleep -Milliseconds $d5
}

$count = 0
while ($true) {
    $count++
    Write-Host "[$count] $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Yellow

    # 滑动到下一个视频（-NoSwipe 时跳过）
    if (-not $NoSwipe) {
        Swipe-Up
        $loadWait = Get-Random -Minimum 2 -Maximum 5
        Write-Host "  >> 等待视频加载 ${loadWait}s..."
        Start-Sleep -Seconds $loadWait

        # 检测直播
        Write-Host "  >> 检测直播..."
        if (Is-LiveStream) {
            Write-Host "  >> 检测到直播，跳过，立即划走" -ForegroundColor Red
            Swipe-Up
            Start-Sleep -Seconds 2
            continue
        }
        Write-Host "  >> 正常视频" -ForegroundColor Green
    }

    $actions = @()
    if ($doLike) { $actions += "like" }
    if ($doCollect) { $actions += "collect" }
    if ($doComment) { $actions += "comment" }

    for ($i = 0; $i -lt $actions.Count; $i++) {
        switch ($actions[$i]) {
            "like"    { Do-Like }
            "collect" { Do-Collect }
            "comment" { Do-Comment }
        }
        if ($i -lt $actions.Count - 1) {
            $wait = Get-Random -Minimum 2 -Maximum 8
            Write-Host "  >> 等待 ${wait}s 后执行下一个动作..."
            Start-Sleep -Seconds $wait
        }
    }

    # s 模式只执行一次就退出
    if ($NoSwipe) {
        Write-Host "  >> 完成，退出" -ForegroundColor Green
        break
    }
}