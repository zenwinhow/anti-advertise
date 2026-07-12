# Ad Blocking Plugins

面向 Loon、Egern 和 Surge 的去广告插件集合。每个插件使用独立目录存放，方便持续增加新的应用、小程序或网站规则。

## 插件列表

| 插件 | Loon | Egern | Surge | 说明 |
| --- | --- | --- | --- | --- |
| 安鑫物业小程序 | [loon.plugin](plugins/anxin-property/loon.plugin) | [egern.yaml](plugins/anxin-property/egern.yaml) | [surge.sgmodule](plugins/anxin-property/surge.sgmodule) | [查看详情](plugins/anxin-property/README.md) |
| 花小猪 | [loon.plugin](plugins/huaxiaozhu/loon.plugin) | [egern.yaml](plugins/huaxiaozhu/egern.yaml) | [surge.sgmodule](plugins/huaxiaozhu/surge.sgmodule) | [查看详情](plugins/huaxiaozhu/README.md) |
| 超鹿运动 | [loon.plugin](plugins/superdeer/loon.plugin) | [egern.yaml](plugins/superdeer/egern.yaml) | [surge.sgmodule](plugins/superdeer/surge.sgmodule) | [查看详情](plugins/superdeer/README.md) |

## 目录结构

```text
.
├── plugins/
│   └── <plugin-slug>/
│       ├── README.md
│       ├── loon.plugin
│       ├── loon-priority-rules.list
│       ├── egern.yaml
│       ├── surge.sgmodule
│       └── scripts/
├── captures/
│   └── <plugin-slug>/        # 本地抓包，Git 会忽略其内容
├── .gitattributes
├── .gitignore
└── README.md
```

目录和文件命名规则：

- 插件目录使用小写英文及连字符，例如 `anxin-property`。
- Loon 配置统一命名为 `loon.plugin`。
- Egern 配置统一命名为 `egern.yaml`。
- Surge 配置统一命名为 `surge.sgmodule`。
- 插件分析、安装说明和已知限制写入同目录的 `README.md`。
- 原始抓包放在对应的 `captures/<plugin-slug>/`，不得提交到仓库。

## 安装

### Loon

打开目标插件目录中的 `loon.plugin`，复制 GitHub Raw 地址，在 Loon 插件页面通过 URL 添加并启用。

### Egern

打开目标插件目录中的 `egern.yaml`，复制 GitHub Raw 地址，在 Egern 的“工具 → 模块”中添加并启用。

### Surge

打开目标插件目录中的 `surge.sgmodule`，复制 GitHub Raw 地址，在 Surge 的模块页面通过 URL 安装并启用。

涉及 HTTPS 内容匹配的插件通常需要安装并信任客户端 CA 证书，同时启用 MITM。具体要求以各插件目录中的说明为准。

## 添加新插件

1. 创建 `plugins/<plugin-slug>/`。
2. 根据支持的客户端添加 `loon.plugin`、`egern.yaml`、`surge.sgmodule`，不要求三者必须同时存在。
3. Surge 模块必须声明 `#!category=...`；去广告模块默认使用 `#!category=广告拦截`。
4. 添加插件自己的 `README.md`，说明匹配依据、MITM 主机和已知限制。
5. 将抓包放入 `captures/<plugin-slug>/`，确认其中不包含准备提交的文件。
6. 在本 README 的插件列表中增加入口。

编写规则时应优先匹配稳定且明确的广告接口、路径或响应字段，避免整域拦截公共 CDN。不要在配置、说明或提交记录中包含 Cookie、Token、用户标识和其他敏感信息。

## 免责声明

这些配置仅用于个人网络调试和改善客户端体验。接口及资源路径可能随服务端更新而变化，请自行评估使用风险。
