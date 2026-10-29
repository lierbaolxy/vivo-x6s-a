# -*- coding: utf-8 -*-
"""
手机遥控 HTTP 服务端（PC 侧）
适用：vivo X6s A (Android 5.1) + Auto.js 4.1.1 + 无障碍滚动

启动：python phone_ctl_server.py [port] [interval|rand]
      port 默认 8000；第二个参数是自动上滑间隔：
        rand（默认）= 随机 3~10 秒，也可写 10 表示固定 10 秒

接口：
  GET /set?cmd=up[&arg=xxx]   下发一条指令（覆盖尚未被取走的指令）
  GET /cmd                     手机轮询取指令（取走即清空，返回 JSON）
  GET /ack?msg=xxx             手机回报执行结果（写入 phone_ack.log）
  GET /peek                    查看当前待取指令（调试用）
  GET /auto/start[?interval=10] 启动自动上滑循环（不带参数=随机3~10秒）
  GET /auto/stop               停止自动上滑循环
  GET /auto/status             查看自动循环状态
  GET /ping                    健康检查
  GET /files/<name>            下载脚本文件（手机浏览器取脚本用）
"""
import json
import os
import random
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

ROOT = os.path.dirname(os.path.abspath(__file__))
# 回报日志文件名可由环境变量覆盖（多台手机各跑各的服务端时用来区分日志）
ACK_LOG = os.path.join(ROOT, os.environ.get("PCS_ACK_LOG", "phone_ack.log"))

STATE = {"cmd": None, "arg": "", "seq": 0}
LOCK = threading.Lock()

# 自动上滑循环状态
AUTO = {"on": False, "min": 3, "max": 10, "interval": None, "sent": 0}

# 手机最近一次连进来的真实 IP（自动记录，供状态查询）
PHONE = {"ip": None, "t": None}

# 实际监听端口（main 里赋值，供 /info 显示）
PORT_CFG = 8000


def set_cmd(cmd, arg=""):
    """下发一条指令并返回序号"""
    with LOCK:
        STATE["seq"] += 1
        STATE["cmd"] = cmd
        STATE["arg"] = arg
        return STATE["seq"]


def auto_worker():
    """后台线程：按间隔持续下发 up"""
    while True:
        time.sleep(0.3)
        if not AUTO["on"]:
            continue
        wait = AUTO["interval"] if AUTO["interval"] else random.randint(AUTO["min"], AUTO["max"])
        end = time.time() + wait
        while time.time() < end and AUTO["on"]:
            time.sleep(0.2)
        if not AUTO["on"]:
            continue
        seq = set_cmd("up", "")
        AUTO["sent"] += 1
        print("[%s] AUTO seq=%d 已下发 up（第 %d 次）" % (
            time.strftime("%H:%M:%S"), seq, AUTO["sent"]), flush=True)


def lan_ip():
    """获取本机局域网 IP（不实际发包）"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def log_ack(msg):
    line = "[%s] %s" % (time.strftime("%Y-%m-%d %H:%M:%S"), msg)
    print(line, flush=True)
    try:
        with open(ACK_LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def decode_autojoy_post(msg):
    """Auto.js 4.1.1 的 http.post 会把字符串按字符拆成 0=xx&1=xx&...，
    这里按索引顺序还原成原文，否则中文回报全是乱码"""
    if not msg.startswith("0=") or "&1=" not in msg:
        return msg
    try:
        q = parse_qs(msg, keep_blank_values=True)
        keys = sorted(q.keys(), key=lambda k: int(k))
        return "".join((q[k][0] if q[k] else "") for k in keys)
    except (ValueError, TypeError):
        return msg


class Handler(BaseHTTPRequestHandler):
    # 静默访问日志，避免每秒轮询刷屏
    def log_message(self, fmt, *args):
        pass

    def _send(self, payload, ctype="application/json; charset=utf-8", code=200, encoding="utf-8"):
        if isinstance(payload, str):
            payload = payload.encode(encoding, "replace")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        """手机侧用 POST 提交长文本（节点树 dump 等）"""
        u = urlparse(self.path)
        if u.path != "/ack":
            self._send("not found", ctype="text/plain; charset=utf-8", code=404)
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        body = self.rfile.read(length) if length > 0 else b""
        msg = body.decode("utf-8", "replace")
        msg = decode_autojoy_post(msg)
        PHONE["ip"] = self.client_address[0]
        PHONE["t"] = time.strftime("%H:%M:%S")
        log_ack(msg)
        self._send("ok", ctype="text/plain; charset=utf-8")

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        path = u.path

        # 手机取指令：取走即清空
        if path == "/cmd":
            PHONE["ip"] = self.client_address[0]
            PHONE["t"] = time.strftime("%H:%M:%S")
            with LOCK:
                data = {"seq": STATE["seq"], "cmd": STATE["cmd"], "arg": STATE["arg"]}
                STATE["cmd"] = None
                STATE["arg"] = ""
            self._send(json.dumps(data, ensure_ascii=False))
            return

        # PC 下发指令
        if path == "/set":
            cmd = (q.get("cmd") or [""])[0].strip()
            arg = (q.get("arg") or [""])[0]
            if not cmd:
                self._send(json.dumps({"ok": False, "err": "cmd 不能为空"}, ensure_ascii=False))
                return
            seq = set_cmd(cmd, arg)
            print("[%s] SET seq=%d cmd=%s arg=%s" % (
                time.strftime("%H:%M:%S"), seq, cmd, arg), flush=True)
            self._send(json.dumps({"ok": True, "seq": seq}, ensure_ascii=False))
            return

        # 自动上滑：开 / 关 / 查
        if path == "/auto/start":
            iv = (q.get("interval") or [""])[0].strip()
            AUTO["interval"] = int(iv) if iv.isdigit() and int(iv) > 0 else None
            AUTO["on"] = True
            self._send(json.dumps({"ok": True, "on": True,
                                   "interval": AUTO["interval"] or "3-10随机"},
                                  ensure_ascii=False))
            print("[%s] AUTO 启动 间隔=%s" % (
                time.strftime("%H:%M:%S"), AUTO["interval"] or "3-10随机"), flush=True)
            return

        if path == "/auto/stop":
            AUTO["on"] = False
            self._send(json.dumps({"ok": True, "on": False}, ensure_ascii=False))
            print("[%s] AUTO 停止" % time.strftime("%H:%M:%S"), flush=True)
            return

        if path == "/auto/status":
            self._send(json.dumps({"on": AUTO["on"],
                                   "interval": AUTO["interval"] or "rand",
                                   "sent": AUTO["sent"]}, ensure_ascii=False))
            return

        # 供 ctl.bat status 直接 curl 拉取最近回报（GBK 编码，适配中文控制台）
        if path == "/tail":
            try:
                n = int((q.get("n") or ["6"])[0])
            except ValueError:
                n = 6
            try:
                with open(ACK_LOG, "r", encoding="utf-8", errors="replace") as f:
                    lines = f.readlines()[-n:]
            except OSError:
                lines = []
            self._send("".join(lines), ctype="text/plain; charset=gbk", code=200,
                       encoding="gbk")
            return

        # 状态摘要（纯文本 GBK，供 ctl.bat 直接打印，无需解析）
        if path == "/info":
            pc_ip = lan_ip()
            phone = PHONE["ip"] or "尚未连接"
            seen = PHONE["t"] or "-"
            lines = [
                "PC   地址 : http://%s:%d" % (pc_ip, PORT_CFG),
                "手机最近连接: %s （%s）" % (phone, seen),
                "手机脚本需填: var PC = \"http://%s:%d\";" % (pc_ip, PORT_CFG),
            ]
            self._send("\n".join(lines) + "\n", ctype="text/plain; charset=gbk",
                       encoding="gbk")
            return

        # 手机回报
        if path == "/ack":
            msg = (q.get("msg") or [""])[0]
            log_ack(unquote(msg))
            self._send("ok", ctype="text/plain; charset=utf-8")
            return

        if path == "/peek":
            with LOCK:
                self._send(json.dumps(STATE, ensure_ascii=False))
            return

        if path == "/ping":
            self._send("pong", ctype="text/plain; charset=utf-8")
            return

        # 文件下载（仅限定本目录内、防目录穿越）
        if path.startswith("/files/"):
            name = unquote(path[len("/files/"):])
            if not name or name != os.path.basename(name) or name.startswith("."):
                self._send("bad name", ctype="text/plain; charset=utf-8", code=400)
                return
            full = os.path.join(ROOT, name)
            if not os.path.isfile(full):
                self._send("not found", ctype="text/plain; charset=utf-8", code=404)
                return
            with open(full, "rb") as f:
                data = f.read()
            print("[%s] FILE %s -> %d bytes (来自 %s)" % (
                time.strftime("%H:%M:%S"), name, len(data),
                self.client_address[0]), flush=True)
            self._send(data, ctype="application/octet-stream")
            return

        self._send("not found", ctype="text/plain; charset=utf-8", code=404)


def main():
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("端口必须是数字")
            return
    ip = lan_ip()
    global PORT_CFG
    PORT_CFG = port

    # 第二个参数：自动上滑间隔（rand / 数字 / 缺省 = rand）
    mode = sys.argv[2].strip() if len(sys.argv) > 2 else "rand"
    if mode.lower() == "rand" or mode == "":
        AUTO["interval"] = None
        mode_desc = "随机 3~10 秒"
    elif mode.isdigit() and int(mode) > 0:
        AUTO["interval"] = int(mode)
        mode_desc = "固定 %d 秒" % int(mode)
    else:
        AUTO["interval"] = None
        mode_desc = "随机 3~10 秒（参数无法识别）"
    AUTO["on"] = True
    threading.Thread(target=auto_worker, daemon=True).start()

    print("=" * 56)
    print("手机遥控服务端已启动")
    print("  本机 IP : %s" % ip)
    print("  监听端口: %d" % port)
    print("  自动上滑: 已开启，%s" % mode_desc)
    print("  指令下发: http://%s:%d/set?cmd=up" % (ip, port))
    print("  日志文件: %s" % ACK_LOG)
    print("=" * 56, flush=True)
    srv = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
        srv.server_close()


if __name__ == "__main__":
    main()
