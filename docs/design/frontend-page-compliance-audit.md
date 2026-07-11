# 前端页面规范审计

## 目的

本文件用于跟踪前端页面按 `ai-commerce-design.md` 与 `component-library.md` 统一改造的进度。后续新增页面、重构页面、Figma 落地页面都必须先检查本表，再进入开发。

## 总体结论

当前已经完成基础设计规范、基础组件目录、设计系统展示页和竞品监控页面的第一批落地。剩余主要风险集中在 `App.vue` 和 workflow 相关大组件：原生按钮、输入框、局部硬编码颜色和页面级弹窗较多，需要分批迁移，避免一次性改动影响业务流程。

## 优先级规则

| 优先级 | 范围 | 处理目标 |
| --- | --- | --- |
| P0 | 高频主路径、跨页面外壳、AI 生成链路、工作流画布 | 优先替换基础组件，统一主按钮、Tab、搜索、弹窗和状态反馈 |
| P1 | 业务独立模块、设置、知识库、素材、技能中心 | 按模块迁移控件和 token，补齐空状态、表单和筛选交互 |
| P2 | 静态包装页、低频入口、内部展示页 | 保持结构清晰，作为后续清理项 |

## 页面审计表

| 页面 / 组件 | 当前状态 | 主要不一致 | 目标组件 / Token | 优先级 | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| `frontend/src/App.vue` | 主应用外壳仍承载大量页面片段和弹窗 | 原生 `button/input/textarea` 多，弹窗、Toast、工具栏和状态反馈样式分散；部分内联 HTML 使用硬编码色值 | `BaseButton`、`BaseIconButton`、`BaseModal`、`BaseToast`、`BaseDropdown`、N0-N7、`--color-primary` | P0 | 全局导航、项目弹窗、资料编辑、知识沉淀、采集设置等通用弹窗优先改成 base 组件；新增交互不得继续写散落按钮样式 |
| `frontend/src/features/workflow/components/WorkflowCanvasPage.vue` | 工作流画布主路径，按钮和 Tab 很多 | 画布顶部按钮、左侧节点 Tab、版本操作、全屏编辑操作仍为原生按钮 | `BaseButton`、`BaseIconButton`、`BaseTabs`、`BaseTag`、`BaseModal` | P0 | 顶部主操作保留黑色主按钮；缩放、返回、Agent、知识库等按钮统一尺寸和 hover/focus；节点切换具备键盘可用性 |
| `frontend/src/features/workflow/components/WorkflowAgentDrawer.vue` | Agent 高频对话面板，交互复杂 | 快捷回复、上传菜单、消息操作、停止/发送按钮仍是局部样式；图标不完全统一 lucide | `BaseButton`、`BaseIconButton`、`BaseDropdown`、`BaseTag`、`lucide-vue-next` | P0 | 发送按钮使用黑色主按钮；停止、复制、重试、编辑、确认入画布有统一 disabled/loading/focus 态 |
| `frontend/src/features/competitor-monitor/components/CompetitorMonitorView.vue` | 已完成 Phase 1 迁移 | 列表行仍是业务按钮，后续可抽通用 `DataList` 模式；洞察分类选择仍是固定默认值 | `BaseTabs`、`BaseButton`、`BaseSearchInput`、`BaseInput`、`BaseTextarea`、`BaseCard`、`BaseTag` | P0 | 已接入基础按钮、Tab、搜索、输入框、文本域、卡片、状态标签；下一步补洞察分类选择和列表组件抽象 |
| `frontend/src/features/competitor-monitor/components/ChangeDetailPanel.vue` | 独立详情面板 | 详情卡片和空状态仍是业务样式 | `BaseCard`、`BaseTag` | P1 | 事实观察、AI 解读、设计建议统一卡片间距、标题层级和空状态样式 |
| `frontend/src/pages/design-system/DesignSystemPage.vue` | 内部组件展示页 | 已使用基础组件，需保持 API 与组件一致 | `BaseButton`、`BaseSearchInput`、`BaseTabs`、`BaseDropdown`、`BaseModal`、`BaseToast`、`BaseProgress` | P1 | 作为开发参考页，示例必须能真实渲染，禁止展示过期 prop 名 |
| `frontend/src/pages/workflow/WorkflowPage.vue` | 页面包装入口 | 仅包装 slot/feature | 页面分层规范 | P2 | 保持薄入口，不放业务逻辑 |
| `frontend/src/pages/factory/FactoryPage.vue` | 页面包装入口 | 仅包装 slot，真实 UI 在 `App.vue` 片段内 | 页面分层规范，后续拆 feature | P1 | 网页工厂 UI 后续应从 `App.vue` 拆到 `features/factory` 后再迁移 base 组件 |
| `frontend/src/pages/knowledge/KnowledgePage.vue` | 页面包装入口 | 仅包装 slot，真实 UI 在 `App.vue` 片段内 | 页面分层规范，后续拆 feature | P1 | 知识库 UI 后续应从 `App.vue` 拆到 `features/knowledge`，筛选、导入、详情弹窗用 base 组件 |
| `frontend/src/pages/projects/ProjectsPage.vue` | 页面包装入口 | 仅包装 slot | 页面分层规范 | P2 | 项目管理真实 UI 从 `App.vue` 拆出后再迁移 |
| `frontend/src/pages/assets/AssetsPage.vue` | 页面包装入口 | 仅包装 slot | 页面分层规范 | P2 | 素材资产真实 UI 从 `App.vue` 拆出后再迁移 |
| `frontend/src/pages/skill-center/SkillCenterPage.vue` | 页面包装入口 | 仅包装 slot | 页面分层规范 | P1 | Skill 表单、导入、保存、状态反馈后续从 `App.vue` 拆出并迁移 base 组件 |
| `frontend/src/pages/settings/SettingsPage.vue` | 页面包装入口 | 仅包装 slot | 页面分层规范 | P1 | 模型设置、连接测试、日志筛选后续从 `App.vue` 拆出并迁移 base 组件 |
| `frontend/src/pages/diagnosis/DiagnosisPage.vue` | 页面包装入口 | 仅包装 slot | 页面分层规范 | P2 | 后续如承载真实诊断 UI，再按基础组件重构 |

## 分阶段迁移计划

### 第一阶段：组件护栏与高频样板

- 保留 `#222529` 黑色主按钮作为默认 primary。
- 所有新页面从 `frontend/src/components/base` 引入基础组件。
- 已完成竞品监控第一批样板迁移，后续页面参考该方式推进。
- 设计系统展示页必须保持可运行，作为前后端和 UI 对齐的入口。

### 第二阶段：工作流主路径

- 先改 `WorkflowCanvasPage.vue` 顶部工具栏和左侧节点 Tab。
- 再改 `WorkflowAgentDrawer.vue` 的发送、停止、上传、消息操作按钮。
- 每次只迁移一个交互区域，并补测试断言该区域引入对应 base 组件。

### 第三阶段：从 `App.vue` 拆业务 feature

- 网页工厂拆到 `frontend/src/features/factory`。
- 知识库拆到 `frontend/src/features/knowledge`。
- 设置拆到 `frontend/src/features/settings`。
- 技能中心拆到 `frontend/src/features/skill-center`。
- 拆分后再替换基础组件，避免在巨型文件里继续堆 UI。

## 开发验收清单

- 不引入 Element Plus 或 `@element-plus/icons-vue`。
- 图标统一使用 `lucide-vue-next`，描边 2px，尺寸 16 / 20 / 24。
- 主操作使用 `BaseButton variant="primary"`，黑色主按钮视觉权重最高。
- 搜索使用 `BaseSearchInput`，Tab 使用 `BaseTabs`，弹窗使用 `BaseModal`，状态提示使用 `BaseToast` 或 `BaseTag`。
- 新增颜色必须先进入 token；业务页面不得新增零散灰色、蓝色、紫色。
- 页面入口放 `frontend/src/pages`，业务模块放 `frontend/src/features`，通用组件放 `frontend/src/components/base`。
