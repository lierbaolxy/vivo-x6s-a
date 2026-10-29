# vivo-x6s-a

vivo X6s A（Android 5.1.1 / SDK 22 / 1080×1920，不可 root、不可升级）上的自动化脚本集：
**PC 端 HTTP 服务端 + 手机端 Auto.js 无障碍滚动脚本**，实现远程控制快手极速版自动上滑（含互动、诊断、免 root 卸载系统应用等配套工具）。

> 核心思路：不用坐标滑动，只用无障碍 `scrollForward/scrollBackward` 整屏翻页 —— Android 4.1+ 通用，
> 不需要 Android 7.0 才有的 `dispatchGesture`，因此在 5.1/6.0 这类老机型上依然可用。

---

## 一、极简三步（只想跑起来就看这段）

| 步骤 | 在哪 | 做什么 |
|---|---|---|
| 1 | PC | 下载/拷贝这两个文件到**同一个目录**：`phone_ctl_server.py`、`ctl.bat`（手机端脚本 `remote_ctl_kuaishou_v3_20261029.js` 也放这个目录，服务端会自动提供下载） |
| 2 | PC | 在该目录双击/执行 `ctl.bat start`，记下输出里的 `PC   地址 : http://<IP>:8000` 那一行 |
| 3 | 手机 | 装 **Auto.js 4.1.1（armeabi-v7a）** → 打开无障碍服务 → 手机浏览器打开 `http://<上一步的IP>:8000/files/remote_ctl_kuaishou_v3_20261029.js` 下载 → 用 Auto.js 运行该脚本 → 切到快手极速版视频页 |

验收：PC 上 `ctl.bat status`，日志出现 `成功:ViewPager(...) 校验=已换页` 即正常。
停止：`ctl.bat stop`（或手机按音量减）。

> 脚本第 24 行是唯一需要改的地方：`var PC = "http://172.20.36.178:8000";` 必须等于 PC 当前局域网 IP；
> IP 变了就 `ctl.bat status` 看「手机脚本需填」那一行，原样替换。

**需要准备但不在本仓库里的东西**：Auto.js 4.1.1 的 APK（`AutoJs-4.1.1-armeabi-v7a-release.apk`，6.x 版本要求 Android 7+，不要用）。

---

## 二、PC 端跑什么 / 手机端跑什么

| 端 | 文件 | 作用 |
|---|---|---|
| **PC** | `phone_ctl_server.py` | HTTP 服务端（默认 8000），提供指令队列、自动上滑线程、回报日志、`/files/` 脚本下载 |
| **PC** | `ctl.bat` | 唯一入口：`start/stop/status`，路径自动取脚本目录，杀进程按端口判定 |
| **PC** | `phone_ack.log` | 手机回报日志（排查问题看这个，自动生成） |
| **手机** | `remote_ctl_kuaishou_v3_20261029.js` | 主脚本（v3.1）：每 500ms 向 PC 拉指令 → 无障碍滚动执行 → POST 回报 |
| 手机（可选） | `remote_ctl_kuaishou_v2_20261023.html`、`remote_ctl_x6sa_20261023.html` | 旧版控制台网页（现用 `ctl.bat` 替代） |

连接方向是 **手机 → PC**（手机脚本里填 PC 的 IP），所以手机 IP 变了不用管，PC IP 变了才要改脚本。

多机并行：每台手机用独立端口 + 独立入口，例如第二台用 `ctl_5g.bat`（8001）、脚本 `remote_ctl_5g_20261023.js`，互不抢指令。

---

## 三、图文帖只左右翻图、不上滑（v3.1 修复说明，2026-10-29）

**现象**：刷到快手极速版的图文帖（多张图片）时，脚本只把图片左右翻，不切下一个帖子；日志还显示"成功"，实际没换页。

**根因**：外层竖向信息流容器和帖子内部的图片轮播（ViewPager）**都是"全屏 + scrollable"**。
旧逻辑按面积/深度挑第一个可滚动节点，命中轮播后就在轮播上 `scrollForward` → 左右翻图；翻图确实产生了变化，于是误判为"滑动成功"，外层信息流永远轮不到。

**修复（`remote_ctl_kuaishou_v3_20261029.js`）**：

1. **候选排序**：信息流标记（点赞/评论/分享等文字）→ 竖向类名（RecyclerView/ListView 等）→ 深度，优先选外层竖向容器；
2. **排除横向容器**：`HorizontalScrollView`、内层 ViewPager 一律跳过，ViewPager 只保留排序最优的一个；
3. **滑动后页面指纹校验**：对比作者名/点赞数/评论文本，内容没变判为"未换页"，继续尝试下一个候选；
4. **兜底**：整屏找不到有效竖向候选时回报 `失败:无有效竖向滚动`，不再无限翻图；
5. v3.1.1 顺带修了：无障碍服务被系统断开后 `currentPackage()` 抛异常会导致脚本静默退出，现已兜住。

**怎么确认已修复**：`ctl.bat status` 看回报，正常是
`成功:ViewPager(1080x1848,sb=true,d=5,...) 第1次/共57节点 校验=已换页`；
图文帖上应变成 `校验=已换页`（换了帖子），而不是反复"成功"却停在原地。
诊断指令 `/set?cmd=cand` 可打印当前候选排序（类名/深度/方向/是否含信息流标记）。

**影响面**：快手极速版图文帖；同结构的抖音图文帖同理。代价是每条指令多一次指纹比对（约几十毫秒）。

---

## 四、这套滑动方式怎么复用到其它手机

**可以复用的部分**：`scrollForward` 候选排序 + 横向容器排除 + 页面指纹校验，与分辨率、机型、坐标完全无关。

| 项目 | 要求 / 说明 |
|---|---|
| 系统版本 | **Android 4.1+**，能打开无障碍服务即可；**不需要** Android 7+ 的 `dispatchGesture`（这正是老机型能跑的原因） |
| Auto.js 版本 | Android 5.x / 6.x 用 **4.1.1（armeabi-v7a）**；Android 7+ 可用 4.1.1 或 AutoJs6 |
| 必须改 | 脚本里的 `var PC = "http://<PC_IP>:<端口>"`（端口多机并行时区分） |
| 不用改 | 分辨率、坐标、滑动时长 —— 只用整屏翻页语义，无坐标依赖 |
| 可能要改 | `SEEDS`（定位窗口根用的种子文字，如「我/首页/精选」），目标 App 若一个都没有，加一个该 App 首页必现的文字即可 |
| 可能需要改 | 目标 App 若用**横向 RecyclerView** 承载信息流（少见），把它的类名加进横向排除列表 |
| 仍然做不到 | 任意坐标滑动、长按、指定滑动时长（要这些只能走 ADB `input swipe`，且每次手机重启需重做 `adb tcpip 5555`） |
| 风险 | 无障碍服务被杀/被系统回收后脚本会停摆（不崩，但需重开）；Auto.js 必须加电池白名单 + 后台锁定，并设「自动锁屏=永不」 |

换机型的最小改动清单：① 装对应架构的 Auto.js；② 改 `var PC`；③ 若找不到种子文字补一个 `SEEDS`；④ 用 `/set?cmd=scan`、`/set?cmd=dump`、`/set?cmd=cand` 三条诊断指令确认候选排序是否符合预期。

---

## 五、其它可用脚本

| 文件 | 用途 |
|---|---|
| `as65_android5.py` | 纯 ADB 方案：每 3~10 秒随机 `input swipe` 一次（最稳，但每次重启要 `adb tcpip 5555`） |
| `douyin_bot.ps1` | ADB 滑动 + 点赞/收藏/评论组合（`.\douyin_bot.ps1 123`） |
| `douyin_bot_auto_screen.js` / `douyin_ad_coin_20261027.js` | Auto.js 端互动脚本（需 Android 7+） |
| `step1_sdk_check_20260917.js`、`swipe_10s*`、`probe*_scroll_20260917.js` | 机型能力探测：SDK_INT、手势是否可用、无障碍是否可滚 |
| `uninstaller_server.py` + `uninstaller_panel.html` + `启动卸载器.bat` | 免 root 卸载系统应用面板（`uninstall --user 0`，不可逆） |
| `list_apps_v2_20261026.html`、`mtp_*.ps1`、`install.sh` | 应用清单、MTP 传输、安装辅助 |
| `手机遥控SOP.md` | 完整 SOP：设备信息、手动指令、故障排查、已确认走不通的方案 |

---

## 六、前置条件

1. PC 装 Python（`phone_ctl_server.py` 仅用标准库）与 Auto.js 手机端
2. 手机开「开发者选项 → USB 调试」（ADB 方案需要；纯无障碍方案不需要）
3. 手机与 PC 在**同一 Wi-Fi**
4. Windows 防火墙放行 8000（或所用端口）入站

### 无线 ADB（仅 ADB 方案需要）

```powershell
adb devices                    # 看到 f20eb4fc  device
adb -s f20eb4fc tcpip 5555     # 开一次无线端口，之后可拔线
adb connect 172.20.32.85:5555
adb -s 172.20.32.85:5555 shell getprop ro.product.model
```

> 手机重启后无线端口失效，需再插线执行一次 `adb tcpip 5555`。

---

## 七、常见问题

| 现象 | 原因 / 解决 |
|---|---|
| `失败:无候选节点` | Auto.js 4.1.1 在该机的 `classNameMatches(".*")` 选择器失效 → 用 v3（`parent()` 上溯 + `child(i)` 遍历） |
| 单条指令要 10~30 秒 | 每条都重扫无障碍树 → v3 已加 5 秒缓存 |
| 回报中文乱码 | Auto.js 4.1.1 `http.post` 按字符拆包 → 服务端已还原 |
| `ctl.bat` 报 `'0' 不是内部或外部命令` | 批处理需 CRLF + GBK，文件头 `chcp 936` |
| 手机失联、日志只有 hb | 手机睡了 / Auto.js 被杀 / 网络变了 → 检查「自动锁屏=永不」、电池白名单、`ctl.bat status` |
| 端口通了但无回报 | Windows 防火墙拦端口，放行入站 |
| `失败:取树失败 种子=null` | 当前页面没有任何种子文字，停在视频页再发指令 |

---

## 八、环境备注（本机）

- Git 安装在 `G:\Program Files\Git`，`gh` 在 `G:\Program Files\gh`
- 本机 `HOME` 被 Cadence 改成 `d:\Cadence\Spb_data`，git 自带 ssh 会找不到密钥，
  已配置 `git config --global core.sshCommand` 指向 `C:/Users/20808/.ssh/id_ed25519`
- 远程仓库：`git@github.com:lierbaolxy/vivo-x6s-a.git`
