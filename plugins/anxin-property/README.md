# Anxin Property

安鑫物业微信小程序广告素材拦截插件，支持 Loon、Egern 和 Surge。

> 当前为激进模式：优先保证广告素材无法回源，接受共享微信 CDN 资源及相关 DNS 查询被误杀的风险。

## 文件

- `loon.plugin`：Loon 插件
- `egern.yaml`：Egern 原生模块
- `surge.sgmodule`：Surge 模块（推荐用于微信原生 TCP 回源）
- `scripts/`：请求阶段本地响应脚本

## 匹配依据

广告视频、封面和静态创意由以下微信素材主机提供：

- `wxsmw.wxs.qq.com`
- `wxsnsdy.wxs.qq.com`
- `wxsnsdythumb.wxs.qq.com`
- `wximg.wxs.qq.com`

视频及封面具有以下稳定路径特征：

```text
/snssvpdownload/SH/reserved/ads_svp_video__
```

后续抓包发现，部分静态广告创意使用另一类路径，资源文件名中带有稳定业务标记：

```text
/snscosdownload/<region>/reserved/<resource-id-containing-0000008d00004eec>
```

新旧抓包中该标记对应的响应均为广告创意，包括视频首帧、商品图和游戏推广图。规则同时限定 `wximg.wxs.qq.com` 或 `wxsnsdythumb.wxs.qq.com`、`snscosdownload`、`reserved` 目录及 `0000008d00004eec` 标记，避免扩大到微信 CDN 的其他资源。

这些特征前的 CDN 目录按可变路径处理，不依赖 `/131/20204/`、`/131/20210/`、`/141/20204/` 等可能变化的目录。规则不会整域拦截 `*.wxs.qq.com`。

安鑫物业业务接口 `wechat.zhtxcom.com` 不在拦截范围内。

## 为什么使用域名级阻断

后续抓包显示，同一个广告图片 URL 会出现两条请求链：

1. 小程序 WebKit 请求命中 URL 复写并收到空响应。
2. 微信原生 CFNetwork 随后请求完全相同的 URL，并成功取得真实图片。

因此只使用 URL 复写仍会留下静态广告。当前版本在 Loon 和 Egern 中直接拒绝以下四个已确认的素材主机，并保留精确 URL 规则作为第二层防线：

- `wximg.wxs.qq.com`
- `wxsmw.wxs.qq.com`
- `wxsnsdy.wxs.qq.com`
- `wxsnsdythumb.wxs.qq.com`

物业自身的图片来自 `wechat.zhtxcom.com`，不受上述域名规则影响。

## 为什么还要拦截 DoH

最新抓包显示，微信会同时请求以下公共 DoH 服务，自行解析广告素材主机：

- `dns.alidns.com`
- `doh.pub`

查询内容明确包含 `wximg.wxs.qq.com` 和 `wxsmw.wxs.qq.com`。这条应用内 DNS 路径会绕过普通 Host 映射，随后原生 CFNetwork 使用解析结果直接回源。

当前配置增加以下防线：

1. 将四个素材主机映射到 `0.0.0.0`。
2. Egern DNS 层直接拒绝四个素材主机的查询。
3. 对两个公共 DoH 服务，仅阻断查询四个素材主机的 DNS 报文。
4. 继续保留域名规则和精确素材 URL 规则。

配置没有完整屏蔽 `dns.alidns.com` 或 `doh.pub`，其他域名的 DoH 查询仍可通过。

## 为什么还要阻断 IP 网段

后续抓包中没有出现广告素材主机的 DNS 查询，但微信仍然直接连接 `wximg.wxs.qq.com` 并成功取得多张广告图。这表示微信或系统继续使用此前 DoH 响应缓存的真实 CDN IP。

连接由应用自行解析并使用目标 IP 发起时，分流阶段可能看不到原始域名，域名规则因而无法命中。当前配置从 DoH 响应提取素材 CDN 地址，并激进阻断其所在 `/24` 网段：

```text
27.152.184.0/24
121.204.225.0/24
121.204.229.0/24
124.72.129.0/24
171.105.26.0/24
171.108.209.0/24
171.108.210.0/24
171.108.216.0/24
220.160.46.0/24
```

Loon/Egern 在连接层拒绝这些网段，Egern 还会在 DNS 响应中过滤它们。CDN 地址会随地区和时间变化，后续可能需要根据新抓包补充网段。

## 原始 TCP 与 Surge 强制 HTTP 引擎

最新抓包继续出现一种稳定现象：WebKit 请求会命中复写，而 WeChat 原生 CFNetwork 对完全相同 URL 的请求仍能返回真实 JPEG。这符合“原始 TCP 连接只被识别出 HTTP 头、但未进入完整 HTTP 处理引擎”的特征。此时代理可以记录请求和响应头，却不会执行 URL 复写或脚本。

Surge 提供 `force-http-engine-hosts`，能够把指定主机的原始 TCP 连接强制交给 HTTP 引擎。`surge.sgmodule` 同时启用：

1. `force-http-engine-hosts` 强制处理四个素材主机的 443 端口。
2. MITM 的 `tcp-connection` 模式。
3. 请求脚本直接返回可解码的透明 GIF，不访问上游 CDN。
4. `REJECT-TINYGIF` 域名规则作为兜底。

Loon 和 Egern 版本也增加了请求阶段本地响应脚本，但两者官方文档没有提供与 Surge `force-http-engine-hosts` 完全对应的强制引擎选项，因此对于这条原生回源链，Surge 方案更有针对性。

## 安装

### Loon

导入 `loon.plugin` 并启用。安装并信任 Loon CA 证书，确保 HTTPS 解密/MITM 已开启。

### Egern

在“工具 → 模块”中添加 `egern.yaml` 并启用。安装并信任 Egern CA 证书，确保 MITM 已开启。

### Surge

导入 `surge.sgmodule` 并启用。安装并信任 Surge CA 证书，开启 MITM 和脚本功能。该模块会自动追加强制 HTTP 引擎主机及 MITM 主机。

若微信仍使用缓存的广告素材，请彻底退出微信或清理小程序缓存后重试。

更新到本版本后，应先停止再重新启动 Loon/Egern，彻底结束微信进程，然后重新打开小程序。否则微信可能继续使用升级前缓存的 CDN IP 和图片。

## 已知限制

广告控制和元数据请求封装在微信 `mmtls` 流量中，现有抓包没有暴露可安全复写的 JSON 响应。当前规则会阻止广告视频和封面下载，但小程序中仍可能留下空白广告位。

不要将整个 `*.wxs.qq.com` 配置为 `REJECT`，否则可能影响其他微信小程序的图片、字体和媒体资源。

本插件虽然没有阻断整个 `*.wxs.qq.com`，但会完整阻断上面列出的四个共享素材主机。这可能导致其他微信小程序中的图片、视频或缩略图无法加载；这是激进模式的预期代价。

IP 网段规则比域名规则影响更广，可能误伤同一运营商或腾讯 CDN 网段上的其他服务。这同样是激进模式的预期代价。
