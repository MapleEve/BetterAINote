# scripts 分层指南

## 目录职责

本目录保存已跟踪脚本，例如 dev worker 启动、本地环境注入、E2E 数据重置、搜索索引重建和转写辅助脚本。

## 可改范围

- 可以维护 `dev-with-worker.mjs`、`run-with-local-env.mjs`、`local-env.mjs`、`e2e-reset-data.mjs`、`e2e-setup.mjs`、`rebuild-search-index.mjs`、`run-diarize.py`。
- 脚本必须默认安全，清晰区分开发、测试、E2E 和生产行为。
- 读取环境变量时必须允许本地覆盖，但不能把真实值写入输出或提交。

## 禁止事项

- 禁止脚本默认删除用户资料、录音、数据库或 storage 内容。
- 禁止把真实 token、Cookie、HAR、未脱敏路径或非公开字段写入日志。
- 禁止新增安装包步骤，除非任务明确要求并更新锁文件。

## 验证

- 改脚本后运行对应脚本的最小 smoke 命令或相关测试。
- E2E reset 相关变更必须跑 `src/tests/e2e-reset-rules.test.ts`。
- 搜索重建脚本变更必须跑搜索模块测试。
