# Changelog

## [Unreleased]

### New Features

- 胶囊主题功能 - tray 菜单新增 Theme 子菜单，六套配色（鲸跃蓝/星眸黑/玉奁冰/残烬红/齐王紫/凝脂白）一键切换，铅笔与状态色跟随主题，选择持久化到 ~/piko/config.json，重启与窗口自愈重建后保持

### Added

- 主题切换 - tray 菜单 Theme 子菜单列出全部主题并对勾标记当前项，父菜单标题实时显示选中主题名；选中即生效并写入 ~/piko/config.json，启动时读回恢复
- 主题 token 体系 - 每主题完整定义三档状态色(idle/thinking/working 底色与文字色)、正文色与铅笔笔身色，胶囊底色不透明保证可读性

### Fixed

- 修复胶囊运行数日后无响应、只能重启应用的问题 - 流式 delta 每秒上百条直灌 webview 会压垮 IPC/渲染通道且无恢复手段；现对更新做 150ms trailing 合并节流，并新增 ping watchdog（30s 探活、连续 2 次超时自动重建窗口），重建后自动恢复显示与各开关状态
- 降低 pi 扩展到本地 socket 的消息频率 - 状态切换即时上报，流式 delta 合并为 200ms 一条，避免高频请求加重负担
