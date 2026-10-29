// ============================================================
// 滑动诊断（临时排查用）
// 生成时间：2026-09-17
//
// 每 5 秒检查一次「当前前台是谁」+「能不能翻页」，
// 结果用 toast 显示（屏幕底部），同时写入 AutoJs 日志面板。
//
// 判断方法：
//   第 1 行包名如果是 org.autojs...  -> 说明抖音不在前台，所以滑不动
//   第 1 行包名是抖音(aweme)         -> 那才需要看后面的节点数
// ============================================================

var i = 0;
while (true) {
    i++;

    // 当前前台应用
    var pkg = "?";
    try { pkg = currentPackage(); } catch (e) {}

    // 当前界面的可滚动节点
    var nodeCount = 0;
    var nodes = null;
    try {
        nodes = scrollable(true).find();
        if (nodes) nodeCount = nodes.size;
    } catch (e) {}

    // 逐个尝试翻页
    var result = "当前界面没有可滚动节点";
    if (nodeCount > 0) {
        result = "找到" + nodeCount + "个节点，都不响应翻页";
        for (var k = 0; k < nodeCount; k++) {
            try {
                if (nodes.get(k).scrollForward()) {
                    result = "第" + (k + 1) + "个节点翻页成功(" + nodes.get(k).className() + ")";
                    break;
                }
            } catch (e) {}
        }
    }

    toastLog("[" + i + "] 前台=" + pkg + " | 节点数=" + nodeCount + " | " + result);
    sleep(5000);
}