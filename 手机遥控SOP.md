# 手机遥控滑动 · SOP / 备忘录

> 用途：让 PC 远程控制 vivo X6s A 上的快手极速版自动上滑。
> 最后验证：2026-10-23，实测单条指令往返约 1 秒，固定 10 秒与随机 3–10 秒均正常工作。

---

## 一、设备信息（固定不变）

| 项目 | 值 |
|---|---|
| 手机型号 | **vivo X6s A** |
| 系统 | **Android 5.1.1（SDK_INT=22）** |
| 分辨率 | 1080 × 1920 |
| ADB 序列号 | f20eb4fc（重连后可能变成动态 ID，如 9f5b9acc） |
| 能否 root | **不能**（Bootloader 锁定，2018-03 安全补丁阻断所有已知提权） |
| 能否升级 | **不能**（官方支持止于 5.1） |
| 现用网络 IP | 172.20.33.122（会变，不重要） |
| PC 局域网 IP | 172.20.36.178（会变，**重要**） |

---

## 二、手机上跑什么、怎么跑

### 跑的是
**Auto.js 4.1.1（armeabi-v7a）** + 脚本 **`remote_ctl_kuaishou_v3_20261029.js`**（v3.1，含图文帖修复）

- APK：`AutoJs-4.1.1-armeabi-v7a-release.apk`（必须 4.1.1，不能用 6.x：6.x 需 Android 7+）
- 脚本位置：Auto.js 脚本目录（通常 `内部存储/脚本/`），也曾放在 `内部存储/bluetooth/` 后从 Auto.js 导入
- 脚本能力：每 500ms 向 PC 拉取指令 → 用无障碍 `scrollForward/scrollBackward` 执行 → POST 回报结果

### 首次准备（只做一次）
1. 安装 Auto.js 4.1.1（vivo 需在「开发者选项」里打开 **USB 安装** 才能装 APK）
2. 打开 **设置 → 辅助功能 → AutoJs** 无障碍服务
3. 「设置 → 电池」把 AutoJs 加白名单；最近任务里锁定 AutoJs，防止被杀
4. 「设置 → 显示 → 自动锁屏」设为 **永不**（息屏后无障碍滚动会失效）
5. 把脚本导入 Auto.js（两种方式）：
   - 手机浏览器打开 `http://<PC_IP>:8000/files/remote_ctl_kuaishou_v3_20261029.js` 下载
     （前提：PC 上存在该 js 文件；若已清理，需要重新生成一份再下载）
   - 或 PC 上 `Win+R` → `fsquirt` 蓝牙发送（vivo X6S A 已配对）
6. 检查脚本第一段配置：`var PC = "http://172.20.36.178:8000";` 必须是 **PC 当前 IP**

### 每次使用
1. 手机打开 Auto.js → 点脚本 → 运行，看到 toast **「v3 已启动」**
2. 切到 **快手极速版**，停在视频页
3. PC 上执行 `ctl.bat start`（见下）
4. 停止：PC 上 `ctl.bat stop`；或手机按 **音量减键**；或下发 `cmd=stop`

> 注意：不要同时运行 v1/v2/v3 两个脚本，会互相抢指令。

---

## 三、PC 上跑什么

| 文件 | 作用 |
|---|---|
| `phone_ctl_server.py` | HTTP 服务端，**自动上滑循环在内置后台线程里** |
| `ctl.bat` | 唯一入口，负责启停与查看状态（路径自动取脚本目录） |
| `phone_ack.log` | 手机回报日志，排查问题看这个 |

### 常用命令
```bat
ctl.bat start                     随机 3~10 秒自动上滑
ctl.bat start 10                  固定 10 秒
ctl.bat start 10 172.20.33.122    固定 10 秒 + 启动前 ping 手机
ctl.bat start 172.20.33.122       只给手机 IP（间隔默认随机）
ctl.bat stop                      停止服务端（自动上滑随之停止）
ctl.bat status                    看 PC 地址 / 手机最近 IP / 回报
```
在该目录下双击 `ctl.bat` 或 `.\ctl.bat start` 均可。

### 正常状态长这样
```
[server] 已启动，端口 8000
[auto]   已开启，随机间隔 3~10 秒
[phone]  在线
PC   地址 : http://172.20.36.178:8000
手机最近连接: 172.20.33.122 （13:50:32）
手机脚本需填: var PC = "http://172.20.36.178:8000";
```
日志里应持续出现：
```
seq=12 cmd=up => 成功:ViewPager(1080x1848,sb=true,d=5,unknown) 第1次/共57节点 校验=已换页
```

---

## 四、手动指令（调试用）

| 地址 | 作用 |
|---|---|
| `/set?cmd=up` | 上滑一次（下一个视频） |
| `/set?cmd=up&arg=5` | 连滑 5 次（上限 10） |
| `/set?cmd=down` | 下滑回上一个 |
| `/set?cmd=tap&arg=关注` | 按文字/描述点击（中文要 URL 编码） |
| `/set?cmd=back` / `home` / `recents` | 系统按键 |
| `/set?cmd=status` | 前台包名 / 分辨率 / 节点数 |
| `/set?cmd=scan` / `dump` | 诊断：节点总数 / 前 60 节点结构 |
| `/set?cmd=cand` | 诊断：当前竖向滚动候选排序（类名/深度/方向/是否含信息流标记） |
| `/set?cmd=stop` | 停手机脚本 |
| `/auto/start?interval=10` / `/auto/stop` / `/info` | 自动循环开关、状态摘要 |

PowerShell 写法：
```powershell
Invoke-WebRequest "http://127.0.0.1:8000/set?cmd=up" -UseBasicParsing | Out-Null
```

---

## 五、换网络 / IP 变化怎么办

连接方向是 **手机 → PC**，所以：
- **手机 IP 变了** → 不用管，只要还在同一 Wi-Fi 网段
- **PC IP 变了** → 手机脚本里的 `var PC = "http://..."` 必须改

改法：`ctl.bat status`，把输出里「手机脚本需填」那一行原样替换进手机脚本，保存后重新运行脚本。

换 Wi-Fi 后先看：
```bat
ctl.bat start 172.20.33.122
```
`[phone] 不可达` = 不在同一网段（手机用了 4G 或别的 Wi-Fi），此时无解，需回到同一局域网。

---

## 六、故障排查（按真实现象查）

| 现象 | 原因 | 处理 |
|---|---|---|
| `失败:无候选节点` | Auto.js 4.1.1 的 `classNameMatches(".*").find()` 在该机恒返回 0（选择器失效，不是树为空） | 已用 v3 规避：`parent()` 上溯 + `child(i)` 广度遍历；若用旧脚本会重现 |
| 单条指令耗时 10~30 秒 | 每条指令都重扫整棵无障碍树 | v3 已加 5 秒缓存；仍慢就把缓存调大 |
| `tap` 返回 `失败:点击(节点存在但click=false)` | 节点不可点击 | 换 `desc()` 匹配，或改用 `scrollForward` |
| 手机回报中文乱码（`0=%E4...&1=...`） | Auto.js 4.1.1 的 `http.post` 按字符拆包 | 服务端 `decode_autojoy_post()` 已还原 |
| `ctl.bat` 报 `'0' 不是内部或外部命令` | 批处理需 **CRLF + GBK** | 保存为 CRLF/GBK；文件头 `chcp 936` |
| `start` 卡住不返回 | 旧版用 `tasklist /v /fi "WINDOWTITLE..."` 会挂死 | 已改为「循环并入 Python 线程 + 按端口杀进程」 |
| 手机失联，日志只有 hb | 手机睡了 / Auto.js 被杀 / 网络变 | 检查自动锁屏=永不、加电池白名单、`ctl.bat status` 看手机最近 IP |
| `start` 提示「已在运行」 | 8000 端口被占用 | 先 `ctl.bat stop` |
| 端口监听但无回报 | PC 防火墙拦 8000 | Windows 防火墙放行 8000 入站 |
| `失败:取树失败 种子=null` | 当前页面没有任何可作种子的文字 | 停在视频页再发指令 |

---

## 七、已知能力边界

1. 只有 **整屏翻页** 语义（`scrollForward/scrollBackward`），**不能**自由坐标滑动、长按、指定滑动时长
2. 图文帖会左右翻图片、不上滑：v3.1 已修复（跳过横向容器，只滚竖向信息流，并用页面指纹校验是否真的换页）；若整屏都找不到竖向候选，会回报 `失败:无有效竖向滚动`，不会无限翻图
3. 只有部分 UI 有文字/描述可点，`tap` 依赖文字匹配
4. 手机脚本无法远程更新（没有 ADB），改脚本必须手动传一次

---

## 八、已确认走不通的路（别再试）

| 方案 | 结论 |
|---|---|
| **SSH（SimpleSSHD/Termux/SSHelper）** | 能登录，但 `input swipe` 需要 `INJECT_EVENTS`（signature\|shell 级），普通 App UID 执行必被拒；无 root 无解 |
| **Shizuku** | 最低 Android 6.0，无线调试需 11+，不适用 |
| **KingRoot / 一键 root** | 安全补丁 2018-03，全部失效 |
| **无线 ADB（不使用线）** | Android 5.1 无原生无线调试；`adb tcpip 5555` 必须先接一次 USB |

> 若将来需要**任意坐标滑动/长按**：插一次 USB 执行
> `adb -s f20eb4fc tcpip 5555`，拔线后即可无线 `adb shell input swipe`，
> 之后所有 App 通用，但每次手机重启需重做一次。

---

## 九、最小启动清单（背下来）

```
手机：Auto.js 跑 v3 → 切到快手极速版视频页
PC  ：ctl.bat start
验收：ctl.bat status 里出现 成功:ViewPager
停止：ctl.bat stop（或手机音量减）
```

---

## 十、第二台手机（5G）· 双机并行

两台手机各跑各的服务端、各占一个端口，互不抢指令，可以同时自动上滑。

| 项目 | X6s A | 5G 手机 |
|---|---|---|
| 端口 | **8000** | **8001** |
| PC 入口 | `ctl.bat` | `ctl_5g.bat` |
| 手机 IP | 172.20.33.122（可变） | 172.20.33.75（可变） |
| 手机端脚本 | `remote_ctl_kuaishou_v3_20261029.js` | `remote_ctl_5g_20261023.js` |
| 回报日志 | `phone_ack.log` | `phone_ack_5g.log` |

### 5G 手机信息
| 项目 | 值 |
|---|---|
| 蓝牙名 | 5G（**PC 侧未配对**，走蓝牙要先配对） |
| 界面显示版本 | 「Android 8.3」= **伪造** |
| 真实系统 | **Android 6.0（SDK_INT=23）** |
| 分辨率 | 480 × 1014 |
| 手势 swipe | 不可用（需 SDK 24） |
| 无障碍 scrollForward | **可用**（已验证能翻抖音） |
| ADB 接口 | 从不枚举，**没有 ADB 兜底** |
| MTP 传文件 | 0 字节（坏的），只能用浏览器下载/蓝牙 |

### 安装（手机端）
1. Auto.js 4.1.1 打开无障碍服务
2. 浏览器下载：`http://<PC_IP>:8001/files/remote_ctl_5g_20261023.js`
3. 导入运行，看到 toast「5G 遥控已启动」
4. 停在目标 App 视频页

### 命令（与 ctl.bat 完全一致，只是端口不同）
```bat
ctl_5g.bat start                    随机 3~10 秒
ctl_5g.bat start 10                 固定 10 秒
ctl_5g.bat status                   状态（含手机最近连接 IP）
ctl_5g.bat stop                     停止 5G 这一路
```
两条互不影响：停掉 8001 不影响 8000 继续滑。

### 脚本需填的那一行
```js
var PC = "http://172.20.36.178:8001";   // 5G 手机用 8001
var PC = "http://172.20.36.178:8000";   // X6s A  用 8000
```

### 已知限制
5G 手机没有 ADB、MTP 也坏，脚本只能靠浏览器下载或蓝牙；一旦 Auto.js 脚本丢失，需要重新传一次。
