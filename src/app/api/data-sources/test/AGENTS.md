# src/app/api/data-sources/test 分层指南

## 目录职责
数据源连接测试 API，只验证当前提交的连接信息，不持久化设置、设备或同步状态。

## 真实文件
- `route.ts`

## 下级入口
- 本层没有更深的已跟踪源码目录。

## 可改范围
- 可以调整本目录真实文件和同级测试所覆盖的行为。
- 跨目录移动、公共类型变化、数据库结构变化、路由响应变化必须同步更新调用方和测试。

## 禁止事项
- 禁止提交真实 token、Cookie、HAR、私有录音、私有转写、数据库内容和 provider 私有标识。
- 禁止把内部研究、抓包过程、调试证据或本地路径写入公开 UI、公开文档、测试快照或注释。
- 禁止在测试接口中写入 `sourceConnections`、source devices、同步状态或 worker 队列。

## 依赖方向
依赖方向是 route.ts 到 src/server/modules/data-sources；禁止从 API route 引用浏览器组件。

## 测试要求
- 首选验证：src/tests/data-sources-route.test.ts
- 修改路由响应或跨模块契约时，加跑 `bun run type-check`。
