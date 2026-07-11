# 前端目录与设计系统落地规范

## 目录职责

| 目录 | 职责 | 放置规则 |
| --- | --- | --- |
| `frontend/src/app` | 应用壳层、路由入口、全局布局装配 | 只放 AppShell、全局 provider、应用级组合逻辑 |
| `frontend/src/pages` | 页面入口 | 每个一级页面一个目录，只做页面级编排，不沉淀可复用基础组件 |
| `frontend/src/pages/design-system` | 内部设计系统展示页 | 展示基础组件、token 和交互状态，不承载业务流程 |
| `frontend/src/features` | 业务领域模块 | 放具体业务组件、业务样式、领域服务连接 |
| `frontend/src/components/base` | 无业务基础组件 | 放 Button、Tabs、SearchInput、Modal 等跨页面复用组件 |
| `frontend/src/styles` | 全局样式入口与 token | `base.css` 放 token 和基础组件 class，`layout.css` 放全局布局 |
| `frontend/src/services` | 前端纯逻辑服务 | 放 API 适配、数据转换、状态构建，禁止写 UI |
| `docs/design` | 设计规范与前端落地规范 | 放 MD 规范、组件清单、目录约束、视觉 token 说明 |

设计系统展示页放在 `frontend/src/pages/design-system/DesignSystemPage.vue`，只用于组件巡检和迁移参考，不承载业务流程。

## 分层规则

- 基础组件不得依赖业务模块。
- 页面可以依赖 `components/base` 和 `features`，但 `components/base` 不得反向依赖 `pages` 或 `features`。
- 业务组件如果被 3 个以上页面复用，应评估是否下沉到 `components/base` 或独立 feature。
- CSS token 和通用 `.ui-*` class 只放在 `frontend/src/styles/base.css`。
- 页面私有样式放在页面或 feature 对应样式文件中，不新增散落全局选择器。

## 组件建设原则

- 视觉按 `docs/design/ai-commerce-design.md`，交互行为参考 Element Plus 成熟模式。
- 图标统一使用 `lucide-vue-next`，默认 2px 描边，尺寸 16/20/24px。
- 主按钮使用黑色 `#222529`；品牌蓝只用于链接、选中态、焦点态、导航高亮；AI 紫只用于 AI/智能能力。
- 新页面优先使用 `BaseButton`、`BaseTabs`、`BaseSearchInput`、`BaseIconButton`、`BaseCard` 等基础组件。
- 组件用法详见 `docs/design/component-library.md`，展示页位于 `frontend/src/pages/design-system/DesignSystemPage.vue`。
- Figma、截图或设计稿落地流程详见 `docs/design/figma-to-code-workflow.md`。

## 设计需求与知识库页面层级

| 层级 | 页面 / 状态 | 路由或入口 | 主要展示 |
| --- | --- | --- | --- |
| 一级页 | 需求文档 | `#/projects/:projectId/requirements` | 产品需求、模糊需求、设计需求的列表、状态和知识沉淀入口 |
| 一级页 | 知识库 | `#/projects/:projectId/knowledge` | 结构树、流程图、交互 Demo、Markdown、知识治理概览 |
| 一级页 | 设计方案 | `#/projects/:projectId/design` | 输入需求、页面蓝图画布、Agent 补充、转需求文档 |
| 二级状态 | 转需求文档弹窗 | 设计方案页顶部操作 | 选择产品需求 / 模糊需求 / 设计需求，设计需求显示模板预览 |
| 二级状态 | 知识库节点详情 | 知识库结构树节点 | 截图定位、AI 上下文、节点证据和关联知识 |
| 二级状态 | 解析任务 / 召回测试 | 知识库顶部工具弹窗 | URL 导入任务、知识召回验证、批量管理 |

跳转关系：

- 设计方案页点击“转需求文档”后选择“设计需求”，生成结构化设计需求并跳转到需求文档一级页，自动筛选“设计需求”。
- 知识库页只负责查看和补全知识，不直接替代设计方案画布；知识会在“转设计需求”时按栏目补全。
- 需求文档页的“沉淀到知识库”把已确认文档转为可复用知识块，回流到知识库一级页。

## 文件管理与前后端分配

| 模块 | 前端文件 | 职责 | 后端职责 |
| --- | --- | --- | --- |
| 设计需求生成 | `frontend/src/services/designRequirement.js` | 生成固定栏目、栏目状态、知识引用、治理摘要 | 后续可迁移为正式接口，负责持久化和权限校验 |
| 转需求文档弹窗 | `frontend/src/App.vue` | 入口触发、模板预览、提交后跳转需求文档 | `workspace.createMaterial` 保存需求材料 |
| 知识库展示 | `frontend/src/pages/knowledge/KnowledgeHubPanel.vue` | 展示四层保存、完整度、结构树和二级详情入口 | 返回 URL 解析结果、知识块、解析任务和截图资产 |
| 需求文档列表 | `frontend/src/pages/knowledge/RequirementDocumentsPanel.vue` | 一级 Tab 展示产品/模糊/设计需求和知识状态 | 提供需求材料列表、状态更新、批量管理 |

设计需求固定模板包含：背景目标、适用场景、用户角色、业务流程、页面/功能清单、权限规则、异常场景、数据字段、前后端边界、验收标准。系统能自动提取或知识库补全的栏目显示“已提取/已补全”，缺失栏目显示“待补充”，不得伪装为已完成。
