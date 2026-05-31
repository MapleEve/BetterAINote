# src/features/dashboard 分层指南

## 目录职责
仪表盘工作台、搜索、列表和转写轮询。

## 真实文件
- `transcription-polling.ts`
- `workstation.tsx`

## 下级入口
- `src/features/dashboard/components/`

## 可改范围
- 可以调整本目录真实文件和同级测试所覆盖的行为。
- 跨目录移动、公共类型变化、数据库结构变化、路由响应变化必须同步更新调用方和测试。
- 新增文件时优先放在最具体的叶子目录，并补充对应 AGENTS.md 指针或规则。

## 禁止事项
- 禁止提交真实 token、Cookie、HAR、私有录音、私有转写、数据库内容和未脱敏来源标识。
- 禁止把敏感或未脱敏材料写入公开 UI、公开文档、测试快照或注释。
- 禁止绕过认证、归属校验、公开错误映射和 provider 中立文案。

## 依赖方向
依赖方向是 feature 组件调用 src/services、src/lib 的公开客户端工具和 src/components/ui；禁止直接导入 src/server 或 src/db。

## 状态和数据流
状态和数据流从页面 props、store、hook 或 service 响应进入组件；本地交互状态留在组件或对应 store，不写入全局单例。

## 测试要求
- 首选验证：src/tests/dashboard-search-ui-regression.test.ts、src/tests/dashboard-transcription-polling.test.ts
- 修改类型边界、路由响应或跨模块契约时，加跑 `bun run type-check`。
- 涉及公开文档、发布卫生或路径重排时，加跑公开残留和 secret 扫描。

## 内层覆盖条件
- 本文件只在 `src/features/dashboard/` 及其子目录内生效，子目录 AGENTS.md 可以收紧规则。
- 如果子目录需要放宽外层规则，必须写明目录范围、被放宽的规则、原因、验证命令和不外溢边界。
- 任何内层规则都不得放宽 secrets、私人录音、私人转写、破坏性 git 操作和公开泄漏红线。
