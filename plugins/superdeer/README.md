# 超鹿运动去广告

用于清理超鹿运动 App 中的开屏、Banner、营销卡片和运营弹窗，支持 Loon、Egern 和 Surge。

## 功能与匹配依据

经网络流量分析，相关运营位由 `app.chaolu.com.cn` 的独立接口返回。插件仅处理下列精确路径，不阻断整个业务域名或图片 CDN。

| 接口路径 | 内容 | 处理方式 |
| --- | --- | --- |
| `/app/getSplashData/V2` | 开屏图、跳转链接和倒计时 | 清空 `splashes` |
| `/recommend/app/banner/list` | 首页顶部活动 Banner | 清空 `bannerList` |
| `/recommend/generalbanner/firstLevel` | 团课页推广 Banner | 将 `data` 设为空列表 |
| `/recommend/generalbanner/personalCenterBanner` | 个人中心推广 Banner | 将 `data` 设为空列表 |
| `/recommend/touchcard/get` | 邀新触达卡片 | 将 `data` 设为空值 |
| `/homepage/app/recommendModel/findRecommendModel` | 首页活动推荐组件 | 将 `data` 设为空列表 |
| `/homepage/app/tofu/findTofu` | 左右营销区 | 清空两侧卡片 |
| `/app/newcomerPower/banner` | 新人活动 Banner | 关闭展示并清空素材 |
| `/c/exercise/banner/list` | 训练页活动 Banner | 将 `data` 设为空列表 |
| `/scheduleLesson/popup/popupStatus` | 课程页邀新弹窗 | 关闭弹窗并清空素材 |
| `/recommend/pop/popUpBottomDialog` | 底部运营弹窗 | 将 `show` 设为 `0` |
| `/recommend/pop/commonPush` | 通用运营弹窗 | 清空 `popList` |

响应脚本保留状态码和未涉及的响应字段。响应不是有效 JSON 或数据结构不符合预期时，脚本不修改原响应。

## 文件

- `loon.plugin`：Loon 插件。
- `egern.yaml`：Egern 模块。
- `surge.sgmodule`：Surge 模块。
- `scripts/loon-surge-response.js`：Loon 与 Surge 响应过滤脚本。
- `scripts/egern-response.js`：Egern 响应过滤脚本。

## MITM 要求

所有目标接口均使用 HTTPS，响应体过滤需要安装并信任所用客户端的 CA 证书，并开启 MITM。配置仅将 `app.chaolu.com.cn` 加入 MITM 主机列表。

使用 HTTPS 解密前，请了解证书信任带来的隐私和安全影响。

## 安装

分别复制 `loon.plugin`、`egern.yaml` 或 `surge.sgmodule` 的 GitHub Raw 地址，在对应客户端的插件或模块页面通过 URL 添加并启用。

启用后完全退出超鹿运动再重新打开。旧素材仍然显示时，可清理 App 缓存后重试。

## 已知限制

- 服务端可能按地区、账号状态或 App 版本返回不同内容，未列出的广告位不会被处理。
- 部分运营位同时包含挑战、礼包、积分、邀新或使用指南，启用后相关入口可能一并隐藏。
- SSL Pinning、QUIC 或其他绕过 HTTP 处理链的连接可能导致规则无法命中。
- 接口路径或响应字段变化后，需要更新规则和脚本。
