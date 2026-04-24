# 部署说明

## 适用对象

这篇面向准备在本机、家用服务器、私有服务器或容器环境中运行 BetterAINote 的用户。当前重点是私有自托管，不是公共 SaaS、桌面发行版或公开镜像发布。

## 当前状态

| 项目 | 说明 |
| --- | --- |
| 阶段 | `preview` |
| 发布 | 第一次公开提交后仍不发布正式 release |
| Docker | 可以本地构建；发布工作流手动触发且默认关闭 |
| Release | Release notes 工作流手动触发且默认关闭，只在发布计划批准后使用 |
| CI | `pnpm format-and-lint`、`pnpm type-check`、测试和构建可在 CI 中运行 |
| 推荐部署 | 自己控制的本机、私有服务器或可信容器环境 |

## 运行形态

```text
浏览器
  │
  ▼
Next.js app ──► SQLite 数据库组
  │                 ├─ betterainote.db
  │                 ├─ betterainote-library.db
  │                 ├─ betterainote-transcripts.db
  │                 ├─ betterainote-voiceprints.db
  │                 └─ betterainote-words.db
  │
  ├─► worker：同步检查 / 转写调度 / 队列任务
  │
  └─► storage：本地录音归档目录
```

Desktop packaging 不在当前部署边界内。

## 本地自托管

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

默认地址是 `http://localhost:3001`。

最少需要配置：

```env
DATABASE_PATH=./data/betterainote.db
LOCAL_STORAGE_PATH=./storage
APP_URL=http://localhost:3001
BETTER_AUTH_SECRET=<generate-a-strong-secret>
ENCRYPTION_KEY=<generate-a-strong-64-char-hex-key>
```

`BETTER_AUTH_SECRET` 和 `ENCRYPTION_KEY` 必须按部署环境生成，不要复用示例值。

## Docker 自托管

本地构建运行：

```bash
docker compose up -d --build app worker
```

推荐挂载：

- `/app/data`：SQLite 数据库目录。
- `/app/audio`：本地录音归档目录。

示例环境形状：

```env
DATABASE_PATH=/app/data/betterainote.db
APP_URL=http://localhost:3001
LOCAL_STORAGE_PATH=/app/audio
BETTER_AUTH_SECRET=<generate-a-strong-secret>
ENCRYPTION_KEY=<generate-a-strong-64-char-hex-key>
```

不要把私有凭据打进镜像。需要发布镜像时，必须先明确发布计划，再手动开启对应 workflow。

## 数据边界

BetterAINote 默认使用本地 SQLite 和本地文件目录：

| 数据 | 默认位置 / 说明 |
| --- | --- |
| 核心设置 | `DATABASE_PATH` 指向的 `betterainote.db` |
| 录音库和任务状态 | `betterainote-library.db` |
| 转写文本和来源报告 | `betterainote-transcripts.db` |
| 说话人和声纹关联 | `betterainote-voiceprints.db` |
| 词级时间数据 | `betterainote-words.db`，可用 `TRANSCRIPT_WORDS_DATABASE_PATH` 覆盖 |
| 本地音频 | `LOCAL_STORAGE_PATH` |

备份时请把数据库目录和音频归档目录一起处理，否则恢复后可能出现记录存在但音频缺失的情况。

## 配置分区

| 区域 | 说明 |
| --- | --- |
| `Data Sources` | 录音来源账号连接。 |
| `Sync` | worker 自动同步和手动同步。 |
| `VoScript` | 私有转写服务。 |
| `Transcription` | 通用转写偏好。 |
| `AI Rename` | 标题生成服务和重命名策略。 |
| `Playback` / `Display` | 本地使用体验。 |

Provider 凭据、转写凭据、AI 服务密钥和非敏感偏好应按区域分开管理。

## 工作流说明

- CI workflow 可以在 push / pull request 上运行，用于 lint、type-check、test 和 build。
- Docker workflow 有 `workflow_dispatch` 和 `allow_publish` 开关，默认不发布。
- Release workflow 有 `workflow_dispatch` 和 `allow_release` 开关，默认不创建正式发布。
- Stale 维护 workflow 默认关闭，不在 preview 阶段自动处理 Issue。

这符合当前状态：preview、自托管优先、不发布。

## 部署安全清单

- 使用强随机 `BETTER_AUTH_SECRET` 和 `ENCRYPTION_KEY`。
- `.env.local`、数据库、音频归档、来源凭据、服务密钥都不要进 git。
- 不要把 Web 面板直接暴露到公网；如需远程访问，请放在 VPN、反向代理、TLS 和访问控制之后。
- 限制运行用户对数据库目录和音频目录的访问权限。
- 公开反馈前先脱敏日志、截图和错误响应。

## 相关链接

- [README](../README.md)
- [开发文档](./DEVELOPMENT.md)
- [数据源说明](./DATA_SOURCES.md)
- [隐私说明](./PRIVACY.md)
- [安全策略](../SECURITY.md)
