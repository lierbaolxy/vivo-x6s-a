// ============================================================
// 第一步：环境诊断 + 滑动方案探测
// 生成时间：2026-09-17
//
// 用法：
//   1. 先手动打开抖音，停在视频播放页（不要停在首页/搜索页）
//   2. 再运行本脚本
//   3. 运行完会弹窗，把弹窗内容发我
// ============================================================

var lines = [];
lines.push("===== 设备信息 =====");
lines.push("SDK_INT  = " + device.sdkInt);
lines.push("release  = " + device.release);
lines.push("brand    = " + device.brand);
lines.push("model    = " + device.model);
lines.push("屏幕     = " + device.width + " x " + device.height);
lines.push("支持手势 = " + (device.sdkInt >= 24 ? "是 (>=7.0)" : "否 (需>=24)"));
lines.push("当前包名 = " + currentPackage());

// ---------- 测试1：无障碍滚动（安卓4.1+即可用） ----------
lines.push("");
lines.push("===== 测试1：无障碍滚动 =====");
try {
    var node = scrollable(true).findOne(2000);
    if (!node) {
        lines.push("结果：没找到可滚动节点");
        lines.push(">>> 方案A 不可用");
    } else {
        var ok = node.scrollForward();
        lines.push("节点类名：" + node.className());
        lines.push("scrollForward() 返回：" + ok);
        if (ok) {
            lines.push(">>> 方案A 可用（已翻过一个视频）");
        } else {
            lines.push(">>> 找到节点但不响应翻页");
        }
    }
} catch (e) {
    lines.push("结果：异常 " + e);
    lines.push(">>> 方案A 不可用");
}

// ---------- 测试2：手势滑动（安卓7.0+） ----------
lines.push("");
lines.push("===== 测试2：手势滑动 =====");
try {
    var cx = Math.floor(device.width / 2);
    swipe(cx, Math.floor(device.height * 0.75), cx, Math.floor(device.height * 0.25), 400);
    lines.push("结果：swipe() 成功");
    lines.push(">>> 方案B 可用（已翻过一个视频）");
} catch (e) {
    lines.push("结果：swipe() 失败");
    lines.push("错误：" + e);
    lines.push(">>> 方案B 不可用");
}

// ---------- 输出结果 ----------
var text = lines.join("\n");
console.log(text);
try {
    alert("环境诊断结果", text);
} catch (e) {
    toast(text);
}