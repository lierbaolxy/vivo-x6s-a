# vivo-x6s-a

通过无线 ADB 控制 **Android 5.1 手机** 自动刷短视频（快手极速版等）的脚本集。

适配机型：vivo X6S A（分辨率 1080x1920，安卓 5.1.1）。

> ⚠️ 安卓 5.1 没有 `dispatchGesture` 手势接口，Auto.js 等无障碍方案无法模拟滑动，
> 因此本仓库统一采用 **ADB `input swipe`** 方案——不依赖 root，5.1 ~ 11 全部可用。

---

## 前置条件

1. 电脑安装 ADB（或直接安装 Git，本仓库开发环境已装 Git 于 `D:\workspace\G盘\Git`）
2. 手机开启「开发者选项」中的 **USB 调试**
3. 手机与电脑连接**同一 Wi-Fi**（无线 ADB 使用）

### 无线 ADB 连接

安卓 5.1 必须先有线引导一次开启无线端口（之后可拔线）：

```powershell
# 1. USB 线连手机，确认设备
adb devices                    # 看到 f20eb4fc  device

# 2. 开启无线端口（这一步后即可拔线）
adb -s f20eb4fc tcpip 5555

# 3. 连接无线（手机和电脑同一 Wi-Fi）
adb connect 172.20.32.85:5555

# 4. 验证
adb -s 172.20.32.85:5555 shell getprop ro.product.model
```

> 手机**重启后**无线端口会自动失效，需重新插线执行一次 `adb tcpip 5555`。

---

## 脚本用法

### 1. `as65_android5.py` —— 每 3~10 秒随机上滑一次

最简单的"纯刷屏"脚本，间隔随机更具拟真性、抗风控。

```powershell
# 在项目目录下
python as65_android5.py
```

- 每 **3~10 秒随机** 上滑一次
- 停止：`Ctrl+C`
- 设备地址、坐标、间隔均可在文件顶部常量修改

### 2. `douyin_bot.ps1` —— 滑动 + 互动（点赞/收藏/评论）

功能更全的 PowerShell Bot，数字参数组合控制互动模式，可自动跳过直播。

```powershell
# 纯滑动，不互动
.\douyin_bot.ps1 0

# 只点赞
.\douyin_bot.ps1 1

# 点赞 + 收藏 + 评论（默认模式）
.\douyin_bot.ps1 123

# 组合示例
.\douyin_bot.ps1 12     # 点赞+收藏
.\douyin_bot.ps1 23     # 收藏+评论
.\douyin_bot.ps1 1s     # 只点赞，不滑动（末尾加 s）
```

| 参数数字 | 含义 |
|---------|------|
| `1` | 点赞 |
| `2` | 收藏 |
| `3` | 评论 |
| `s`（末尾）| 关闭自动滑动 |

> ⚠️ 脚本内 `$Device` 默认 `172.20.32.85:5555`，如需指定其他设备可在末尾传参或直接改头部默认值。

### 3. 其他 Auto.js 脚本（`*.js`）

`douyin_bot.js`、`douyin_bot -30-light.js` 等为旧版 Auto.js 脚本。
**仅适用于 Android 7+ 手机**（依赖 `dispatchGesture`），安卓 5.1 会报"需要 Android 7.0"，请忽略或仅在 7+ 设备使用。

---

## 常见问题

| 问题 | 原因 / 解决 |
|------|------------|
| `adb` 无法连接 / 设备 offline | 关掉开发者选项会断开 ADB；保持 USB 调试开启 |
| 手机重启后连接失败 | 无线端口失效，重新插线执行一次 `adb tcpip 5555`|
| 屏幕灭了滑动无效 | 先唤醒：`adb -s <设备> shell input keyevent KEYCODE_WAKEUP` |
| 提示"需要 Android 7.0" | 那是 Auto.js 脚本，安卓 5.1 无此手势接口，改用 ADB 方案 |

---

## 定位固定

本仓库另可用于将手机 GPS 定位固定到指定地点（无需 root）：

1. 开发者选项打开「允许模拟位置」
2. 安装虚拟定位 App（如 FakeTraveler / Fake GPS）
3. 在 App 中设为目标坐标（如河北怀来 `40.4153, 115.5178`），并设置后台加锁 + 电池白名单保持运行

---

## 环境备注

- **Git** 安装于 `D:\workspace\G盘\Git`
- 本机 `HOME` 环境变量被 Cadence 软件改为 `d:\Cadence\Spb_data`，故 git 命令前建议先执行：
  ```powershell
  $env:HOME="C:\Users\20808"
  ```
  或已通过 `git config --global core.sshCommand` 指定了 SSH 私钥（`C:\Users\20808\.ssh\id_ed25519`）。
- 远程仓库 `as6`：`git@github.com:lierbaolxy/as6-android5.git`