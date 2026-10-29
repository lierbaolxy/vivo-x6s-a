// ============================================================
// 自动上滑（极简版）· 每 10 秒向上滑动一次
// 生成时间：2026-09-17
//
// 目标机型实测数据（来自 step1 诊断）：
//   SDK_INT = 23  (真实 Android 6.0，设置界面显示的 8.3 是伪造的)
//   brand/model = 5G
//   屏幕 = 480 x 1014
//
// 该机型 SDK < 24，不支持手势 swipe()，所以本脚本使用无障碍滚动：
//   scrollable(true).find() + node.scrollForward()
//   走 AccessibilityNodeInfo 动作，不需要坐标，与分辨率无关
//
// 职责：只做向上滑动，每 10 秒一次
//      不拉起 App、不点击、不调亮度、运行中不弹提示
// 停止：音量减键
// ============================================================

// ==================== 配置 ====================
var INTERVAL = 10000; // 滑动间隔 (ms)，10 秒

// ==================== 向上滑动一次 ====================
// 遍历当前界面的可滚动列表，命中哪个能翻页就用哪个
function swipeUp() {
    var nodes = scrollable(true).find();
    if (!nodes || !nodes.size) return false;
    for (var i = 0; i < nodes.size; i++) {
        try {
            if (nodes.get(i).scrollForward()) return true;
        } catch (e) {}
    }
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
    // 屏幕唤醒保护：避免息屏后滑不动（不需要可删掉这两行）
    try {
        device.wakeUpIfNeeded();
        device.keepScreenOn(3600 * 1000);
    } catch (e) {}

    count++;
    var ok = swipeUp();
    // 只写日志，不弹提示
    console.log("[" + count + "] " + (ok ? "上滑成功" : "上滑失败(当前界面无可滚动列表)"));

    sleep(INTERVAL);
}