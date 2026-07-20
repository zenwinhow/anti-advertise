# 安鑫物业小程序去广告与外跳防护

用于拦截安鑫物业微信小程序中的广告视频、封面和静态创意，并按安鑫物业来源标识处理已确认的外部推广请求，支持 Loon、Egern 和 Surge。

三个客户端的实现并不完全相同：Egern 与 Surge 优先使用精确路径匹配；Surge 会强制目标连接进入 HTTP Engine；Loon 还提供域名、DoH 和 IP 网段级的激进兜底。插件不封锁淘宝闪购域名、接口或目标小程序包，正常访问淘宝闪购不应被本插件直接拒绝。

## 匹配依据

经网络流量分析，广告素材来自以下微信共享素材主机：

- `wxsmw.wxs.qq.com`
- `wxsmw.wxs.qq.com.tcdnvod.com`
- `wxsnsdy.wxs.qq.com`
- `wxsnsdythumb.wxs.qq.com`
- `wximg.wxs.qq.com`

插件识别两类稳定路径特征：

```text
/snssvpdownload/SH/reserved/ads_svp_video__
/snscosdownload/<可变目录>/reserved/<包含 0000008d00004eec 的资源名>
```

第一类用于广告视频及封面，第二类用于视频首帧、商品图和游戏推广图等静态创意。规则允许前置 CDN 目录变化，并同时限定主机、目录和资源标记，避免扩大到整个 `*.wxs.qq.com`。

新一轮网络流量分析还确认了两处广告漏口：

- 广告视频会通过 `wxsmw.wxs.qq.com.tcdnvod.com` 回源，并可能直接连接已观察到的 CDN 地址。
- `wxa.wxs.qq.com/wxad-design/` 提供广告组件专用界面素材；插件只处理该目录，不整域阻断 `wxa.wxs.qq.com`。

安鑫物业业务接口 `wechat.zhtxcom.com` 不在拦截范围内。

## 外跳防护边界

抓包显示，微信下载外部目标小程序包时不携带来源页面，且可见的 `busi_id` 与安鑫物业自身包相同。按目标 AppID、下载地址、淘宝闪购域名或饿了么接口阻断，都无法区分“从安鑫物业跳转”和“用户正常打开淘宝闪购”，因此插件不采用这些规则。

当前唯一可安全限定来源的明文信号，是安鑫物业向 `webgw.alipay-eco.com` 发出的推广请求携带包含该小程序 AppID 的 `servicewechat.com/...` Referer。三端脚本仅在该来源完整匹配时返回空响应；同一主机上来自淘宝闪购、其它小程序、浏览器或应用的请求全部透传。AppID 只是公开的路由标识，代码将其分段保存，以免被 Secret Scanning 误判为 AppSecret。

这项防护能够阻止已确认、可归因于安鑫物业的阿里生态推广请求，但微信原生的小程序跳转指令位于专有加密流量中，无法在不误伤正常淘宝闪购的前提下保证所有跳转都被网络规则拦截。

## 各客户端的处理方式

| 客户端 | 策略 | 主要取舍 |
| --- | --- | --- |
| Loon | 精确 URL、素材域名、指定 DoH 查询和已识别 CDN 地址多层阻断 | 命中能力强，但可能影响其他微信小程序 |
| Egern | 精确广告路径、已确认的 CDN 地址与来源限定推广脚本 | 不封锁淘宝闪购，缓存或原生回源仍可能绕过 |
| Surge | 与 Egern 相同，并用 `force-http-engine-hosts` 和 `tcp-connection` 处理原生 TCP 回源 | 对原生回源更有针对性，但仍需 MITM |

微信可能先由小程序 WebKit 请求素材，再由原生网络栈对同一地址回源。只做 URL 复写时，第二条连接可能仍取得素材。Surge 因此强制目标 HTTP 主机的 443 连接进入 HTTP Engine；三端还拒绝本次确认的素材 CDN 地址，Loon 则继续使用影响范围更大的多层兜底。

### Loon 的 DoH 与 IP 兜底

微信可能通过 `dns.alidns.com` 或 `doh.pub` 自行解析素材主机，并使用缓存的 CDN IP 直接连接。Loon 配置会：

1. 将已确认的素材主机映射到 `0.0.0.0`。
2. 仅拦截查询原有四个 `wxs.qq.com` 素材主机的指定 DoH 请求。
3. 拒绝已识别的素材 CDN `/24` 网段。
4. 保留域名和精确 URL 规则。

Egern 与 Surge 不拦截公共 DoH，也不采用 Loon 的 `/24` 网段兜底；它们只拒绝本次确认的两个 `/32` 地址，以降低对其他页面和应用的影响。CDN 地址可能随地区和时间变化，这些精确地址可能失效，而 Loon 的网段规则还可能误伤同一网段上的其他服务。

### Loon 规则优先级

主配置中的 `GEOIP,CN,DIRECT`、其他中国 IP 直连规则或 `FINAL` 可能先于插件网段规则生效。使用 Loon 时，请将 `loon-priority-rules.list` 的内容复制到主配置 `[Rule]` 顶部，并放在这些规则之前。该文件使用 `REJECT-DROP`，仅作为普通规则订阅时不一定具有足够优先级。

## 文件

- `loon.plugin`：Loon 激进模式插件。
- `loon-priority-rules.list`：需放在 Loon 主配置 `[Rule]` 顶部的高优先级网段规则。
- `egern.yaml`：Egern 精确路径模块。
- `surge.sgmodule`：Surge 精确路径与强制 HTTP Engine 模块。
- `scripts/`：各客户端使用的请求阶段响应脚本。

## MITM 要求

精确 HTTPS 路径和来源限定推广请求处理需要安装并信任所用客户端的 CA 证书，并开启 MITM。目标主机如下：

```text
wxsmw.wxs.qq.com
wxsmw.wxs.qq.com.tcdnvod.com
wxsnsdy.wxs.qq.com
wxsnsdythumb.wxs.qq.com
wximg.wxs.qq.com
wxa.wxs.qq.com
webgw.alipay-eco.com
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

- 广告控制、点击和小程序跳转指令可能位于微信专有加密流量中；来源限定脚本只能处理可见且带有安鑫物业 Referer 的推广请求，不能保证阻止原生跨小程序跳转。
- 不应手动把整个 `*.wxs.qq.com` 配置为拒绝，否则可能影响其他微信小程序的图片、字体和媒体资源。
- Loon 会完整拒绝多个共享素材主机，并阻断部分 CDN 网段，误伤风险明显高于 Egern 和 Surge。
- 插件不包含淘宝闪购、饿了么或目标小程序包的全局拒绝规则；若正常访问仍异常，应先检查主配置中的其它规则或缓存。
- 为读取 HTTPS Referer，客户端仍需对 `webgw.alipay-eco.com` 启用 MITM。脚本会透传非安鑫来源请求，但使用证书固定的客户端可能在脚本处理前拒绝连接；出现这种情况时应移除该主机和来源限定脚本。
- 未来只有在抓包提供可稳定验证的安鑫物业来源标识时，才能安全补充其它平台防护；仅凭目标域名或 AppID 不会加入规则。
- CDN 主机、地址或素材路径变化后，现有规则可能失效。
- SSL Pinning、QUIC、缓存或未进入客户端 HTTP 处理链的连接可能绕过精确路径规则。
