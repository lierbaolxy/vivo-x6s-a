home();
sleep(500);

// ==================== 配置 ====================
var WATCH_TIME = 3000;   // 亮屏看视频时间 (ms)
var REST_TIME = 10000;   // 暗屏休息时间 (ms)
var PREVIEW_TIME = 2000; // 滑前亮屏预览时间 (ms)
var DIM_BRIGHTNESS = 5;   // 休息时亮度 (不能为0，vivo会锁屏)
var BRIGHT_BRIGHTNESS = 40; // 亮屏时亮度 (40=较暗，255=最亮)

// 滑动参数 (适配 vivo 1080x2408)
var screenW = 1080, screenH = 2408;
var minX = 200, maxX = 880;
var minDur = 300, maxDur = 800;
// 从下往上滑：起点 Y 在屏幕下方 75%，终点 Y 在屏幕上方 20%
var swipeFromY = Math.floor(screenH * 0.78);
var swipeToY = Math.floor(screenH * 0.22);

// ==================== 停止控制 ====================
events.observeKey();
events.onKeyDown("volume_down", function(event) {
    try {
        device.setBrightnessMode(1);  // 恢复自动亮度
        device.setBrightness(BRIGHT_BRIGHTNESS);
    } catch (e) {}
    toast("滑动已停止");
    engines.stopAll();
    event.consumed = true;
});

// ==================== 初始化 ====================
try {
    device.setBrightnessMode(0);  // 关自动亮度
    device.setBrightness(BRIGHT_BRIGHTNESS);
} catch (e) {
    toast("请手动关闭自动亮度，否则降亮度无效");
}
toast("省电滑动已启动 | 音量-停止");

// ==================== 工具函数 ====================
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dimScreen() {
    try { device.setBrightness(DIM_BRIGHTNESS); } catch (e) {}
}

function restoreScreen() {
    try {
        device.wakeUpIfNeeded();
        device.keepScreenOn(3600 * 1000); // 保持1小时不锁屏
        device.setBrightness(BRIGHT_BRIGHTNESS);
    } catch (e) {}
}

// ==================== 主循环 ====================
while (true) {
    restoreScreen();
    sleep(PREVIEW_TIME); // 亮2秒预览

    // 滑动
    var x1 = rand(minX, maxX);
    var x2 = rand(minX, maxX);
    var dur = rand(minDur, maxDur);
    swipe(x1, swipeFromY, x2, swipeToY, dur);

    sleep(WATCH_TIME);   // 亮3秒观看
    dimScreen();         // 降到最低亮度
    sleep(REST_TIME);    // 暗10秒休息
}