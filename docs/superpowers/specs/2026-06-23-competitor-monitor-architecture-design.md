# Competitor Monitor Architecture Design

## Goal

重构并完善“竞品监控”功能方案，明确前端、业务后端、采集服务、AI 服务的职责边界，给出更符合大厂项目的推荐架构，并在进入实现前完成一轮方案级 bug 检查和优化收口。

目标不是只把页面结构列出来，而是把“谁接管主流程、谁给谁数据、状态真相放在哪里、哪些能力先做、哪些能力后做”写成可评审、可排期、可拆人开发的设计文档。

## Scope

本设计覆盖：

- `AI 助手 / 竞品监控` 一级能力下的 MVP 信息架构。
- 前端、业务后端、采集服务、AI 服务的明确职责边界。
- 大厂风格的推荐系统分层与数据流。
- 方案级风险检查、边界冲突修正和 MVP 收敛建议。
- 面向 2 到 6 周交付节奏的阶段划分与团队分工方式。

本设计暂不覆盖：

- 登录态页面监控。
- 浏览器插件或 Figma 插件。
- 实时监控。
- 复杂审批流和深度第三方协同。
- 高级视觉识别和完整自动设计方案生成。

## Recommended Architecture

推荐采用 `业务后端主导编排，前端做纯消费与轻交互，采集/AI 作为后端下游能力服务` 的架构。

这是一种更符合大厂项目的模式。前端不直接对接采集服务和 AI 服务，而是统一通过业务后端获取稳定的业务对象。业务后端承担主流程编排、状态管理、权限校验、任务调度、聚合查询和结果追溯。采集服务负责抓取、截图、快照抽取。AI 服务负责结构化分析、标签建议、报告草稿生成。前端专注页面体验、列表详情、筛选、对比、编辑和反馈。

推荐系统分层如下：

```text
体验层
└── Frontend Web

业务编排层
└── Competitor Monitor Backend

能力执行层
├── Capture Worker / Service
├── Diff Worker
├── AI Analysis Worker / Service
├── Report Export Worker
└── Notification Worker

存储层
├── Relational DB
├── Object Storage
├── Queue
└── Cache / Redis
```

核心原则：

- 业务状态真相只保存在业务后端。
- 采集服务和 AI 服务是可替换能力，不直接定义用户看到的产品状态。
- 前端消费统一业务对象，不拼接底层原始抓取结果和模型原始输出。
- 任务型能力全部异步化，避免前端阻塞等待长耗时接口。

## Why This Is Recommended

这是推荐主方案，原因如下：

1. 业务语义集中。竞品、任务、快照、变化、分析、报告、洞察都属于业务对象，应由业务后端掌控生命周期，而不是分散在前端或子服务里。
2. 联调成本更低。前端只依赖业务后端，不需要同时理解采集失败、模型失败、导出失败等多套协议。
3. 依赖可替换。后续更换抓取引擎、视觉 diff 算法、模型供应商时，不需要改前端产品逻辑。
4. 安全和审计更稳。权限、成本、日志、失败重试、来源追溯都能统一治理。
5. 团队协作清晰。前端、业务后端、采集、AI 可以并行推进，不会在职责归属上互相覆盖。

## Information Architecture

`AI 助手 / 竞品监控` 保留一个一级 Tab，内部采用二级 Tab。MVP 只保留最短闭环所需能力。

MVP 二级 Tab：

- 概览
- 竞品库
- 变化记录
- 分析报告

第二阶段增加：

- 监控任务
- 洞察库

第三阶段增加：

- UI 参考

MVP 最小闭环：

```text
添加竞品
→ 自动创建默认监控任务
→ 周期采集页面快照
→ 生成变化记录
→ 输出 AI 结构化分析
→ 生成报告
```

为缩短第一版路径，`监控任务` 不建议一开始作为独立高心智 Tab，而是先收进竞品详情页或竞品详情抽屉中的一个区块。

## Responsibilities

### Frontend Responsibilities

前端接管：

- 竞品监控页面框架、二级 Tab 切换、路由同步和筛选状态。
- 概览卡片、竞品列表、变化列表、变化详情、报告列表与详情等所有展示与交互。
- 添加竞品、新建报告、筛选、导出入口、收藏洞察等用户操作入口。
- 截图对比、文本 Diff、AI 输出分层展示。
- 空状态、加载状态、错误状态、重试入口和权限显隐。
- 轻量编辑能力，例如 Markdown 轻编辑和备注补充。

前端不接管：

- 监控任务调度。
- 快照真相存储。
- Diff 计算。
- AI Prompt 编排与模型调用。
- 任务失败重试和底层能力降级。

### Business Backend Responsibilities

业务后端接管：

- 领域模型：`competitor`、`monitor_task`、`page_snapshot`、`change_record`、`ai_analysis`、`report`、`insight`。
- 工作空间隔离、角色权限、对象级权限、操作审计。
- 统一业务状态机和聚合查询口径。
- 主任务编排：何时采集、何时比较、何时触发 AI、何时通知、何时导出。
- 对前端输出稳定业务 API。
- 对下游采集服务和 AI 服务发起内部任务调用。
- 成本统计、失败恢复、任务回溯、通知触发。

业务后端是主系统，拥有业务状态真相。

### Capture Service Responsibilities

采集服务接管：

- URL 访问与浏览器渲染。
- 页面截图。
- HTML、文本、DOM 等快照物料提取。
- 采集日志、失败分类、超时控制、有限重试。
- 将结果按统一快照契约回传给业务后端。

采集服务不直接给前端提供产品接口，也不直接决定变化等级、洞察结论或报告内容。

### AI Service Responsibilities

AI 服务接管：

- 竞品画像生成。
- 页面内容总结。
- 变化摘要生成。
- 产品、UX、UI 三维影响分析。
- 标签和优先级建议。
- 报告草稿生成和洞察提炼。
- Prompt 模板、模型调用日志、Token 成本记录。

AI 服务只返回结构化结果与建议，不直接定义产品最终状态，也不直接控制前端页面逻辑。

## Data Flow

推荐数据流如下：

```text
Frontend
→ Competitor Monitor Backend
→ Capture Service
→ Competitor Monitor Backend
→ Diff / AI Orchestration
→ AI Service
→ Competitor Monitor Backend
→ Frontend
```

具体交接：

1. 前端调用业务后端创建竞品。
2. 业务后端创建 `competitor`，并初始化默认 `monitor_task`。
3. 业务后端向采集服务派发采集任务。
4. 采集服务返回快照物料地址和采集元信息。
5. 业务后端保存 `page_snapshot`，并与上一个快照配对。
6. 业务后端完成变化检测或调用 diff worker，生成 `change_record`。
7. 业务后端将结构化 diff 输入发给 AI 服务。
8. AI 服务返回 `factual_observation`、`interpretation`、`product_impact`、`ux_impact`、`ui_impact`、`recommendation`、`tags`、`severity_suggestion`。
9. 业务后端将其保存为 `ai_analysis`，并回填到 `change_record` 可读模型。
10. 前端只读取业务后端聚合后的业务对象，不感知底层服务协议。

一句话概括：

`前端 <- 业务后端 <- 采集服务 / AI 服务`

不推荐：

- `前端 <-> 采集服务`
- `前端 <-> AI 服务`

## Data Contracts

### Frontend-Facing API

前端只调用业务 API，例如：

- `GET /api/competitor-monitor/overview`
- `GET /api/competitors`
- `POST /api/competitors`
- `GET /api/changes`
- `GET /api/changes/:id`
- `POST /api/reports`
- `GET /api/reports/:id`
- `POST /api/changes/:id/save-as-insight`

前端面向的是业务对象，而不是采集原始结果或模型原始响应。

### Internal Service API

内部服务接口建议单独命名，例如：

- `POST /internal/capture/jobs`
- `POST /internal/diff/jobs`
- `POST /internal/ai/change-analysis`
- `POST /internal/ai/report-draft`
- `POST /internal/export/report`

这样可以把产品 API 和能力 API 分开，避免前端误依赖内部契约。

## State Model

状态机必须在业务后端统一定义，前端只消费这些业务状态。

### MonitorTask.status

- `draft`
- `active`
- `paused`
- `error`

### PageSnapshot.status

- `queued`
- `capturing`
- `succeeded`
- `failed`

### ChangeRecord.status

- `detected`
- `analyzing`
- `ready`
- `ignored`
- `failed`

### Report.status

- `draft`
- `generating`
- `ready`
- `export_failed`

如果需要更细的 worker 状态，可以存在内部执行日志中，不建议直接暴露给前端页面态。

## MVP Feature Boundaries

### Phase 1: Foundational Closed Loop

目标：用户能完成添加竞品、自动采集、变化查看和 AI 分析。

前端：

- 竞品监控页面框架
- 概览
- 竞品库
- 添加竞品表单
- 变化记录列表与详情
- AI 分析结果分层展示

业务后端：

- 竞品 CRUD
- 默认监控任务初始化
- 快照保存
- 变化记录生成
- AI 分析任务编排

采集：

- 页面抓取
- 页面截图
- 文本抽取

AI：

- 竞品画像
- 变化摘要与结构化分析

### Phase 2: Report Closed Loop

目标：用户可基于竞品与变化生成分析报告。

前端：

- 报告列表
- 新建报告流程
- 报告详情
- Markdown 轻编辑

业务后端：

- 报告 CRUD
- 报告任务编排
- 导出入口与权限

AI：

- 报告草稿生成

### Phase 3: Insight Accumulation

目标：用户可将高价值变化沉淀为洞察。

前端：

- 洞察列表
- 收藏为洞察
- 状态与优先级管理

业务后端：

- 洞察 CRUD
- 变化来源绑定
- 报告来源绑定

### Phase 4: UI Reference Enhancement

目标：沉淀视觉参考和页面截图资产。

这阶段再补：

- UI 参考 Tab
- 风格标签
- 页面类型识别
- AI 视觉分析

第一版不建议提前做。

## Plan-Level Bug Check

对原始方案做一轮结构性 bug 检查，主要问题如下：

1. `AI 服务` 与 `后端 AI 分析服务` 边界重叠，责任人不清。
2. `监控任务服务` 与 `采集任务服务` 都在描述任务，缺少主从关系。
3. 前端承担过多流程状态理解，容易变成多接口拼装器。
4. AI 接口按同步返回设计，不适合正式生产环境中的长耗时和重试。
5. `UI 参考` 与 `变化记录` 的素材边界未定义清楚，后期会重复存图和重复标注。
6. `报告` 与 `洞察` 的来源链路不够硬，追溯性不足。
7. `概览` 统计口径没有明确统一出口，容易各模块各算各的。
8. 权限模型只写了角色，缺少对象级授权边界。

## Optimizations

基于上述问题，建议做如下优化：

1. 统一将业务后端定义为主系统，采集和 AI 为下游能力服务。
2. 所有长耗时能力异步任务化，前端只轮询或订阅业务状态。
3. 前端只消费业务对象，不消费能力服务原始返回。
4. 报告和洞察必须保存来源引用，至少能追溯到 `change_record` 或 `ai_analysis`。
5. `监控任务` 第一版收进竞品详情，减少独立心智负担。
6. `报告编辑器` 第一版做 Markdown 轻编辑，不做重型富文本系统。
7. 统一概览聚合口径，由业务后端一次返回。
8. 状态机先少而稳，不要把底层 worker 状态直接暴露到页面层。

## Team Split Recommendation

推荐团队按四条线并行：

### Frontend Line

- 页面结构
- 筛选和列表
- 变化详情体验
- 报告详情和轻编辑
- 状态与空错态

### Business Backend Line

- 领域模型
- 状态机
- 聚合 API
- 权限体系
- 主流程编排

### Capture Line

- 浏览器抓取
- 截图与文本抽取
- 快照物料管理
- 采集错误恢复

### AI Line

- 竞品画像
- 变化结构化分析
- 报告草稿生成
- 成本与日志

如果团队规模有限，也应该至少保证“前端”和“业务后端”是两条明确责任线，不建议让前端直接统筹采集和 AI 的产品主链路。

## Delivery Recommendation

如果目标是在 2 到 6 周内做出靠谱 MVP，推荐节奏如下：

1. 第 1 周：定模型、状态机、业务 API 和前端框架。
2. 第 2 周：打通采集、快照保存和竞品详情。
3. 第 3 周：完成变化记录、Diff 展示和变化详情。
4. 第 4 周：接入 AI 变化分析与竞品画像。
5. 第 5 周：补齐报告生成与详情页。
6. 第 6 周：做权限、通知、空错态、日志和性能打磨。

## Final Recommendation

最终推荐采用：

`业务后端接管主流程，前端接管体验，采集与 AI 作为后端下游能力`

这是当前最平衡的方案：

- 比“前端主导聚合”更稳，更适合正式项目。
- 比“一开始完全平台化拆超细服务”更轻，更适合当前 MVP。
- 既保留大厂式边界清晰、状态统一、依赖可替换的优点，也不会在第一版过早平台化。

对这类项目来说，真正像大厂的不是服务拆得越多越好，而是：

- 业务状态真相唯一
- 能力边界清晰
- 数据可追溯
- 前后端职责稳定
- 子系统可替换

本设计以此作为首要准则。
