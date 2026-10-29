# -*- coding: utf-8 -*-
"""Verify APK integrity, CPU ABI and min Android version."""
import os
import struct
import zipfile

APK_DIR = r"D:\workspace\trae\滑动"
FILES = [
    os.path.join(APK_DIR, "apk", "AutoJs-4.1.1-armeabi-v7a-release.apk"),
    os.path.join(APK_DIR, "apk", "AutoJS-universal.apk"),
    os.path.join(APK_DIR, "autojs6-v6.7.0-arm64-v8a-62db1ff8.apk"),
]

SDK_NAME = {21: "5.0", 22: "5.1", 23: "6.0", 24: "7.0", 25: "7.1",
            26: "8.0", 27: "8.1", 28: "9", 29: "10", 30: "11",
            31: "12", 32: "12L", 33: "13", 34: "14", 35: "15"}


def read_min_sdk(zf):
    """Read minSdkVersion from binary AndroidManifest.xml."""
    RES_ID = 0x0101020C  # android:minSdkVersion
    try:
        data = zf.read("AndroidManifest.xml")
    except KeyError:
        return None
    needle = struct.pack("<I", RES_ID)
    idx = data.find(needle)
    while idx != -1:
        if idx + 13 <= len(data):
            dtype = data[idx + 8]
            val = struct.unpack("<I", data[idx + 9:idx + 13])[0]
            if dtype in (0x10, 0x11) and 1 <= val <= 40:
                return val
        idx = data.find(needle, idx + 1)
    return None


for p in FILES:
    print("=" * 62)
    name = os.path.basename(p)
    if not os.path.exists(p):
        print("[MISSING] " + name)
        continue
    size = os.path.getsize(p)
    with open(p, "rb") as f:
        magic = f.read(4)
    print("[FILE] %s" % name)
    print("       size = %s bytes (%.1f MB)" % (format(size, ","), size / 1024 / 1024))
    print("       magic = %s %s" % (magic, "OK" if magic[:2] == b"PK" else "NOT A ZIP!"))
    try:
        with zipfile.ZipFile(p) as zf:
            bad = zf.testzip()
            print("       integrity = %s" % ("CORRUPT at " + str(bad) if bad else "OK"))
            abis = sorted({n.split("/")[1] for n in zf.namelist()
                           if n.startswith("lib/") and n.count("/") >= 2})
            print("       abi = %s" % (abis if abis else "none (pure java)"))
            ms = read_min_sdk(zf)
            if ms:
                print("       minSdk = API %d (Android %s)" % (ms, SDK_NAME.get(ms, "?")))
            else:
                print("       minSdk = (unparsed)")
    except zipfile.BadZipFile as e:
        print("       integrity = BROKEN ZIP -> %s" % e)
    except Exception as e:
        print("       error = %s" % e)