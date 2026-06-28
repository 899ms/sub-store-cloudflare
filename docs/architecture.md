# 架构说明

Sub-Store Cloudflare 是一个单 Worker 应用：管理界面由 Worker Static Assets 托管，配置 API 和订阅输出由同一个 Worker 处理，结构化配置保存在 D1。

## 运行边界

```text
Cloudflare Worker
  |
  |-- Static Assets                  Vue 管理界面
  |-- /api/env                       环境信息
  |-- /api/settings                  前端设置
  |-- /api/storage                   备份与恢复
  |-- /api/sources                   订阅源
  |-- /api/collections               组合订阅
  |-- /api/templates                 分流模板
  |-- /api/preview/*                 节点预览
  |-- /download/source/:id/:target   单订阅源输出
  |-- /download/collection/:id/:target 组合订阅输出
  |
  |-- D1                             sources / collections / templates / app_settings
  |-- Worker Secrets                 管理端 token / 下载 token
```

核心路径只需要 Workers、D1 和 Secrets。KV、R2、Durable Objects、Queue、Cron 都不是必要组件。

## 数据模型

| 表 | 作用 |
| --- | --- |
| `sources` | 保存远程订阅 URL 或本地节点文本。 |
| `collections` | 保存订阅源组合、过滤器和默认模板。 |
| `templates` | 保存规则模板，包括代理组、规则提供者和规则列表。 |
| `app_settings` | 保存界面设置和远程订阅请求参数。 |

## 输出流程

```text
客户端请求 /download/collection/:id/:target
  |
  |-- 校验下载 token
  |-- 读取 collection
  |-- 拉取 collection 里的 sources
  |-- 解析节点
  |-- 应用 source filters
  |-- 合并
  |-- 应用 collection filters
  |-- 确保节点名唯一
  |-- 套用 template
  |-- 输出 mihomo / sing-box / v2ray / uri / json
```

`/download/source/:id/:target` 走同一套解析和过滤逻辑，只是不读取 collection。

## Filters

过滤器是这版自己的小型 JSON DSL，保存在 D1。前端编辑器会把界面里的动作转换成下面这些结构；Worker 只读取这些结构：

- `include`：按字段和正则保留节点。
- `exclude`：按字段和正则排除节点。
- `rename`：按正则重命名字段，默认字段是 `name`。
- `delete-field`：按正则删除字段里的匹配文本，默认字段是 `name`。
- `dedupe`：按一个或多个字段去重，可以删除重复项，也可以给重复节点重命名。
- `sort`：按节点名排序，也支持随机排序。
- `regex-sort`：按一组正则表达式把节点排到前面。
- `flag`：按节点名识别区域旗帜，或移除已有旗帜。
- `quick`：过滤无效节点，并批量设置 `udp`、`tfo`、`skip-cert-verify`、`vmess aead` 等常用属性。

示例：

```json
[
  { "type": "include", "field": "name", "pattern": "香港|HK|日本|JP" },
  { "type": "exclude", "field": "name", "pattern": "官网|剩余|倍率" },
  { "type": "delete-field", "field": "name", "patterns": ["倍率\\s*\\d+"] },
  { "type": "dedupe", "fields": ["server", "port"], "action": "rename", "link": "-" },
  { "type": "regex-sort", "expressions": ["香港|HK", "日本|JP", "新加坡|SG"], "direction": "asc" },
  { "type": "flag", "mode": "add" },
  { "type": "sort", "direction": "asc" }
]
```

## Templates

模板也是 JSON 配置，保存在 D1。Mihomo 模板支持：

- `mixedPort`
- `allowLan`
- `mode`
- `logLevel`
- `dns`
- `sniffer`
- `proxyGroups`
- `ruleProviders`
- `rules`

`proxyGroups[].proxies` 里可以使用 `$all`，生成时会展开为当前组合订阅里的全部节点。

## 为什么只用 D1

这个项目的数据是结构化配置，主要是订阅源、组合关系、过滤器和规则模板。D1 可以直接表达这些关系，也方便迁移和导出。大文件、后台任务和跨请求状态都不是核心路径，因此不默认引入其他 Cloudflare 存储或异步组件。

## 上游关系

完整订阅管理系统请参考 [sub-store-org/Sub-Store](https://github.com/sub-store-org/Sub-Store)。本项目保留核心管理体验和订阅生成链路，部署形态收敛到 Cloudflare Workers。
