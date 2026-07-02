# Anxin Property

安鑫物业微信小程序广告素材拦截插件，支持 Loon 和 Egern。

> 当前为激进模式：优先保证广告素材无法回源，接受共享微信 CDN 资源被误杀的风险。

## 文件

- `loon.plugin`：Loon 插件
- `egern.yaml`：Egern 原生模块

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

## 安装

### Loon

导入 `loon.plugin` 并启用。安装并信任 Loon CA 证书，确保 HTTPS 解密/MITM 已开启。

### Egern

在“工具 → 模块”中添加 `egern.yaml` 并启用。安装并信任 Egern CA 证书，确保 MITM 已开启。

若微信仍使用缓存的广告素材，请彻底退出微信或清理小程序缓存后重试。

## 已知限制

广告控制和元数据请求封装在微信 `mmtls` 流量中，现有抓包没有暴露可安全复写的 JSON 响应。当前规则会阻止广告视频和封面下载，但小程序中仍可能留下空白广告位。

不要将整个 `*.wxs.qq.com` 配置为 `REJECT`，否则可能影响其他微信小程序的图片、字体和媒体资源。

本插件虽然没有阻断整个 `*.wxs.qq.com`，但会完整阻断上面列出的四个共享素材主机。这可能导致其他微信小程序中的图片、视频或缩略图无法加载；这是激进模式的预期代价。
