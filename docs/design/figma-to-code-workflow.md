# Figma / 设计稿到代码执行规范

## 适用范围

本规范用于把 Figma 页面、截图设计稿、交互说明或视觉稿落地到当前项目代码中。当前阶段暂不接入 Figma 组件映射和 Code Connect，只约束设计稿解析、组件复用、资源处理、交互状态和交付验证。

相关规范：

- 视觉与组件基础规范：[ai-commerce-design.md](./ai-commerce-design.md)
- 前端目录分层规范：[frontend-structure.md](./frontend-structure.md)
- 基础组件使用规范：[component-library.md](./component-library.md)

## 一、核心原则

### 1.1 先复用，再局部实现

页面实现前必须先检查 `frontend/src/components/base` 是否已有匹配组件。按钮、Tab、搜索框、卡片、标签、下拉、弹窗、Toast、进度条等基础能力优先复用现有组件。

只有当现有组件在视觉、尺寸、交互、状态和语义上无法覆盖设计稿时，才允许在页面或业务模块中局部实现。不要因为“看起来差不多”就强行复用，也不要在每个页面重复手写基础组件样式。

### 1.2 视觉按设计系统，交互参考成熟模式

视觉必须遵守 `ai-commerce-design.md`：黑色主按钮、品牌蓝辅助、AI 紫专用、N0-N7 灰度、4px 栅格、弱阴影、线性图标。

交互行为可以参考 Element Plus 的成熟模式，例如 focus、hover、active、disabled、loading、clearable、error、Popover 外部点击关闭、Esc 关闭和键盘可达性。但视觉样式不得继承 Element Plus 默认主题。

### 1.3 文件必须放在正确层级

- 页面入口：`frontend/src/pages/<domain>/<PageName>.vue`
- 业务组件：`frontend/src/features/<domain>/components`
- 无业务基础组件：`frontend/src/components/base`
- 全局 token 与 `.ui-*` class：`frontend/src/styles/base.css`
- 设计规范文档：`docs/design`
- 前端纯逻辑服务：`frontend/src/services`

不允许把页面、业务组件、基础组件和文档混在一个大文件里。

## 二、设计稿解析流程

实现前按顺序判断设计稿内容：

1. 页面类型：工作台、列表页、画布页、弹窗、表单、详情页还是移动端页面。
2. 页面结构：是否有侧边栏、顶部栏、工具栏、画布区、结果区、固定操作区。
3. 基础组件：按钮、输入框、搜索框、Tab、筛选项、卡片、标签、弹窗、Toast 是否可复用。
4. 资源类型：图片、图标、文本、组件实例、运营图、截图兜底。
5. 交互状态：默认、hover、active、focus、disabled、loading、error、selected、open。
6. 数据状态：空态、加载、失败、无权限、额度不足、长文本、大量数据。
7. 响应式：桌面最小宽度、移动端表现、横向滚动、弹窗宽度。

如果设计稿缺少关键状态，不要自行脑补成最终规范；先按当前组件规范补齐合理默认，并在交付说明中标注。

## 三、资源处理规则

### 3.1 图片

图片填充、运营图、用户上传封面、商品图、复杂截图节点必须作为图片资源处理，不要用 CSS 或 HTML 手绘。

长期使用的图片必须进入项目资源目录，禁止依赖临时外链。导出图片时应保留设计稿逻辑尺寸，页面中按设计稿尺寸渲染，不按图片物理像素放大。

### 3.2 图标

图标统一使用 `lucide-vue-next`。默认线性 2px 描边，尺寸只能使用 16px、20px、24px。

常规图标使用 N5，主操作图标使用品牌蓝，AI 图标使用 AI 紫，禁用图标使用 N3。禁止在页面里临时内联 SVG 或用 CSS 画图标。确实没有匹配图标时，先选 lucide 中语义最接近的通用图标，并在交付说明中标注。

### 3.3 文本

文本必须考虑换行、省略和悬浮提示。列表、卡片内多行文本最多展示 3 行，超出折叠省略；需要查看完整内容时使用 Tooltip、Popover 或详情页承接。

## 四、组件复用判断

复用基础组件必须同时满足：

- 视觉匹配：颜色、圆角、边框、字号、间距接近设计规范。
- 尺寸匹配：高度、padding、图标尺寸、点击热区符合需求。
- 交互匹配：hover、focus、disabled、loading、selected 等状态完整。
- 语义匹配：组件职责一致，不用按钮冒充 Tab，不用卡片冒充弹窗。
- API 可表达：props、slot、事件能覆盖页面需要。

不满足以上条件时，按以下顺序处理：

1. 如果只是基础组件能力不足，优先增强 `frontend/src/components/base`。
2. 如果是业务独有结构，放到 `frontend/src/features/<domain>/components`。
3. 如果只是单页一次性区域，允许放在页面内，但样式不得污染全局。

## 五、交互状态要求

所有可交互组件至少覆盖：

- 默认态
- hover
- active
- focus-visible
- disabled
- loading
- selected / active
- open / close
- error

通用动效使用 `0.2s ease`。长任务必须提供进度、加载文案或明确反馈，不允许只让按钮转圈且没有状态说明。

弹窗、下拉、浮层必须明确：

- 是否有遮罩
- 点击遮罩是否关闭
- Esc 是否关闭
- 外部点击是否关闭
- 关闭后是否保留输入
- 内容超高如何滚动
- 底部操作区是否固定

## 六、颜色与样式约束

页面和组件优先使用 `frontend/src/styles/base.css` 中的 CSS 变量：

- `--color-primary`
- `--color-brand`
- `--color-ai-accent`
- `--color-n0` 至 `--color-n7`
- `--color-success`
- `--color-warning`
- `--color-error`
- `--space-*`
- `--radius-*`
- `--shadow-*`

除设计系统 token 文件和必要的示例色块外，不建议在业务页面里散落硬编码色值。确实需要新增颜色时，先判断是否应补充到设计规范和 token，而不是直接写在页面 CSS 中。

## 七、页面交付清单

每次从设计稿落地页面或组件，交付说明至少包含：

- 改动文件
- 设计稿来源或截图来源
- 复用的基础组件
- 新增的业务组件或资源
- 颜色 token 使用说明
- 图标来源
- 已覆盖的交互状态
- 已运行的验证命令
- 未处理风险或设计稿缺失状态

推荐验证命令：

```bash
npm --prefix frontend run build
node --test tests/image-to-html-failed-preview.test.mjs tests/image-to-html-timeout.test.mjs
```

如果启动了页面进行视觉验证，需要补充 localhost URL、检查过的浏览器视口和是否存在控制台报错。

## 八、设计侧交付建议

设计稿交付时建议包含：

- 页面名称与所属业务模块
- 桌面和移动端断点
- 是否包含侧边栏、顶部栏、工具栏
- 主按钮与次按钮规则
- 空态、加载、失败、无权限、额度不足状态
- 长文本和大量数据情况
- 图片、图标、运营图资源清单
- 弹窗、下拉、抽屉、Toast 的触发和关闭规则
- 哪些区域应复用基础组件，哪些区域是业务特有组件

设计稿越完整，代码越少猜测，后续返工越少。
