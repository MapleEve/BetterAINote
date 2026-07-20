# 贡献指南

[English](#english)

## 中文

欢迎为 BetterAINote 提交改进。

### 基本原则

- 保持单用户产品边界
- 不重新引入已裁剪的旧平台功能
- 优先复用现有数据源、转录、speaker、rename 抽象
- 新改动必须通过类型检查和测试

### 本地开发

```bash
bun install
cp .env.example .env.local
bun run db:migrate
bun run dev
```

`bun run dev` 会同时启动 Web app 和 worker。只调网页用 `bun run dev:web`，只调后台任务用 `bun run worker`。

### 提交前检查

```bash
bun run type-check
bun run test
```

### 文档要求

- README.md 默认使用简体中文，并维护英文、日文、韩文版本
- 顶部提供语言切换链接
- 品牌统一使用 `BetterAINote`

### 变更范围建议

- 数据源接入：放在 `src/lib/data-sources`
- 转录 provider / VoScript HTTP 客户端与公开类型：放在 `src/lib/transcription/providers` 与 `src/lib/voice-transcribe`
- 同步、转录队列、API credential 选择、VoScript 访问编排、说话人审阅、AI 重命名和词级转写落盘等后端业务编排：放在 `src/server/modules`
- 前端设置业务 UI：放在 `src/features/settings/components`
- 前端设置状态：放在 `src/features/settings`
- 数据库：使用当前的分库 schema 与 baseline migration

## English

Contributions to BetterAINote are welcome.

### Principles

- keep the single-user product boundary
- do not reintroduce trimmed legacy platform features
- reuse the existing source, transcription, speaker, and rename abstractions
- pass type-check and tests before submitting changes

### Local development

```bash
bun install
cp .env.example .env.local
bun run db:migrate
bun run dev
```

`bun run dev` starts both the web app and worker. Use `bun run dev:web` for web-only work, or `bun run worker` for background jobs.

### Required checks

```bash
bun run type-check
bun run test
```

### Documentation

- Keep `README.md` as the Simplified Chinese default entry.
- Keep `README.en.md`, `README.ja.md`, and `README.ko.md` aligned with the public positioning.
- Do not move credentials, raw source responses, transcripts, or local test data into public docs.

### Change Areas

- Source providers: `src/lib/data-sources`
- Transcription providers plus VoScript HTTP clients and public types: `src/lib/transcription/providers` and `src/lib/voice-transcribe`
- Backend orchestration for sync, transcription queues, API credential selection, VoScript access, speaker review, AI rename, and word-level transcript persistence: `src/server/modules`
- Settings UI: `src/features/settings/components`
- Settings state: `src/features/settings`
- Databases: keep the current shard schemas and baseline migrations
