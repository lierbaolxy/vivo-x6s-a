// 模板匹配探针 v2：切回抖音后截图并匹配「去观看」按钮
var LOG = "/sdcard/_probe_screen.log";
var PKG = "com.ss.android.ugc.aweme.lite";

function w(s) {
    console.log(s);
    try { files.append(LOG, s + "\n"); } catch (e) {}
}

w("==== 探针v2 开始 ====");
try {
    launch(PKG);
    sleep(4000);
    w("前台=" + currentPackage() + " 活动=" + currentActivity());
} catch (e) { w("launch 异常: " + e); }

try {
    var img = captureScreen();
    if (img) {
        w("captureScreen OK " + img.getWidth() + "x" + img.getHeight());
        try {
            images.save(img, "/sdcard/_probe_cap2.png");
            w("已保存 /sdcard/_probe_cap2.png");
        } catch (e2) { w("保存失败: " + e2); }

        var tpl = images.read("/sdcard/脚本/tpl_watch_go.png");
        var p = images.findImage(img, tpl, { threshold: 0.85 });
        if (p) {
            w("模板匹配成功 坐标=" + p.x + "," + p.y + " 中心=" + (p.x + tpl.getWidth() / 2) + "," + (p.y + tpl.getHeight() / 2));
        } else {
            w("模板匹配失败");
            // 放宽阈值再试
            var p2 = images.findImage(img, tpl, { threshold: 0.72 });
            w(p2 ? "放宽阈值匹配成功 " + p2.x + "," + p2.y : "放宽阈值仍失败");
        }
    } else {
        w("captureScreen 返回 null");
    }
} catch (e) {
    w("截图/匹配异常: " + e);
}

w("==== 探针v2 结束 ====");
