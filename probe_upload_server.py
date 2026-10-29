# -*- coding: utf-8 -*-
"""局域网小服务（8099）：分发脚本 + 接收手机回传的应用清单
  GET  /        手机浏览器打开，显示下载入口
  GET  /dl      下载 list_apps 脚本（强制按附件下载）
  GET  /result  查看已收到的清单
  POST /upload  接收清单文本 -> app_list.txt
"""
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

BASE = r"d:\workspace\trae\滑动"
SCRIPT = os.path.join(BASE, "list_apps_v2_20261026.js")
OUT = os.path.join(BASE, "app_list.txt")

SEG = {}  # 分段上报缓存 {段号: 文本}

PAGE = """<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>应用清单采集</title>
<style>
body{font:16px/1.7 sans-serif;padding:24px;background:#111;color:#eee}
a{display:block;padding:16px;margin:12px 0;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;text-align:center}
p{color:#aaa}
</style>
<h2>应用清单采集</h2>
<a href="/dl">1. 下载 list_apps_20260918.js</a>
<p>下载后点开 → 选择用 Auto.js 运行。</p>
<p>跑完会自动回传到这台电脑，无需其他操作。</p>
<p>退出脚本：音量减键。</p>
"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, body, ctype, extra=None):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or []):
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query, keep_blank_values=True)

        # 分段上报（Auto.js 的 http.post 不可用时的兜底通道）
        if u.path == "/put":
            try:
                i = int((q.get("i") or ["0"])[0])
                t = int((q.get("t") or ["1"])[0])
            except ValueError:
                self._send("bad", "text/plain; charset=utf-8")
                return
            SEG[i] = (q.get("d") or [""])[0]
            if len(SEG) >= t:
                text = "".join(SEG[k] for k in sorted(SEG))
                with open(OUT, "w", encoding="utf-8") as f:
                    f.write(text)
                SEG.clear()
                print("分段上报完成 %d 段 %d 字" % (t, len(text)), flush=True)
            self._send("ok", "text/plain; charset=utf-8")
            return

        # 脚本下载：强制附件，避免浏览器直接显示源码
        if self.path.startswith("/dl"):
            try:
                with open(SCRIPT, "rb") as f:
                    data = f.read()
            except OSError:
                self._send("script missing", "text/plain; charset=utf-8")
                return
            self._send(data, "application/octet-stream",
                       [("Content-Disposition", 'attachment; filename="list_apps_v2_20261026.js"')])
            return
        # 查看已收到的清单
        if self.path.startswith("/result"):
            try:
                with open(OUT, "rb") as f:
                    data = f.read()
            except OSError:
                data = b"(not received yet)"
            self._send(data, "text/plain; charset=utf-8")
            return
        self._send(PAGE, "text/html; charset=utf-8")

    def do_POST(self):
        """手机回传的清单文本"""
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        data = self.rfile.read(n) if n > 0 else b""
        with open(OUT, "wb") as f:
            f.write(data)
        print("收到清单 %d 字节" % n, flush=True)
        self._send("ok", "text/plain; charset=utf-8")


HTTPServer(("0.0.0.0", 8099), Handler).serve_forever()
