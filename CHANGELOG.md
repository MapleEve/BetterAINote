# 更新日志

## 0.6.0-preview

### 当前状态

BetterAINote 处于 `0.6.0-preview` 预发布阶段。这个版本是后续架构、数据库和 E2E 流程的 baseline SOT，当前重点是私有自托管、公开文档安全、多来源录音工作台定位和可维护的 provider 边界。

### 新增

- 英文优先 README，并补齐简体中文、日文、韩文项目概览，按公开项目风格说明定位、快速开始、文档入口、隐私、安全、许可和贡献提醒。
- 数据源说明，面向普通用户解释钉钉 / A1 / 闪记、TicNote、Plaud、飞书妙记、讯飞听见的成熟度和限制。
- API 文档，明确 preview 阶段公开 API 形状、错误语义和 `source-report` 脱敏边界。
- 部署文档，说明本地 SQLite、storage、worker、CI、Docker 和 Release 工作流的状态。
- 隐私和安全文档，统一 provider 凭据、日志、Issue、截图和网络抓包文件的脱敏要求。
- VoScript 风格 License：前置中英文附加条款，个人使用免费，商业使用需事先书面授权，后置 Apache License 2.0 原文。
- LobeHub 方向的服务分层 baseline：API route 只保留 HTTP 适配职责，录音、说话人、搜索、来源报告等业务写入 `src/server/modules/*`。
- 面向全文搜索的 SQLite baseline：拆分 core/library/transcripts/voiceprints/words/search 分片，搜索 sidecar 覆盖 recordings、transcripts、speakers 和 tags。

### 已有能力

- Web app + worker 的私有录音工作台运行形态。
- 本地 SQLite 拆分存储：核心设置、录音库、转写、说话人、词级时间和可重建搜索索引。
- `Data Sources`、`Sync`、`VoScript`、`Transcription`、`AI Rename`、`Playback`、`Display` 设置区域。
- 支持来源报告、私有转写、说话人审阅、本地标题编辑和可选标题写回。

### 发布说明

- `package.json` 保持 `private: true`，不发布 npm 包。
- Docker 发布 workflow 和 Release workflow 均为手动触发且默认关闭。
- `0.6.0-preview` 可以作为预发布版本归档；暂不面向公开托管或商业分发场景提供稳定承诺。

### 注意

- TicNote 和 Plaud 的标题写回只在启用且来源接受时生效。
- 钉钉、飞书妙记、讯飞听见等来源能力取决于账号权限和来源返回内容。
- 公开反馈前必须脱敏日志、截图、错误响应和示例数据。
