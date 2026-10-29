// ============================================================
// 抖音自动上滑（纯滑动版 · 兼容安卓 7.0 以下）
// 生成时间：2026-09-17
//
// 职责：只负责向上滑动屏幕，不管当前是什么画面、什么 App
//      不拉起任何 App、不切桌面、不做任何点击
//
// 滑动实现自动降级：
//   1) 手势 swipe()            —— 安卓 7.0+ (SDK>=24)
//   2) 无障碍 scrollForward()  —— 安卓 4.1+ (任何版本)
//
// 停止：音量减键
// 省电：亮 WATCH_TIME 观看 → 暗 REST_TIME 休息（不需要可把两值设为 0）
// ============================================================

// ==================== 配置 ====================
var WATCH_TIME = 3000;      // 亮屏观看时间 (ms)，设 0 = 不调亮度
var REST_TIME = 10000;      // 暗屏休息时间 (ms)，设 0 = 不调亮度
var PREVIEW_TIME = 2000;    // 每轮开始前的亮屏等待 (ms)
var DIM_BRIGHTNESS = 5;     // 休息亮度（不要设 0，部分机型会锁屏）
var BRIGHT_BRIGHTNESS = 40; // 观看亮度（255 = 最亮）

// 手势滑动的参数（按屏幕尺寸自动换算，仅安卓7.0+使用）
var screenW = device.width;
var screenH = device.height;
var minX = Math.floor(screenW * 0.18);
var maxX = Math.floor(screenW * 0.82);
var swipeFromY = Math.floor(screenH * 0.78);
var swipeToY = Math.floor(screenH * 0.22);
var minDur = 300, maxDur = 800;

// ==================== 滑动实现 ====================
// SDK>=24 优先用手势；否则直接用无障碍滚动
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

// 遍历可滚动节点，找到第一个能翻页的（不限定具体 App，任何界面通用）
function scrollSwipe() {
    var nodes = scrollable(true).find();
    if (!nodes || !nodes.size) return false;
    var total = Math.min(nodes.size, 3);
    for (var i = 0; i < total; i++) {
        try {
            if (nodes.get(i).scrollForward()) return true;
        } catch (e) {}
    }
    return false;
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
    if (REST_TIME <= 0) return;
    try { device.setBrightness(DIM_BRIGHTNESS); } catch (e) {}
}

function restoreScreen() {
    try {
        device.wakeUpIfNeeded();
        device.keepScreenOn(3600 * 1000); // 1 小时不自动锁屏
        if (WATCH_TIME > 0) device.setBrightness(BRIGHT_BRIGHTNESS);
    } catch (e) {}
}

// ==================== 停止控制（音量减键） ====================
events.observeKey();
events.onKeyDown("volume_down", function (event) {
    try {
        device.setBrightnessMode(1); // 恢复自动亮度
        device.setBrightness(BRIGHT_BRIGHTNESS);
    } catch (e) {}
    toast("已停止");
    engines.stopAll();
    event.consumed = true;
});

// ==================== 启动 ====================
if (WATCH_TIME > 0) {
    try {
        device.setBrightnessMode(0); // 关自动亮度
        device.setBrightness(BRIGHT_BRIGHTNESS);
    } catch (e) {
        toast("请手动关闭自动亮度，否则调亮度无效");
    }
}

toast("已启动 | 滑动方式：" + MODE + " | 音量减键停止");

// ==================== 主循环 ====================
var failCount = 0;
while (true) {
    restoreScreen();
    if (PREVIEW_TIME > 0) sleep(PREVIEW_TIME);

    if (swipeUp()) {
        failCount = 0;
    } else {
        failCount++;
        if (failCount === 3) {
            toast("连续3次滑动失败：当前画面没有可滚动的列表，请确认无障碍服务已开启");
        }
    }

    if (WATCH_TIME > 0) sleep(WATCH_TIME); // 亮屏观看
    dimScreen();                           // 降到最低亮度
    if (REST_TIME > 0) sleep(REST_TIME);   // 暗屏休息
}