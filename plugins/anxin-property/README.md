# 安鑫物业小程序去广告

用于拦截安鑫物业微信小程序中的广告视频、封面和静态创意，支持 Loon、Egern 和 Surge。

三个客户端的实现并不完全相同：Egern 与 Surge 优先使用精确路径匹配；Surge 会强制目标连接进入 HTTP Engine；Loon 还提供域名、DoH 和 IP 网段级的激进兜底。重视兼容性时建议优先尝试 Surge 或 Egern。

## 匹配依据

经网络流量分析，广告素材来自以下微信共享素材主机：

- `wxsmw.wxs.qq.com`
- `wxsnsdy.wxs.qq.com`
- `wxsnsdythumb.wxs.qq.com`
- `wximg.wxs.qq.com`

插件识别两类稳定路径特征：

```text
/snssvpdownload/SH/reserved/ads_svp_video__
/snscosdownload/<可变目录>/reserved/<包含 0000008d00004eec 的资源名>
```

第一类用于广告视频及封面，第二类用于视频首帧、商品图和游戏推广图等静态创意。规则允许前置 CDN 目录变化，并同时限定主机、目录和资源标记，避免扩大到整个 `*.wxs.qq.com`。

安鑫物业业务接口 `wechat.zhtxcom.com` 不在拦截范围内。

## 各客户端的处理方式

| 客户端 | 策略 | 主要取舍 |
| --- | --- | --- |
| Loon | 精确 URL、四个素材域名、指定 DoH 查询和已识别 CDN 网段多层阻断 | 命中能力强，但可能影响其他微信小程序 |
| Egern | 仅处理已识别的素材主机和精确广告路径 | 影响范围较小，原生回源可能绕过处理 |
| Surge | 精确路径匹配，并用 `force-http-engine-hosts` 和 `tcp-connection` 处理原生 TCP 回源 | 对原生回源更有针对性，不整域阻断 |

微信可能先由小程序 WebKit 请求素材，再由原生网络栈对同一地址回源。只做 URL 复写时，第二条连接可能仍取得素材。Surge 因此强制四个目标主机的 443 连接进入 HTTP Engine；Loon 则使用影响范围更大的多层兜底。

### Loon 的 DoH 与 IP 兜底

微信可能通过 `dns.alidns.com` 或 `doh.pub` 自行解析素材主机，并使用缓存的 CDN IP 直接连接。Loon 配置会：

1. 将四个素材主机映射到 `0.0.0.0`。
2. 仅拦截查询这四个主机的指定 DoH 请求。
3. 拒绝已识别的素材 CDN `/24` 网段。
4. 保留域名和精确 URL 规则。

Egern 与 Surge 不拦截公共 DoH 或 CDN IP，以降低对其他页面和应用的影响。CDN 地址可能随地区和时间变化，Loon 的网段规则既可能失效，也可能误伤同一网段上的其他服务。

### Loon 规则优先级

主配置中的 `GEOIP,CN,DIRECT`、其他中国 IP 直连规则或 `FINAL` 可能先于插件网段规则生效。使用 Loon 时，请将 `loon-priority-rules.list` 的内容复制到主配置 `[Rule]` 顶部，并放在这些规则之前。该文件使用 `REJECT-DROP`，仅作为普通规则订阅时不一定具有足够优先级。

## 文件

- `loon.plugin`：Loon 激进模式插件。
- `loon-priority-rules.list`：需放在 Loon 主配置 `[Rule]` 顶部的高优先级网段规则。
- `egern.yaml`：Egern 精确路径模块。
- `surge.sgmodule`：Surge 精确路径与强制 HTTP Engine 模块。
- `scripts/`：各客户端使用的请求阶段响应脚本。

## MITM 要求

精确 HTTPS 路径处理需要安装并信任所用客户端的 CA 证书，并开启 MITM。目标主机如下：

```text
wxsmw.wxs.qq.com
wxsnsdy.wxs.qq.com
wxsnsdythumb.wxs.qq.com
wximg.wxs.qq.com
```

Loon 还会将 `dns.alidns.com` 和 `doh.pub` 加入 MITM，以匹配指定的 DoH 查询。使用 HTTPS 解密前，请了解证书信任带来的隐私和安全影响。

## 安装

### Loon

通过 GitHub Raw 地址导入并启用 `loon.plugin`，安装并信任 Loon CA 证书，然后开启 MITM。再将 `loon-priority-rules.list` 的内容复制到主配置 `[Rule]` 最前面；只导入插件可能无法覆盖更早生效的本地直连规则。

### Egern

在“工具 → 模块”中通过 GitHub Raw 地址添加并启用 `egern.yaml`，安装并信任 Egern CA 证书，然后开启 MITM。该模块不会整域拒绝微信共享素材主机。

### Surge

在模块页面通过 GitHub Raw 地址导入并启用 `surge.sgmodule`，安装并信任 Surge CA 证书，并开启 MITM、URL Rewrite 和脚本功能。模块会自动追加目标 HTTP Engine 与 MITM 主机。

安装或更新后，请彻底退出微信并重新进入小程序。旧素材仍显示时，可清理微信小程序缓存后重试。

## 已知限制

- 广告控制和元数据可能位于微信专有加密流量中；当前规则主要阻止素材下载，无法保证广告容器一并消失。
- 不应手动把整个 `*.wxs.qq.com` 配置为拒绝，否则可能影响其他微信小程序的图片、字体和媒体资源。
- Loon 会完整拒绝四个共享素材主机，并阻断部分 CDN 网段，误伤风险明显高于 Egern 和 Surge。
- CDN 主机、地址或素材路径变化后，现有规则可能失效。
- SSL Pinning、QUIC、缓存或未进入客户端 HTTP 处理链的连接可能绕过精确路径规则。
