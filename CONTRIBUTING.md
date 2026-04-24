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
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

### 提交前检查

```bash
pnpm type-check
pnpm test
```

### 文档要求

- 中文优先
- 顶部提供英文锚点链接
- 品牌统一使用 `BetterAINote`

### 变更范围建议

- 数据源接入：放在 `src/lib/data-sources`
- 转录服务：放在 `src/lib/transcription` 与 `src/lib/voice-transcribe`
- 前端设置：放在 `src/components/settings-sections`
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
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

### Required checks

```bash
pnpm type-check
pnpm test
```
