# 花小猪去广告

花小猪 App 广告域名拦截插件，支持 Loon、Egern 和 Surge。

## 文件

- `loon.plugin`：Loon 插件
- `egern.yaml`：Egern 模块
- `surge.sgmodule`：Surge 模块

## 匹配依据

规则来自本地抓包 `captures/huaxiaozhu/2026-07-03-164809(1).pcap`。该抓包持续约 9.48 秒，共 1941 个数据包。流量使用 TLS 加密，抓包没有包含解密密钥，因此只能可靠读取 DNS 和 TLS SNI，不能安全确认 HTTPS 请求路径或响应字段。

抓包中出现以下专用广告端点：

| 域名 | 抓包现象 | 用途判断 |
| --- | --- | --- |
| `adtrack.hongyibo.com.cn` | 7 次 TLS ClientHello，并有持续加密数据交换 | 花小猪自有广告追踪 |
| `guanggao-prod.cn-shanghai.log.aliyuncs.com` | 1 次 TLS ClientHello | 独立的广告日志项目 |
| `sdk.e.qq.com` | 8 次 TLS ClientHello，失败后反复重试 | 腾讯广点通广告 SDK |
| `mi.gdt.qq.com` | 8 次 TLS ClientHello，失败后反复重试 | 腾讯广点通广告接口 |

三个客户端都只使用完整域名规则，不使用域名后缀、通配符或 IP 网段。抓包中还出现 `static.hongyibo.com.cn`、`res-new.hongyibo.com.cn`、`s3-hnapuhdd-cdn.didistatic.com` 等资源主机，但它们同时可能承载地图、活动页或普通图片，规则不会整域阻断这些共享资源。

## MITM 要求

不需要安装或信任 MITM 证书。规则在连接分流阶段按目标域名拒绝请求，不读取 HTTPS 正文。

## 安装

### Loon

复制 `loon.plugin` 的 GitHub Raw 地址，在 Loon 插件页面通过 URL 添加并启用。

### Egern

复制 `egern.yaml` 的 GitHub Raw 地址，在 Egern 的“工具 → 模块”中添加并启用。

### Surge

复制 `surge.sgmodule` 的 GitHub Raw 地址，在 Surge 的模块页面通过 URL 安装并启用。

启用后彻底结束花小猪进程再重新打开。若仍显示旧广告素材，需等待或清理 App 缓存后复测。

## 已知限制

- 抓包只有约 9.48 秒，无法覆盖服务端后续新增或按地区下发的其他广告域名。
- 由于 HTTPS 正文未解密，当前实现只能做精确域名拦截，不能只复写某个广告 API 的响应字段。
- `sdk.e.qq.com` 和 `mi.gdt.qq.com` 是多个 App 共用的广点通端点；启用插件期间，其他 App 的广点通广告也会被阻断。
- 广告请求失败后，App 可能保留空白广告位；网络层规则无法安全移除原生界面容器。
- 激励广告、广告奖励或依赖广告完成状态的活动可能无法使用。
