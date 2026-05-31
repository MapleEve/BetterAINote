# GitHub 项目设置

这篇用于维护 BetterAINote 在 GitHub 上的公开项目描述、homepage 和 topics/tags。公开定位必须围绕：多个语言平台的语音资料私有化集合，统一管理。

## 推荐公开简介

```text
多平台语音资料私有化集合与统一管理工作台
```

英文语义：

```text
Private self-hosted workspace for multi-platform voice record aggregation and unified management
```

## Homepage

```text
https://github.com/MapleEve/BetterAINote#readme
```

## Topics / tags

```text
betterainote
self-hosted
voice-notes
recording-management
transcription
speaker-diarization
sqlite
nextjs
bun
privacy-first
meeting-notes
ai-notes
```

## Repository secrets

这些值只配置在 GitHub Repository secrets，不写入文档、代码、日志或 issue。

```text
CODECOV_TOKEN
FOSSA_API_KEY
ANTHROPIC_API_KEY
ANTHROPIC_BASE_URL
GH_TOKEN
```

- `CODECOV_TOKEN`：Codecov 上传令牌，用于 CI 上传覆盖率和测试结果。
- `FOSSA_API_KEY`：FOSSA 扫描令牌，用于依赖 license / policy 检查。
- 没有配置 `FOSSA_API_KEY` 时，FOSSA workflow 会跳过扫描，不阻塞普通 CI。
- `ANTHROPIC_API_KEY`：Claude Code Action 的 Anthropic API key。
- `ANTHROPIC_BASE_URL`：Claude Code Action 使用的自定义 Anthropic 兼容服务地址。
- `GH_TOKEN`：Claude Code Action 用于读取 PR / issue 上下文并回写评论的 GitHub token。
- 没有配置 Claude 相关 secret 时，Claude workflow 会跳过执行，不阻塞普通 CI。

## GitHub CLI 设置命令

```bash
gh repo edit MapleEve/BetterAINote \
  --description "多平台语音资料私有化集合与统一管理工作台" \
  --homepage "https://github.com/MapleEve/BetterAINote#readme" \
  --add-topic betterainote \
  --add-topic self-hosted \
  --add-topic voice-notes \
  --add-topic recording-management \
  --add-topic transcription \
  --add-topic speaker-diarization \
  --add-topic sqlite \
  --add-topic nextjs \
  --add-topic bun \
  --add-topic privacy-first \
  --add-topic meeting-notes \
  --add-topic ai-notes
```

执行后确认：

```bash
gh repo view MapleEve/BetterAINote --json description,homepageUrl,repositoryTopics,url
```

## 公开文案边界

可以公开：

- 多平台录音资料统一管理。
- 私有自托管、本地 SQLite、本地音频归档。
- 数据源成熟度、公开 API 形状、部署边界。
- 不含真实账号信息的最小复现步骤。

不能公开：

- 真实 token、cookie、bearer、账号、组织 ID、用户 ID、录音 ID。
- 数据库、音频、逐字稿、来源原始响应、完整日志或未脱敏请求记录。
- 未脱敏的登录态截图、数据源详情截图或错误响应。
- 未脱敏或非公开材料。
