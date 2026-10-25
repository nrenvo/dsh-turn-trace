# dsh-turn-trace

> **每一轮对话的一张账单。** 在 DeepSeek Harness 里新增一个 **Turns** 页签：展开一轮看这轮花了多少，再展开一步看这一步花了多少。

[![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-blue)](https://github.com/topics/dsh-plugin)
[![npm](https://img.shields.io/npm/v/dsh-turn-trace.svg)](https://www.npmjs.com/package/dsh-turn-trace)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> English: [README.md](README.md)

![Turns 页签：六轮对话逐轮计价，顶栏是会话总额、缓存省下的钱与翻页](docs/images/turns-overview.png)

## 它做什么

- 轮次是一个列表，默认折叠，每行就是「钱 + 步数」。
- 展开一轮：每一步显示 `Step i/n`、这一步的 token、这一步的钱。
- 步里面直接列出调用：`llm · model · 6.4s`、`bash · ok · 41s`。

工具本身不消耗 token——一步的 token 永远属于这一步的模型调用，所以钱记在**步**上，不记在工具上。

## 为什么不直接用 Trajectory？

Trajectory 回答「什么时候」：事件账本和耗时。Turns 回答「花了多少」：每一步的 token、金额，以及这一步调用了什么。它是增量式的，Chat 和 Trajectory 都留在原位。

播放、墙钟甘特图、跨会话 dashboard 都刻意不做——那些已经有更合适的地方。

## 安装

需要 DeepSeek Harness 桌面 App（Homebrew cask `deepseek-harness`），或任何提供 Web UI 的 `dsh` profile。

```sh
# 从 npm 安装
dsh plugin --profile desktop add dsh-turn-trace

# 从本地源码安装
git clone https://github.com/nrenvo/dsh-turn-trace
cd dsh-turn-trace
pnpm install && pnpm build
dsh plugin --profile desktop add link:$PWD
```

重启 App，打开任意会话，点击 Chat / Trajectory 旁边的 **Turns**。

## 界面长什么样

![7 秒演示：展开一轮、点开一个调用、打开右侧检查器](docs/images/turns-demo.gif)

*7 秒演示：展开一轮、点开一个调用、打开右侧检查器。*

| 层级 | 内容 |
| --- | --- |
| 顶栏 | 轮数、会话总金额、缓存省下的钱、USD/CNY 切换 |
| 分页条 | 每页 10 轮，第 1 页最新；**Older** 在需要时拉取下一段历史 |
| 轮次 | 步数、墙钟耗时、金额、缓存省下的钱 |
| 步 | `Step i/n`、金额、输入/输出 token、缓存省下的钱、最贵一步标记、缓存未命中标记 |
| 调用 | `llm`：模型 + 耗时 · `tool`：状态、错误码、耗时、参数摘要 · `user`：提示词原文 |
| 右侧检查器 | 点任意一行：概述、参数、原始返回、来源 |

文案跟随 DSH 的语言设置（中文 / English），走宿主的 locale 服务，不靠浏览器语言猜。

## 原理

**纯客户端插件**。它读界面已经持有的会话快照（`useChat` → `order` + `nodes`），折叠成「轮 → 步 → 金额」。没有 host 插件、没有包内 RPC、没有轮询：会话跑起来时快照本身在更新，视图跟着重算。

### 计价

每次调用按 DeepSeek 公布的单 token 价格计价，用调用自己的时间戳判断峰/谷（峰时：UTC 01:00–04:00、06:00–10:00 的工作日）。费率写在 [`src/pricing.ts`](src/pricing.ts)，只改一处。金额是估算，不是账单。

## 精度与限制

- **每一步按自己记录的模型 id 计价**（先取 `finalNode.requestConfig.model`，再取 `providerMetadata.model`）。没有模型 id 的步会继承最近的已记录模型，并在顶栏计数；如果整场会话都没记录模型，这一步就保持未计价，而不是猜一个。
- 中国法定节假日没有建模，节假日的会话会略微偏高。
- 只折叠当前已加载的窗口；**Older** 会走插槽自带的 `loadOlder` 往前翻。

## 开发

```sh
pnpm install
pnpm test            # 折叠与计价的断言，不需要起运行时
pnpm test:activation # 启动安全：apply() 不能抛（需要先 build）
pnpm typecheck       # tsc --noEmit
pnpm build           # tsdown，然后把 lib/client.js 包进 __ModuleLoader__.load(...)
```

客户端产物通过 `window.__ModuleLoader__.load({ id, factory })` 注册；
`scripts/wrap-client.mjs` 在 CJS 构建之后加这层外壳，浏览器半边因此用的是运行时的
`require('react')`，而不是自带一份 React。

`lib/` 已提交进仓库，这样 `github:` 安装可以直接用。改完源码后运行
`pnpm build`，并把 `lib/` 一起提交。

## License

[MIT](LICENSE)
