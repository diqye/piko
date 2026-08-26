# Project Instructions

# Verification

- **不要自己跑 `bun run dev` 验证**：GUI 应用跑在用户桌面，agent 无法观察窗口/tray 实际效果。改动后只跑 `bunx tsc --noEmit` 保证类型正确，构建与交互验证交给用户自己完成（dev watch 常驻，用户自己看）

# Coding Flow

1. First, show the list of files to modify (describe the change, do not show modified code)
2. Waiting for the user's agreement
3. Implement the user's requirement

# Release Flow

版本号唯一来源是 `package.json`，`electrobun.config.ts` 和 about 页都从它读，只改这一处。

1. `package.json` 的 `version` 递增（patch/minor 自行判断）
2. `CHANGELOG.md`：`[Unreleased]` 冻结为 `0.0.3 (2026-02-05)` 格式（版本号与第 1 步一致，同天重发不换标题、版本号递增即可），顶部新建空 `[Unreleased]`
3. `bun run build:canary` 构建
4. 依次 commit：版本号+changelog 一个提交，构建产物另行处理
