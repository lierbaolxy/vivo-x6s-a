# -*- coding: utf-8 -*-
"""
Android 5.1 无线 ADB 自动刷屏脚本
用法: python as65_android5.py
停止: Ctrl+C

流程:
  1. 自动尝试连接无线设备
  2. 若无线端口失效(手机重启后), 自动通过 USB 打开 5555 端口
  3. 连接成功后拔掉 USB 线, 脚本通过 Wi-Fi 持续上滑
"""
import argparse
import random
import shutil
import subprocess
import sys
import time

# ------- adb 路径(PATH 里没有时回退绝对路径) -------
ADB = shutil.which("adb") or r"D:\workspace\trae\滑动\QtScrcpy-win-x64-v3.3.1\QtScrcpy-win-x64-v3.3.1\adb.exe"

# ------- 设备 -------
USB_ID = "f20eb4fc"                          # USB 连接时的设备序列号
WIFI_IP = "172.20.32.85"                     # 手机 Wi-Fi IP
DEVICE = f"{WIFI_IP}:5555"                   # 无线设备地址

# ------- 滑动参数 (1080x1920, 竖屏上滑) -------
X1, Y1 = 540, 1500    # 起点
X2, Y2 = 540, 400     # 终点
DUR = 300             # 时长(ms)

# ------- 随机间隔范围(秒) -------
INTERVAL_MIN, INTERVAL_MAX = 3, 10


def run(args, silent=True):
    """执行 adb 命令, 返回是否成功(exitcode==0)"""
    try:
        r = subprocess.run(
            [ADB] + args,
            stdout=subprocess.DEVNULL if silent else None,
            stderr=subprocess.DEVNULL if silent else None,
            check=False,
        )
        return r.returncode == 0
    except Exception:
        return False


def ensure_connected():
    """确保无线设备已连接; 失败则尝试用 USB 开启无线端口"""
    # 1. 尝试直接连无线
    if run(["connect", DEVICE]):
        # 2. 验证无线设备真的可用
        if run(["-s", DEVICE, "shell", "echo ok"]):
            print(f"[连接] 无线设备 {DEVICE} 已就绪, 可以拔 USB 线了")
            return True

    # 3. 无线连不上 -> 需要 USB 引导一次（电脑上需有设备）
    print("[连接] 无线端口失效, 尝试通过 USB 打开 5555 端口...")
    if run(["-s", USB_ID, "tcpip", "5555"]):
        time.sleep(2)
        if run(["connect", DEVICE]):
            print(f"[连接] USB 引导成功, 无线设备 {DEVICE} 已就绪, 可以拔 USB 线了")
            return True
        print("[连接] 已开启端口但仍无法无线连接, 请确认手机与电脑在同一 Wi-Fi")
    else:
        print(f"[连接] 未找到 USB 设备 {USB_ID}, 请确认数据线已插且打开了 USB 调试")
    return False


def swipe():
    run(["-s", DEVICE, "shell",
         f"input swipe {X1} {Y1} {X2} {Y2} {DUR}"])


def parse_args():
    p = argparse.ArgumentParser(description="Android 5.1 自动上滑")
    p.add_argument("--serial", default="", help="USB 设备序列号; 指定后直连该设备, 不走无线流程")
    p.add_argument("--swipe", default="", help="滑动坐标 x1,y1,x2,y2, 例: 540,950,540,250")
    p.add_argument("--interval", default="", help="间隔秒数范围 min,max, 例: 3,10")
    p.add_argument("--count", type=int, default=0, help="滑动次数, 0 表示无限")
    return p.parse_args()


def main():
    global DEVICE, X1, Y1, X2, Y2, INTERVAL_MIN, INTERVAL_MAX
    args = parse_args()

    if args.swipe:
        try:
            X1, Y1, X2, Y2 = [int(v) for v in args.swipe.split(",")]
        except ValueError:
            print("[错误] --swipe 格式应为 x1,y1,x2,y2")
            sys.exit(1)
    if args.interval:
        try:
            INTERVAL_MIN, INTERVAL_MAX = [int(v) for v in args.interval.split(",")]
        except ValueError:
            print("[错误] --interval 格式应为 min,max")
            sys.exit(1)

    if args.serial:
        DEVICE = args.serial
        if not run(["-s", DEVICE, "shell", "echo ok"]):
            print(f"[错误] 未找到设备 {DEVICE}, 请确认数据线与 USB 调试")
            sys.exit(1)
        print(f"[连接] 直连设备 {DEVICE} 已就绪")
    elif not ensure_connected():
        print("[错误] 无法连接设备, 请检查 USB 线 / USB 调试 / 同一 Wi-Fi 后重试")
        sys.exit(1)

    print(f"[开始] 随机 {INTERVAL_MIN}-{INTERVAL_MAX}s 上滑一次 (设备 {DEVICE}), "
          f"坐标 {X1},{Y1}->{X2},{Y2}, Ctrl+C 停止")
    count = 0
    try:
        while True:
            if args.count and count >= args.count:
                break
            count += 1
            swipe()
            iv = random.randint(INTERVAL_MIN, INTERVAL_MAX)
            print(f"[{count}] {time.strftime('%H:%M:%S')} 已上滑, {iv}s 后下一次", flush=True)
            if args.count and count >= args.count:
                break
            time.sleep(iv)
        print(f"[完成] 共上滑 {count} 次")
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()