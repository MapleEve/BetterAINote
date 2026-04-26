# API 参考

## 适用对象

这篇面向自托管 BetterAINote 的使用者、贡献者和想接入本地自动化的开发者。它描述当前公开 API 的用户侧形状，不记录数据源内部协议，也不作为稳定 SDK 合约。

## 当前状态

| 项目 | 说明 |
| --- | --- |
| 阶段 | `preview`，首个正式 release 前仍可能调整路径、字段和错误码 |
| 部署 | 私有部署优先，默认面向本机或可信网络 |
| 鉴权 | 浏览器请求使用 Web app 会话；服务间访问应使用部署方控制的 secret 或 integration key |
| 发布 | CI 可以运行；`0.6.0-preview` 可作为预发布归档，Release / Docker 发布工作流默认关闭，需要手动授权 |

所有示例都使用 `http://localhost:3001`。不要把示例里的占位符替换成真实凭据后提交到公开仓库。

## 鉴权模型

- Web UI 发起的请求使用 BetterAINote 本地会话。
- 自动化或服务间访问应由部署方自己控制访问边界和密钥轮换。
- 数据源凭据、转写服务密钥、AI 标题服务密钥不会通过公开 API 完整返回。
- 示例、Issue、日志和截图里统一使用 `<redacted>`。

下面的 HTTP 示例省略鉴权头；自托管部署可以按自己的网关、反向代理或集成密钥策略添加访问控制。

## 接口清单

| 区域 | Endpoint | 作用 |
| --- | --- | --- |
| Health | `GET /api/health` | 本地实例健康检查。 |
| Data sources | `GET /api/data-sources` | 读取数据源启用状态、能力标识和安全元数据。 |
| Data sources | `PUT /api/data-sources` | 保存当前用户的数据源设置。 |
| Sync | `GET /api/data-sources/sync` | 读取已启用来源的同步状态。 |
| Sync | `POST /api/data-sources/sync` | 请求立即执行一次同步检查。 |
| Recordings | `GET /api/recordings` | 读取录音列表的基础入口。 |
| Recordings | `GET /api/recordings/query` | 按来源、时间、状态等条件查询本地录音库。 |
| Recordings | `GET /api/recordings/:id` | 读取单条本地录音详情。 |
| Recordings | `GET /api/recordings/:id/audio` | 在本地音频可用时播放或下载。 |
| Source report | `GET /api/recordings/:id/source-report` | 读取脱敏后的来源报告。 |
| Transcription | `POST /api/recordings/:id/transcribe` | 提交私有转写任务。 |
| Transcription | `GET /api/recordings/:id/transcribe` | 查询转写任务状态。 |
| Transcript | `GET /api/recordings/:id/transcript/raw` | 读取转写文本和安全元数据。 |
| Transcript | `GET /api/recordings/:id/transcript/speakers` | 读取按说话人整理后的转写视图。 |
| Speakers | `GET /api/recordings/:id/speakers` | 读取说话人审阅数据。 |
| Speakers | `PATCH /api/recordings/:id/speakers` | 保存说话人审阅编辑。 |
| Speakers | `GET /api/recordings/:id/speaker-map` | 读取录音级说话人映射。 |
| Speakers | `PATCH /api/recordings/:id/speaker-map` | 更新录音级说话人映射。 |
| Speaker profiles | `GET /api/speakers/profiles` | 列出已保存说话人。 |
| Speaker profiles | `POST /api/speakers/profiles` | 创建说话人档案。 |
| Voiceprints | `GET /api/voiceprints` | 代理读取私有转写服务的声纹列表。 |
| Voiceprints | `DELETE /api/voiceprints/:id` | 删除远端声纹引用。 |
| Rename | `PATCH /api/recordings/:id/rename` | 重命名本地录音；支持来源时可尝试写回。 |
| Rename | `POST /api/recordings/:id/rename/auto` | 基于转写内容生成标题并保存。 |
| Settings | `/api/settings/*` | 读写播放、展示、同步、转写、VoScript、AI 标题等设置。 |

## 常见请求

查询录音：

```http
GET /api/recordings/query?limit=20&source=ticnote HTTP/1.1
Host: localhost:3001
Accept: application/json
```

本地重命名：

```http
PATCH /api/recordings/rec_123/rename HTTP/1.1
Host: localhost:3001
Content-Type: application/json

{
  "title": "产品周会"
}
```

提交私有转写：

```http
POST /api/recordings/rec_123/transcribe HTTP/1.1
Host: localhost:3001
Content-Type: application/json

{
  "service": "voscript",
  "language": "auto"
}
```

## 响应形状

录音查询响应示例：

```json
{
  "items": [
    {
      "id": "rec_123",
      "source": "ticnote",
      "title": "产品周会",
      "startedAt": "2026-04-24T09:30:00.000Z",
      "durationSeconds": 1840,
      "audio": {
        "available": true,
        "localPath": null
      },
      "transcript": {
        "status": "ready"
      }
    }
  ],
  "nextCursor": null
}
```

同步请求响应示例：

```json
{
  "status": "queued",
  "sources": ["ticnote", "plaud", "dingtalk-a1"],
  "requestedAt": "2026-04-24T10:00:00.000Z"
}
```

错误响应示例：

```json
{
  "error": {
    "code": "SOURCE_AUTH_FAILED",
    "message": "The selected source credentials need attention.",
    "requestId": "req_preview_123"
  }
}
```

## Source report 公开边界

`GET /api/recordings/:id/source-report` 是给 UI 和用户排查用的只读报告。它可以返回：

- 来源名称、录音标题、可用 section 列表。
- 来源逐字稿文本和段落数量。
- 来源摘要 markdown。
- 来源详情是否可用、语言、创建时间、更新时间。

它不会返回：

- 上游原始响应对象。
- cookie、bearer、刷新凭据、下载签名、临时音频 URL。
- 用户 ID、组织 ID、远端记录 ID 等可直接定位账号的数据。
- 完整请求头、完整响应头或内部调试上下文。

如果需要报告来源问题，请只贴 `sourceProvider`、`availableSections`、HTTP 状态、脱敏后的字段名和错误信息。

## 错误语义

| HTTP status | 含义 |
| --- | --- |
| `400` | 请求参数或 JSON 结构无效。 |
| `401` | 未登录、会话过期或缺少集成密钥。 |
| `403` | 当前账号或集成密钥没有权限执行操作。 |
| `404` | 本地资源不存在，或当前用户不可见。 |
| `409` | 状态冲突，例如同一录音已有转写任务在运行。 |
| `422` | 请求可解析，但当前来源或录音状态无法处理。 |
| `429` | 实例正在执行本地限速或并发限制。 |
| `500` | BetterAINote 内部错误。请查看脱敏后的服务日志。 |
| `502` | 已配置的数据源或服务返回上游错误。 |
| `503` | worker、数据源或转写服务暂时不可用。 |

错误码在 preview 阶段足够用于 UI 判断，但外部自动化仍应保留未知错误兜底。

## 敏感信息边界

公开 API、文档、测试 fixture、Issue 和 PR 中不得包含：

- 数据源 cookie、bearer、刷新凭据、会话字段。
- VoScript、转写服务、AI 标题服务或对象存储密钥。
- 本地数据库文件、音频文件、完整转写文本。
- 暴露个人、组织、项目、服务器名称的本地路径。
- 上游完整请求 / 响应、网络抓包文件或截图里的登录态。

## 相关链接

- [README](../README.md)
- [数据源说明](./DATA_SOURCES.md)
- [部署说明](./DEPLOYMENT.md)
- [隐私说明](./PRIVACY.md)
- [安全策略](../SECURITY.md)
