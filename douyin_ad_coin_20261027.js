// ============================================================
// 抖音极速版 · 「看广告赚金币」极简版脚本
// 分工：用户手动进入「赚钱任务」页并让「去观看」按钮出现在屏幕内，
//       脚本负责点击按钮 + 观看广告 + 连看 + 收金币 + 冷却重试。
//
// 运行环境：AutoJs6（org.autojs.autojs6），需开启无障碍 + 截图权限
// 停止方式：音量减键
//
// 设计原则（吸取前面的教训）：
//   1) 不用 currentActivity() 判断“是否在主页面”——该值会返回 View 类名，
//      之前据此连按返回把抖音按到闪屏重启
//   2) 不做自动导航、不滑动探路，只在明确跳出抖音时处理包名
//   3) 按钮定位：单帧截图 + 文字模板匹配；截不到图时退回固定坐标
//   4) 跳进其他活动页（bullet WebView）时只按一次返回，不连环按
// ============================================================

// ==================== 配置 ====================
var CFG = {
    pkg: "com.ss.android.ugc.aweme.lite",
    tplPath: "/sdcard/脚本/tpl_watch_text.png",   // 「去观看」文字模板（165x70）
    matchThreshold: 0.90,
    fallbackTap: [0.859, 0.705],   // 截图不可用时的兜底坐标（任务页顶部布局）
    retryGapMs: 10 * 1000,         // 未进入广告/本轮完成后的重试间隔
    adStartSec: 35,                // 点击后最长等 35 秒（实测广告加载约 30 秒）
    liveAdSec: 40,                 // 直播广告停 40 秒后返回进入视频广告
    videoAdSec: 25,                // 每段视频广告停 25 秒（任务要求 20 秒）
    adTotalSec: 150,               // 单段广告总时长上限
    continueMax: 5,                // 连看上限（不含首段）
    deleteAllApk: false,           // true=删所有 apk；false=只删运行期间新增
    logPath: "/sdcard/douyin_ad_coin.log"
};

// 弹窗兜底坐标（仅在确认弹窗文字存在时使用）
var P = {
    takeReward: [0.500, 0.559],
    quitAd: [0.500, 0.635],
    closeReward: [0.774, 0.328]
};

var W = 1080, H = 1920;   // 模板基准分辨率，固定值（不读 device.width，AutoJs6 启动瞬间可能横屏）
function px(r) { return Math.round(W * r); }
function py(r) { return Math.round(H * r); }

var stopped = false;
var captureOk = false;

// ==================== 日志 ====================
function log(msg) {
    var line = "[" + new Date().toLocaleString() + "] " + msg;
    console.log(line);
    try { files.append(CFG.logPath, line + "\n"); } catch (e) {}
}

// ==================== 安装包清理 ====================
var APK_DIRS = [
    "/sdcard/Download",
    "/sdcard/documents",
    "/sdcard/tencent/QQfile_recv",
    "/sdcard/Android/data/com.android.browser/files/Download",
    "/sdcard/Android/data/com.android.chrome/files/Download",
    "/sdcard/Android/data/com.tencent.mtt/files/Download"
];
var apkBaseline = {};

function listApks() {
    var out = [];
    for (var i = 0; i < APK_DIRS.length; i++) {
        var d = APK_DIRS[i];
        var names = [];
        try {
            if (!files.exists(d)) continue;
            names = files.listDir(d);
        } catch (e) { continue; }
        for (var j = 0; j < names.length; j++) {
            var n = names[j];
            if (!/\.apk$/i.test(n)) continue;
            var full = d + "/" + n;
            try { if (!files.isFile(full)) continue; } catch (e2) { continue; }
            out.push(full);
        }
    }
    return out;
}

function initBaseline() {
    var arr = listApks();
    for (var i = 0; i < arr.length; i++) apkBaseline[arr[i]] = 1;
    log("安装包基线=" + arr.length + " 个");
}

function cleanApkOnce() {
    var arr = listApks();
    for (var i = 0; i < arr.length; i++) {
        var p = arr[i];
        if (!CFG.deleteAllApk && apkBaseline[p]) continue;
        try {
            if (files.remove(p)) log("已删除安装包: " + p);
            else log("删除失败(权限): " + p);
        } catch (e) {}
    }
}

initBaseline();
var cleanThread = threads.start(function () {
    while (!stopped) {
        try { cleanApkOnce(); } catch (e) {}
        sleep(3000);
    }
});

// ==================== 状态 ====================
function inDouyin() {
    var p = "";
    try { p = String(currentPackage() || ""); } catch (e) {}
    return p === CFG.pkg;
}

function curAct() {
    var a = "";
    try { a = String(currentActivity() || ""); } catch (e) {}
    return a;
}

function isAdUi() {
    var a = curAct();
    return a.indexOf("LivePlayActivity") >= 0 || a.indexOf("ExcitingVideoActivity") >= 0;
}

function isBulletPage() {
    return curAct().indexOf("bullet") >= 0;
}

// 只处理“跳出抖音”，不按返回探路
function guardPackage() {
    var p = "";
    try { p = String(currentPackage() || ""); } catch (e) {}
    if (!p) return;
    if (p === CFG.pkg) return;
    if (p === "com.android.systemui") return;
    if (p.indexOf("autojs") >= 0) return;

    if (p.indexOf("launcher") >= 0 || p.indexOf("home") >= 0) {
        log("前台是桌面，拉起抖音");
        try { launch(CFG.pkg); } catch (e) {}
        sleep(2500);
        return;
    }

    // 浏览器 / 应用商店 / 安装器：只按一次返回，不安装不下载
    log("跳出抖音到 " + p + "，按一次返回");
    try { back(); } catch (e2) {}
    sleep(1200);
}

// ==================== 截图能力 ====================
function checkCapture() {
    try {
        var img = captureScreen();
        if (img) {
            try { img.recycle(); } catch (e) {}
            log("截图权限可用");
            return true;
        }
    } catch (e2) {
        log("截图不可用: " + e2);
    }
    return false;
}

// 单帧匹配「去观看」，返回中心坐标或 null
function findWatchOnce() {
    if (!captureOk) return null;
    var tpl = null;
    try { tpl = images.read(CFG.tplPath); } catch (e) { return null; }
    if (!tpl) return null;
    var img = null, found = null;
    try {
        img = captureScreen();
        if (img) found = images.findImage(img, tpl, { threshold: CFG.matchThreshold });
    } catch (e2) { log("截图/匹配异常: " + e2); }
    if (img) try { img.recycle(); } catch (e3) {}
    if (!found) { try { tpl.recycle(); } catch (e4) {} return null; }
    var c = [Math.round(found.x + tpl.getWidth() / 2),
             Math.round(found.y + tpl.getHeight() / 2)];
    try { tpl.recycle(); } catch (e5) {}
    return c;
}

// ==================== 交互 ====================
function tapXY(xy) {
    try { click(px(xy[0]), py(xy[1])); } catch (e) {}
}

function tapText(kw, timeout) {
    var nd = null;
    try { nd = textContains(kw).findOne(timeout || 1200); } catch (e) {}
    if (nd) {
        try { if (nd.click()) return true; } catch (e2) {}
    }
    return false;
}

function hasText(kw, timeout) {
    var nd = null;
    try { nd = textContains(kw).findOne(timeout || 800); } catch (e) {}
    return !!nd;
}

// ==================== 广告流程 ====================
function watchAdFlow() {
    var t0 = Date.now();
    var liveSec = 0, videoSec = 0, advanced = false;

    while (Date.now() - t0 < CFG.adTotalSec * 1000 && !stopped) {
        guardPackage();

        // 判断广告是否结束：只看包名 + 广告页特征，不使用 currentActivity 的完整类名
        // （该值可能返回 android.widget.FrameLayout 之类，不能用来判断"回到任务页"）
        if (inDouyin() && !isAdUi()) {
            sleep(1500);
            if (inDouyin() && !isAdUi()) {
                log("广告结束（前台=抖音且非广告页）");
                return true;
            }
        }

        if (curAct().indexOf("LivePlayActivity") >= 0) {
            liveSec++;
            if (liveSec >= CFG.liveAdSec && !advanced) {
                advanced = true;
                log("直播广告停 " + CFG.liveAdSec + "s，返回切视频广告");
                try { back(); } catch (e) {}
                sleep(3000);
                continue;
            }
        } else {
            videoSec++;
            if (videoSec >= CFG.videoAdSec) break;
        }
        sleep(1000);
    }

    try { back(); } catch (e2) {}
    sleep(1800);
    return true;
}

function continueWatching() {
    var extra = 0;
    while (!stopped && extra < CFG.continueMax) {
        if (!(hasText("再看一个视频", 1500) || hasText("领取奖励", 1200))) {
            log("未再出现连看弹窗，连看结束（已连看 " + extra + " 段）");
            return extra;
        }
        if (!tapText("领取奖励", 1500)) {
            tapXY(P.takeReward);
            sleep(1300);
        }
        log("进入连看第 " + (extra + 2) + " 段");
        if (!waitAdStart(20)) {
            log("连看段未加载，结束连看");
            return extra;
        }
        watchAdFlow();
        extra++;
        log("连看第 " + extra + " 段完成");
    }

    if (hasText("再看一个视频", 1000)) {
        if (!tapText("坚持退出", 1200)) tapXY(P.quitAd);
        sleep(1200);
        log("达到连看上限 " + CFG.continueMax + "，已退出");
    }
    return extra;
}

function closeRewardDialog() {
    if (hasText("恭喜累计获得奖励", 1500) || hasText("收下金币", 1000)) {
        tapXY(P.closeReward);
        sleep(1000);
        log("已关闭奖励弹窗");
    }
}

function waitAdStart(maxSec) {
    var end = Date.now() + maxSec * 1000;
    while (Date.now() < end && !stopped) {
        guardPackage();
        if (isAdUi()) return true;
        sleep(1500);
    }
    return false;
}

// ==================== 单轮 ====================
function adRound() {
    log("---- 新一轮 ----");

    if (!inDouyin()) {
        try { launch(CFG.pkg); } catch (e) {}
        sleep(3000);
    }

    var pt = findWatchOnce();
    if (pt) {
        log("模板定位「去观看」 " + pt[0] + "," + pt[1]);
        try { click(pt[0], pt[1]); } catch (e2) {}
    } else {
        log("未匹配到按钮，用兜底坐标 " + px(CFG.fallbackTap[0]) + "," + py(CFG.fallbackTap[1]));
        tapXY(CFG.fallbackTap);
    }

    sleep(3000);
    guardPackage();

    if (!isAdUi()) {
        log("未进入广告 活动=" + curAct());
        if (isBulletPage()) {          // 点进了活动页，只返回一次
            try { back(); } catch (e3) {}
            sleep(1500);
            log("已从活动页返回");
        }
        return false;
    }

    log("广告已进入: " + curAct());
    watchAdFlow();
    continueWatching();
    closeRewardDialog();

    log("本轮结束 前台=" + currentPackage() + " 活动=" + curAct());
    return true;
}

// ==================== 停止键 ====================
try {
    events.observeKey();
    events.onKeyDown("volume_down", function (event) {
        stopped = true;
        toast("脚本已停止");
        log("音量减键停止");
        try { engines.stopAll(); } catch (e) {}
        event.consumed = true;
    });
} catch (e) {}

// ==================== 启动 ====================
if (!auto.service) {
    toast("无障碍服务未开启！设置→辅助功能→AutoJs6");
    exit();
}
try {
    device.wakeUpIfNeeded();
    device.keepScreenOn(6 * 60 * 60 * 1000);
} catch (e) {}

log("脚本启动 分辨率=" + W + "x" + H + " 连看上限=" + CFG.continueMax);
toast("脚本启动 | 请停在赚钱任务页并让「去观看」可见 | 音量-停止");

captureOk = checkCapture();   // 首次会弹录屏授权，已勾选「不再显示」
if (!captureOk) log("截图不可用，将用兜底坐标点击");

sleep(2500);

// ==================== 主循环 ====================
while (!stopped) {
    var ok = false;
    try { ok = adRound(); } catch (e) { log("本轮异常: " + e); }
    log((ok === true ? "本轮完成，下一轮" : "未进入广告，重试") + "间隔 " + (CFG.retryGapMs / 1000) + "s");
    var end = Date.now() + CFG.retryGapMs;
    while (Date.now() < end && !stopped) {
        sleep(2000);
    }
}

try { cleanThread.interrupt(); } catch (e) {}
log("脚本已退出");
