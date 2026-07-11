# 组件库使用规范

## 基础组件

- `BaseButton`：主按钮、品牌辅助按钮、AI 按钮和普通按钮。
- `BaseInput`：单行文本、URL、密码、数字等基础输入框，统一 focus、disabled 和 invalid 态。
- `BaseTextarea`：多行文本输入框，统一 focus、disabled、invalid 和 resize 行为。
- `BaseSearchInput`：搜索输入框，统一使用 `ui-search` 样式和 lucide 图标。
- `BaseTabs`：页面级分类 Tab，例如模块、栏目或主内容切换。
- `BaseSegmentedTabs`：紧凑分段切换，例如创作模式、视图模式或筛选模式。
- `BaseDropdown`：筛选下拉和操作菜单。
- `BaseModal`：弹窗与确认框。
- `BaseToast`：轻提示。
- `BaseProgress`：进度条。

## 使用规则

- 新页面优先从 `frontend/src/components/base` 引入基础组件。
- 禁止直接引入 Element Plus；可以参考其交互行为，但视觉必须使用本项目 token 和 `.ui-*` 样式。
- 业务状态、接口调用和页面编排放在 `pages` 或 `features`，基础组件只负责通用交互和展示。
- 从 Figma、截图或设计稿落地页面时，先阅读 [figma-to-code-workflow.md](./figma-to-code-workflow.md)。
