# Image-to-HTML Quality Version - 2026-07-09

## Scope

本版本整理图片转 HTML 的增强生成约束，目标是让模型输出更像真实可用页面，而不是截图海报或 1440 内容岛。变更只覆盖图片转 HTML 的生成规则、契约和回归测试。

## Included Files

- `backend/services/image-to-html-service.js`
- `frontend/src/App.vue`
- `docs/product-contracts/frontend-backend-handoff.md`
- `tests/image-to-html-failed-preview.test.mjs`

## What Changed

- 统一 normal / regenerate 路径为增强生成：保留基础框架，传入增强 MD，使用当前图标体系、上下文图片替换和重叠检查。
- 约束 1920-first：先按 1920px 宽屏组织桌面布局，再向下适配 1440 / 768 / 390；避免 1440px 内容岛居中显示在 1920px。
- 约束 H5 适配：390px 下不要把桌面侧边栏、视频入口和顶部按钮硬塞成九宫格；使用更多按钮、底部导航、悬浮入口、抽屉菜单或横向 chip。
- 约束基础组件：搜索框、输入框、按钮、筛选、分页、标签、侧边栏参考 Eleme / Element Plus 密度和交互，按钮高度控制在 40px 内。
- 约束图标：统一精致图标库风格，图标只用 12px / 16px / 20px / 24px 阶梯，等比例缩放且不超过文字高度。
- 约束文本和布局：短标签不拆行，tab 超出横向滚动并带右侧渐隐遮罩，不出现默认虚框，避免夸张错落、遮挡和随机错位。
- 约束视觉基础：4px 基础网格、2/4/6/8px 圆角梯度、灰度可读、PNG/logo/人物/元素/组合场景图片分类。

## Why

近期生成结果暴露了几个稳定问题：1920 预览只把 1440 页面居中、390 H5 挤入桌面侧边栏、输入框出现默认虚框、下拉和 tab 交互不像真实组件、图标大小失控、短文案换行和错落排版。该版本把这些问题写入前端增强 MD、后端 prompt、产品契约和测试，防止后续合并代码时丢失。

## Verification

已通过：

```bash
node --test --test-name-pattern "image-to-html enhanced prompts require usable responsive web and app pages" tests/image-to-html-failed-preview.test.mjs
node --test tests/image-to-html-failed-preview.test.mjs
node --test tests/restored-asset-delete.test.mjs
node --test tests/backend-authoritative-sync.test.mjs
git diff --check -- frontend/src/App.vue backend/services/image-to-html-service.js docs/product-contracts/frontend-backend-handoff.md tests/image-to-html-failed-preview.test.mjs
npm --prefix frontend run build
```

构建仅保留 Vite large chunk warning。

## Excluded Dirty Worktree Areas

本版本不包含以下当前工作区已有脏改动：capture/browser session、workflow runner、competitor analysis、navigation、factory panel、Vite config、README、其它测试和服务文件、未跟踪的新 backend/frontend/docs 目录。提交时应只 stage 本版本 Included Files 和本版本说明文件。

## Suggested Commit

```text
feat: harden image-to-html quality rules

- Add 1920-first desktop layout constraints and H5 collapse patterns.
- Tighten Element Plus-like controls, icon sizing, nowrap, focus, tabs, grid, radius, image, and grayscale rules.
- Preserve backend/model ownership with contract and regression coverage.
- Verification: image-to-html tests, restored asset delete tests, backend authoritative sync tests, diff check, frontend build.
```
