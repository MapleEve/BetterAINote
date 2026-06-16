# src/app/api/recording-tags/[id] 分层指南

## 目录职责
单个录音标签 API，委派 recording-tags 模块处理归属校验和删除副作用。

## 真实文件
- `route.ts`

## 禁止事项
- 禁止绕过认证、归属校验和公开错误映射。
- 禁止从本层引用浏览器组件或页面实现。

## 依赖方向
依赖方向是 route.ts 到 `src/server/modules/recording-tags`。
