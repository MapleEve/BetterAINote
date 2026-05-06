# 更新日志

## 0.6.1-preview

### 发布说明

这个小版本继续推进 `0.6.0-preview` 之后的架构收敛和搜索能力，不再把 0.6.0 当作后续开发的终点。

### 架构

- 按 LobeHub 方向把 dashboard 和 recording detail 的业务 UI 编排层迁入 `src/features/dashboard` 与 `src/features/recordings`。
- 保留 `src/components/*` 作为通用组件、布局组件和基础 UI 组件的归属层，避免业务工作台继续堆在 components。
- 增加架构边界测试，要求 dashboard/recordings 业务 UI 不再回退到 `src/components/dashboard` 或 `src/components/recordings`。
- 将搜索的查询入口收口到 `src/server/modules/search/search-repository.ts` 与 `queries.ts`，新增 `/api/search` 作为薄 HTTP 适配层。
- 将 recordings/transcripts/speakers/tags 的搜索读模型拆到 `src/server/modules/recordings/search-read-model.ts`，搜索重建不再直接拼领域文档。
- 增加本地 SQLite FTS 查询清洗和 CJK n-gram fallback，避免把用户输入直接交给 FTS parser，同时为中文/日韩文搜索做 baseline。

## 0.6.0-preview

### 当前状态

BetterAINote 处于 `0.6.0-preview` 预发布阶段。这个版本是后续架构、数据库和 E2E 流程的 baseline SOT，当前重点是私有自托管、公开文档安全、多来源录音工作台定位和可维护的 provider 边界。

### 新增

- 简体中文默认 README，英文可切换，并保留日文、韩文项目概览；顶部加入 Remotion 生成的产品场景动效，突出多平台语音资料私有化集合与统一管理。
- AI 安装部署指南，面向让 AI 工具协助安装、部署、验收时的环境边界、命令顺序、凭据安全和检查清单。
- GitHub 项目设置说明，固化公开简介、homepage、topics/tags 和公开文案安全边界。
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
