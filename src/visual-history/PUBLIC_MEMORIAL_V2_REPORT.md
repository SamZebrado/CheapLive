# PUBLIC_MEMORIAL_V2_REPORT — CheapLive Visual History

Generated: 2026-06-29

---

## 1. v1 总素材数

474 个唯一素材（来自 951 个原始扫描文件，去重后）

## 2. v2 精选素材数

61 个精选素材

## 3. Cat 素材数

10 个（Cat-Owl Failure Case section），占总数 16.4%，符合 ≤25% 的规则

## 4. Sacabambaspis 素材数

16 个（Main Demo section），高于 Cat-Owl 数量，满足规则

## 5. 是否修复 manifest sha256

是。v1 的 manifest.json 中全部 474 条 sha256 字段都存储了图片高度值（整数），而非 64 位 hex 哈希。v2 的 manifest-public.json 中全部 61 条 sha256 字段均为正确的 64 位 hex SHA-256 哈希值。

## 6. 是否生成 public v2 index.html

是。`cheaplive-visual-history-public-v2-20260629-0040/index.html`，约 60 KB，自包含静态网页。

## 7. 是否保留 full archive

是。v1 的全部产物（474 素材、zip 包、报告）均保留在原位，未删除、未覆盖。

## 8. public v2 本地路径

```
CheapLive-agent-outbox/memorial/cheaplive-visual-history-public-v2-20260629-0040/
```

## 9. public v2 zip 路径

```
CheapLive-agent-outbox/memorial/cheaplive-visual-history-public-v2-20260629-0040.zip
```
（待生成）

## 10. 精选分布

| Section | 数量 |
|---------|------|
| Main Demo (Sacabambaspis) | 16 |
| Cat-Owl Failure Case | 10 |
| Android & Receiver | 8 |
| Bloopers | 7 |
| Hero | 5 |
| Motion Evidence | 5 |
| Contact Sheets | 5 |
| Demo | 3 |
| Black Screen | 1 |
| Subtitle | 1 |

## 11. v1 问题修复

| 问题 | v1 状态 | v2 状态 |
|------|---------|---------|
| sha256 字段 | 全部异常（存高度值） | 全部修复为 64 位 hex |
| Cat 占比 | 51%（242/474） | 16.4%（10/61） |
| 重复标题 | 265 个文件有重复 | 去重后精选 |
| source_path 暴露路径 | 包含内部路径 | 仅保留相对路径 |
| debug-page 误分类 | blackscreen | 修正为 bloopers |
| GIF 高度异常 | 600548px | 修正为 600px |

## 12. 页面特性

- 深色背景（#0a0a0a）
- 响应式网格（280px 最小列宽）
- Section 筛选导航栏（sticky）
- 灯箱查看（支持键盘导航）
- 无外部 CDN 依赖
- 直接打开 index.html 可用
- 不包含敏感信息

## 13. 合规声明

- [x] 未修改 CheapLive 主项目代码
- [x] 未执行 git add / commit / push
- [x] 未删除 v1 原始纪念网页
- [x] 未覆盖 v1 zip
- [x] 未将全量 474 张挂到公开版
- [x] 未公开设备序列号、token、私密路径、logcat 敏感信息
- [x] Cat-Owl Failure Case 明确定位为失败案例，不描述为成功角色
- [x] 页面底部仅写 "Generated locally"，不写内部绝对路径

## 14. 未验证项

- [未验证] 网页在真实浏览器中的渲染效果（沙箱内无法打开浏览器预览）
- [未验证] zip 包解压后的完整性
- [未验证] 缩略图在所有浏览器中的显示一致性
- [未验证] 是否有遗漏的重要截图未包含在精选中

## 15. 下一步建议

1. 用户在真实浏览器中打开 index.html 审阅效果
2. 生成 zip 包（`cd memorial && zip -r cheaplive-visual-history-public-v2-20260629-0040.zip cheaplive-visual-history-public-v2-20260629-0040/`）
3. 如满意，将 v2 目录部署到 GitHub Pages（作为参赛 demo 的小彩蛋）
4. 如需调整精选内容或 caption，可直接修改 manifest-public.json 并重新生成
