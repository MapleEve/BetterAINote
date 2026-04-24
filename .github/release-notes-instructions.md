# 发布说明写作规范

[English](#english)

## 中文

### 关于 BetterAINote

BetterAINote 是一个面向单用户的私有录音工作台，支持多数据源同步、官方记录缓存、私有转录、说话人审阅和 AI 重命名。

### 分类

按下面的标题分组，空分类可以省略：

- **🎙️ 新功能**：用户可感知的新能力
- **🐛 修复**：用户侧问题修复
- **⚡ 改进**：性能、体验、稳定性提升
- **🔧 内部**：基础设施、依赖、重构

### 忽略项

以下内容不要出现在发布说明中：

- 纯 CI/CD 变更
- 纯测试变更
- 无用户影响的重构
- 纯格式化或 lint 调整

### 风格

- 面向自部署用户，不面向开发者
- 用现在时态
- 一条一行，准确简洁
- 不把 Plaud 当成产品唯一中心，只有在确实是 Plaud 专属行为时才点名
- 如果需要迁移，顶部加 **⚠️ 需要迁移**

## English

### About BetterAINote

BetterAINote is a single-user private recording workspace with multi-source sync, official artifact caching, private transcription, speaker review, and AI rename.

### Categories

- **🎙️ New Features**
- **🐛 Bug Fixes**
- **⚡ Improvements**
- **🔧 Internal**

### Skip

- CI/CD-only changes
- test-only changes
- refactors with no user impact
- formatting-only changes
- provider-internal protocol churn with no user-visible impact
