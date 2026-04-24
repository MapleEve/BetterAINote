<div align="center">

# BetterAINote 🎙️

> *「录音散在不同平台，你想要的是一个自己的、安全的、可长期整理的录音工作台。」*

<a href="https://github.com/MapleEve/BetterAINote/actions/workflows/ci.yml">
  <img src="https://img.shields.io/github/actions/workflow/status/MapleEve/BetterAINote/ci.yml?branch=main&style=flat-square" alt="CI" />
</a>
<a href="https://github.com/MapleEve/BetterAINote/releases">
  <img src="https://img.shields.io/badge/Release-preview%20only-lightgrey?style=flat-square" alt="Release status" />
</a>
<a href="./docs/DEPLOYMENT.md">
  <img src="https://img.shields.io/badge/Self--hosting-first-blue?style=flat-square" alt="Self-hosting first" />
</a>
<a href="./LICENSE">
  <img src="https://img.shields.io/badge/License-custom%20based%20on%20Apache%202.0-orange?style=flat-square" alt="License" />
</a>

<br>

把钉钉、TicNote、Plaud、飞书妙记、讯飞听见等来源的录音整理到一个本地工作台。<br>
录音、转写、说话人审阅、AI 标题和来源记录都优先留在你自己的部署里。<br>
当前是 preview，自托管优先；还没有发布正式 release，也不发布 npm 包或镜像。

<br>

[快速开始](#开始用) · [数据源](./docs/DATA_SOURCES.md) · [API](./docs/API.md) · [部署](./docs/DEPLOYMENT.md) · [隐私](./docs/PRIVACY.md) · [安全](./SECURITY.md)

</div>

---

## 你是不是也遇到过这个

> 录音在不同厂商平台里，标题不统一，下载方式不一样，想查一次会议要在多个网页之间来回翻。

> 转写、重命名、说话人整理各有一套工具，但凭据、音频、数据库和日志到底留在哪里并不清楚。

BetterAINote 解决的就是这个。**它把多来源录音收进一个私有工作台，让同步、归档、私有转写、说话人审阅和 AI 重命名围绕你的本地数据运行。**

---

## 适合谁

- 已经在用钉钉 / A1 / 闪记、TicNote、Plaud、飞书妙记、讯飞听见等录音平台的人。
- 想把录音库、SQLite 数据库、服务凭据和音频归档放在自己机器或服务器上的用户。
- 想用 VoScript 等私有转写服务处理录音，而不是把所有内容交给第三方流水线的人。
- 希望先自托管、再按自己的节奏接入更多工作流或 AI Agent 的开发者。

BetterAINote 是独立项目。Plaud 只是其中一个支持的数据源，不是项目中心，也不是项目身份。

---

## 当前状态

| 项目 | 说明 |
| --- | --- |
| 阶段 | `preview`，优先给愿意自托管和反馈的人试用 |
| 发布 | 第一次公开提交后仍不发布正式 release；Docker / Release 工作流需要手动授权且默认关闭 |
| 包分发 | `package.json` 保持 `private: true`，不发布 npm 包 |
| 部署方向 | 私有部署优先：本机、家用服务器、私有服务器或你控制的容器环境 |
| 兼容承诺 | API、数据源能力和配置项在首个正式 release 前仍可能调整 |

---

## 开始用

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

打开 `http://localhost:3001`，创建第一个管理员账号，然后进入设置页配置：

- `Data Sources`：连接钉钉、TicNote、Plaud、飞书妙记、讯飞听见等录音来源。
- `VoScript`：配置私有转写服务地址和访问凭据。
- `Transcription`：设置通用转写行为。
- `AI Rename`：配置标题生成和重命名策略。
- `Sync` / `Playback` / `Display`：控制同步、播放和界面偏好。

不要把 `.env.local`、数据库、音频归档、截图里的账号状态或任何真实凭据提交到仓库。

完整说明见 [部署文档](./docs/DEPLOYMENT.md) 和 [开发文档](./docs/DEVELOPMENT.md)。

---

## 你会得到什么

**统一录音工作台**

- 多来源记录进入同一个本地录音库。
- 可按来源、标题、时间、转写状态和同步状态整理。
- 支持本地音频归档，路径可指向本机磁盘或你控制的挂载目录。

**私有转写与说话人整理**

- 可对接 VoScript 等私有转写服务。
- 支持转写状态、原文查看、说话人审阅和声纹关联工作流。
- 来源记录、私有转写和 AI 标题生成相互独立，方便替换服务。

**安全的来源调试入口**

- `source-report` 只返回适合 UI 和用户排查的公开形状。
- 不返回上游原始响应、认证字段、下载签名、cookie、用户标识或完整请求上下文。
- Issue、日志和截图都应脱敏后再公开。

---

## 支持的数据源

| 来源 | 当前用户口径 |
| --- | --- |
| 钉钉 / A1 / 闪记 | 使用设置页要求的账号凭据同步可访问记录；来源详情、音频和摘要能力取决于账号可见内容。 |
| TicNote | 支持中国区 / 国际区站点；可同步记录、归档可获取音频，并在启用时尝试把重命名写回来源。 |
| Plaud | 作为一个录音来源接入；可同步记录、归档可获取音频，并在启用时尝试把重命名写回来源。 |
| 飞书妙记 | 可在账号权限允许时同步或查看来源元数据、逐字稿和摘要。 |
| 讯飞听见 | 偏转写记录导入 / 查看场景；音频和标题写回能力按来源实际可用情况处理。 |

这张表是普通用户的成熟度说明，不代表每个来源都有同样字段、同样音频能力或同样写回能力。详见 [数据源文档](./docs/DATA_SOURCES.md)。

---

## 本地开发

```bash
pnpm dev          # Web app + worker
pnpm dev:web      # 只启动 Web app
pnpm worker       # 只启动 worker
pnpm type-check
pnpm format-and-lint
```

运行形态：

- `app`：Next.js Web UI 和 API routes。
- `worker`：后台同步检查、转写调度和队列任务。
- `SQLite`：核心设置、录音库、转写、说话人和词级时间等拆分数据库。
- `storage`：本地录音归档目录。

开发时请保持数据源、转写服务、标题生成和 UI 偏好之间的边界，不要把某一个来源写成全局默认心智模型。

---

## 隐私和安全

BetterAINote 的隐私结果取决于你的部署方式、连接的数据源和配置的外部服务。默认请把它当成一个含录音、转写文本、账号状态和服务凭据的私有数据库。

- 本地 SQLite 和 `LOCAL_STORAGE_PATH` 可能包含录音标题、来源记录、转写文本、说话人信息和音频文件。
- Provider 凭据、VoScript 凭据、AI 标题服务密钥和会话信息只应存在于你的私有部署里。
- 日志、Issue、PR、截图和录屏必须先脱敏；不要公开 cookie、bearer、用户 / 组织 / 录音 ID、会议内容、网络抓包文件、完整环境文件或本地私有路径。
- 对外暴露面板前，请使用强随机 `BETTER_AUTH_SECRET` / `ENCRYPTION_KEY`，并放在你自己的网络边界或反向代理后。

更多说明见 [隐私文档](./docs/PRIVACY.md) 和 [安全策略](./SECURITY.md)。

---

## 文档

| 主题 | 中文主文档 |
| --- | --- |
| API 形状与公开边界 | [docs/API.md](./docs/API.md) |
| 数据源成熟度与限制 | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) |
| 私有部署与工作流 | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) |
| 本地开发约定 | [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) |
| 自动同步行为 | [docs/AUTO_SYNC.md](./docs/AUTO_SYNC.md) |
| 隐私边界 | [docs/PRIVACY.md](./docs/PRIVACY.md) |
| 安全策略 | [SECURITY.md](./SECURITY.md) |
| 更新日志 | [CHANGELOG.md](./CHANGELOG.md) |
| 贡献说明 | [CONTRIBUTING.md](./CONTRIBUTING.md) |

---

## 贡献 & Issue

欢迎 PR 和 Issue，但请先确认提交内容适合公开仓库：

- 只提交脱敏后的日志、请求形状、错误码和最小复现步骤。
- 不要上传数据库、录音、完整转写、网络抓包文件、真实来源详情、截图里的登录态或完整环境文件。
- 如果问题涉及未修复安全风险，请使用 GitHub 私有安全通道，不要公开发 Issue。
- 文档、模板和示例必须保持 BetterAINote 的独立项目定位，避免把任一来源写成产品唯一中心。

---

## License

BetterAINote 使用 **基于 Apache License 2.0 的 BetterAINote 自定义许可**，不是未修改的标准 Apache-2.0 SPDX 许可。完整条款以 [LICENSE](./LICENSE) 为准。
