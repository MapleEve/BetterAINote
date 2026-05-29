# BetterAINote Agent 指南

## 加载顺序

先读取本文件，再沿着将要修改的路径读取更近的 AGENTS.md。越靠近目标文件的规则越具体。CLAUDE.md 只是桥接提醒，AGENTS.md 是唯一规范来源。

本地机器说明只能写入被忽略的 AGENTS.local.md、CLAUDE.local.md 或 LOCAL-MATERIALS.md 指定的本地目录，不能写进 tracked 公开文件。

## 仓库意图

BetterAINote 是隐私优先、可自托管、provider 中立的多平台录音聚合、转写、搜索和管理工作台。公开表达必须面向用户，避免把内部调查、实现证据或 provider 私有材料带到公开表面。

## 目录索引

- `src/AGENTS.md`：源码架构、依赖方向和子目录加载地图。
- `src/app/AGENTS.md`：App Router 页面、布局和 API route 适配边界。
- `src/features/AGENTS.md`：浏览器端工作台、组件、store 和 hook 边界。
- `src/server/AGENTS.md`：服务端业务模块、权限、持久化和副作用边界。
- `src/lib/AGENTS.md`：共享领域工具、provider 抽象、设置、存储、平台封装和公开错误映射。
- `src/db/AGENTS.md`：schema、迁移、数据库路径和迁移入口。
- `src/tests/AGENTS.md`：Vitest 覆盖、架构护栏和公开发布卫生测试。
- `.github/AGENTS.md`：GitHub 模板、workflow 和公开自动化边界。
- `docs/AGENTS.md`：公开文档和文档资产规则。
- `public/AGENTS.md`：运行时公开静态资源规则。
- `scripts/AGENTS.md`：已跟踪脚本和安全本地自动化规则。
- `LOCAL-MATERIALS.md`：被忽略本地资料目录的分层约定。

## 公共红线

- 不提交真实 token、密码、私有 ID、浏览器会话材料、本地数据库、私有录音、私有转写或 provider 私有来源材料。
- 不在公开文档、UI 文案、注释、测试或 issue 模板中暴露内部研究、抓包细节、请求归档、实现专用标签或本地证据路径。
- 不把公开定位改成非隐私优先、非可自托管或偏向单一 provider 的表达。
- 不修改 license、package privacy、release automation 或发布行为，除非任务明确要求检查发布边界。
- 不删除被忽略本地资料，例如 tmp、data、storage、录音、数据库、worker 日志，除非用户明确要求。
- 不运行破坏性 git 命令，不覆盖用户工作；改动前检查 `git status --short --branch`。

## 跨层耦合

页面和 feature、API route 和 server 模块、设置 UI 和 settings 模块、录音 UI 和 recordings 模块、provider UI 和 provider 抽象、搜索 route 和 search 模块、数据库 shape 和迁移加读写测试必须一起维护。

## 验证门槛

- 说明文档或规则变更：运行 `git diff --check`，检查最终 diff，并用 `git check-ignore -v` 验证本地资料忽略边界。
- 源码变更：运行最窄相关测试；触碰类型边界时运行 `bun run type-check`。
- 公开文档、发布或卫生变更：运行公开残留扫描和 secret/private-data 扫描。
- 大范围变更：优先运行 `bun run format-and-lint`、`bun run type-check`、`bun run test`。

## Git、签名和提交

- 提交前确认 author 和 committer 是 `Maple Gao <esanisa@gmail.com>`。
- 本仓库提交必须使用 SSH 签名，保留 `commit.gpgsign=true` 和 `gpg.format=ssh`。
- 不 push `origin/main`，审查工作使用 `mini/` 前缀分支。
- staged 范围必须只包含任务相关文件；不要把 ignored 本地资料、依赖产物、数据库或日志加入提交。
