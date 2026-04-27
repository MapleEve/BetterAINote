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
- 数据库、音频、逐字稿、来源原始响应、完整日志或抓包文件。
- 未脱敏的登录态截图、数据源详情截图或错误响应。
- 私有 provider 研究记录、临时测试记录和本地路径。
