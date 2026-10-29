// Auto.js 抖音/快手 省电滑动 bot — 自适应分辨率版
// 适用: Auto.js 4.1.1 + Android 7.0 及以上（滑动依赖 dispatchGesture）
// 特点: 坐标全部按屏幕宽高百分比计算，换任何分辨率的手机都不用改代码
// 停止: 按音量减

// ==================== 目标 App（按顺序找已安装的）====================
var TARGET_APPS = [
    { pkg: "com.ss.android.ugc.aweme",      name: "抖音" },
    { pkg: "com.ss.android.ugc.aweme.lite", name: "抖音极速版" },
    { pkg: "com.smile.gifmaker",            name: "快手" },
    { pkg: "com.kuaishou.nebula",           name: "快手极速版" }
];

// ==================== 配置 ====================
var WATCH_TIME = 3000;      // 亮屏看视频时间 (ms)
var REST_TIME = 10000;      // 暗屏休息时间 (ms)
var PREVIEW_TIME = 2000;    // 滑前亮屏预览时间 (ms)
var DIM_BRIGHTNESS = 5;     // 休息时亮度 (5=暗但不锁屏，0 会锁屏)
var BRIGHT_BRIGHTNESS = 40; // 观看时亮度 (40=较暗，255=最亮)

// ==================== 分辨率自适应 ====================
var screenW = device.width;
var screenH = device.height;
// 兜底：系统上报异常时用常见值，避免算出非法坐标
if (!screenW || screenW < 320) screenW = 1080;
if (!screenH || screenH < 480) screenH = 1920;

// 横向取屏幕中间 19%~81%，避开左右边缘的手势区
var minX = Math.floor(screenW * 0.19);
var maxX = Math.floor(screenW * 0.81);
var minDur = 300, maxDur = 800;
// 从下往上滑：起点在屏高 78%，终点在屏高 22%
var swipeFromY = Math.floor(screenH * 0.78);
var swipeToY = Math.floor(screenH * 0.22);

// ==================== 工具函数 ====================
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 判断包名是否已安装
function isInstalled(pkg) {
    try {
        context.getPackageManager().getPackageInfo(pkg, 0);
        return true;
    } catch (e) {
        return false;
    }
}

// 无障碍检查（Auto.js 4.1.1 必须主动开启，否则 swipe 无效）
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

// 拉起目标 App；找不到就提示手动打开，脚本继续跑
function launchTarget() {
    for (var i = 0; i < TARGET_APPS.length; i++) {
        var t = TARGET_APPS[i];
        if (isInstalled(t.pkg)) {
            try {
                app.launchPackage(t.pkg);
                sleep(3000);
                toast("已启动: " + t.name);
                return true;
            } catch (e) {}
        }
    }
    toast("未检测到抖音/快手，请手动打开后再运行");
    return false;
}

function dimScreen() {
    try { device.setBrightness(DIM_BRIGHTNESS); } catch (e) {}
}

function restoreScreen() {
    try {
        device.wakeUpIfNeeded();
        device.setBrightness(BRIGHT_BRIGHTNESS);
    } catch (e) {}
}

// 带异常恢复的滑动
function doSwipe() {
    if (!ensureAccessibility()) return false;
    try {
        var x1 = rand(minX, maxX);
        var x2 = rand(minX, maxX);
        var dur = rand(minDur, maxDur);
        swipe(x1, swipeFromY, x2, swipeToY, dur);
        return true;
    } catch (e) {
        toast("滑动异常: " + e);
        return false;
    }
}

// ==================== 停止控制 ====================
events.observeKey();
events.onKeyDown("volume_down", function (event) {
    try {
        device.setBrightnessMode(1);
        device.setBrightness(BRIGHT_BRIGHTNESS);
    } catch (e) {}
    toast("滑动已停止");
    engines.stopAll();
    event.consumed = true;
});

// ==================== 初始化 ====================
if (!ensureAccessibility()) { exit(); }

home();
sleep(500);
launchTarget();

try {
    device.setBrightnessMode(0);            // 关自动亮度
    device.setBrightness(BRIGHT_BRIGHTNESS);
    device.keepScreenOn(3600 * 1000);       // 1 小时不自动锁屏
} catch (e) {
    toast("请到 设置-应用-Auto.js 里允许「修改系统设置」");
}

toast("省电滑动已启动 | 分辨率 " + screenW + "x" + screenH + " | 音量-停止");

// ==================== 主循环 ====================
while (true) {
    restoreScreen();
    sleep(PREVIEW_TIME);   // 亮屏预览

    doSwipe();             // 上滑切视频

    sleep(WATCH_TIME);     // 亮屏观看
    dimScreen();           // 降暗
    sleep(REST_TIME);      // 暗屏休息
}