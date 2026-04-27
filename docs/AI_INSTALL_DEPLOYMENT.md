# AI 安装部署指南

这篇给协助安装或部署 BetterAINote 的 AI 工具使用。默认目标是私有自托管：把多个语言平台的语音资料集合到一个本地工作台，并围绕本地数据库、录音归档、私有转写和后续搜索能力统一管理。

不要把真实 token、cookie、数据库、音频、转写内容、截图里的账号状态或本地私有路径写进公开文档、Issue、PR、日志片段或命令记录。

## 先确认什么

开始前先向用户确认这些信息，不要猜：

| 项目 | 需要确认 |
| --- | --- |
| 运行位置 | 本机、家用服务器、私有服务器、NAS 或自建容器环境。 |
| 访问地址 | 例如 `http://localhost:3001`，或用户自己控制的域名。 |
| 数据目录 | SQLite 数据库目录和本地音频归档目录。 |
| 启动方式 | 本地 Bun、分离 app / worker，或本地构建 Docker Compose。 |
| 转写服务 | VoScript 或其他私有转写服务地址与凭据。 |
| 数据源 | 钉钉 / A1、TicNote、Plaud、飞书妙记、讯飞听见等需要接入哪些。 |
| 公开边界 | 是否会截图、开 Issue、发 PR；如会，必须先脱敏。 |

## 基线约束

- 包管理器使用 Bun，当前基线是 `bun@1.2.20`。
- `package.json` 保持 `private: true`，当前不发布 npm 包。
- 公开 Docker 镜像不在 preview 默认发布范围内；可以在私有环境本地构建。
- `bun run dev` 同时启动 Web app 和后台 worker。
- SQLite 按 core、library、transcripts、voiceprints、words 和可重建 search sidecar 分片。
- 搜索后续覆盖 recordings、transcripts、speakers 和 tags，因此部署时不要把数据库合并成一个临时文件。

## 本地安装

```bash
bun install
cp .env.example .env.local
bun run db:migrate
bun run dev
```

默认打开 `http://localhost:3001`。创建第一个管理员账号后，在设置页配置数据源、VoScript、转写、AI Rename、同步、播放和显示偏好。

如果只启动网页：

```bash
bun run dev:web
```

如果只启动 worker：

```bash
bun run worker
```

## 必填环境变量

```env
DATABASE_PATH=./data/betterainote.db
LOCAL_STORAGE_PATH=./storage
APP_URL=http://localhost:3001
BETTER_AUTH_SECRET=<generate-a-strong-secret>
ENCRYPTION_KEY=<generate-a-strong-64-char-hex-key>
```

可选覆盖：

```env
TRANSCRIPT_WORDS_DATABASE_PATH=./data/betterainote-words.db
```

`BETTER_AUTH_SECRET` 和 `ENCRYPTION_KEY` 必须按部署环境生成。不要复用示例值，不要把 `.env.local` 提交到仓库。

## Docker 私有部署

本地构建：

```bash
docker compose up -d --build app worker
```

推荐挂载：

| 路径 | 说明 |
| --- | --- |
| `/app/data` | SQLite 数据库目录。 |
| `/app/audio` | 本地录音归档目录。 |

示例：

```env
DATABASE_PATH=/app/data/betterainote.db
LOCAL_STORAGE_PATH=/app/audio
APP_URL=http://localhost:3001
BETTER_AUTH_SECRET=<generate-a-strong-secret>
ENCRYPTION_KEY=<generate-a-strong-64-char-hex-key>
```

不要把 provider 凭据、VoScript 凭据或 AI 服务密钥打进镜像。

## AI 工具执行边界

可以执行：

- 检查 Bun 版本、安装依赖、运行迁移、启动 app / worker。
- 生成随机 secret，并把占位值替换到用户指定的私有环境文件。
- 根据用户提供的私有地址测试登录页、设置页、数据源页、录音列表和转写页。
- 运行本地校验命令，并把失败点解释清楚。

不要执行：

- 删除用户已有数据库、音频归档或声纹数据，除非用户明确要求。
- 把真实 provider token、cookie、VoScript 密钥或 AI 服务密钥写入公开文件。
- 把登录态截图、录音标题、逐字稿、组织 ID、用户 ID、录音 ID 或抓包内容发到公开渠道。
- 为了省事跳过 worker；真实 provider 同步和转写调度必须覆盖 worker。

## 验收命令

```bash
bun install --frozen-lockfile --ignore-scripts
bun run format-and-lint
bun run type-check
bun run test
bun run build
bun run db:migrate
```

需要检查 UI 时，打开 `APP_URL`，至少覆盖：

- 注册 / 登录。
- `Data Sources` 设置与真实 provider 配置。
- 手动同步和 worker 自动同步。
- 录音列表、录音详情、来源信息。
- 转写输出、来源逐字稿、说话人标签。
- VoScript 设置与转写任务状态。
- AI Rename 设置和本地标题编辑。
- 搜索入口准备状态：recordings、transcripts、speakers、tags。

## 升级和备份

升级前先备份：

- `DATABASE_PATH` 所在目录。
- `LOCAL_STORAGE_PATH`。
- 如果覆盖了 `TRANSCRIPT_WORDS_DATABASE_PATH`，也要单独备份。

不要清空 VoScript 后端的声纹或说话人数据。BetterAINote 只负责自己的本地记录、索引和展示；转写服务自己的持久化数据由转写服务管理。

## 相关文档

- [README](../README.md)
- [部署说明](./DEPLOYMENT.md)
- [数据源说明](./DATA_SOURCES.md)
- [隐私说明](./PRIVACY.md)
- [安全策略](../SECURITY.md)
