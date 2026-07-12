# 超鹿运动去广告

超鹿运动 App 运营广告位响应过滤插件，支持 Loon、Egern 和 Surge。

## 文件

- `loon.plugin`：Loon 插件
- `egern.yaml`：Egern 模块
- `surge.sgmodule`：Surge 模块
- `scripts/loon-surge-response.js`：Loon/Surge 响应过滤脚本
- `scripts/egern-response.js`：Egern 响应过滤脚本

## 匹配依据

规则来自本地 HAR 抓包 `captures/superdeer/2026-07-12-225518.har`。抓包中的广告和运营位均由 `app.chaolu.com.cn` 上的独立 API 返回，因此插件只匹配以下精确路径，不阻断整个业务域名或图片 CDN：

| 接口 | 抓包中的内容 | 处理方式 |
| --- | --- | --- |
| `/app/getSplashData/V2` | 开屏图、跳转链接和倒计时 | 清空 `splashes` |
| `/recommend/app/banner/list` | 首页顶部活动、邀新和年卡宣传 banner | 清空 `bannerList` |
| `/recommend/generalbanner/firstLevel` | 团课页推广 banner | 返回空列表 |
| `/recommend/generalbanner/personalCenterBanner` | 个人中心推广 banner | 返回空列表 |
| `/recommend/touchcard/get` | 邀新触达卡片 | 将 `data` 置空 |
| `/homepage/app/recommendModel/findRecommendModel` | 首页活动推荐组件 | 返回空列表 |
| `/homepage/app/tofu/findTofu` | 接口明确标注的左右“营销区” | 清空两侧卡片 |
| `/app/newcomerPower/banner` | 新人活动 banner | 关闭展示并清空素材 |
| `/c/exercise/banner/list` | 训练页礼包、积分等活动 banner | 返回空列表 |
| `/scheduleLesson/popup/popupStatus` | 课程页邀新弹窗 | 关闭弹窗并清空素材 |
| `/recommend/pop/popUpBottomDialog` | 底部运营弹窗状态 | 将 `show` 置为 `0` |
| `/recommend/pop/commonPush` | 通用运营弹窗列表 | 清空 `popList` |

脚本只修改已确认的展示字段，保留原响应的状态码和其他字段。JSON 解析失败或数据结构变化时会透传原响应。

## MITM 要求

这些接口均为 HTTPS 响应体过滤，需要在所用客户端中安装并信任 CA 证书、开启 MITM。插件的 MITM 清单仅包含 `app.chaolu.com.cn`。

## 安装

### Loon

复制 `loon.plugin` 的 GitHub Raw 地址，在 Loon 插件页面通过 URL 添加并启用。

### Egern

复制 `egern.yaml` 的 GitHub Raw 地址，在 Egern 的“工具 → 模块”中添加并启用。

### Surge

复制 `surge.sgmodule` 的 GitHub Raw 地址，在 Surge 的模块页面通过 URL 安装并启用。

启用后完全结束超鹿运动进程再重新打开。如果仍显示旧素材，需等待或清理 App 缓存后复测。

## 已知限制

- 规则基于一次 HAR 抓包，无法覆盖其他城市、账号状态或后续版本新增的广告位。
- 运营位中也包含挑战、礼包、积分、邀新、排行榜和使用指南等入口；启用后这些入口可能一并隐藏。
- 若 App 使用 SSL Pinning 或 QUIC 绕过 HTTP 解析，脚本可能无法命中。
- 接口字段或路径改名后需要重新抓包调整。
