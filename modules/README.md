# 模块插件

此目录用于存放**非去广告**类型的模块插件，例如功能增强、界面调整、签到、解锁、辅助脚本等。

`plugins/` 目录保留给去广告插件；不属于去广告场景的模块请放到本目录，避免与广告拦截规则混在一起。

## 目录结构

```text
modules/
└── <module-slug>/
    ├── README.md
    ├── loon.plugin
    ├── egern.yaml
    ├── surge.sgmodule
    └── scripts/
```

- 使用小写英文和连字符命名模块目录。
- 使用 `loon.plugin`、`egern.yaml` 和 `surge.sgmodule` 作为标准客户端文件名。
- 不支持的客户端可以不提供对应配置。
- 在模块 README 中说明作用范围、匹配依据、MITM 要求、安装方法和已知限制。

## Surge 分类

Surge 模块必须声明 `#!category=...` 元数据字段。请根据模块用途选择合适的分类（例如 `#!category=功能增强`、`#!category=签到`、`#!category=解锁` 等），不要沿用去广告插件使用的 `#!category=广告拦截`。

## 模块列表

| 模块 | Loon | Egern | Surge | 详细说明 |
| --- | --- | --- | --- | --- |
| 节点 IP 质量检测 | [配置](ip-quality/loon.plugin) | [配置](ip-quality/egern.yaml) | [配置](ip-quality/surge.sgmodule) | [README](ip-quality/README.md) |

新增模块时请在本节补充索引，并同步更新根目录 `README.md`。
