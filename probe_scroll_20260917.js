// ============================================================
// 滑动诊断脚本（一次性运行，不改动任何 App）
// 用途：查清"找到了节点但滑不动"的确切原因
//
// 用法：AutoJs 里运行本脚本 → 10 秒内切到目标 App → 等提示"诊断完成"
// 结果：① 悬浮控制台(结束时自动弹出) ② /sdcard/autoswipe_probe.txt
//       ③ 自动回传到电脑(成功会 toast)
// 退出：音量减键
// ============================================================

var PC_URL = "http://172.20.36.178:8099/upload";  // 电脑接收地址，失败不影响诊断

var lines = [];
function log(s) { lines.push("" + s); console.log("" + s); }

// ---------- 小工具：节点摘要 ----------
function areaOf(nd) {
    try { var b = nd.bounds(); return b ? b.width() * b.height() : 0; } catch (e) { return 0; }
}
function brief(nd) {
    var cls = "?", w = 0, h = 0, sb = 0, txt = "";
    try { cls = String(nd.className()); cls = cls.substring(cls.lastIndexOf(".") + 1); } catch (e) {}
    try { var b = nd.bounds(); if (b) { w = b.width(); h = b.height(); } } catch (e) {}
    try { sb = nd.scrollable() ? 1 : 0; } catch (e) {}
    try {
        txt = String(nd.text() || nd.desc() || "");
        if (txt.length > 8) txt = txt.substring(0, 8);
    } catch (e) {}
    return cls + " " + w + "x" + h + " sb=" + sb + (txt ? " [" + txt + "]" : "");
}

// 统一动作探测：把返回值和异常都记录下来（关键！之前异常被吞掉了）
function tryAction(label, fn) {
    try {
        var r = fn();
        log(label + " => " + r);
        return r === true;
    } catch (e) {
        log(label + " => 异常: " + e);
        return false;
    }
}

// ---------- 等待切到目标 App ----------
toast("10 秒后开始诊断，请切到目标 App");
sleep(10000);

var pkg = "?", act = "?";
try { pkg = currentPackage(); } catch (e) {}
try { act = currentActivity(); } catch (e) {}
log("前台包名: " + pkg);
log("当前 Activity: " + act);
try { log("屏幕: " + device.width + "x" + device.height + "  SDK=" + device.sdkInt); } catch (e) {}

// ---------- ① 全量节点（按面积从大到小） ----------
var all = [];
try {
    var r = classNameMatches(".*").find();
    for (var i = 0; r && i < r.size; i++) all.push(r.get(i));
} catch (e) { log("全量查找异常: " + e); }
log("全部节点: " + all.length + " 个");
all.sort(function (a, b) { return areaOf(b) - areaOf(a); });

// ---------- ② 标记为可滚动的节点 ----------
var sbNodes = [];
try {
    var s = scrollable(true).find();
    for (var i = 0; s && i < s.size; i++) sbNodes.push(s.get(i));
} catch (e) { log("scrollable 查找异常: " + e); }
log("标记 scrollable 的节点: " + sbNodes.length + " 个");
for (var i = 0; i < sbNodes.length && i < 10; i++) log("  sb" + i + ": " + brief(sbNodes[i]));

var hit = false;

// ---------- ③-1 面积前 40 个节点：scrollForward ----------
log("--- scrollForward 探测(面积前40) ---");
for (var i = 0; i < all.length && i < 40; i++) {
    var nd = all[i];
    if (tryAction("sf " + brief(nd), function () { return nd.scrollForward(); })) {
        toast("！scrollForward 成功: " + brief(nd));
        hit = true;
        break;
    }
}

// ---------- ③-2 未命中：performAction(4096) 直发动作 ----------
if (!hit) {
    log("--- performAction(4096) 探测(面积前10) ---");
    for (var i = 0; i < all.length && i < 10; i++) {
        var nd = all[i];
        if (tryAction("pa4096 " + brief(nd), function () { return nd.performAction(4096); })) {
            toast("！performAction(4096) 成功: " + brief(nd));
            hit = true;
            break;
        }
    }
}

// ---------- ③-3 未命中：先设无障碍焦点(64)再滚动 ----------
if (!hit) {
    log("--- 焦点(64)+滚动(4096) 探测(面积前5) ---");
    for (var i = 0; i < all.length && i < 5; i++) {
        var nd = all[i];
        tryAction("focus64 " + brief(nd), function () { return nd.performAction(64); });
        if (tryAction("then sf " + brief(nd), function () { return nd.scrollForward(); })) {
            toast("！焦点后滚动成功: " + brief(nd));
            hit = true;
            break;
        }
    }
}

// ---------- ③-4 其他通道探测（Android 6 无 root 预期全失败，留证据） ----------
tryAction("全局 scrollDown()", function () { scrollDown(); return "无异常"; });
tryAction("全局 swipe()", function () { swipe(240, 800, 240, 200, 300); return "无异常"; });
tryAction("shell input swipe", function () {
    var r = shell("input swipe 240 800 240 200 300", false);
    return "code=" + r.code + " out=" + r.result;
});

// ---------- 结论 ----------
log("====================");
log("诊断完成  时间: " + new Date().toLocaleString());
log(hit ? "结论: 找到能滚动的节点了，用上面标记成功的方式即可"
        : "结论: 当前界面下无障碍滚动全部无效（对照上面各条结果判断）");

// ---------- 保存到手机文件 ----------
try {
    files.write("/sdcard/autoswipe_probe.txt", lines.join("\n"));
    log("已保存: /sdcard/autoswipe_probe.txt");
} catch (e) { log("保存文件失败: " + e); }

// ---------- 回传电脑 ----------
try {
    var resp = http.post(PC_URL, lines.join("\n"),
                        { contentType: "text/plain", charset: "utf-8" });
    log("已回传电脑: HTTP " + resp.statusCode);
    toast("诊断结果已回传电脑 ✓");
} catch (e) {
    log("回传电脑失败(不影响诊断): " + e);
}

// ---------- 显示结果并保持 ----------
try { console.show(); console.setSize(0.96, 0.6); } catch (e) {}
toast("诊断完成：看悬浮窗内容，音量减键退出");

events.observeKey();
events.onKeyDown("volume_down", function (event) { engines.stopAll(); event.consumed = true; });
while (true) sleep(1000);