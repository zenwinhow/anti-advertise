# 节点 IP 质量检测

用于对齐 [IP.Check.Place](https://ip.check.place/) 口径检测节点/策略出口 IP 的类型、风险以及流媒体和 AI 服务的可用性，支持 Loon、Egern 和 Surge。

## 功能概览

| 类型 | 匹配目标 | 处理方式 |
| --- | --- | --- |
| IP 与地区 | `api.ipify.org`、`ip-api.com`、`api.ipapi.is` | 交叉核对 IP、国家、城市、ASN、组织、时区 |
| IP 类型 | `ip-api.com`、`ipapi.is` 字段 | 归纳为普通 / 移动 / 数据中心 / 住宅代理 / Anycast |
| 风险标记 | `ip-api.com`、`ipapi.is` 字段 | 归纳为 Tor / Proxy / VPN / Abuser / Crawler |
| 流媒体解锁 | `www.netflix.com`、`www.disneyplus.com`、`www.youtube.com/premium` | 页面正则识别不可用与地区代码 |
| AI 服务解锁 | `chat.openai.com/cdn-cgi/trace`、`gemini.google.com` | 状态码与页面文本识别不可用 |

Loon 版沿用上游插件 [MaYIHEI/paperclip](https://github.com/MaYIHEI/paperclip/tree/main/loon/ipquality) 的完整脚本，字段更全，参考 [xykt/IPQuality](https://github.com/xykt/IPQuality) 口径。Surge 与 Egern 版是本仓库独立实现的简化版本，展示信息一致。

## 客户端支持与差异

| 客户端 | 触发方式 | 检测对象 | 说明 |
| --- | --- | --- | --- |
| Loon | 节点/策略组页面 → 手动执行 | 单击的目标节点 | 上游脚本；`$environment.params.node` 可拿到用户选择的节点。 |
| Surge | 策略选择页 → 下拉刷新 Information Panel | 模块参数 `policy` 指向策略当前生效的节点 | Surge `generic` 脚本没有「用户选中节点」入参，改用 `$httpClient` 的 `policy` 参数经指定策略发起检测。 |
| Egern | iOS 主屏小组件刷新 / 长按运行 | 模块 `IPQ_POLICY` 指向策略当前生效的节点 | Egern `generic` 脚本用于渲染 iOS Widget；`ctx.http` 的 `policy` 参数经指定策略发起检测。 |

Surge 与 Egern 由于宿主 API 不提供「用户选中节点」入参，只能反映**当前生效的**策略节点；如需检测同一策略组内其他节点，需要先在策略组里切换节点，再刷新面板/小组件。

## 检测项与展示口径

| 分区 | 内容 | 数据来源 |
| --- | --- | --- |
| 基础信息 | IP、国旗、国家/地区、城市、时区、ASN、组织 | 优先使用 `ip-api.com`，缺失字段由 `ipapi.is` 与 `ipify` 补齐 |
| 类型属性 | 移动、数据中心、住宅代理、Anycast，均不命中则显示"普通" | `ip-api.com` 的 `mobile/hosting` 与 `ipapi.is` 的 `is_datacenter/is_mobile/is_anycast/traits.is_residential_proxy` |
| 风险标记 | Tor、Proxy、VPN、Abuser、Crawler；按最高等级决定卡片色 | `ipapi.is` 的 `is_tor/is_proxy/is_vpn/is_abuser/is_crawler` 与 `ip-api.com` 的 `proxy` |
| 流媒体与 AI | `✓` 支持、`✗` 不支持或被拦、`?` 检测失败；括号内为地区或补充信息 | 各服务网页正则识别 |

Surge 面板颜色由最高风险等级决定：`good`（无命中）→ `info`（轻度）→ `alert`（中/高度）。Egern Widget 背景色同样按风险切换：深绿 → 深黄 → 深红。字段缺失时对应行省略或标记为 `?`，不参与整体判断。

## 文件

- `loon.plugin`：Loon 插件，直接引用上游 `ipquality.js`。
- `surge.sgmodule`：Surge 模块，声明 Information Panel 与 generic 脚本。
- `egern.yaml`：Egern 模块，声明 iOS Widget 与 generic 脚本。
- `scripts/surge-panel.js`：Surge Panel 检测脚本，本仓库维护。
- `scripts/egern-widget.js`：Egern Widget 检测脚本，本仓库维护。

## MITM 要求

三个客户端下都不需要 MITM。脚本只发出站 HTTP 请求，不改写任何流量，不需要安装或信任额外的 CA 证书。

## Loon 安装

1. 复制 `loon.plugin` 的 GitHub Raw 地址。
2. Loon 的「插件」页面通过 URL 添加并启用。
3. 在「节点」或某个策略组内长按或选择目标节点执行「节点 IP 质量检测」。

可配置参数（`#!select` 声明）：

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `MaskIP` | `false` | 输出时对 IP 做遮罩。 |
| `MediaTest` | `true` | 是否执行流媒体/AI 可用性检测。关闭后速度更快。 |
| `MapNotification` | `false` | 是否额外推送含地图链接的通知。 |

具体输出字段以上游脚本 `ipquality.js` 的版本为准。

## Surge 安装

1. 复制 `surge.sgmodule` 的 GitHub Raw 地址。
2. Surge iOS 的「模块」页面通过 URL 添加。
3. 在参数表中把 `policy` 改为你想检测的策略或策略组名（比如 `Proxy`、`节点选择`），保存并启用模块。
4. Surge 首页 → 策略组 → 打开对应策略的选择页；顶部会出现 **节点 IP 质量** 面板，下拉刷新即触发检测。切换到另一节点后再刷新一次即可测下一个节点。

模块参数（`#!arguments`）：

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `policy` | `Proxy` | 用于检测的策略/策略组名。 |
| `media` | `true` | 是否检测 Netflix / Disney+ / YouTube Premium / ChatGPT / Gemini。 |
| `mask` | `false` | 输出时对 IP 做遮罩。 |
| `netflix_title` | `81280792` | 用于 Netflix 检测的标题 ID，默认非独占。 |
| `timeout` | `8` | 单次 HTTP 请求超时（秒，3-20）。 |

`#!arguments` 需要 Surge iOS 较新版本；无法保存参数的旧版本请手动把 `.sgmodule` 里的 `%policy%` 等占位符替换为实际值。

## Egern 安装

1. 复制 `egern.yaml` 的 GitHub Raw 地址。
2. Egern 的「工具 → 模块」通过 URL 添加。
3. 打开模块的环境变量，把 `IPQ_POLICY` 改成你想检测的策略/策略组名（比如 `Proxy`、`节点选择`），保存并启用。
4. 回到 Egern 主界面 → 小组件页，把「节点 IP 质量」小组件加入 iOS 主屏，或在 Egern 内的小组件列表长按 → 运行。刷新小组件即触发检测；切换到另一节点后再刷新一次即可测下一个节点。

模块环境变量（`env_schema`）：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `IPQ_POLICY` | `Proxy` | 用于检测的策略/策略组名。 |
| `IPQ_MEDIA` | `true` | 是否检测 Netflix / Disney+ / YouTube Premium / ChatGPT / Gemini。 |
| `IPQ_MASK` | `false` | 输出时对 IP 做遮罩。 |
| `IPQ_NETFLIX_TITLE` | `81280792` | 用于 Netflix 检测的标题 ID，默认非独占。 |
| `IPQ_TIMEOUT_MS` | `8000` | 单次 HTTP 请求超时（毫秒）。 |

小组件在 `systemSmall` 等紧凑尺寸下只显示 IP 与风险摘要；`systemMedium/Large` 展示完整信息。

## 依赖的第三方接口

Surge 与 Egern 版会访问以下第三方服务：

- `api.ipify.org`、`ip-api.com`、`api.ipapi.is`（IP 与地区数据）
- `www.netflix.com`、`www.disneyplus.com`、`www.youtube.com`（流媒体解锁）
- `chat.openai.com`、`gemini.google.com`（AI 服务）

Loon 版访问的第三方接口更多，具体以上游脚本为准。所有请求都会经模块参数指定的策略/节点发出，请在了解上游脚本行为和隐私影响后再启用。

## 已知限制

- 结果依赖第三方接口，接口返回异常时相应字段会缺失或标为 `?`。
- Surge Panel 与 Egern Widget 每次刷新只能反映**当前生效的**策略节点；同一策略组内检测其他节点需要先在策略组里切换。
- 各厂商检测端点会不定期变更，正则匹配失败时相应字段会显示为不可用或 `?`；本仓库尽量跟进但不承诺实时同步。
- Netflix 检测使用固定标题 ID，某些地区可能显示"不可用"仅代表该标题不在库中，不代表 Netflix 整体被拦截。
- 不同节点、地区、时段的检测结果可能不同，同一节点多次执行也可能有差异。
- SSL Pinning、QUIC 或代理路径异常可能导致检测请求失败。
- 仅提供参考性判断，具体业务是否可用请以实际使用为准。
