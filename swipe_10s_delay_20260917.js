// ============================================================
// 自动上滑 · 每 10 秒一次（带启动延迟版）
// 生成时间：2026-09-17
//
// 与上一版的唯一区别：启动后先等 START_DELAY 秒再开始滑，
// 让你有时间从 AutoJs 切到目标 App。不拉起任何 App。
//
// 不绑定任何 App：不限抖音，前台是什么就滑什么（任何有
// 可滚动容器的界面都会尝试），只是提示里会显示前台包名方便排查。
//
// 目标机型：SDK_INT=23 (Android 6.0)，屏幕 480x1014
//   不支持手势 swipe()（需 SDK>=24），使用无障碍滚动：
//   scrollable(true).find() + node.scrollForward()
//
// 停止：音量减键
// ============================================================

// ==================== 配置 ====================
var INTERVAL = 10000;    // 滑动间隔 (ms)
var START_DELAY = 10000; // 启动后延迟多久开始滑(ms)，给你时间切到目标 App；设 0 = 立即开始

// ==================== 工具函数 ====================
function shortName(cls) {
    if (!cls) return "?";
    var p = String(cls).split(".");
    return p[p.length - 1];
}

// 读取节点信息：类名 / 面积 / 是否可滚动
function infoOf(nd) {
    var cls = "?", area = 0, sb = false;
    try { cls = shortName(nd.className()); } catch (e) {}
    try { sb = nd.scrollable(); } catch (e) {}
    try {
        var b = nd.bounds();
        if (b) area = Math.max(0, b.width()) * Math.max(0, b.height());
    } catch (e) {}
    return { node: nd, cls: cls, area: area, sb: sb };
}

// 加入候选（按"类名+面积"去重，避免同节点重复尝试）
function pushCand(list, seen, nd) {
    if (!nd) return;
    var info = infoOf(nd);
    var key = info.cls + "|" + info.area;
    if (seen[key]) return;
    seen[key] = true;
    list.push(info);
}

// ==================== 向上滑动一次 ====================
var didBackTest = false;   // 反向诊断只做一次

function swipeUp(n) {
    // 调用前先提示（带前台包名，可直接看出脚本看到的当前前台是哪个 App）
    toast("第 " + n + " 次：调用滑动 | 前台=" + shortName(currentPackage()));

    var cands = [], seen = {};

    // 候选①：无障碍树里标记可滚动的节点（正规路径）
    var nodes = scrollable(true).find();
    var total = (nodes && nodes.size) ? nodes.size : 0;
    for (var i = 0; i < total; i++) pushCand(cands, seen, nodes.get(i));

    // 候选②：类名像滚动容器、但没标记 scrollable 的节点
    // （很多 App 的竖向翻页容器不标记 scrollable，这是"节点都无效"的关键兜底）
    try {
        var like = classNameMatches(".*(Pager|RecyclerView|ScrollView|ListView|WebView).*").find();
        var m = (like && like.size) ? like.size : 0;
        for (var j = 0; j < m && j < 20; j++) pushCand(cands, seen, like.get(j));
    } catch (e) {
        console.log("类名兜底查找失败: " + e);
    }

    if (!cands.length) {
        toast("第 " + n + " 次：找不到任何候选节点");
        return false;
    }

    var desc = [];
    for (var k = 0; k < cands.length; k++) {
        desc.push(cands[k].cls + "(" + cands[k].area + ")");
    }
    console.log("[" + n + "] 候选" + cands.length + "个: " + desc.join(" "));

    // 逐个尝试 scrollForward（异常不再吞掉，要看到真实报错）
    var errMsg = "";
    for (var t = 0; t < cands.length; t++) {
        var ok = false;
        try {
            ok = cands[t].node.scrollForward();
        } catch (e) {
            if (!errMsg) errMsg = "" + e;
        }
        console.log("  试 " + cands[t].cls + " 面积=" + cands[t].area +
                    " scrollable=" + cands[t].sb + " => " + ok +
                    (errMsg ? " 异常:" + errMsg : ""));
        if (ok) {
            toast("第 " + n + " 次：成功 → " + cands[t].cls);
            return true;
        }
    }

    // 全失败 → 反向诊断：true=节点支持无障碍滚动(只是方向/位置问题)，false=完全不响应
    if (!didBackTest) {
        didBackTest = true;
        var back = false;
        try { back = cands[0].node.scrollBackward(); } catch (e) {}
        toast("反向测试=" + back + "（true=节点支持无障碍滚动，画面会往回跳一下）");
    }

    toast("第 " + n + " 次：失败 " + cands.length + "个候选 首个=" +
          cands[0].cls + "(" + cands[0].area + ")" +
          (errMsg ? " err:" + errMsg.substring(0, 24) : ""));
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
// 无障碍服务检查：没开启的话滑动必然失败
if (!auto.service) {
    toast("无障碍服务未开启！请去 设置→辅助功能 开启 AutoJs");
    console.log("无障碍服务未开启，脚本退出");
    exit();
}
toast("无障碍服务已开启 ✓");

if (START_DELAY > 0) {
    toast((START_DELAY / 1000) + " 秒后开始滑动，请切到目标 App（任意 App 都行）");
    sleep(START_DELAY);
}
toast("开始滑动 | 每 " + (INTERVAL / 1000) + " 秒一次 | 音量减键停止");

// ==================== 主循环 ====================
var count = 0;
while (true) {
    // 屏幕唤醒保护：避免息屏后滑不动（不需要可删掉这两行）
    try {
        device.wakeUpIfNeeded();
        device.keepScreenOn(3600 * 1000);
    } catch (e) {}

    count++;
    var ok = swipeUp(count);
    console.log("[" + count + "] 前台=" + currentPackage() + " | " +
                (ok ? "上滑成功" : "上滑失败"));

    sleep(INTERVAL);
}