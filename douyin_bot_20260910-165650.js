// Auto.js 抖音省电滑动 bot — 优化版 (1080x1920)
// 生成时间: 2026-09-10 16:56:50
// 适用: Auto.js 4.1.1 (Android 5.1)，屏幕 1080x1920 竖屏

// ==================== 无障碍检查（4.1.1 必须主动开启）====================
function ensureAccessibility() {
    if (!auto.service) {
        toast("正在开启无障碍服务...");
        try { auto(); } catch (e) {}
        sleep(2000);
        if (!auto.service) {
            toast("请手动到 设置-无障碍 开启 Auto.js");
            return false;
        }
        toast("无障碍已开启");
    }
    return true;
}

// 滑动（带无障碍检测与异常恢复）
function doSwipe() {
    if (!ensureAccessibility()) return false;
    try {
        var x1 = rand(minX, maxX);
        var x2 = rand(minX, maxX);
        var dur = rand(minDur, maxDur);
        swipe(x1, swipeFromY, x2, swipeToY, dur);
        return true;
    } catch (e) { toast("滑动异常:" + e); return false; }
}

// ==================== 配置 ====================
var WATCH_TIME = 3000;   // 亮屏看视频时间 (ms)
var REST_TIME = 10000;   // 暗屏休息时间 (ms)
var PREVIEW_TIME = 2000; // 滑前亮屏预览时间 (ms)
var DIM_BRIGHTNESS = 5;   // 休息时亮度 (5=暗但不锁屏，0会锁屏)
var BRIGHT_BRIGHTNESS = 40; // 亮屏时亮度 (40=较暗，255=最亮)

// 滑动参数 (适配 1080x1920 竖屏)
var screenW = 1080, screenH = 1920;
var minX = Math.floor(screenW * 0.19), maxX = Math.floor(screenW * 0.81);
var minDur = 300, maxDur = 800;
var swipeFromY = Math.floor(screenH * 0.78); // 起点 Y 在屏高78%
var swipeToY = Math.floor(screenH * 0.22);   // 终点 Y 在屏高22%

// ==================== 停止控制 ====================
events.observeKey();
events.onKeyDown("volume_down", function(event) {
    try {
        device.setBrightnessMode(1);  // 恢复自动亮度
    } catch (e) {}
    toast("滑动已停止");
    engines.stopAll();
    event.consumed = true;
});

// ==================== 初始化 ====================
if (!ensureAccessibility()) { exit(); }
home();
sleep(500);
try {
    device.setBrightnessMode(0);  // 关自动亮度
    device.setBrightness(BRIGHT_BRIGHTNESS);
} catch (e) {
    toast("请手动关闭自动亮度，否则降亮度无效");
}

// ==================== 工具函数 ====================
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function dimScreen() {
    try { device.setBrightness(DIM_BRIGHTNESS); } catch (e) {}
}
function restoreScreen() {
    try { device.setBrightness(BRIGHT_BRIGHTNESS); } catch (e) {}
}

toast("省电滑动已启动 | 音量-停止");

// ==================== 主循环 ====================
while (true) {
    restoreScreen();
    sleep(PREVIEW_TIME);  // 亮屏预览

    doSwipe();            // 滑动切视频（带无障碍检测）

    sleep(WATCH_TIME);    // 亮屏观看
    dimScreen();          // 降暗
    sleep(REST_TIME);     // 暗屏休息
}