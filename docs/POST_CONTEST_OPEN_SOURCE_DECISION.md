# 赛后开源决策

> **SUPERSEDED NOTE**: 本文件取代比赛期间所有关于源码保密、冻结和禁止公开的规则。

## 1. 决策日期

2026-07-22

## 2. 背景

TRAE AI 创造力大赛初赛已经结束。CheapLive 进入了初赛专业评分 TOP 2000，获得初赛优秀奖；很遗憾未进入专业评审通道 TOP 300，因此没有晋级复赛。

比赛期间为了遵守参赛边界，仓库中曾存在以下限制：
- Android Capture 源码暂不公开；
- Android 项目在独立分支或本地继续开发；
- 参赛源码冻结；
- 不得将真实 Android 项目推到公开 GitHub；
- README 将 Android Capture 标为暂停开发或暂不提供；
- 部分比赛相关源码、测试和文档暂时隔离。

## 3. 决策内容

### 3.1 比赛期限制正式失效

比赛期间的以下限制**现已全部失效**：
- 源码保密要求
- 源码冻结要求
- 禁止公开 Android 源码和 APK（技术文档层面）
- 禁止推送到公开仓库
- Android 暂停开发标注

### 3.2 可公开内容

以下内容**现在可以公开**：
- Android Capture 源码（`android-capture/`）
- Android Receiver 源码（`android-capture/app/src/main/assets/web/receiver/`）
- Android Capture Web 页面（`android-capture/app/src/main/assets/web/capture/`）
- 参赛 Demo（`src/contest-demo/`）
- 开源面捕 Demo（`src/face-tracking/`）
- 相关测试脚本（`tests/`）
- 项目文档和 README

### 3.3 后续开发允许

- 允许正常维护和功能开发
- 允许修复 bug 和改进现有功能
- 允许添加新功能（如动作捕捉完善、gaze/brow 链路等）

### 3.4 仍需遵守的安全限制

**以下内容仍然禁止公开**：
- 密钥、签名材料、keystore 文件
- 真实 token、sessionId、用户隐私数据
- 私有日志和构建缓存
- 私人截图和录像
- ADB 设备序列号
- 用户目录绝对路径
- TransparentFloatingBrowser 源码副本（仍是独立仓库）

### 3.5 历史规则处理

- 旧规则文件保留作为归档
- 旧规则顶部标记 `SUPERSEDED — 比赛已结束，现由本文件取代`
- 删除或改写会继续阻止公开 Android 源码的活动规则
- 保留安全、隐私、禁止泄密和禁止破坏性 Git 操作的规则

## 4. 生效范围

本决策适用于以下仓库：
- GitHub: https://github.com/SamZebrado/CheapLive（默认分支：main）
- Gitee: https://gitee.com/samzebrado/CheapLive（默认分支：master）

## 5. 执行要点

1. 更新根 README.md，反映赛后真实状态
2. 更新 android-capture/README.md，提供完整的 Android 构建和使用指南
3. 在两个 Demo 页面中添加比赛结果与赛后开源说明
4. 更新根 index.html，添加比赛结果说明
5. 更新 .gitignore，覆盖 Android/Gradle 构建输出等
6. 创建 THIRD_PARTY_NOTICES.md（如需要）
7. 执行安全审计，确保无敏感信息泄露
8. 分别推送到 GitHub 和 Gitee，确保两端内容一致