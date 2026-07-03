# Contest Demo 回归事故经验与 Checklist

## 1. 事故摘要

3D 优化不是单纯视觉升级；它覆盖/绕开了原 2D demo 的 UI 和数据链路。
导致 layout 回归、音频监听按钮消失、face params 和 avatar 脱钩、camera preview 外露。
只 curl 200 导致线上问题未被发现。

## 2. 根因

- 没有把 2D 正常版本作为 regression baseline
- 重写 UI 前没有列出旧 UI controls
- 只验证 3D renderer 加载，没有验证 face params → avatar
- 只 curl 验证 Pages，没有线上截图
- 自动 fallback 到 2D 会掩盖 3D 问题
- 多 agent 乱 checkout / restore 增加了未提交修改丢失风险
- 没有 source-of-truth 复用策略，contest / receiver / face-tracking 分叉
- contest-demo MediaPipe 从未本地化，一直依赖 CDN（face-tracker.js 已本地化但 contest-demo 未复用）

## 3. 硬规则

1. 旧 2D layout（commit 503ff6f）是当前 contest demo 的 visual baseline
2. 3D 优化只能替换 avatar renderer，不能重写/丢弃 UI controls
3. 重写 UI 前必须列出旧 UI controls，不得丢按钮
4. 发布前必须确认音频监听按钮（#monitorBtn）存在
5. 发布前必须确认 face params appliedToAvatar=true
6. face params 数字动不等于 avatar 被驱动
7. 任何 3D fallback 必须用户确认，禁止 silent fallback
8. GitHub Pages 发布必须 Playwright 截图，不准只 curl
9. MediaPipe/model/wasm 必须 same-origin，本地路径优先
10. 禁止 checkout/restore/reset/clean 清理其他 agent 修改
11. source-of-truth renderer 不能随便复制分叉

## 4. 发布前 Regression Checklist

- [ ] 音频监听按钮存在（#monitorBtn）
- [ ] 摄像头按钮存在（#faceCamBtn）
- [ ] 摄像头 video 不可见
- [ ] face params 数字变化
- [ ] face params appliedToAvatar=true
- [ ] 2D avatar mouth 仍可动
- [ ] 3D avatar headYaw/headPitch/headRoll 可动
- [ ] 3D avatar mouthOpen 可动
- [ ] 3D 加载失败显示错误，不自动切 2D
- [ ] MediaPipe bundle/model/wasm same-origin
- [ ] 不请求 google/jsdelivr/unpkg（初始加载）
- [ ] 1280/1440 三栏不换行
- [ ] dual-device 跳转正确
- [ ] 线上 Playwright 截图保存

## 5. 后续计划

- P0 恢复 demo UI controls ✅（已在本轮修复）
- P0 接回 face frame dispatcher ✅（已在上轮修复）
- P0 恢复 MediaPipe local path ✅（已在本轮修复）
- P0 修 layout/camera preview ✅（已在上轮修复）
- P1 source-of-truth renderer 迁移
- P1 音频监听 UI 恢复和网页端 mock 测试 ✅（按钮已恢复，端到端待验证）
- P2 Android receiver/音频真机验收
