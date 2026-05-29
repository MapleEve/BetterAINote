# BetterAINote 本地资料分层约定

## 定位

本文件说明被 .gitignore 排除的本地资料目录。它们用于计划、会议、研究、PRD、临时证据和调试产物，不属于公开仓库交付内容。

## 顶层本地资料目录

- `plans/`：本地执行计划、任务拆解、回滚步骤和排期草稿。
- `meeting-notes/`：会议纪要、录音转写整理和待办归档。
- `specs/`：本地规格草案、接口草案和实现前校验材料。
- `roadmaps/`：路线图草案、版本候选、优先级和延期记录。
- `prd/`：PRD 草稿、需求评审材料和未发布需求来源。
- `research/`：provider、竞品、实现选型和本地调查记录。

## tmp 子目录

- `tmp/docs/`：临时文档拼装、未发布长文和校对中间稿。
- `tmp/internal-docs/`：内部连续性记录、私有复盘和不可公开上下文。
- `tmp/research/`：临时研究抓取、实验记录和待脱敏材料。
- `tmp/betterainote-design-evidence/`：设计证据、截图、交互核对和本地验收材料。

## 分层规则

每个本地资料目录可以放置自己的 AGENTS.md、CLAUDE.md 和 README.md。越靠近资料的文件越具体；内层规则只能收紧公开边界，不能允许提交 secrets、私有录音、私有转写、数据库、抓包归档或 provider 私有标识。

## 提交边界

这些目录必须保持 ignored，不得 stage。若其中的结论需要进入公开仓库，必须重新整理成脱敏、provider 中立、用户可读的公开文案，并放入 docs、README 或源码注释的合适位置。
