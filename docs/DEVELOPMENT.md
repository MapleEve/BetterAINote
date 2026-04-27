# 开发文档

## 适用对象

这篇面向 BetterAINote 贡献者和本地二次开发者。它说明当前 preview 阶段的开发边界、数据边界和公开文档口径，不替代源码里的类型和测试。

## 当前状态

- BetterAINote 是独立的多来源私有录音工作台。
- `0.6.0-preview` 是架构、数据库和 E2E 流程的 baseline SOT，不再把核心分层和 SQLite 形状当作后续可选优化。
- 当前优先级是自托管、数据安全、文档清晰和可维护的 provider 边界。
- 首个正式 release 前，API、设置项、数据源能力和 UI 细节仍可能调整。
- 不发布 npm 包；`package.json` 保持 `private: true`。
- 不在文档或 UI 中把某一个来源写成产品唯一中心。

## 本地启动

```bash
bun install
cp .env.example .env.local
bun run db:migrate
bun run dev
```

默认：

- Web URL：`http://localhost:3001`
- `bun run dev`：执行 `scripts/dev-with-worker.mjs`，同时启动 Next.js Web app 和后台 worker。
- `bun run dev:web`：只启动 Next.js Web app，适合只调前端和 API。
- `bun run worker`：只启动后台 worker，适合同步、转写调度和队列任务调试。

## 常用检查

```bash
bun run format-and-lint
bun run type-check
bun run test
bun run db:migrate
```

文档改动至少要跑格式 / lint、类型检查和任务要求的敏感词扫描。`bun run type-check` 如果生成 `tsconfig.tsbuildinfo`，结束前删除。

## 产品边界

| 边界 | 要求 |
| --- | --- |
| 多来源 | 钉钉、TicNote、Plaud、飞书妙记、讯飞听见等都应通过 provider 模型表达能力。 |
| 私有部署 | 默认用户是自己控制实例、数据库、音频和服务凭据的人。 |
| 服务分层 | 数据源、私有转写、AI 标题生成、播放和显示设置相互独立。 |
| preview | 不承诺所有字段和 API 在首个正式 release 前稳定。 |
| 文档 | README 以英文为主入口，并维护简体中文、日文、韩文版本；技术 docs 可逐步补齐。 |

## 架构 baseline

`0.6.0-preview` 起，代码结构按 LobeHub 方向收敛为清晰的模块边界：

- `src/app/api/**/route.ts` 只做 HTTP 输入输出、session 校验和状态码映射。
- 业务 SOT 放在 `src/server/modules/*`，例如 recordings、recording-tags、speakers、search 和 data-sources。
- `src/features/*` 承担前端业务编排和 hook，`src/components/*` 承担可复用界面组件。
- Provider 专属协议、凭据归一化、来源错误和能力表达留在 `src/lib/data-sources/providers/*`。
- API route 不直接访问 `@/db`、`@/db/schema` 或 `drizzle-orm`；这个边界由 preview architecture 测试守住。

## 设置 IA

| 分组 | Section |
| --- | --- |
| Transcription & Services | `Transcription`, `AI Rename`, `VoScript` |
| Data Sources & Connections | `Data Sources`, `Sync` |
| App & Interface | `Playback`, `Display` |

职责：

- `Data Sources`：录音来源连接和来源能力展示。
- `Sync`：worker 同步间隔、手动同步和状态。
- `VoScript`：私有转写服务地址和凭据状态。
- `Transcription`：转写默认行为。
- `AI Rename`：标题生成和写回策略。
- `Playback`：音频播放行为。
- `Display`：本地 UI 偏好。

## 数据布局

主数据库由环境变量指定：

```env
DATABASE_PATH=./data/betterainote.db
```

相关 SQLite 文件派生在同一目录：

- `betterainote.db`：认证、设置、来源连接、服务凭据元数据。
- `betterainote-library.db`：录音库和任务状态。
- `betterainote-transcripts.db`：转写文本、来源报告和相关元数据。
- `betterainote-voiceprints.db`：说话人档案和说话人审阅状态。
- `betterainote-words.db`：可选词级时间数据。
- `betterainote-search.db`：可重建全文搜索 sidecar，覆盖 recordings、transcripts、speakers 和 tags。

本地音频由 `LOCAL_STORAGE_PATH` 控制。

`0.6.0-preview` 的数据库以每个分片的 `0000_*_baseline.sql` 作为初始公开基线。preview 发布前不要保留开发过程中拆出来的零散 migration；后续版本再从这个 baseline 往前追加可审计 migration。

## Provider 开发约定

新增或修改数据源时：

- Provider 专属解析、凭据处理和来源错误转换必须留在 provider 层。
- UI 只消费安全的能力标识和展示字段。
- 标题写回必须作为 provider capability 表达，不能假设所有来源都支持。
- 来源报告只能返回公开安全形状，不能把上游原始响应透出给浏览器。
- 公开错误信息要面向用户可处理的问题，不暴露内部请求上下文。
- 测试 fixture 只能使用脱敏样例。

## 敏感信息边界

不要提交或公开：

- `.env.local`、数据库、音频归档、完整转写、账号页面截图。
- 数据源 cookie、bearer、刷新凭据、组织 / 用户 / 录音 ID。
- VoScript、AI 标题服务、对象存储或其它服务密钥。
- 网络抓包文件、完整来源响应、内部排查记录或本地私有路径。

Issue 和 PR 模板应提醒贡献者只提供脱敏日志、字段名、HTTP 状态和最小复现步骤。

## 公开文档规则

- README 以英文为主入口，并维护简体中文、日文、韩文版本。
- 必须说明 `preview`、自托管优先、`0.6.0-preview` 可做预发布归档，但不发布 npm 包或公开镜像。
- License 口径统一为“个人免费，商业使用须事先取得书面授权；条款为 BetterAINote Additional Terms on top of Apache License 2.0”。
- 不写会让 BetterAINote 像某个来源派生项目的措辞。
- 不记录来源内部协议、未公开计划或本地研究材料。

## 相关链接

- [README](../README.md)
- [API 参考](./API.md)
- [数据源说明](./DATA_SOURCES.md)
- [部署说明](./DEPLOYMENT.md)
- [隐私说明](./PRIVACY.md)
- [安全策略](../SECURITY.md)
