// ============================================================
// 滑动诊断 v2（自动等待切到目标 App + shell 滑动专项测试）
// 生成时间：2026-09-17
//
// 与 v1 的区别：
//   ① 不再固定等 10 秒 —— 会自动检测前台，切到目标 App 后才开始
//      （v1 报告显示当时前台是 AutoJs 自己，等于什么都没测到）
//   ② 增加 shell input swipe 专项测试（如果这条能通，方案就简单了）
//
// 用法：运行后立刻按 Home 切到目标 App → 等提示"诊断完成" → 音量减键退出
// 结果：悬浮控制台 + /sdcard/autoswipe_probe.txt + 自动回传电脑
// ============================================================

var PC_URL = "http://172.20.36.178:8099/upload";
var AUTOJS_PKGS = ["org.autojs.autojs", "org.autojs.autojs6"];

var lines = [];
function log(s) { lines.push("" + s); console.log("" + s); }
function pkgNow() { try { var p = currentPackage(); return p ? p : ""; } catch (e) { return ""; } }

// ---------- 小工具 ----------
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
// 统一动作探测：返回值和异常都记录（异常绝不再吞掉）
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

// ---------- ① 自动等待切到目标 App（不再固定 10 秒） ----------
toast("请立刻切到目标 App，脚本会自动开始（不用等）");
var waited = 0;
while (true) {
    var p = pkgNow();
    if (p && AUTOJS_PKGS.indexOf(p) < 0) break;          // 已经切走了
    if (waited % 5 == 0) toast("等待切到目标 App…已等 " + waited + " 秒");
    if (waited >= 90) { toast("等待超时，按当前界面继续"); break; }
    sleep(1000);
    waited++;
}
log("切换等待: " + waited + " 秒");
sleep(1500);   // 给目标界面稳定时间

var pkg = "?";
try { pkg = currentPackage(); } catch (e) {}
var act = "?";
try { act = currentActivity(); } catch (e) {}
log("前台包名: " + pkg + (AUTOJS_PKGS.indexOf(pkg) >= 0 ? "  ★仍然是AutoJs，等于白测" : ""));
log("当前 Activity: " + act);
try { log("屏幕: " + device.width + "x" + device.height + "  SDK=" + device.sdkInt); } catch (e) {}
try { log("无障碍服务: " + (auto.service ? "已连接" : "未连接")); } catch (e) {}

// ---------- ② 全量节点（按面积从大到小） ----------
var all = [];
try {
    var r = classNameMatches(".*").find();
    for (var i = 0; r && i < r.size; i++) all.push(r.get(i));
} catch (e) { log("全量查找异常: " + e); }
log("全部节点: " + all.length + " 个");

// ---------- ③ 标记为可滚动的节点 ----------
var sbNodes = [];
try {
    var s = scrollable(true).find();
    for (var i = 0; s && i < s.size; i++) sbNodes.push(s.get(i));
} catch (e) { log("scrollable 查找异常: " + e); }
log("标记 scrollable 的节点: " + sbNodes.length + " 个");
for (var i = 0; i < sbNodes.length && i < 10; i++) log("  sb" + i + ": " + brief(sbNodes[i]));

var hit = false;

// ---------- ④ 前5个 scrollable 节点直接 scrollForward（老版本验证过的路径） ----------
log("--- 前5个 scrollable 节点直接 scrollForward ---");
for (var i = 0; i < sbNodes.length && i < 5; i++) {
    var nd = sbNodes[i];
    if (tryAction("sb-sf " + brief(nd), function () { return nd.scrollForward(); })) {
        toast("！scrollForward 成功: " + brief(nd));
        hit = true;
        break;
    }
}

// ---------- ⑤ 面积前 40 个节点：scrollForward ----------
if (!hit) {
    all.sort(function (a, b) { return areaOf(b) - areaOf(a); });
    log("--- scrollForward 探测(面积前40) ---");
    for (var i = 0; i < all.length && i < 40; i++) {
        var nd = all[i];
        if (tryAction("sf " + brief(nd), function () { return nd.scrollForward(); })) {
            toast("！scrollForward 成功: " + brief(nd));
            hit = true;
            break;
        }
    }
}

// ---------- ⑥ 未命中：performAction(4096) / 先设焦点(64)再滚 ----------
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

// ---------- ⑦ shell 滑动专项（关键测试！若可用整件事就简单了） ----------
log("--- shell 滑动专项 ---");
tryAction("全局 swipe()", function () { swipe(240, 850, 240, 250, 300); return "无异常"; });

toast("现在测试 shell 滑动：请盯着画面，看有没有上滑一次");
sleep(1500);
tryAction("shell input swipe 300ms", function () {
    var r = shell("input swipe 240 850 240 250 300 2>&1; echo EXIT=$?", false);
    return "code=" + r.code + " out=[" + r.result + "]";
});
sleep(2500);
tryAction("shell input touchscreen swipe", function () {
    var r = shell("input touchscreen swipe 240 850 240 250 300 2>&1; echo EXIT=$?", false);
    return "code=" + r.code + " out=[" + r.result + "]";
});
sleep(2500);
tryAction("shell input keyevent 20(下方向键)", function () {
    var r = shell("input keyevent 20 2>&1; echo EXIT=$?", false);
    return "code=" + r.code + " out=[" + r.result + "]";
});
toast("shell 测试结束：刚才画面滑动过吗？（记住结果）");

// ---------- ⑧ 结论 ----------
log("====================");
log("诊断完成  时间: " + new Date().toLocaleString());
log("前台: " + pkg + " / " + act);
log(hit ? "结论: 无障碍滚动有可用节点，用上面标记成功的方式即可"
        : "结论: 无障碍滚动全废，重点看第 ⑦ 段 shell 测试结果");

// ---------- 保存 + 回传 ----------
try {
    files.write("/sdcard/autoswipe_probe2.txt", lines.join("\n"));
    log("已保存: /sdcard/autoswipe_probe2.txt");
} catch (e) { log("保存文件失败: " + e); }
try {
    var resp = http.post(PC_URL, lines.join("\n"), { contentType: "text/plain", charset: "utf-8" });
    log("已回传电脑: HTTP " + resp.statusCode);
    toast("诊断结果已回传电脑 ✓");
} catch (e) { log("回传电脑失败(不影响诊断): " + e); }

// ---------- 显示结果并保持 ----------
try { console.show(); console.setSize(0.96, 0.6); } catch (e) {}
toast("诊断完成：看悬浮窗内容，音量减键退出");

events.observeKey();
events.onKeyDown("volume_down", function (event) { engines.stopAll(); event.consumed = true; });
while (true) sleep(1000);