# src/tests 分层指南

## 目录职责
Vitest 测试目录，覆盖边界、服务、UI 回归和公开发布卫生。

## 真实文件
- `audio-format.test.ts`
- `auth-registration.test.ts`
- `backend-boundary-regression.test.ts`
- `ci-integrations.test.ts`
- `dashboard-search-ui-regression.test.ts`
- `dashboard-transcription-polling.test.ts`
- `data-source-utils.test.ts`
- `data-sources-presentation.test.ts`
- `data-sources-route.test.ts`
- `data-sources-sync-route.test.ts`
- `dev-with-worker-script.test.ts`
- `dingtalk-provider.test.ts`
- `display-settings-store.test.ts`
- `e2e-reset-rules.test.ts`
- `encryption.test.ts`
- `errors.test.ts`
- `feishu-minutes-provider.test.ts`
- `frontend-data-sources-regression.test.ts`
- `generate-title.test.ts`
- `iflyrec-provider.test.ts`
- `platform-runtime.test.ts`
- `plaud.integration.test.ts`
- `plaud.test.ts`
- `playback-settings-store.test.ts`
- `preview-architecture-boundary.test.ts`
- `preview-database-foundation.test.ts`
- `preview-performance-boundary.test.ts`
- `provider-factory.test.ts`
- `public-release-hygiene.test.ts`
- `public-version-contract.test.ts`
- `react-surface-ssr.test.ts`
- `recording-player-regression.test.ts`
- `recording-speaker-map-module.test.ts`
- `recording-speaker-map-route.test.ts`
- `recording-speakers-module.test.ts`
- `recording-speakers-route.test.ts`
- `recording-transcript-read-module.test.ts`
- `recording-transcript-read-routes.test.ts`
- `rename-auto-route.test.ts`
- `rename-route.test.ts`
- `repetition-detection.test.ts`
- `search-bm25-sqlite-boundary.test.ts`
- `search-fts-maintenance.test.ts`
- `search-index-writer.test.ts`
- `search-indexer.test.ts`
- `search-job-processor.test.ts`
- `search-read-model.test.ts`
- `search-repository.test.ts`
- `search-route.test.ts`
- `search-segmenter.test.ts`
- `search-tokenization.test.ts`
- `search-write-path-contract.test.ts`
- `search-writeback-integration.test.ts`
- `service-url.test.ts`
- `services-and-settings-coverage.test.ts`
- `settings-section-routes.test.ts`
- `source-connections.test.ts`
- `source-report-route.test.ts`
- `source-title-writeback.test.ts`
- `speaker-blank-lines.test.ts`
- `speaker-label-editor-regression.test.ts`
- `speaker-profiles-route.test.ts`
- `speakers.test.ts`
- `sync-settings-store.test.ts`
- `sync-worker.test.ts`
- `sync.test.ts`
- `ticnote-provider.test.ts`
- `title-generation-config.test.ts`
- `title-generation-settings-store.test.ts`
- `transcribe-route.test.ts`
- `transcription-jobs.test.ts`
- `transcription-settings-store.test.ts`
- `transcription.test.ts`
- `trimmed-surface.test.ts`
- `use-recording-playback.test.ts`
- `utils.test.ts`
- `voice-transcribe-provider.test.ts`
- `voice-transcribe-service.test.ts`
- `voiceprints.test.ts`
- `voscript-settings-store.test.ts`
- `word-artifacts.test.ts`
- `worker-state.test.ts`

## 下级入口
- 本层没有更深的已跟踪源码目录。

## 可改范围
- 可以调整本目录真实文件和同级测试所覆盖的行为。
- 跨目录移动、公共类型变化、数据库结构变化、路由响应变化必须同步更新调用方和测试。
- 新增文件时优先放在最具体的叶子目录，并补充对应 AGENTS.md 指针或规则。

## 禁止事项
- 禁止提交真实 token、Cookie、HAR、私有录音、私有转写、数据库内容和未脱敏来源标识。
- 禁止把敏感、未脱敏或非公开材料写入公开 UI、公开文档、测试快照或注释。
- 禁止绕过认证、归属校验、公开错误映射和 provider 中立文案。

## 依赖方向
依赖方向必须遵守 src 根规则；更近目录的 AGENTS.md 可以收紧实现细节。

## 状态和数据流
状态和数据流应在本目录内保持单向、可追踪，并由测试覆盖关键分支。

## 测试要求
- 首选验证：bun run test
- 修改类型边界、路由响应或跨模块契约时，加跑 `bun run type-check`。
- 涉及公开文档、发布卫生或路径重排时，加跑公开残留和 secret 扫描。

## 内层覆盖条件
- 本文件只在 `src/tests/` 及其子目录内生效，子目录 AGENTS.md 可以收紧规则。
- 如果子目录需要放宽外层规则，必须写明目录范围、被放宽的规则、原因、验证命令和不外溢边界。
- 任何内层规则都不得放宽 secrets、私人录音、私人转写、破坏性 git 操作和公开泄漏红线。
