# 花小猪去广告

花小猪 App 广告域名及活动接口处理插件，支持 Loon、Egern 和 Surge。

## 文件

- `loon.plugin`：Loon 插件
- `egern.yaml`：Egern 模块
- `surge.sgmodule`：Surge 模块
- `scripts/surge-activity-mget.js`：为 Surge 返回空 JSON 对象的请求脚本

## 匹配依据

规则来自本地抓包：

- `captures/huaxiaozhu/2026-07-03-164809(1).pcap`：持续约 9.48 秒，共 1941 个数据包。
- `captures/huaxiaozhu/2026-07-08-083718.pcap`：持续约 31.13 秒，共 2934 个数据包。

流量使用 TLS 加密，抓包没有包含解密密钥，因此只能可靠读取 DNS 和 TLS SNI，不能安全确认 HTTPS 请求路径或响应字段。

抓包中出现以下专用广告端点：

| 域名 | 抓包现象 | 用途判断 |
| --- | --- | --- |
| `adtrack.hongyibo.com.cn` | 7 次 TLS ClientHello，并有持续加密数据交换 | 花小猪自有广告追踪 |
| `guanggao-prod.cn-shanghai.log.aliyuncs.com` | 旧抓包 1 次、新抓包 51 次 TLS ClientHello | 独立的广告日志项目 |
| `open-set-api.shenshiads.com` | 新抓包出现 4 个 DNS 包；未观察到可解密路径 | 第三方广告投放接口 |
| `sdk.e.qq.com` | 旧抓包 8 次、新抓包 8 次 TLS ClientHello，失败后反复重试 | 腾讯广点通广告 SDK |
| `mi.gdt.qq.com` | 旧抓包 8 次、新抓包 16 次 TLS ClientHello，失败后反复重试 | 腾讯广点通广告接口 |

域名拦截部分只使用完整域名规则，不使用域名后缀、通配符或 IP 网段。抓包中还出现 `static.hongyibo.com.cn`、`res-new.hongyibo.com.cn`、`s3-hnapuhdd-cdn.didistatic.com`、`s3-pypu.hongyibo.com.cn`、`img-ys011.didistatic.com` 等资源主机，以及若干无 SNI 的直连 IP。它们同时可能承载地图、活动页、普通图片或代理链路流量，规则不会整域或按 IP 阻断这些目标。

此外，插件加入用户补充的预防性活动接口规则：

```text
^https://res\.hongyibo\.com\.cn/os/gs/resapi/activity/mget\?_t
```

命中后返回 HTTP 200 和空 JSON 对象 `{}`。原始抓包中存在 `res.hongyibo.com.cn` 的 DNS 查询，但 TLS 正文未解密，无法从该抓包确认这条路径是否实际承载广告，因此它作为预防性规则保留。Loon 和 Egern 使用原生 `reject-dict`；Surge 使用本地请求脚本提供相同响应。

## MITM 要求

四条域名规则不需要 MITM。活动接口是 HTTPS URL 级匹配，需要在所用客户端中安装并信任 CA 证书、开启 MITM，并确保 `res.hongyibo.com.cn` 已进入 MITM 主机列表；三个模块已经包含该主机声明。

## 安装

### Loon

复制 `loon.plugin` 的 GitHub Raw 地址，在 Loon 插件页面通过 URL 添加并启用。

### Egern

复制 `egern.yaml` 的 GitHub Raw 地址，在 Egern 的“工具 → 模块”中添加并启用。

### Surge

复制 `surge.sgmodule` 的 GitHub Raw 地址，在 Surge 的模块页面通过 URL 安装并启用。

启用后彻底结束花小猪进程再重新打开。若仍显示旧广告素材，需等待或清理 App 缓存后复测。

## 已知限制

- 首次抓包只有约 9.48 秒，无法覆盖服务端后续新增或按地区下发的其他广告域名。
- 第二次抓包覆盖约 31.13 秒，但仍未解密 HTTPS 正文；只能确认域名、SNI 和连接时序，无法确认具体广告 JSON 字段。
- 活动接口规则来自用户补充，未由现有抓包或实机行为验证；若该接口同时返回正常活动内容，可能导致相关活动入口为空。
- `sdk.e.qq.com` 和 `mi.gdt.qq.com` 是多个 App 共用的广点通端点；启用插件期间，其他 App 的广点通广告也会被阻断。
- 广告请求失败后，App 可能保留空白广告位；网络层规则无法安全移除原生界面容器。
- 激励广告、广告奖励或依赖广告完成状态的活动可能无法使用。
