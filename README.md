# Ad Blocking Plugins

面向 Loon、Egern 和 Surge 的去广告插件集合。每个插件独立维护，只拦截已识别的广告域名、接口、资源路径或响应字段，尽量减少对正常业务的影响。

## 插件列表

| 插件 | Loon | Egern | Surge | 详细说明 |
| --- | --- | --- | --- | --- |
| 安鑫物业小程序 | [配置](plugins/anxin-property/loon.plugin) | [配置](plugins/anxin-property/egern.yaml) | [配置](plugins/anxin-property/surge.sgmodule) | [README](plugins/anxin-property/README.md) |
| 花小猪 | [配置](plugins/huaxiaozhu/loon.plugin) | [配置](plugins/huaxiaozhu/egern.yaml) | [配置](plugins/huaxiaozhu/surge.sgmodule) | [README](plugins/huaxiaozhu/README.md) |
| 超鹿运动 | [配置](plugins/superdeer/loon.plugin) | [配置](plugins/superdeer/egern.yaml) | [配置](plugins/superdeer/surge.sgmodule) | [README](plugins/superdeer/README.md) |

各插件采用的匹配方式、MITM 主机和已知限制不同，安装前请先阅读对应说明。

## 安装

1. 在插件列表中打开对应客户端的配置文件。
2. 复制该文件的 GitHub Raw 地址。
3. 在客户端中通过 URL 添加并启用：
   - Loon：插件页面。
   - Egern：“工具 → 模块”。
   - Surge：模块页面。
4. 如果插件需要处理 HTTPS URL 或响应体，请按插件说明安装并信任客户端 CA 证书，然后开启 MITM。
5. 完全退出目标 App 后重新打开；已有广告素材仍显示时，可清理目标 App 的缓存后再试。

订阅远程配置和脚本前，请自行检查文件内容与更新来源。

## 设计原则

- 优先匹配明确的广告接口、资源路径或响应字段。
- 共享 CDN 只匹配广告专用路径，避免直接阻断整个域名。
- MITM 主机应有明确用途并避免使用全局通配；若范围大于实际改写目标，应在插件说明中解释原因。
- JSON 过滤脚本只修改已识别的广告字段，解析失败时保留原响应。
- 不在仓库中记录 Cookie、Token、用户标识或其他私密数据。

规则依据来自网络流量分析。插件 README 只公开规则所需的域名、路径、字段和行为，不包含原始流量文件或个人环境信息。

## 项目结构

```text
plugins/
└── <plugin-slug>/
    ├── README.md
    ├── loon.plugin
    ├── egern.yaml
    ├── surge.sgmodule
    └── scripts/
```

部分插件会包含额外的规则文件，具体用途以插件 README 为准。不支持的客户端可以不提供对应配置。

## 贡献

新增或更新插件时：

1. 使用小写英文和连字符命名插件目录。
2. 使用 `loon.plugin`、`egern.yaml` 和 `surge.sgmodule` 作为标准客户端文件名。
3. 为 Surge 去广告模块声明 `#!category=广告拦截`。
4. 在插件 README 中说明作用范围、匹配依据、MITM 要求、安装方法和已知限制。
5. 文档应面向所有使用者，不记录个人设备、本机路径、原始流量文件名、采集日期、包数量或分析工具环境。
6. 更新本页的插件列表。

提交前请检查规则范围，避免误伤共享服务；原始网络流量和敏感请求数据不得提交。

## 免责声明

本项目用于网络调试与客户端体验优化。第三方应用的接口、域名和数据结构可能随时变化，规则也可能导致功能缺失、空白广告位或其他兼容性问题。使用者应在了解 HTTPS 解密的隐私与安全影响后自行决定是否启用。
