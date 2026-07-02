# Anxin Property

安鑫物业微信小程序广告素材拦截插件，支持 Loon、Egern 和 Surge。

> 各客户端实现不同：Egern 使用抓包路径精确复写；Loon 与 Surge 仍保留针对原生回源的激进兜底。

## 文件

- `loon.plugin`：Loon 插件
- `loon-priority-rules.list`：需复制到 Loon 主配置最前面的高优先级 IP 规则
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

## 为什么部分客户端使用域名级阻断

后续抓包显示，同一个广告图片 URL 会出现两条请求链：

1. 小程序 WebKit 请求命中 URL 复写并收到空响应。
2. 微信原生 CFNetwork 随后请求完全相同的 URL，并成功取得真实图片。

因此只使用 URL 复写仍可能留下静态广告。Loon 和 Surge 版本直接拒绝以下四个已确认的素材主机，并保留精确 URL 规则作为第二层防线：

- `wximg.wxs.qq.com`
- `wxsmw.wxs.qq.com`
- `wxsnsdy.wxs.qq.com`
- `wxsnsdythumb.wxs.qq.com`

Egern 版本不再整站拒绝这些共享素材主机，只处理已确认的广告路径。物业自身的图片来自 `wechat.zhtxcom.com`，不受规则影响。

## 为什么还要拦截 DoH

最新抓包显示，微信会同时请求以下公共 DoH 服务，自行解析广告素材主机：

- `dns.alidns.com`
- `doh.pub`

查询内容明确包含 `wximg.wxs.qq.com` 和 `wxsmw.wxs.qq.com`。这条应用内 DNS 路径会绕过普通 Host 映射，随后原生 CFNetwork 使用解析结果直接回源。

Loon 的激进版本增加以下防线：

1. 将四个素材主机映射到 `0.0.0.0`。
2. 对两个公共 DoH 服务，仅阻断查询四个素材主机的 DNS 报文。
3. 继续保留域名规则和精确素材 URL 规则。

Egern 精确版本不拦截公共 DoH，避免影响页面和其他应用的正常解析。

## 为什么还要阻断 IP 网段

后续抓包中没有出现广告素材主机的 DNS 查询，但微信仍然直接连接 `wximg.wxs.qq.com` 并成功取得多张广告图。这表示微信或系统继续使用此前 DoH 响应缓存的真实 CDN IP。

连接由应用自行解析并使用目标 IP 发起时，分流阶段可能看不到原始域名，域名规则因而无法命中。Loon 激进版本从 DoH 响应提取过以下素材 CDN `/24` 网段：

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

Egern 精确版本不包含 IP 网段规则。CDN 地址会随地区和时间变化，按 IP 拦截容易误伤同网段的页面资源，因此不适合当前 Egern 方案。

### Loon 规则优先级陷阱

Loon 的本地规则优先级高于插件规则。常见主配置通常包含 `GEOIP,CN,DIRECT`、中国 IP 直连或其他本地 `DIRECT` 规则；应用通过 HTTPDNS 直接连接中国 CDN IP 时，这些本地规则会先放行流量，插件内的 `IP-CIDR ... REJECT` 不会再执行。

抓包已验证这种情况：DoH 返回的 `124.72.129.36`、`121.204.229.162` 都位于插件声明的拦截网段内，但请求仍然成功。

使用 Loon 时，需要打开主配置，把 `loon-priority-rules.list` 中的规则复制到主配置 `[Rule]` 顶部，并确保它们位于以下规则之前：

```text
GEOIP,CN,DIRECT
其他中国 IP 或本地 DIRECT 规则
FINAL
```

优先规则使用 `REJECT-DROP`，避免微信收到失败响应后快速重试。仅把该文件作为普通规则订阅仍可能受到优先级影响，推荐直接放进主配置本地规则顶部。

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

然后将 `loon-priority-rules.list` 的内容复制到主配置 `[Rule]` 最前面。只导入插件不足以覆盖优先级更高的本地直连规则。

### Egern

在“工具 → 模块”中添加 `egern.yaml` 并启用。更新已有模块时，先删除旧缓存或重新添加模块，再完全停止 Egern 与微信后重新打开。

安装并信任 Egern CA 证书。为本次验证，在“全部连接 → …”中开启“全局 MITM”；“HTTP 全局抓包”只用于确认请求是否进入 HTTP 处理链，不影响拦截结果，可按需开启。

Egern 模块仅复写抓包确认的三类素材：广告 MP4、`ads_svp_video__` 封面图，以及资源 ID 带 `0000008d00004eec` 的静态创意。它不会整站阻断四个微信素材主机，也不包含公共 DoH 或 IP 网段规则。

### Surge

导入 `surge.sgmodule` 并启用。安装并信任 Surge CA 证书，开启 MITM 和脚本功能。该模块会自动追加强制 HTTP 引擎主机及 MITM 主机。

若微信仍使用缓存的广告素材，请彻底退出微信或清理小程序缓存后重试。

更新到本版本后，应先停止再重新启动 Loon/Egern，彻底结束微信进程，然后重新打开小程序。否则微信可能继续使用升级前缓存的 CDN IP 和图片。

## 已知限制

广告控制和元数据请求封装在微信 `mmtls` 流量中，现有抓包没有暴露可安全复写的 JSON 响应。当前规则会阻止广告视频和封面下载，但小程序中仍可能留下空白广告位。

不要将整个 `*.wxs.qq.com` 配置为 `REJECT`，否则可能影响其他微信小程序的图片、字体和媒体资源。

Loon 与 Surge 的激进兜底会完整阻断上面列出的四个共享素材主机，可能导致其他微信小程序中的图片、视频或缩略图无法加载。Egern 精确版本没有这一行为。

Loon 的 IP 网段规则比域名规则影响更广，可能误伤同一运营商或腾讯 CDN 网段上的其他服务。
