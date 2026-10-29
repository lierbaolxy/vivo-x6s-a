# -*- coding: utf-8 -*-
"""本地系统应用卸载器 - PC 端服务
仅监听 127.0.0.1，通过 adb shell 身份执行 pm uninstall --user 0。
"""
import json
import os
import re
import subprocess
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ADB = os.environ.get("ADB", "adb")
PORT = 8899
BASE = os.path.dirname(os.path.abspath(__file__))
PANEL = os.path.join(BASE, "uninstaller_panel.html")

# 禁止卸载的核心包（精确匹配）
PROTECTED = {
    "android",
    "com.android.systemui",
    "com.android.settings",
    "com.android.shell",
    "com.android.packageinstaller",
    "com.android.defcontainer",
    "com.bbk.launcher2",
    "com.vivo.abe",
    "com.vivo.pem",
    "com.vivo.daemonService",
    "com.vivo.devicereg",
    "com.vivo.fingerprint.fpc.service",
    "com.android.webview",
    "com.android.keychain",
}
# 禁止卸载的核心包（前缀匹配）
PROTECTED_PREFIX = (
    "com.android.providers",
    "com.android.server",
    "com.qualcomm",
    "org.codeaurora",
    "com.android.incallui",
    "com.android.dialer",
)

# 常见包名 -> 中文名（未收录的显示包名）
LABELS = {
    "com.android.systemui": "系统界面",
    "com.bbk.launcher2": "桌面",
    "com.android.settings": "设置",
    "com.android.phone": "电话",
    "com.android.server.telecom": "通话服务",
    "com.android.mms": "短信",
    "com.android.contacts": "联系人",
    "com.android.dialer": "拨号",
    "com.android.incallui": "来电界面",
    "com.android.bluetooth": "蓝牙",
    "com.android.bluetoothsettings": "蓝牙设置",
    "com.vivo.daemonService": "vivo 守护服务",
    "com.vivo.abe": "vivo ABE 引擎",
    "com.vivo.pem": "vivo 电源管理",
    "com.android.providers.media": "媒体存储",
    "android.process.media": "媒体存储进程",
    "com.android.phone": "电话(系统)",
    "com.android.camera": "相机",
    "com.android.gallery3d": "图库",
    "com.vivo.gallery": "相册",
    "com.vivo.fingerprint": "指纹",
    "com.vivo.fingerprint.fpc.service": "指纹 HAL",
    "com.vivo.browser": "vivo 浏览器",
    "com.android.browser": "浏览器",
    "com.vivo.space": "vivo 空间/云服务",
    "com.bbk.cloud": "vivo 云服务",
    "com.bbk.appstore": "应用商店",
    "com.vivo.game": "游戏中心",
    "com.vivo.vivokaraoke": "K歌",
    "com.vivo.magazine": "杂志锁屏",
    "com.vivo.simpleweather": "天气",
    "com.vivo.weather": "天气",
    "com.vivo.weather.provider": "天气服务",
    "com.vivo.dream.weather": "天气(情景)",
    "com.vivo.simpleclock": "闹钟时钟",
    "com.android.BBKClock": "时钟",
    "com.vivo.dream.clock": "时钟(情景)",
    "com.vivo.doubletimezoneclock": "双时区时钟",
    "com.vivo.smartmultiwindow": "分屏",
    "com.vivo.doubleinstance": "应用分身",
    "com.vivo.smartshot": "超级截屏",
    "com.vivo.compass": "指南针",
    "com.vivo.collage": "拼图",
    "com.vivo.quickpay": "快捷支付",
    "com.vivo.Tips": "使用技巧",
    "com.vivo.ewarranty": "电子保修卡",
    "com.vivo.findphone": "手机寻回",
    "com.vivo.msgpush": "消息推送",
    "com.vivo.appfilter": "应用过滤/拦截",
    "com.vivo.securedaemonservice": "安全守护",
    "com.bbk.iqoo.logsystem": "日志系统",
    "com.android.bbklog": "系统日志",
    "com.android.notes": "便签",
    "com.vivo.magic.note": "便签",
    "com.vivo.dream.note": "便签(情景)",
    "com.bbk.calendar": "日历",
    "com.vivo.widget.calendar": "日历组件",
    "com.android.providers.calendar": "日历存储",
    "com.android.email": "邮件",
    "com.android.filemanager": "文件管理",
    "com.android.VideoPlayer": "视频播放器",
    "com.android.bbkmusic": "i音乐",
    "com.vivo.simplemusic": "音乐",
    "com.vivo.dream.music": "音乐(情景)",
    "com.android.photoeditor": "照片编辑",
    "com.iqoo.secure": "i管家",
    "com.iqoo.powersaving": "省电管理",
    "com.bbk.updater": "系统更新",
    "com.mobiletools.systemhelper": "系统助手",
    "com.chaozh.iReader": "掌阅",
    "com.baidu.input_bbk.service": "百度输入法",
    "com.baidu.map.location": "百度定位SDK",
    "com.baidu.duersdk.opensdk": "百度语音SDK",
    "com.iflytek.speechsuite": "讯飞语音",
    "com.ibimuyu.lockscreen": "锁屏画报",
    "com.vlife.vivo.wallpaper": "壁纸",
    "com.bbk.theme": "i主题",
    "com.bbk.theme.resources": "主题资源",
    "com.ringclip": "铃声剪辑",
    "com.svox.pico": "TTS 语音",
    "com.dsi.ant.server": "ANT+ 服务",
    "com.google.android.gsf": "Google 服务框架",
    "com.google.android.gsf.login": "Google 登录",
    "com.google.android.syncadapters.contacts": "Google 联系人同步",
    "com.vivo.audiofx": "音效",
    "com.vivo.networkimprove": "网络优化",
    "com.vivo.networkstate": "网络状态",
    "com.vivo.dream.weather": "天气(情景)",
    "com.vivo.motionrecognition": "动作识别",
    "com.vivo.setupwizard": "开机向导",
    "com.iqoo.engineermode": "工程模式",
}


def adb(serial, *args, timeout=30):
    cmd = [ADB] + (["-s", serial] if serial else []) + list(args)
    try:
        p = subprocess.run(cmd, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=timeout)
        return (p.stdout or "") + (p.stderr or "")
    except FileNotFoundError:
        return "__ADB_NOT_FOUND__"
    except subprocess.TimeoutExpired:
        return "__TIMEOUT__"


def list_devices():
    out = adb(None, "devices", "-l")
    if out.startswith("__"):
        return []
    devs = []
    for line in out.splitlines():
        line = line.strip()
        if not line or line.startswith("List of") or line.startswith("*"):
            continue
        parts = line.split()
        if len(parts) >= 2 and parts[1] == "device":
            model = ""
            for t in parts[2:]:
                if t.startswith("model:"):
                    model = t[6:].replace("_", " ")
            devs.append({"serial": parts[0], "model": model})
    return devs


def list_packages(serial):
    out = adb(serial, "shell", "pm list packages -f", timeout=60)
    pkgs = {}
    for line in out.splitlines():
        line = line.strip()
        if not line.startswith("package:") or "=" not in line:
            continue
        path, name = line[len("package:"):].rsplit("=", 1)
        pkgs[name] = {
            "path": path,
            "system": path.startswith(("/system", "/vendor", "/oem", "/app")),
            "mem": 0,
            "disabled": False,
        }

    dis = adb(serial, "shell", "pm list packages -d")
    for line in dis.splitlines():
        if line.strip().startswith("package:"):
            n = line.strip()[8:]
            if n in pkgs:
                pkgs[n]["disabled"] = True

    # 只解析第一张 "Total PSS by process" 表，遇非匹配行即结束，避免重复累加
    mi = adb(serial, "shell", "dumpsys meminfo", timeout=90)
    started = False
    for line in mi.splitlines():
        if not started:
            if line.strip().startswith("Total PSS by process"):
                started = True
            continue
        if not line.strip():
            continue
        m = re.match(r"\s*(\d+)\s+kB:\s+(\S+)", line)
        if not m:
            break
        kb = int(m.group(1))
        base = m.group(2).split(":")[0]
        if base in pkgs:
            pkgs[base]["mem"] += kb

    result = []
    for name, info in pkgs.items():
        prot = name in PROTECTED or any(name.startswith(p) for p in PROTECTED_PREFIX)
        result.append({
            "pkg": name,
            "label": LABELS.get(name, ""),
            "path": info["path"],
            "system": info["system"],
            "memKb": info["mem"],
            "disabled": info["disabled"],
            "protected": prot,
        })
    result.sort(key=lambda x: (-x["memKb"], x["pkg"]))
    return result


def uninstall(serial, packages):
    results = []
    for pkg in packages:
        if pkg in PROTECTED or any(pkg.startswith(p) for p in PROTECTED_PREFIX):
            results.append({"pkg": pkg, "ok": False, "msg": "核心包禁止操作"})
            continue
        out = adb(serial, "uninstall", "--user", "0", pkg, timeout=120).strip()
        lines = [l for l in out.splitlines() if l.strip()]
        msg = lines[-1] if lines else ""
        results.append({"pkg": pkg, "ok": msg.endswith("Success"), "msg": msg})
    return results


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path in ("/", "/index.html"):
            try:
                with open(PANEL, "rb") as f:
                    self._send(200, f.read(), "text/html; charset=utf-8")
            except FileNotFoundError:
                self._send(500, "panel html missing", "text/plain; charset=utf-8")
        elif u.path == "/api/devices":
            self._send(200, json.dumps(list_devices(), ensure_ascii=False))
        elif u.path == "/api/packages":
            q = parse_qs(u.query)
            serial = (q.get("serial") or [""])[0]
            self._send(200, json.dumps(list_packages(serial), ensure_ascii=False))
        else:
            self._send(404, "{}")

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != "/api/uninstall":
            self._send(404, "{}")
            return
        n = int(self.headers.get("Content-Length") or 0)
        try:
            payload = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
        except Exception:
            self._send(400, json.dumps({"error": "bad json"}))
            return
        serial = payload.get("serial", "")
        pkgs = payload.get("packages") or []
        if not serial or not pkgs:
            self._send(400, json.dumps({"error": "missing serial/packages"}))
            return
        self._send(200, json.dumps(uninstall(serial, pkgs), ensure_ascii=False))


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = "http://127.0.0.1:%d/" % PORT
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    print("卸载器已启动: " + url)
    print("关闭此窗口即停止服务")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
