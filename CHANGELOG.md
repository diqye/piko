# Changelog

## [Unreleased]

### Fixed

- 修复胶囊运行数日后无响应、只能重启应用的问题 - 流式 delta 每秒上百条直灌 webview 会压垮 IPC/渲染通道且无恢复手段；现对更新做 150ms trailing 合并节流，并新增 ping watchdog（30s 探活、连续 2 次超时自动重建窗口），重建后自动恢复显示与各开关状态
- 降低 pi 扩展到本地 socket 的消息频率 - 状态切换即时上报，流式 delta 合并为 200ms 一条，避免高频请求加重负担
