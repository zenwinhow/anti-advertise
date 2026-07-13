# 花小猪去广告

用于拦截花小猪 App 的部分广告端点、活动接口、首页广告卡片和广告素材，支持 Loon、Egern 和 Surge。

## 功能概览

| 类型 | 匹配目标 | 处理方式 |
| --- | --- | --- |
| 广告与追踪域名 | 5 个完整域名 | 拒绝连接 |
| 活动接口 | `res.hongyibo.com.cn`、`res-new.hongyibo.com.cn` 的指定路径 | 返回空 JSON 数据 |
| 首页 Feed | `casper-agent.hongyibo.com.cn` 的指定路径 | 删除具有广告标记或广告素材的卡片 |
| 广告素材 | `*.didistatic.com/static/ad_oss/` | 按路径拒绝图片和 GIF |

## 域名匹配依据

经网络流量分析识别出以下广告相关端点：

| 域名 | 用途 |
| --- | --- |
| `adtrack.hongyibo.com.cn` | 花小猪广告追踪 |
| `guanggao-prod.cn-shanghai.log.aliyuncs.com` | 广告日志上报 |
| `open-set-api.shenshiads.com` | 第三方广告投放接口 |
| `sdk.e.qq.com` | 腾讯广点通广告 SDK |
| `mi.gdt.qq.com` | 腾讯广点通广告接口 |

域名规则仅匹配以上完整域名，不使用域名后缀或 IP 网段。花小猪、滴滴及其 CDN 的其他主机可能同时承载地图、活动页、图片、字体或组件资源，因此不做整域阻断。

## 接口与响应处理

| 主机和路径 | 识别到的内容 | 处理方式 |
| --- | --- | --- |
| `res-new.hongyibo.com.cn/resapi/activity/mget` | 开屏与首页弹窗 | 返回成功状态和空数据对象 |
| `res-new.hongyibo.com.cn/resapi/activity/render` | 首页品牌广告位 | 返回成功状态和空数据对象 |
| `casper-agent.hongyibo.com.cn/agent/v3/feeds` | 首页 Feed 广告卡片 | 删除广告卡片，保留其他卡片 |
| `casper-agent.hongyibo.com.cn/agent/v3/preview` | 首页预览与 Banner 模板 | 使用相同的卡片过滤逻辑 |
| `*.didistatic.com/static/ad_oss/` | 广告图片和 GIF | 按广告素材路径拒绝 |

首页 Feed 脚本会识别 `is_external_commercial_ad`、模板类型中的 `external_commercial_ad`、已知广告卡片 ID，以及包含 `/static/ad_oss/` 的素材。共享资源主机若不包含该广告路径，则不会被素材规则阻断。

插件还包含以下兼容性规则：

```text
^https://res\.hongyibo\.com\.cn/os/gs/resapi/activity/mget\?_t
```

该接口命中后返回 HTTP 200 和空 JSON 对象 `{}`。它属于预防性规则，无法保证接口只承载广告；如果同时承载正常活动内容，相关入口也可能变为空白。

## 文件

- `loon.plugin`：Loon 插件。
- `egern.yaml`：Egern 模块。
- `surge.sgmodule`：Surge 模块。
- `scripts/loon-surge-feed-filter.js`：Loon 与 Surge 首页 Feed 过滤脚本。
- `scripts/egern-feed-filter.js`：Egern 首页 Feed 过滤脚本。
- `scripts/surge-activity-mget.js`：Surge 兼容性活动接口脚本。
- `scripts/surge-activity-empty.js`：Surge `res-new` 活动接口脚本。

## MITM 要求

五条完整域名拒绝规则不需要 MITM。活动接口、素材 URL 和首页响应体处理需要安装并信任客户端 CA 证书，并开启 MITM。

配置中的 MITM 主机范围大于实际改写目标，用于让相关业务连接进入客户端 HTTP 处理链；这些附加主机不会因为出现在 MITM 列表中而自动被拒绝。Surge 模块还会把同一组主机追加到 `force-http-engine-hosts`。

使用 HTTPS 解密前，请检查配置中的主机清单，并了解证书信任带来的隐私和安全影响。

## 安装

分别复制 `loon.plugin`、`egern.yaml` 或 `surge.sgmodule` 的 GitHub Raw 地址，在对应客户端的插件或模块页面通过 URL 添加并启用。

启用后完全退出花小猪再重新打开。旧广告素材仍然显示时，可清理 App 缓存后重试。

## 已知限制

- 服务端可能按地区、账号状态或版本下发不同广告，未识别的域名、路径和字段不会被处理。
- 预防性活动接口和 `res-new` 接口可能同时承载正常运营内容，相关活动入口可能被隐藏。
- 首页脚本依赖当前广告标记、卡片 ID 和素材路径；结构变化后需要更新过滤逻辑。
- `sdk.e.qq.com` 和 `mi.gdt.qq.com` 为多个 App 共用，启用期间其他 App 的广点通广告也可能被阻断。
- 网络层规则可能只移除素材，无法收起 App 原生广告容器，因此界面中可能留下空白区域。
- 激励广告及依赖广告完成状态的奖励或活动可能无法使用。
- SSL Pinning、QUIC 或其他绕过 HTTP 处理链的连接可能导致 URL 和响应脚本无法命中。
