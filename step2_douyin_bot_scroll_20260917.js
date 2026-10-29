// ============================================================
// 第二步：抖音省电自动滑动（兼容安卓 7.0 以下）
// 生成时间：2026-09-17
//
// 滑动实现自动降级：
//   1) 手势 swipe()        —— 安卓 7.0+ (SDK>=24)
//   2) 无障碍 scrollForward() —— 安卓 4.1+ (任何版本)，走 AccessibilityNodeInfo 动作
//   3) 若两者都失败，会提示
//
// 停止：音量减键
// 省电：亮 WATCH_TIME 看视频 → 暗 REST_TIME 休息
// ============================================================

// ==================== 配置 ====================
var TARGET_PKG = "com.ss.android.ugc.aweme.lite"; // 抖音极速版；普通版改为 com.ss.android.ugc.aweme
var WATCH_TIME = 3000;      // 亮屏观看时间 (ms)
var REST_TIME = 10000;      // 暗屏休息时间 (ms)
var PREVIEW_TIME = 2000;    // 滑动前亮屏预览 (ms)
var DIM_BRIGHTNESS = 5;     // 休息亮度（不要设 0，部分机型会锁屏）
var BRIGHT_BRIGHTNESS = 40; // 观看亮度（255 = 最亮）

// 滑动参数：按屏幕尺寸自动换算，适配任意分辨率
var screenW = device.width;
var screenH = device.height;
var minX = Math.floor(screenW * 0.18);
var maxX = Math.floor(screenW * 0.82);
var swipeFromY = Math.floor(screenH * 0.78);
var swipeToY = Math.floor(screenH * 0.22);
var minDur = 300, maxDur = 800;

// ==================== 滑动实现（自动降级） ====================
// SDK>=24 优先用手势（更像真人）；否则直接用无障碍滚动
var MODE = (device.sdkInt >= 24) ? "gesture" : "scroll";

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function gestureSwipe() {
    var x1 = rand(minX, maxX);
    var x2 = rand(minX, maxX);
    var dur = rand(minDur, maxDur);
    swipe(x1, swipeFromY, x2, swipeToY, dur);
}

function scrollSwipe() {
    var node = scrollable(true).findOne(1200);
    if (!node) return false;
    return node.scrollForward();
}

function swipeUp() {
    // 1. 手势
    if (MODE === "gesture") {
        try {
            gestureSwipe();
            return true;
        } catch (e) {
            MODE = "scroll"; // 手势不可用，永久降级
            console.log("手势不可用，降级为无障碍滚动：" + e);
        }
    }
    // 2. 无障碍滚动
    try {
        if (scrollSwipe()) return true;
    } catch (e) {
        console.log("滚动异常：" + e);
    }
    // 3. 兜底再试一次手势
    try {
        gestureSwipe();
        return true;
    } catch (e) {}
    return false;
}

// ==================== 亮度控制 ====================
function dimScreen() {
    try { device.setBrightness(DIM_BRIGHTNESS); } catch (e) {}
}

function restoreScreen() {
    try {
        device.wakeUpIfNeeded();
        device.keepScreenOn(3600 * 1000); // 1 小时不自动锁屏
        device.setBrightness(BRIGHT_BRIGHTNESS);
    } catch (e) {}
}

// ==================== 停止控制（音量减键） ====================
events.observeKey();
events.onKeyDown("volume_down", function (event) {
    try {
        device.setBrightnessMode(1); // 恢复自动亮度
        device.setBrightness(BRIGHT_BRIGHTNESS);
    } catch (e) {}
    toast("滑动已停止");
    engines.stopAll();
    event.consumed = true;
});

// ==================== 启动 ====================
try {
    device.setBrightnessMode(0); // 关自动亮度
    device.setBrightness(BRIGHT_BRIGHTNESS);
} catch (e) {
    toast("请手动关闭自动亮度，否则调亮度无效");
}

// 确保目标 App 在前台
try {
    var cur = currentPackage();
    if (cur !== TARGET_PKG) {
        app.launchPackage(TARGET_PKG);
        sleep(3000);
    }
} catch (e) {
    console.log("启动目标App失败，请手动打开抖音：" + e);
}

toast("已启动 | 滑动方式：" + MODE + " | 音量减键停止");

// ==================== 主循环 ====================
var failCount = 0;
while (true) {
    restoreScreen();
    sleep(PREVIEW_TIME); // 亮屏预览

    if (swipeUp()) {
        failCount = 0;
    } else {
        failCount++;
        if (failCount === 3) {
            toast("连续3次滑动失败，请确认无障碍服务已开启且在抖音视频页");
        }
    }

    sleep(WATCH_TIME); // 亮屏观看
    dimScreen();       // 降到最低亮度
    sleep(REST_TIME);  // 暗屏休息
}