# src/app/api/recordings/[id]/transcript/speakers 分层指南

## 目录职责
带说话人视图的转写 API，复用 transcript-read 与 speaker-map。

## 真实文件
- `route.ts`

## 下级入口
- 本层没有更深的已跟踪源码目录。

## 可改范围
- 可以调整本目录真实文件和同级测试所覆盖的行为。
- 跨目录移动、公共类型变化、数据库结构变化、路由响应变化必须同步更新调用方和测试。
- 新增文件时优先放在最具体的叶子目录，并补充对应 AGENTS.md 指针或规则。

## 禁止事项
- 禁止提交真实 token、Cookie、HAR、私有录音、私有转写、数据库内容和未脱敏来源标识。
- 禁止把敏感或未脱敏材料写入公开 UI、公开文档、测试快照或注释。
- 禁止绕过认证、归属校验、公开错误映射和 provider 中立文案。

## 依赖方向
依赖方向是 route.ts 到 src/server/modules，再到 src/lib 或 src/db；禁止从 API route 反向引用浏览器组件。

## 状态和数据流
状态和数据流从请求参数进入 route.ts，经认证和 zod 或显式校验后进入 server 模块，响应必须经过公开错误映射。

## 测试要求
- 首选验证：就近运行相关 src/tests/*.test.ts；跨类型或跨模块时补跑 bun run type-check。
- 修改类型边界、路由响应或跨模块契约时，加跑 `bun run type-check`。
- 涉及公开文档、发布卫生或路径重排时，加跑公开残留和 secret 扫描。

## 内层覆盖条件
- 本文件只在 `src/app/api/recordings/[id]/transcript/speakers/` 及其子目录内生效，子目录 AGENTS.md 可以收紧规则。
- 如果子目录需要放宽外层规则，必须写明目录范围、被放宽的规则、原因、验证命令和不外溢边界。
- 任何内层规则都不得放宽 secrets、私人录音、私人转写、破坏性 git 操作和公开泄漏红线。
