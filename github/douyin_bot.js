home();
sleep(500);

// ==================== 配置 ====================
var WATCH_TIME = 3000;   // 亮屏看视频时间 (ms)
var REST_TIME = 10000;   // 暗屏休息时间 (ms)
var PREVIEW_TIME = 2000; // 滑前亮屏预览时间 (ms)
var DIM_BRIGHTNESS = 0;   // 休息时亮度 (0=最暗)
var BRIGHT_BRIGHTNESS = 20; // 亮屏时亮度 (20=很暗，255=最亮)

// 滑动参数
var minX = 100, maxX = 900;
var minDur = 300, maxDur = 800;

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
    try { device.setBrightness(BRIGHT_BRIGHTNESS); } catch (e) {}
}

// ==================== 主循环 ====================
while (true) {
    restoreScreen();
    sleep(PREVIEW_TIME); // 亮2秒预览

    // 滑动
    var x1 = rand(minX, maxX);
    var x2 = rand(minX, maxX);
    var dur = rand(minDur, maxDur);
    swipe(x1, 1600, x2, 400, dur);

    sleep(WATCH_TIME);   // 亮3秒观看
    dimScreen();         // 降到最低亮度
    sleep(REST_TIME);    // 暗10秒休息
}