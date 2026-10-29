// ============================================================
// 远程遥控 v3.1 · 快手极速版适配（Auto.js 4.1.1 / Android 5.1）
// 目标机型：vivo X6s A（SDK_INT=22，1080x1920）
//
// v3 关键修复（实测 v2 的失败原因）：
//   Auto.js 4.1.1 在这台机上 classNameMatches(".*").find() 恒返回 0，
//   但 text("我").findOne() 能正常命中 —— 说明无障碍树有内容，
//   失效的是"类名正则选择器"。
//   => v3 彻底不用选择器枚举，改为：文字定位种子节点 → parent()
//      上溯到窗口根 → child(i) 广度优先遍历整棵树。
//
// v3.1 修复（2026-10-29，图文帖只左右翻图、不上滑）：
//   外层竖向信息流与帖内图片轮播都是"全屏 + 可滚动"，旧逻辑命中谁就
//   在谁身上 scrollForward，命中轮播时左右翻图并误报成功。
//   => 候选按「信息流标记(点赞/评论/分享) → 竖向类名 → 深度」排序，
//      跳过横向容器，ViewPager 只保留最优的一个；滑动后用页面指纹
//      复查，内容没变判为无效并继续试下一个候选。
//   v3.1.1：心跳/状态里的前台包名做了保护，无障碍服务被系统断开时脚本不再崩溃。
//
// 指令：scan / dump / cand / up / down / tap / back / home / recents / status / stop
// ============================================================

// ==================== 配置 ====================
var PC = "http://172.20.36.178:8000";
var POLL = 500;
var CACHE_MS = 5000;
var MAX_SCAN = 300;      // 单棵树最多收集节点数
var HB_EVERY = 60000;

// 用于定位树根的种子文字（哪个存在用哪个）
var SEEDS = ["我", "首页", "精选", "同城", "关注", "推荐", "发现", "消息", "朋友", "直播"];

// ==================== HTTP ====================
function httpText(path) {
    var r = null;
    try {
        var sep = (path.indexOf("?") >= 0) ? "&" : "?";
        r = http.get(PC + path + sep + "_t=" + Date.now(), {
            headers: { "Cache-Control": "no-cache" }
        });
        if (!r || r.statusCode !== 200) return null;
        return r.body.string();
    } catch (e) {
        return null;
    }
}

// 长文本回报：Auto.js 4.1.1 的 http.post 会按字符拆包，服务端已做还原
function ack(msg) {
    try {
        http.post(PC + "/ack", msg, {
            headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
    } catch (e) {}
    console.log(msg.substring(0, 160));
}

// ==================== 节点工具 ====================
function shortName(cls) {
    if (!cls) return "?";
    var p = String(cls).split(".");
    return p[p.length - 1];
}

function nodeInfo(nd, depth) {
    var w = 0, h = 0, area = 0, sb = false, cls = "?", kids = 0, txt = "", dsc = "";
    try {
        var b = nd.bounds();
        if (b) { w = b.width(); h = b.height(); area = Math.max(0, w) * Math.max(0, h); }
    } catch (e) {}
    try { sb = nd.scrollable(); } catch (e) {}
    try { cls = shortName(nd.className()); } catch (e) {}
    try { kids = nd.childCount(); } catch (e) {}
    try { txt = nd.text() || ""; } catch (e) {}
    try { dsc = nd.desc() || ""; } catch (e) {}
    return { node: nd, cls: cls, w: w, h: h, area: area,
             sb: sb, kids: kids, txt: txt, dsc: dsc, depth: depth };
}

// 无障碍服务被系统断开时 currentPackage() 会抛异常，这里统一兜住，避免整脚本崩掉
function foregroundPkg() {
    try { return currentPackage(); } catch (e) { return "?"; }
}

// 种子：按文字找一个真实节点（已实测可用），再上溯到窗口根
function seedNode() {
    for (var i = 0; i < SEEDS.length; i++) {
        var nd = null;
        try { nd = text(SEEDS[i]).findOne(900); } catch (e) {}
        if (!nd) { try { nd = desc(SEEDS[i]).findOne(700); } catch (e) {} }
        if (nd) return nd;
    }
    return null;
}

function climbToRoot(nd) {
    var cur = nd, depth = 0;
    while (cur && depth < 80) {
        var p = null;
        try { p = cur.parent(); } catch (e) { p = null; }
        if (!p) break;
        cur = p;
        depth++;
    }
    return cur;
}

// 广度优先遍历整棵树（child(i) 方式，不依赖选择器）
// pi = 最近一个被收集的祖先在 out 中的下标，用于判断“候选容器里有没有信息流标记”
function bfs(root, maxNodes) {
    var out = [], queue = [{ n: root, d: 0, pi: -1 }], guard = 0;
    while (queue.length > 0 && out.length < maxNodes && guard < 1200) {
        guard++;
        var it = queue.shift();
        var info = nodeInfo(it.n, it.d);
        var myIdx = it.pi;
        if (info.area > 0 || it.d === 0) {
            info.pi = it.pi;
            out.push(info);
            myIdx = out.length - 1;
        }
        var k = 0;
        try { k = it.n.childCount(); } catch (e) { k = 0; }
        for (var i = 0; i < k; i++) {
            var c = null;
            try { c = it.n.child(i); } catch (e) { c = null; }
            if (c) queue.push({ n: c, d: it.d + 1, pi: myIdx });
        }
    }
    return out;
}

var cache = { t: 0, nodes: [], seed: null };

function collectFresh() {
    var seed = seedNode();
    if (!seed) return { nodes: [], seed: null };
    var root = climbToRoot(seed);
    if (!root) return { nodes: [], seed: "种子有/根失败" };
    var nodes = bfs(root, MAX_SCAN);
    return { nodes: nodes, seed: "ok" };
}

function nodesCached() {
    if (Date.now() - cache.t < CACHE_MS && cache.nodes.length) return cache.nodes;
    var r = collectFresh();
    cache.nodes = r.nodes;
    cache.seed = r.seed;
    cache.t = Date.now();
    return cache.nodes;
}

// ==================== 滚动 ====================
// 大容器阈值：屏幕面积的 30%
function bigArea() {
    var sw = 0, sh = 0;
    try { sw = device.width; sh = device.height; } catch (e) {}
    if (!sw || !sh) return 1;
    return sw * sh * 0.30;
}

// 子节点排布方向：左右排=horz（图片轮播/标签页），上下排=vert，看不出=unknown
function orientationOf(nd) {
    var pts = [], k = 0;
    try { k = nd.childCount(); } catch (e) { k = 0; }
    for (var i = 0; i < k && pts.length < 6; i++) {
        var c = null;
        try { c = nd.child(i); } catch (e) { c = null; }
        if (!c) continue;
        var b = null;
        try { b = c.bounds(); } catch (e) { b = null; }
        if (!b || b.width() <= 0 || b.height() <= 0) continue;
        pts.push({ l: b.left, t: b.top });
    }
    if (pts.length < 2) return "unknown";
    var minL = pts[0].l, maxL = pts[0].l, minT = pts[0].t, maxT = pts[0].t;
    for (var j = 1; j < pts.length; j++) {
        if (pts[j].l < minL) minL = pts[j].l;
        if (pts[j].l > maxL) maxL = pts[j].l;
        if (pts[j].t < minT) minT = pts[j].t;
        if (pts[j].t > maxT) maxT = pts[j].t;
    }
    var spreadL = maxL - minL, spreadT = maxT - minT;
    if (spreadL > 100 && spreadL > spreadT * 2) return "horz";
    if (spreadT > 100 && spreadT > spreadL * 2) return "vert";
    return "unknown";
}

// 候选容器里是否有“点赞/评论/分享”这类信息流标记（走 pi 祖先链）
function containsMark(nodes, idx) {
    for (var i = 0; i < nodes.length; i++) {
        var t = (nodes[i].txt || "") + " " + (nodes[i].dsc || "");
        if (!/(点赞|评论|分享|收藏|作者|@)/.test(t)) continue;
        var p = nodes[i].pi, guard = 0;
        while (p >= 0 && guard < 80) {
            if (p === idx) return true;
            p = nodes[p].pi;
            guard++;
        }
    }
    return false;
}

// 候选排序：含信息流标记 > 竖向类名 > 更深（内层信息流） > 面积大
// 横向排布容器与 HorizontalScrollView 直接排除；ViewPager 只保留最优的一个，
// 避免退而求其次时误滚到顶部标签页/图片轮播。
function buildCandidates(nodes, minArea) {
    var VERT = { ViewPager: 1, RecyclerView: 1, ScrollView: 1, NestedScrollView: 1,
                 ListView: 1, WebView: 1 };
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (!n.sb) continue;
        if (n.cls === "HorizontalScrollView") continue;
        if (n.area < minArea) continue;
        var ori = orientationOf(n.node);
        if (ori === "horz") continue;
        out.push({ node: n.node, cls: n.cls, w: n.w, h: n.h, area: n.area, depth: n.depth,
                   ori: ori, grp: containsMark(nodes, i) ? 0 : 1,
                   rank: VERT[n.cls] ? 0 : 1 });
    }
    out.sort(function (a, b) {
        if (a.grp !== b.grp) return a.grp - b.grp;
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (a.depth !== b.depth) return b.depth - a.depth;
        return b.area - a.area;
    });
    var kept = [], vp = false;
    for (var m = 0; m < out.length; m++) {
        if (out[m].cls === "ViewPager") {
            if (vp) continue;
            vp = true;
        }
        kept.push(out[m]);
    }
    return kept;
}

// 页面指纹：优先用信息流标记文字（作者/点赞/评论/分享），没有标记时退回全量文字+节点数
// 图文帖左右翻图时这些标记不变 => 指纹不变 => 判为无效滚动
function uniqJoin(arr) {
    arr.sort();
    var out = [];
    for (var i = 0; i < arr.length; i++) {
        if (i === 0 || arr[i] !== arr[i - 1]) out.push(arr[i]);
    }
    return out.join("|");
}

function pageSignature(nodes) {
    var marks = [], all = [], i;
    for (i = 0; i < nodes.length; i++) {
        var t = nodes[i].txt || "", d = nodes[i].dsc || "";
        var best = t.length >= d.length ? t : d;
        if (!best) continue;
        if (/(点赞|评论|分享|收藏|作者|@)/.test(best)) marks.push(best);
        if (best.length >= 4 && !/^[0-9\s\.\/:%\+\-]+$/.test(best)) all.push(best);
    }
    if (marks.length) return "M:" + uniqJoin(marks);
    return "F:" + uniqJoin(all) + "#" + nodes.length;
}

function refreshTree() {
    var r = collectFresh();
    cache.nodes = r.nodes;
    cache.seed = r.seed;
    cache.t = Date.now();
    return r.nodes;
}

function tryScroll(forward) {
    // 每次都用新树，避免缓存里的节点在滚动后失效
    var nodes = refreshTree();
    if (!nodes.length) return "失败:取树失败 种子=" + (cache.seed || "null");

    var minArea = bigArea();
    var cand = buildCandidates(nodes, minArea);
    if (!cand.length) cand = buildCandidates(nodes, minArea * 0.15);   // 兜底：放宽到约 4.5% 屏
    if (!cand.length) return "失败:无可滚动竖向候选/共" + nodes.length + "节点";

    var sigBefore = pageSignature(nodes);
    var tried = 0, invalid = 0, bad = [];
    for (var m = 0; m < cand.length; m++) {
        var c = cand[m];
        tried++;
        var ok = false;
        try { ok = forward ? c.node.scrollForward() : c.node.scrollBackward(); } catch (e) { ok = false; }
        if (!ok) continue;

        // 滚动后复查：内容没变说明只是原地横滑，继续试下一个候选
        sleep(650);
        var after = refreshTree();
        if (pageSignature(after) !== sigBefore) {
            return "成功:" + c.cls + "(" + c.w + "x" + c.h + ",sb=true,d=" + c.depth + "," +
                   c.ori + ") 第" + tried + "次/共" + nodes.length + "节点 校验=已换页";
        }
        invalid++;
        bad.push(c.cls + "(d" + c.depth + "," + c.ori + ")");
        sigBefore = pageSignature(after);
    }
    return "失败:无有效竖向滚动 候选=" + cand.length + "/试" + tried +
           (invalid ? " 无效=" + invalid + "[" + bad.join(" ") + "]" : "");
}

// ==================== 指令 ====================
function wake() {
    try { device.wakeUpIfNeeded(); } catch (e) {
        try { device.wakeUp(); } catch (e2) {}
    }
    try { device.keepScreenOn(10 * 60 * 1000); } catch (e) {}
}

function dumpStr() {
    var nodes = nodesCached();
    var lim = nodes.length < 80 ? nodes.length : 80;
    var parts = [];
    for (var i = 0; i < lim; i++) {
        var n = nodes[i];
        var extra = "";
        if (n.txt) extra += " t=" + n.txt;
        if (n.dsc) extra += " d=" + n.dsc;
        parts.push(i + " d" + n.depth + " " + n.cls + " sb=" + (n.sb ? 1 : 0) +
                   " " + n.w + "x" + n.h + " k=" + n.kids + extra);
    }
    return "DUMP 总=" + nodes.length + " 种子=" + (cache.seed || "null") +
           " 前台=" + foregroundPkg() + "\n" + parts.join("\n");
}

function doTap(arg) {
    if (!arg) return "失败:tap 缺少文字";
    var nd = null;
    try { nd = text(arg).findOne(1500); } catch (e) {}
    if (!nd) { try { nd = desc(arg).findOne(1000); } catch (e) {} }
    if (!nd) return "失败:找不到文字=" + arg;
    var ok = false;
    try { ok = nd.click(); } catch (e) {}
    return (ok ? "成功:点击 " : "失败:点击(节点存在但click=false) ") + arg;
}

function run(cmd, arg) {
    if (cmd === "dump") return dumpStr();
    if (cmd === "scan") {
        var r = collectFresh();
        cache.nodes = r.nodes; cache.seed = r.seed; cache.t = Date.now();
        return "节点数=" + r.nodes.length + " 种子=" + (r.seed || "null") +
               " 前台=" + foregroundPkg();
    }
    if (cmd === "cand") {
        var nodes = refreshTree();
        var cand = buildCandidates(nodes, bigArea());
        var parts = [];
        for (var ci = 0; ci < cand.length && ci < 10; ci++) {
            var c = cand[ci];
            parts.push((ci + 1) + "." + c.cls + "(d" + c.depth + "," + c.ori + "," +
                       c.w + "x" + c.h + ",mark=" + (c.grp === 0 ? 1 : 0) + ")");
        }
        return "CAND 共" + nodes.length + "节点 候选=" + cand.length + " " + parts.join(" ");
    }
    wake();
    if (cmd === "up") return tryScroll(true);
    if (cmd === "down") return tryScroll(false);
    if (cmd === "tap") return doTap(arg);
    if (cmd === "back") { try { back(); return "成功:back"; } catch (e) { return "失败:back"; } }
    if (cmd === "home") { try { home(); return "成功:home"; } catch (e) { return "失败:home"; } }
    if (cmd === "recents") { try { recents(); return "成功:recents"; } catch (e) { return "失败:recents"; } }
    if (cmd === "status") {
        var w = 0, h = 0;
        try { w = device.width; h = device.height; } catch (e) {}
        return "前台=" + foregroundPkg() + " 屏幕=" + w + "x" + h +
               " 服务=" + (auto.service ? "开" : "关") + " 缓存=" + cache.nodes.length +
               " 种子=" + (cache.seed || "null");
    }
    return "失败:未知指令 " + cmd;
}

// ==================== 停止键 ====================
var stopped = false;
try {
    events.observeKey();
    events.onKeyDown("volume_down", function (event) {
        stopped = true;
        ack("本地停止:音量减键");
        engines.stopAll();
        event.consumed = true;
    });
} catch (e) {}

// ==================== 启动 ====================
if (!auto.service) {
    toast("无障碍服务未开启！设置→辅助功能→AutoJs");
    exit();
}
toast("v3.1.1 已启动");
ack("上线 v3.1.1 脚本=remote_ctl_kuaishou_v3_20261029.js");

// ==================== 主循环 ====================
var lastHb = Date.now();
var loopCount = 0;

while (!stopped) {
    loopCount++;
    try {
        if (Date.now() - lastHb >= HB_EVERY) {
            lastHb = Date.now();
            ack("hb v3.1 循环=" + loopCount + " 前台=" + foregroundPkg());
        }
        var body = httpText("/cmd");
        if (body) {
            var obj = null;
            try { obj = JSON.parse(body); } catch (e) {}
            if (obj && obj.cmd) {
                if (obj.cmd === "stop") {
                    ack("远端停止 v3 seq=" + obj.seq);
                    toast("收到远端停止");
                    break;
                }
                var res = "";
                try { res = run(obj.cmd, obj.arg); } catch (e2) { res = "异常:" + e2; }
                ack("seq=" + obj.seq + " cmd=" + obj.cmd + " => " + res);
            }
        }
    } catch (e3) {
        // 无障碍服务被系统断开等异常不应终止脚本
        ack("循环异常:" + e3);
        sleep(1000);
    }
    sleep(POLL);
}

ack("v3.1 脚本已退出");
