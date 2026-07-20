# .github 分层指南

## 目录职责

本目录保存 GitHub issue 模板、PR 模板、release notes 说明和 workflow。所有内容都是公开协作表面，必须默认会被外部贡献者阅读。

## 可改范围

- 可以维护 `ISSUE_TEMPLATE`、`pull_request_template.md`、`release-notes-instructions.md` 和 `workflows/*.yml`。
- 修改 CI、release、Docker、FOSSA、Codecov 或 Claude workflow 时，必须说明触发条件、权限和发布边界。
- issue 模板必须提醒用户不要粘贴 token、Cookie、HAR、私有录音、私有转写或私有 ID。

## 禁止事项

- 禁止在 workflow、模板或说明里写入真实 secret、未脱敏材料。
- 禁止让 workflow 默认自动发布、自动写 issue 或绕过人工审查。
- 禁止把本地调试路径写成公开排障步骤。

## 验证

- 改 workflow 后运行 `bun run format-and-lint`，并检查 YAML diff。
- 发布相关变更必须检查 license、package privacy 和 release 边界。
- 用 `git diff --check` 确认模板和 workflow 没有空白错误。
