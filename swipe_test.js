// 滑动测试 - 带无障碍重连
toast("测试开始，音量-停止");

var screenH = 2408;
var swipeFromY = Math.floor(screenH * 0.78);
var swipeToY = Math.floor(screenH * 0.22);
var count = 0;

events.observeKey();
events.onKeyDown("volume_down", function(event) {
    toast("停止，共滑动 " + count + " 次");
    engines.stopAll();
    event.consumed = true;
});

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function doSwipe(x1, y1, x2, y2, dur) {
    // 确保无障碍服务开着
    if (!auto.service) {
        toast("无障碍断开，重连中...");
        auto();  // 重新请求无障碍
        sleep(2000);
        if (!auto.service) {
            toast("无障碍重连失败，跳过");
            return false;
        }
        toast("无障碍已重连");
    }
    try {
        gesture(dur, [x1, y1], [x2, y2]);
        return true;
    } catch (e) {
        toast("滑动异常: " + e);
        return false;
    }
}

while (true) {
    count++;
    var x1 = rand(200, 880);
    var x2 = rand(200, 880);
    var dur = rand(300, 800);
    
    var ok = doSwipe(x1, swipeFromY, x2, swipeToY, dur);
    toast("第 " + count + " 次 " + (ok ? "OK" : "FAIL"));
    
    sleep(3000);
}