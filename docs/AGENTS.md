# docs 分层指南

## 目录职责

本目录保存可发布文档、部署说明、API 说明、隐私说明和 README 资产。文档必须面向用户，保持隐私优先、可自托管、provider 中立。

## 可改范围

- 可以维护 `AI_INSTALL_DEPLOYMENT.md`、`API.md`、`AUTO_SYNC.md`、`DATA_SOURCES.md`、`DEPLOYMENT.md`、`DEVELOPMENT.md`、`GITHUB_PROJECT_SETTINGS.md`、`PRIVACY.md`。
- `docs/assets/readme/` 只放公开 README 可引用资产，文件名和语言后缀必须稳定。
- 从本地研究迁移结论时，必须重写为脱敏、用户可读、provider 中立的说明。

## 禁止事项

- 禁止写入内部研究、抓包、私有路径、请求归档、token、Cookie、HAR、私有录音和私有转写。
- 禁止公开实现专用标签、验证-only 文案或 provider 私有字段。
- 禁止把未确认路线图或本地 PRD 草稿伪装成正式文档。

## 验证

- 运行 `git diff --check`。
- 涉及公开发布时运行公开残留和 secret/private-data 扫描。
- 文档引用命令变更时，确认命令仍与 `package.json` 一致。
