# src/app/api/settings/voscript/test 分层指南

## 目录职责
VoScript 连接测试 API，只验证当前表单里的服务连接，不持久化地址或密钥。

## 真实文件
- `route.ts`

## 下级入口
- 本层没有更深的已跟踪源码目录。

## 可改范围
- 可以调整本目录真实文件和同级测试所覆盖的行为。
- 变更请求体、响应字段或公开错误语义时必须同步更新 `src/services/voscript-settings.ts`、设置 UI 和 route 测试。

## 禁止事项
- 禁止记录、返回或提交真实 API Key、服务私有响应、私有录音、私有转写和 provider 私有标识。
- 禁止把测试连接写入 `user_settings` 或 `api_credentials`。

## 依赖方向
route 只做认证、请求体校验、公开错误映射，并委派到 `src/lib/voice-transcribe` 或 `src/server/modules/voice-transcribe`。

## 验证
- 首选验证：`bunx vitest run src/tests/voscript-test-route.test.ts src/tests/services-and-settings-coverage.test.ts src/tests/settings-ui-replacement-regression.test.ts`。
- 修改跨类型契约时补跑 `bun run type-check`。
