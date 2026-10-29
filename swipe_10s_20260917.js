// ============================================================
// 自动上滑（极简版）· 每 10 秒向上滑动一次
// 生成时间：2026-09-17
//
// 职责：只做一件事 —— 每隔 10 秒向上滑动一次屏幕
//      不拉起任何 App、不点任何东西、运行中不弹任何提示
//
// 停止：音量减键
// 适配：手势 swipe() (安卓7.0+) → 无障碍 scrollForward() (安卓4.1+)
// ============================================================

// ==================== 配置 ====================
var INTERVAL = 10000; // 滑动间隔 (ms)，10 秒

// ==================== 滑动实现 ====================
var MODE = (device.sdkInt >= 24) ? "gesture" : "scroll";

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 手势滑动（安卓 7.0+）
function gestureSwipe() {
    var w = device.width, h = device.height;
    var x1 = rand(Math.floor(w * 0.18), Math.floor(w * 0.82));
    var x2 = rand(Math.floor(w * 0.18), Math.floor(w * 0.82));
    swipe(x1, Math.floor(h * 0.78), x2, Math.floor(h * 0.22), rand(300, 800));
}

// 无障碍滚动（安卓 4.1+）：遍历当前界面的可滚动节点，命中哪个能翻就用哪个
function scrollSwipe() {
    var nodes = scrollable(true).find();
    if (!nodes || !nodes.size) return false;
    for (var i = 0; i < nodes.size; i++) {
        try {
            if (nodes.get(i).scrollForward()) return true;
        } catch (e) {}
    }
    return false;
}

function swipeUp() {
    if (MODE === "gesture") {
        try {
            gestureSwipe();
            return true;
        } catch (e) {
            MODE = "scroll"; // 手势不可用，永久降级
        }
    }
    try {
        if (scrollSwipe()) return true;
    } catch (e) {}
    try {
        gestureSwipe();
        return true;
    } catch (e) {}
    return false;
}

// ==================== 停止控制（音量减键） ====================
events.observeKey();
events.onKeyDown("volume_down", function (event) {
    toast("已停止");
    engines.stopAll();
    event.consumed = true;
});

// ==================== 启动 ====================
toast("已启动 | 每 " + (INTERVAL / 1000) + " 秒上滑一次 | 音量减键停止");

// ==================== 主循环 ====================
var count = 0;
while (true) {
    // 保持屏幕唤醒，否则息屏后会滑不动
    try {
        device.wakeUpIfNeeded();
        device.keepScreenOn(3600 * 1000);
    } catch (e) {}

    count++;
    var ok = swipeUp();
    // 只写日志，不弹提示
    console.log("[" + count + "] " + (ok ? "上滑成功" : "上滑失败(当前画面无可滚动列表)"));

    sleep(INTERVAL);
}