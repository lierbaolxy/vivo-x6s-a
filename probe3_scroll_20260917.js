// ============================================================
// 滑动诊断 v3（这次保证测到目标 App）
// 生成时间：2026-09-17
//
// v2 失败原因：前台停在了桌面(launcher)，节点数 0，什么都没测到
// v3 的改进：不检测"你切走了没有"，而是检测"无障碍树里有没有真节点"，
//           只有真的看到有内容的界面（>0 个节点）才开始诊断。
//
// 用法：运行后 打开目标 App（任意 App，比如抖音），停在能滑的界面别动
//      脚本检测到界面后自动开始 → 等"诊断结果已回传电脑 ✓" → 音量减键退出
// ============================================================

var PC_URL = "http://172.20.36.178:8099/upload";
var AUTOJS_PKGS = ["org.autojs.autojs", "org.autojs.autojs6"];

var lines = [];
function log(s) { lines.push("" + s); console.log("" + s); }
function pkgNow() { try { var p = currentPackage(); return p ? p : ""; } catch (e) { return ""; } }
function nodeCount() {
    try { var r = classNameMatches(".*").find(); return r ? r.size : 0; } catch (e) { return -1; }
}
function areaOf(nd) {
    try { var b = nd.bounds(); return b ? b.width() * b.height() : 0; } catch (e) { return 0; }
}
function brief(nd) {
    var cls = "?", w = 0, h = 0, sb = 0, txt = "";
    try { cls = String(nd.className()); cls = cls.substring(cls.lastIndexOf(".") + 1); } catch (e) {}
    try { var b = nd.bounds(); if (b) { w = b.width(); h = b.height(); } } catch (e) {}
    try { sb = nd.scrollable() ? 1 : 0; } catch (e) {}
    try { txt = String(nd.text() || nd.desc() || ""); if (txt.length > 8) txt = txt.substring(0, 8); } catch (e) {}
    return cls + " " + w + "x" + h + " sb=" + sb + (txt ? " [" + txt + "]" : "");
}
function tryAction(label, fn) {
    try { var r = fn(); log(label + " => " + r); return r === true; }
    catch (e) { log(label + " => 异常: " + e); return false; }
}

// ---------- ① 等待"真的有界面的 App"出现 ----------
toast("请在手机上打开目标 App，停在能滑的界面别动（脚本会自动开始）");
var waited = 0, p = "", nc = 0;
while (true) {
    p = pkgNow();
    nc = nodeCount();
    var isAutoJs = AUTOJS_PKGS.indexOf(p) >= 0;
    if (!isAutoJs && nc > 0) break;   // 看到有内容的界面了
    if (waited % 4 == 0) toast("等待目标 App…" + waited + "s  前台=" + p + " 节点=" + nc);
    if (waited >= 180) { toast("等待超时，仍按当前界面继续"); break; }
    sleep(2000);
    waited += 2;
}
log("等待结果: " + waited + " 秒 | 前台=" + p + " | 节点=" + nc);
sleep(1200);

var act = "?";
try { act = currentActivity(); } catch (e) {}
log("前台包名: " + p);
log("当前 Activity: " + act);
try { log("屏幕: " + device.width + "x" + device.height + "  SDK=" + device.sdkInt); } catch (e) {}
try { log("无障碍服务: " + (auto.service ? "已连接" : "未连接")); } catch (e) {}

// ---------- ② 全量节点 ----------
var all = [];
try {
    var r = classNameMatches(".*").find();
    for (var i = 0; r && i < r.size; i++) all.push(r.get(i));
} catch (e) { log("全量查找异常: " + e); }
log("全部节点: " + all.length + " 个");

// ---------- ③ 可滚动节点 ----------
var sbNodes = [];
try {
    var s = scrollable(true).find();
    for (var i = 0; s && i < s.size; i++) sbNodes.push(s.get(i));
} catch (e) { log("scrollable 查找异常: " + e); }
log("标记 scrollable 的节点: " + sbNodes.length + " 个");
for (var i = 0; i < sbNodes.length && i < 10; i++) log("  sb" + i + ": " + brief(sbNodes[i]));

var hit = false;

// ---------- ④ 前5个可滚动节点直接 scrollForward ----------
log("--- 前5个 scrollable 节点直接 scrollForward ---");
for (var i = 0; i < sbNodes.length && i < 5; i++) {
    var nd = sbNodes[i];
    if (tryAction("sb-sf " + brief(nd), function () { return nd.scrollForward(); })) {
        toast("！scrollForward 成功: " + brief(nd)); hit = true; break;
    }
}

// ---------- ⑤ 面积前40节点 scrollForward ----------
if (!hit) {
    all.sort(function (a, b) { return areaOf(b) - areaOf(a); });
    log("--- scrollForward 探测(面积前40) ---");
    for (var i = 0; i < all.length && i < 40; i++) {
        var nd = all[i];
        if (tryAction("sf " + brief(nd), function () { return nd.scrollForward(); })) {
            toast("！scrollForward 成功: " + brief(nd)); hit = true; break;
        }
    }
}

// ---------- ⑥ performAction(4096) / 焦点(64)+滚动 ----------
if (!hit) {
    log("--- performAction(4096) 探测(面积前10) ---");
    for (var i = 0; i < all.length && i < 10; i++) {
        var nd = all[i];
        if (tryAction("pa4096 " + brief(nd), function () { return nd.performAction(4096); })) {
            toast("！performAction(4096) 成功: " + brief(nd)); hit = true; break;
        }
    }
}
if (!hit) {
    log("--- 焦点(64)+滚动(4096) 探测(面积前5) ---");
    for (var i = 0; i < all.length && i < 5; i++) {
        var nd = all[i];
        tryAction("focus64 " + brief(nd), function () { return nd.performAction(64); });
        if (tryAction("then sf " + brief(nd), function () { return nd.scrollForward(); })) {
            toast("！焦点后滚动成功: " + brief(nd)); hit = true; break;
        }
    }
}

// ---------- ⑦ shell / root 通道复查 ----------
log("--- shell/root 通道复查 ---");
tryAction("shell input swipe", function () {
    var r = shell("input swipe 240 850 240 250 300 2>&1; echo EXIT=$?", false);
    return "code=" + r.code + " out=[" + r.result + "]";
});
tryAction("su -c input swipe(测是否有root)", function () {
    var r = shell("su -c 'input swipe 240 850 240 250 300' 2>&1; echo EXIT=$?", false);
    return "code=" + r.code + " out=[" + r.result + "]";
});

// ---------- ⑧ 结论 ----------
log("====================");
log("诊断完成  时间: " + new Date().toLocaleString());
log("前台: " + p + " / " + act + " | 节点=" + all.length);
log(hit ? "结论: ★无障碍滚动有可用节点，用上面标记成功的方式即可"
        : "结论: 无障碍滚动全无效（节点/异常见上）");

try {
    files.write("/sdcard/autoswipe_probe3.txt", lines.join("\n"));
    log("已保存: /sdcard/autoswipe_probe3.txt");
} catch (e) { log("保存文件失败: " + e); }
try {
    var resp = http.post(PC_URL, lines.join("\n"), { contentType: "text/plain", charset: "utf-8" });
    log("已回传电脑: HTTP " + resp.statusCode);
    toast("诊断结果已回传电脑 ✓");
} catch (e) { log("回传电脑失败(不影响诊断): " + e); }

try { console.show(); console.setSize(0.96, 0.6); } catch (e) {}
toast("诊断完成：音量减键退出");

events.observeKey();
events.onKeyDown("volume_down", function (event) { engines.stopAll(); event.consumed = true; });
while (true) sleep(1000);