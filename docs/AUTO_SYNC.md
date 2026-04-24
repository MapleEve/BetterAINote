# 自动同步说明

[English](#english)

## 中文

自动同步由 worker 负责，不在浏览器里执行。

### 行为

- 根据用户设置的同步间隔检查已启用数据源
- 手动点击同步时，会立刻执行一次，不受下一次定时检查限制
- 同步成功后，录音列表会按录音开始时间倒序刷新

### 说明

- 本地没有音频的录音不会进入私有转录
- 私有转录排队与远端排队是两层状态
- Worker 状态会显示最近一次检查时间和下一次自动检查时间

## English

Automatic sync is executed by the worker, not by the browser.

### Behavior

- enabled data sources are checked on the configured interval
- manual sync runs immediately and does not wait for the next scheduled cycle
- the recording list refreshes in descending capture-time order after sync
