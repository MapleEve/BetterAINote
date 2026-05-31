# src/lib 分层指南

## 目录职责
共享领域能力、平台抽象、公开错误和 provider 抽象。

## 真实文件
- `auth-client.ts`
- `auth-server.ts`
- `auth.ts`
- `encryption.ts`
- `env.ts`
- `errors.ts`
- `format-date.ts`
- `i18n.ts`
- `recording-tags.ts`
- `registration.ts`
- `service-url.ts`
- `speakers.ts`
- `utils.ts`

## 下级入口
- `src/lib/ai/`
- `src/lib/api-credentials/`
- `src/lib/audio/`
- `src/lib/data-sources/`
- `src/lib/platform/`
- `src/lib/search/`
- `src/lib/settings/`
- `src/lib/storage/`
- `src/lib/sync/`
- `src/lib/transcription/`
- `src/lib/voice-transcribe/`

## 可改范围
- 可以调整本目录真实文件和同级测试所覆盖的行为。
- 跨目录移动、公共类型变化、数据库结构变化、路由响应变化必须同步更新调用方和测试。
- 新增文件时优先放在最具体的叶子目录，并补充对应 AGENTS.md 指针或规则。

## 禁止事项
- 禁止提交真实 token、Cookie、HAR、私有录音、私有转写、数据库内容和未脱敏来源标识。
- 禁止把敏感、未脱敏或非公开材料写入公开 UI、公开文档、测试快照或注释。
- 禁止绕过认证、归属校验、公开错误映射和 provider 中立文案。

## 依赖方向
依赖方向是 lib 提供稳定领域抽象给 app、features、server、worker；禁止依赖页面层和浏览器 UI。

## 状态和数据流
状态和数据流以纯函数、provider 接口、设置 schema 或客户端封装表达；不得把真实凭据和私有响应写入常量。

## 测试要求
- 首选验证：就近运行相关 src/tests/*.test.ts；跨类型或跨模块时补跑 bun run type-check。
- 修改类型边界、路由响应或跨模块契约时，加跑 `bun run type-check`。
- 涉及公开文档、发布卫生或路径重排时，加跑公开残留和 secret 扫描。

## 内层覆盖条件
- 本文件只在 `src/lib/` 及其子目录内生效，子目录 AGENTS.md 可以收紧规则。
- 如果子目录需要放宽外层规则，必须写明目录范围、被放宽的规则、原因、验证命令和不外溢边界。
- 任何内层规则都不得放宽 secrets、私人录音、私人转写、破坏性 git 操作和公开泄漏红线。
