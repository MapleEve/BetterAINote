# 安全策略

## 适用对象

这篇面向 BetterAINote 自托管用户、部署者和漏洞报告者。BetterAINote 当前是私有部署优先的 preview 项目，请把它当成会处理录音、转写文本、来源账号状态和服务凭据的本地数据库。

## 支持版本

| 版本 / 分支 | 支持状态 |
| --- | --- |
| `main` | preview 阶段支持 |
| 正式 release | 尚未发布 |
| 旧 commit | 不承诺安全修复 |

## 威胁模型

BetterAINote 的主要风险来自：

- 数据源凭据或会话字段泄露。
- 私有转写服务、AI 标题服务或其它服务密钥泄露。
- 本地 SQLite 与录音目录权限过宽。
- 面板被暴露到不可信网络。
- 日志、Issue、截图或网络抓包文件包含私人录音内容或账号状态。

## 部署侧必须做的硬化

- 为 `BETTER_AUTH_SECRET` 和 `ENCRYPTION_KEY` 生成强随机值。
- `.env.local`、数据库、音频目录、服务密钥和来源凭据永远不要提交到 git。
- 把 `DATABASE_PATH` 放在可靠本地磁盘或可信存储上。
- 限制 `LOCAL_STORAGE_PATH`、数据库目录和备份目录的文件权限。
- 对外访问时使用 VPN、反向代理、TLS 和访问控制，不要裸露面板。
- 定期轮换来源凭据和服务密钥。

## 公开报告边界

公开 Issue / PR / 讨论中不要包含：

- cookie、bearer、刷新凭据、会话字段。
- 组织 ID、用户 ID、录音 ID、临时下载链接、签名 URL。
- 私人录音标题、完整转写、会议内容、说话人姓名。
- 数据库文件、音频文件、完整环境文件。
- 网络抓包文件、上游完整请求 / 响应、本地私有路径。

可以提供：

- BetterAINote commit 或版本。
- 操作步骤和预期结果。
- 来源名称、站点模式和脱敏后的错误码。
- 最小化的脱敏日志片段。

## 漏洞上报

如果发现未修复安全问题，请使用 GitHub private security advisory 或私有渠道联系维护者。不要在公开 Issue 中披露可利用细节。

## 相关链接

- [隐私说明](./docs/PRIVACY.md)
- [部署说明](./docs/DEPLOYMENT.md)
- [数据源说明](./docs/DATA_SOURCES.md)
- [API 参考](./docs/API.md)
