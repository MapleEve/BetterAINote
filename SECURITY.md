# 安全说明

[English](#english)

## 中文

BetterAINote 当前是单用户私有部署产品，重点风险主要来自：

- 数据源网页登录态或 bearer token 泄露
- 私有转录服务 API key 泄露
- 本地 SQLite 与录音目录权限过宽
- 将数据库放在不可靠的网络文件系统上

### 建议

- `DATABASE_PATH` 放本地磁盘
- 录音目录单独挂载并限制权限
- 不要把真实 token、cookie、API key 提交到仓库
- 对外暴露面板时，使用你自己的强随机 `BETTER_AUTH_SECRET`
- 定期轮换私有服务密钥

### 报告方式

如果发现安全问题，请通过私有渠道联系维护者，或使用仓库的私有安全通道，不要直接公开披露敏感细节。

## English

BetterAINote is intended for private single-user deployments. The main risks are:

- leaked source-provider cookies, bearer tokens, or sessions
- leaked private transcription API keys
- overly broad filesystem permissions on SQLite files or recording storage
- storing SQLite databases on unreliable network filesystems

### Recommendations

- keep `DATABASE_PATH` on local disk
- mount recordings separately and restrict access
- never commit real credentials
- use a strong `BETTER_AUTH_SECRET`
- rotate private service keys regularly
