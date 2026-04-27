<sub>🌐 <b>简体中文</b> · <a href="README.en.md">English</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a></sub>

<div align="center">

# BetterAINote 🎙️

> *「录音散在不同平台，你想要的是一个自己的、安全的、可长期整理的录音工作台。」*

<a href="https://github.com/MapleEve/BetterAINote/actions/workflows/ci.yml">
  <img src="https://img.shields.io/github/actions/workflow/status/MapleEve/BetterAINote/ci.yml?branch=main&style=flat-square" alt="CI" />
</a>
<a href="https://github.com/MapleEve/BetterAINote/releases">
  <img src="https://img.shields.io/badge/Release-0.6.0--preview-lightgrey?style=flat-square" alt="Release status" />
</a>
<a href="./docs/DEPLOYMENT.md">
  <img src="https://img.shields.io/badge/Self--hosting-first-blue?style=flat-square" alt="Self-hosting first" />
</a>
<a href="./LICENSE">
  <img src="https://img.shields.io/badge/License-个人免费%20·%20商业授权-orange?style=flat-square" alt="License" />
</a>

<br>
<br>

<img src="./docs/assets/betterainote-hero.gif" alt="BetterAINote 多平台语音资料私有化集合与统一管理动效" width="100%" />

<br>

把钉钉 / A1、TicNote、Plaud、飞书妙记、讯飞听见等多平台语音资料整理到一个本地工作台。<br>
重点是多来源语音资料的私有化集合与统一管理，而不是绑定某一个厂商来源。<br>
录音、转写、说话人审阅、AI 标题、来源报告和搜索索引优先围绕你自己的部署运行。<br>
当前版本是 `0.6.0-preview`。自托管优先，不发布 npm 包或公开 Docker 镜像。

<br>

[快速开始](#开始用) · [AI 安装部署](./docs/AI_INSTALL_DEPLOYMENT.md) · [数据源](./docs/DATA_SOURCES.md) · [API](./docs/API.md) · [部署](./docs/DEPLOYMENT.md) · [隐私](./docs/PRIVACY.md)

</div>

---

## 你是不是也遇到过这个

> 录音在不同厂商平台里，标题不统一，下载方式不一样，想查一次会议要在多个网页之间来回翻。

> 转写、重命名、说话人整理各有一套工具，但凭据、音频、数据库和日志到底留在哪里并不清楚。

BetterAINote 解决的就是这个。**它把多来源录音收进一个私有工作台，让同步、归档、私有转写、说话人审阅、AI 重命名和搜索准备围绕你的本地数据运行。**

---

## 适合谁

- 已经在用钉钉 / A1、TicNote、Plaud、飞书妙记、讯飞听见等录音平台的人。
- 想把录音库、SQLite 数据库、服务凭据和音频归档放在自己机器或服务器上的用户。
- 想用 VoScript 等私有转写服务处理录音，而不是把所有内容交给第三方流水线的人。
- 希望先自托管，再按自己的节奏接入更多工作流或自动化能力的开发者。

BetterAINote 是独立项目。Plaud 只是其中一个支持的数据源，不是项目中心，也不是项目身份。

---

## 当前状态

| 项目 | 说明 |
| --- | --- |
| 阶段 | `preview`，优先给愿意自托管和反馈的人试用 |
| 发布 | `0.6.0-preview` 是预发布基线；正式稳定版、Docker 镜像和 npm 包仍不发布 |
| 包分发 | `package.json` 保持 `private: true` |
| 部署方向 | 本机、家用服务器、私有服务器或你控制的容器环境 |
| 兼容承诺 | 首个正式稳定版前，API、数据源能力和设置项仍可能调整 |

---

## 开始用

```bash
bun install
cp .env.example .env.local
bun run db:migrate
bun run dev
```

`bun run dev` 会同时启动 Next.js Web app 和后台 worker。只跑网页用 `bun run dev:web`，单独跑 worker 用 `bun run worker`。

打开 `http://localhost:3001`，创建第一个管理员账号，然后进入设置页配置：

- `Data Sources`：连接钉钉、TicNote、Plaud、飞书妙记、讯飞听见等录音来源。
- `VoScript`：配置私有转写服务地址和访问凭据。
- `Transcription`：设置通用转写行为。
- `AI Rename`：配置标题生成和重命名策略。
- `Sync` / `Playback` / `Display`：控制同步、播放和界面偏好。

不要把 `.env.local`、数据库、音频归档、截图里的账号状态或任何真实凭据提交到仓库。

完整说明见 [部署文档](./docs/DEPLOYMENT.md)。

---

## 你会得到什么

**统一录音工作台**

- 多来源记录进入同一个本地录音库。
- 可按来源、标题、时间、转写状态、同步状态和标签整理。
- 支持本地音频归档，路径可指向本机磁盘或你控制的挂载目录。

**私有转写与说话人整理**

- 可对接 VoScript 等私有转写服务。
- 支持转写状态、原文查看、说话人审阅和可复用说话人档案。
- 来源记录、私有转写和 AI 标题生成相互独立，方便替换服务。

**搜索准备好的数据库基线**

- SQLite 拆分 core、library、transcripts、voiceprints、words 和可重建 search sidecar。
- 搜索基线覆盖录音、逐字稿、说话人和标签。
- preview migration 已整理为分片 baseline，后续版本从这个 SOT 继续追加迁移。

---

## 支持的数据源

| 来源 | 当前用户口径 |
| --- | --- |
| 钉钉 / A1 | 使用设置页要求的账号凭据同步可访问记录；来源详情、音频和摘要能力取决于账号可见内容。 |
| TicNote | 支持中国区 / 国际区站点；可同步记录、归档可获取音频，并在启用时尝试把重命名写回来源。 |
| Plaud | 作为一个录音来源接入；可同步记录、归档可获取音频，并在启用时尝试把重命名写回来源。 |
| 飞书妙记 | 可在账号权限允许时同步或查看来源元数据、逐字稿和摘要。 |
| 讯飞听见 | 偏转写记录导入 / 查看场景；音频和标题写回能力按来源实际可用情况处理。 |

详见 [数据源文档](./docs/DATA_SOURCES.md)。

---

## 隐私和安全

BetterAINote 可能包含录音标题、来源记录、转写文本、说话人名称、音频文件、凭据和服务密钥。默认请把它当成私有基础设施。

- 本地 SQLite 和 `LOCAL_STORAGE_PATH` 可能包含敏感录音与转写数据。
- Provider 凭据、VoScript 凭据、AI 标题服务密钥和会话状态只应存在于你的私有部署里。
- 日志、Issue、PR、截图和录屏必须先脱敏。
- 不要公开 cookie、bearer、组织 / 用户 / 录音 ID、会议内容、抓包文件、完整环境文件或本地私有路径。

更多说明见 [隐私文档](./docs/PRIVACY.md) 和 [安全策略](./SECURITY.md)。

---

## 文档

| 主题 | 简体中文默认 | English | 日本語 | 한국어 |
| --- | --- | --- | --- | --- |
| 项目概览 | [README.md](./README.md) | [README.en.md](./README.en.md) | [README.ja.md](./README.ja.md) | [README.ko.md](./README.ko.md) |
| AI 安装部署 | [docs/AI_INSTALL_DEPLOYMENT.md](./docs/AI_INSTALL_DEPLOYMENT.md) | [docs/AI_INSTALL_DEPLOYMENT.md](./docs/AI_INSTALL_DEPLOYMENT.md) | [docs/AI_INSTALL_DEPLOYMENT.md](./docs/AI_INSTALL_DEPLOYMENT.md) | [docs/AI_INSTALL_DEPLOYMENT.md](./docs/AI_INSTALL_DEPLOYMENT.md) |
| API 与公开边界 | [docs/API.md](./docs/API.md) | [docs/API.md](./docs/API.md) | [docs/API.md](./docs/API.md) | [docs/API.md](./docs/API.md) |
| 数据源成熟度 | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) |
| GitHub 项目设置 | [docs/GITHUB_PROJECT_SETTINGS.md](./docs/GITHUB_PROJECT_SETTINGS.md) | [docs/GITHUB_PROJECT_SETTINGS.md](./docs/GITHUB_PROJECT_SETTINGS.md) | [docs/GITHUB_PROJECT_SETTINGS.md](./docs/GITHUB_PROJECT_SETTINGS.md) | [docs/GITHUB_PROJECT_SETTINGS.md](./docs/GITHUB_PROJECT_SETTINGS.md) |
| 部署 | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) |
| 隐私 | [docs/PRIVACY.md](./docs/PRIVACY.md) | [docs/PRIVACY.md](./docs/PRIVACY.md) | [docs/PRIVACY.md](./docs/PRIVACY.md) | [docs/PRIVACY.md](./docs/PRIVACY.md) |
| 更新日志 | [CHANGELOG.md](./CHANGELOG.md) | [CHANGELOG.md](./CHANGELOG.md) | [CHANGELOG.md](./CHANGELOG.md) | [CHANGELOG.md](./CHANGELOG.md) |

公开文档不要写入私有 provider 研究、真实凭据、原始来源响应、完整转写、数据库或本地测试数据。

---

## License

个人使用免费。商业使用需要事先取得书面授权。

BetterAINote 使用 **Apache License 2.0 之上的 BetterAINote 附加条款**，不是未修改的标准 Apache-2.0 SPDX 许可。完整条款见 [LICENSE](./LICENSE)。
