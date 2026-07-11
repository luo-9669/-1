# 竞品监控开发接手清单

## 推荐开发模式

采用“业务后端主导编排，前端消费稳定 DTO”的模式。

推荐原因：

- 后端统一保存竞品、任务、快照、变化、分析、报告和洞察，后续接权限、审计、定时任务和失败重试更稳。
- 前端只关注用户任务、页面状态和交互体验，不直接理解采集服务、AI 服务或 worker 原始协议。
- 采集、diff、AI worker 后续可替换，只要保持业务 API 不变，前端页面不需要重写。
- 前后端可并行开发：后端先保证 DTO 和状态机，前端按契约渲染列表、详情和动作。

## 当前推荐执行计划

### 本轮执行计划

1. 先守页面文案：用 `tests/competitor-analysis-ui.test.mjs` 覆盖截图红框类内容，禁止英文装饰眉标、工程说明、内部枚举和“默认监控”这类实现型按钮/空态文案出现在页面模板中。
2. 再修前端页面：竞品库按钮、空态、加载提示和任务详情统一改成用户语言，例如“添加并开始监控”“首个监控任务”“等待首次检测”。
3. 然后固化交接：本文档只记录竞品监控开发计划、前后端接管范围、数据交接和验收命令，不在根目录或其他模块散落说明。
4. 最后做 bug 检查：跑竞品监控测试、前端构建、禁用文案扫描和文档旧词扫描，确认没有把内部字段暴露回页面。

### 立即执行：页面质量和团队治理闭环

- 前端：按设计 MD 保留 `竞品库 / 监控任务 / 变化记录 / 分析报告 / 洞察库 / UI 参考`，页面主文案只讲用户任务，不展示英文眉标、内部枚举、接口名、worker 名、后端/前端工程说明。
- 前端：报告、洞察、UI 参考的按钮用用户语言，例如“导出报告”“导出洞察”“收藏”，不要把 `Markdown`、`content-update`、`monitor-failed` 这类实现细节放到主界面。
- 前端：创建竞品后的自动任务属于后端机制，页面不要写“默认监控”“默认监控任务”；用户界面统一写“开始监控”“首个监控任务”“等待首次检测”。
- 前端：下载文件名、空态、失败态、分享页也属于用户体验范围，兜底文案必须用中文业务名，例如 `竞品分析报告.md`，不要出现 `competitor-report.md` 这类内部命名。
- 后端：导出报告、洞察和操作记录时统一生成中文业务文件名，洞察标题缺失时兜底为 `竞品洞察.md`，不要把 `competitor-insight.md` 这类内部命名返回给前端。
- 后端：监控任务的审计标题、默认采集标题和用户可读摘要必须使用中文页型，例如 `官网首页`，不要把 `Homepage` 这类内部页型直接写入操作记录。
- 后端：继续补齐权限、审计、幂等、失败历史、失败归因和版本历史，所有能改变业务状态的动作必须由 service 写入持久化记录。
- 测试：每个功能切片先写 `tests/competitor-analysis-ui.test.mjs`、`tests/competitor-analysis-engine.test.mjs` 或 `tests/competitor-default-sync.test.mjs` 中对应的回归，再实现；最后跑竞品相关测试、构建和禁用文案扫描。

## 大厂式接管建议

推荐由后端接管“业务状态和安全闭环”，前端接管“页面体验和任务完成效率”。

- 后端负责人先定 API 契约、权限 DTO、审计字段、错误码、幂等规则和状态机；所有写动作都必须先过后端校验。
- 前端负责人按设计 MD 做页面信息架构、组件组合、加载/空/失败/禁用态、中文展示映射和交互反馈；不在页面里推导角色、不拼 worker 或 AI 原始结构。
- 双方以 `docs/design/competitor-monitor-api-contract.md` 为交接物；后端变更 DTO 先改契约和测试，前端只按契约消费。
- 测试负责人维护页面禁用文案扫描、权限角色用例、公开分享用例、幂等保存用例和构建回归。

推荐方案仍然是“后端主导业务状态，前端主导体验呈现”。不推荐“前端本地拼监控状态、后端只存数据”，因为真实采集、权限审计、重试、成本治理和公开分享都会让状态分散，后续团队协作成本会快速上升。

### 下一阶段：成员权限和审计深化

- 后端已完成基础角色闭环：`owner / editor` 可执行写动作，`viewer / guest` 只读；权限 DTO、协作成员权限列表与中文权限说明由后端生成，前端只消费。
- 后端已完成操作记录基础筛选与导出：支持按动作、对象类型和操作者查询或导出；UI 参考收藏和取消收藏也会进入操作记录。
- 前端跟进：在概览里展示最近操作记录、权限提示和可恢复动作，不做角色推导，不做本地假状态。
- 测试跟进：对每个角色的可见按钮、禁用原因和服务端拒绝错误码做回归。

### 再下一阶段：真实采集和 AI 成本治理

- 后端/worker：接真实采集服务、diff worker、AI worker，保留现有业务 API 不变。
- 后端：记录模型、token、耗时、fallback、采集失败分类和重试历史。
- 前端：只展示可行动结果，例如“需要登录授权”“页面暂时无法访问”“模型分析失败，可重试”，不要展示底层错误栈。

## 前端接管范围

- 页面入口：`frontend/src/pages/competitor-monitor/`
- 业务 UI：`frontend/src/features/competitor-monitor/`
- API 调用：`frontend/src/services/api.js`
- 展示 helper：`frontend/src/services/competitorMonitor.js`
- 只处理：Tab、列表、搜索、详情、表单校验、空态、加载态、失败态、按钮动作、中文展示映射。
- 不处理：采集、diff、AI prompt、任务排期、失败重试状态机、报告/洞察业务结论生成。

### 前端开发清单

- 新页面或新区域只能放在 `frontend/src/features/competitor-monitor/`，页面入口只放在 `frontend/src/pages/competitor-monitor/`。
- 样式入口必须保持 `frontend/src/styles/index.css` 中 legacy `../styles.css` 先导入、feature styles 后导入，确保竞品监控专属页面样式覆盖旧兼容样式。
- 所有按钮、Tab、输入框、搜索框、卡片、标签优先使用 `frontend/src/components/base/`，不要临时写原生控件和孤立样式。
- 所有枚举展示必须走 `frontend/src/services/competitorMonitor.js` 转中文，例如任务状态、变化类型、报告状态、优先级、洞察分类。
- 操作记录里的 `action` 只能作为筛选参数，不作为展示文案；前端展示动作类型时必须使用后端返回的 `actionLabel` 或业务摘要。
- 操作记录里的 `meta` 只能展示后端公开 DTO 里的安全摘要，不读取 `results/payload/raw/stack/worker/debug` 等内部排障字段。
- 所有写动作按钮都必须受 `GET /api/competitor-monitor/permissions` 返回 DTO 控制禁用态；角色名、可执行动作、受限动作和处理建议优先展示后端字段，同时后端仍做最终拒绝。
- 空态必须给下一步动作，加载态说明正在整理什么，失败态必须给“重新加载/重试/去授权/去添加竞品”等恢复入口。
- 概览必须包含安全趋势摘要，用当前高优先级变化、报告、洞察和竞品数量生成用户可读判断；不要展示模型、token、prompt、worker、debug 或成本治理字段。
- 详情头部必须优先展示用户任务、关注点或业务摘要；官网地址、分享链接、变化 id、快照 id 等证据字段只能放在字段卡片或复制动作里，不要替代页面主说明。
- 任务详情头部必须展示“监控什么、按什么节奏追踪什么变化”这类业务摘要；监控 URL 只能放在“任务地址”字段卡里，不要把原始地址当成主说明。
- 外部公开页失败态必须把分享错误码映射成中文恢复建议，例如“请联系分享人重新生成链接”或“请联系分享人开启下载权限”，不要展示 `COMPETITOR_REPORT_SHARE_*`。
- 页面不得出现：`COMPETITOR`、`Competitor Monitor`、`Change Detail`、`Report Draft`、`content-update`、`monitor-failed`、`默认监控`、`默认监控任务`、后端/前端职责说明、worker/debug 文案。

## 后端接管范围

- 领域模型：`backend/models/workspace.js`
- 持久化读写：`backend/services/workspace-store.js`
- 业务编排：`backend/services/competitor-monitor-service.js`
- AI 分析适配：`backend/services/competitor-analysis-adapter.js`
- HTTP 路由：`backend/routes/competitors.js`
- 本地运行注入：`backend/server/mock-api.mjs`
- 只处理：输入校验、默认任务、任务状态、检测结果、失败记录、报告草稿、洞察保存、DTO 聚合。
- 不处理：页面布局、按钮文案、Tab 交互、组件样式。

### 后端开发清单

- 新业务状态和聚合逻辑放在 `backend/services/competitor-monitor-service.js`，route 只做参数转交。
- 所有写动作都要先校验 `projectId` 和权限，缺权限统一抛 `COMPETITOR_PERMISSION_DENIED`；项目权限按 `ownerUserId`、全局 `owner` 和项目 `members` 的 `owner / editor / viewer / guest` 角色生成。
- 所有涉及报告、分享、洞察、收藏、关联需求、沉淀知识库的动作都要保证幂等，避免重复保存或重复关联。
- 所有团队协作动作都要写 `competitorAuditLogs`，至少包含 `action / summary / targetType / targetId / targetTitle / meta`。
- 后端返回操作记录 DTO 时必须补充中文 `actionLabel`；`action` 保留给筛选和审计归档，不给前端作为可见文案。
- 后端返回操作记录 DTO 时必须瘦身 `meta`，公开 DTO 只保留 `checkedAt / totalDue / succeeded / failed / failureType / recoverySuggestion / fileName / count` 等安全摘要；内部 workspace 审计可以保留安全治理明细，但不得让前端拿到 `results/payload/raw/stack/worker/debug`。
- 后端返回公开 `snapshot` DTO 时只保留截图、标题、URL、状态和时间字段；`textContent/html/raw/singleFileHtml/staticHtml` 只留在后端，用于 diff、AI 分析、报告聚合和排障。
- 采集、diff、AI、导出 worker 只能作为 service 的下游适配器，不能把内部协议暴露给前端。
- 返回给前端的 DTO 只包含产品可理解字段，错误 message 可以给前端展示，但不能泄露内部栈、模型密钥、worker 原始 payload。

## 后端给前端的数据

- `GET /api/competitor-monitor/overview`：概览指标、重要变化、近期报告、待看洞察。
- `GET /api/competitor-monitor/permissions`：读取当前账号在项目内的竞品监控操作权限，包含 `roleLabel/allowedActions/restrictedActions/guidance`，前端只按 DTO 控制按钮和展示说明。
- `GET /api/competitor-monitor/members`：读取项目协作成员及竞品监控权限摘要，前端只读展示“协作成员”，不在该页面做成员增删改。
- `GET /api/competitors`：竞品库列表。
- `POST /api/competitors`：创建竞品并自动创建默认监控任务。
- `GET /api/monitor-tasks`：任务状态、频率、通知设置、最近检测、下次执行、失败原因、失败类型、恢复建议和失败历史。
- `POST /api/monitor-tasks`：新建明确的页面监控任务，后端校验项目归属、权限、URL 和频率，计算下次执行时间并写入审计。
- `PATCH /api/monitor-tasks/:id`：暂停/恢复任务、更新监控频率、更新通知设置。
- `POST /api/competitors/:id/check`：手动检测并返回 `competitor/task/公开 snapshot/change/analysis`。
- `GET /api/changes`：变化记录列表。
- `GET /api/changes/:id`：变化详情、公开 snapshot 和 AI 分析。
- `GET /api/competitor-monitor/reports`：后端聚合的报告草稿或已保存正式报告。
- `POST /api/competitor-monitor/reports/:id/save`：把报告草稿保存为正式报告，支持幂等更新。
- `GET /api/competitor-monitor/reports/:id/export`：导出报告 Markdown。
- `POST /api/competitor-monitor/reports/:id/share`：生成正式报告分享链接，支持 `expiresInDays` 和 `allowDownload`。
- `POST /api/competitor-monitor/reports/:id/share/revoke`：撤销正式报告分享链接。
- `GET /api/competitor-monitor/reports/:id/shared/export`：按分享 token 导出公开报告，后端必须校验下载权限。
- `GET /api/competitor-monitor/reports/:id/shared`：按分享 token 读取公开报告，后端校验启用、撤销和过期状态，并写入访问次数和最近访问时间。
- `GET /api/competitor-monitor/audit-logs`：读取项目级操作审计记录，支持 `action/targetType/actorUserId/limit` 筛选，后端记录关键业务动作，前端只展示。
- `GET /api/competitor-monitor/audit-logs/export`：按当前筛选导出审计记录，后端生成中文 Markdown，前端只下载 `fileName/markdown`。
- `GET /api/competitor-monitor/reports/:id/versions`：读取报告版本历史，用于前端“查看版本历史”动作。
- `GET /api/competitor-monitor/reports/:id/versions/compare`：对比两个正式报告版本，后端返回摘要和章节差异 DTO。
- `GET /api/competitor-monitor/ui-references`：后端从截图、变化记录、AI 分析和洞察聚合 UI 参考 DTO。
- `GET /api/competitor-monitor/ui-reference-favorites`：读取项目级 UI 参考收藏，后端从 workspace materials 过滤返回。
- `POST /api/competitor-monitor/ui-reference-favorites`：收藏 UI 参考，后端按 `projectId + referenceId` 幂等保存。
- `DELETE /api/competitor-monitor/ui-reference-favorites/:id`：取消收藏 UI 参考，后端负责项目归属过滤。
- `GET /api/competitor-monitor/insights`：已保存洞察列表。
- `PATCH /api/competitor-monitor/insights/:id`：更新洞察分类和备注。
- `PATCH /api/competitor-monitor/insights/batch`：批量整理洞察分类和备注，后端负责去重和项目归属校验。
- `GET /api/competitor-monitor/insights/:id/export`：导出洞察 Markdown。
- `POST /api/competitor-monitor/insights/batch-export`：批量导出洞察 Markdown 汇总文件。
- `POST /api/competitor-monitor/insights/batch-deposit-knowledge`：批量把洞察沉淀为知识库资料，后端负责去重、幂等和回写关系。
- `POST /api/competitor-monitor/insights/:id/link-requirements`：把洞察关联到需求文档，并给需求材料写入来源关系。
- `POST /api/competitor-monitor/insights/:id/deposit-knowledge`：把洞察沉淀为知识库资料，并回写 `knowledgeMaterialId`。
- `POST /api/changes/:id/save-as-insight`：把变化保存为洞察，同一变化和分类幂等返回同一条洞察。

## 页面当前状态

- 已有入口：`竞品库`、`监控任务`、`变化记录`、`分析报告`、`洞察库`、`UI 参考`。
- 已有动作：添加竞品、新建监控任务、暂停/恢复监控、调整监控频率、调整通知设置、立即检测、查看变化详情、保存正式报告、逐章节编辑报告、导出报告、生成分享链接、选择分享有效期、设置分享下载权限、撤销分享、查看报告版本历史、报告版本对比、查看操作记录、导出操作记录、保存为洞察、调整洞察分类、编辑洞察备注、批量整理洞察、导出洞察、批量导出洞察、单条/批量沉淀到知识库、关联需求文档、打开关联知识、筛选 UI 参考、查看 UI 参考详情、项目级收藏 UI 参考。
- 已有防线：暂停任务后禁用立即检测；重复保存洞察不会生成重复数据；每次检测都会写入任务运行摘要；检测失败会进入失败历史、重试摘要并给出失败类型和恢复建议，且每次失败都会写入安全审计摘要；洞察治理动作进入操作记录；操作记录支持按报告、洞察和操作者筛选；页面不展示英文装饰眉标、内部枚举、工程说明和实现格式词。
- 已有防线：报告、洞察和操作记录导出使用中文业务文件名，缺省场景不会返回 `competitor-report.md` 或 `competitor-insight.md`；导出 Markdown 内的状态、分类、优先级也必须使用中文业务标签，不直出 `ready / product / strategy / high / medium` 等原始枚举。
- 已有防线：保存正式报告和保存洞察时，后端把 AI 分析治理摘要写入内部审计 `meta.analysisGovernance`，只记录是否有分析记录、处理耗时、是否 fallback 和用量总数；公开审计 DTO、前端页面和导出 Markdown 不展示分析记录、处理耗时、模型名、provider、fallback 原因、prompt、payload、stack、worker、debug 或 token 细项。
- 已有防线：监控任务审计标题使用中文页型，例如 `Figma 官网首页`，不把 `Homepage` 暴露给操作记录。
- 已有防线：操作记录导出使用中文动作名和业务摘要，例如 `执行调度`；不把 `monitor-scheduler-ran`、`runDueMonitorTasks`、`meta.results`、payload、stack、worker 或 debug 明细写进用户下载内容。
- 已有防线：操作记录列表返回公开审计 DTO，调度类记录不会把 `meta.results` 明细交给前端；`taskId/changeId/snapshotId/sourceChangeId/sourceSnapshotId/sourceUrl/sourceDraftId/sourceAssetId/materialId/analysisGovernance` 等证据和治理字段也只保留在内部 workspace 审计里，供后端排障、追溯和统计使用。
- 已有防线：变化详情接口和变化列表共用安全 DTO，失败检测详情不会把采集错误原文写给前端；前端失败卡片只根据失败类型、恢复建议和失败历史展示，不读取 `lastError`。
- 已有防线：成功变化的 `diffText` 也只作为后端证据字段保存，公开列表、详情和手动检测响应统一返回空字符串；前端只展示安全摘要和中文标签。
- 已有防线：变化详情的 AI 分析可在 DTO 中保留 `analysisMode / analysisDurationMs / analysisUsageRecorded / analysisFallbackUsed` 等安全治理摘要，但前端主界面只展示事实观察、AI 解读和设计建议；模型名、provider、token 细项和 fallback 原因只保留在后端内部记录或安全审计摘要。
- 已有防线：手动检测成功响应和变化详情使用同一套安全 `analysis` DTO；前端只用 `change.id` 刷新业务数据，不从检测响应展示模型名、provider 或 token 明细。
- `UI 参考` 已接入后端真实 `screenshots/components/visualTags` DTO；前端支持按参考类型和竞品筛选、查看详情和项目级收藏，不伪造截图、组件库或视觉标签数据。
- 公开分享页已补齐阅读导览、章节数量和章节卡片；失败态继续提供“重新尝试 / 联系分享人”，页面模板不展示分享错误码、内部文件名、来源 id、worker、payload 或 debug 字段。
- 报告版本对比已升级为“版本复盘”工作台：前端展示版本脉络、对比范围、变化结论和下一步建议；对比内容只消费后端安全版本 DTO，不展示来源 id、worker、payload 或 debug 字段。
- 报告详情动作区已升级为“下一步建议”工作台：前端先提示确认报告结论，再把保存正式版本、分享给协作方、导出报告、撤销分享和版本复盘分层展示，避免按钮平铺和技术词干扰。
- 洞察关联需求选择器已补齐关联准备、已选数量、空态恢复入口和用户化说明；前端只选择需求范围，关系写入仍由后端接口完成。
- 竞品库列表已改为只展示竞品名称和监控状态，不再把关注点摘要或官网 URL 当成列表主说明；官网地址只放在详情字段卡里，避免截图红框类原始地址噪声。
- 监控任务列表已改为展示任务范围摘要，例如“监控定价页，每周追踪关键变化。”；任务地址只放在右侧“任务地址”字段卡里，避免把原始 URL 当成列表副文案。

## 当前剩余开发计划

### 本轮校准结论

- 工作方式：所有竞品监控改动继续走“设计 MD 对齐 → 前后端责任切片 → TDD 红绿 → 页面禁用文案扫描 → 构建验证”的顺序，不做无测试的临时改法。
- 推荐架构：继续采用“后端主导业务状态，前端主导体验呈现”。这是更符合大厂项目的方案，因为权限、审计、采集、AI 成本、失败重试和分享都必须有统一后端真相。
- 当前页面原则：页面只保留用户完成任务需要的信息，像 `COMPETITOR MONITOR`、`COMPETITOR`、工程解释、内部枚举、调试词、原始 URL 证据和 worker 字段都不能作为主界面内容出现。
- 文件边界：竞品监控相关实现继续只收敛在既有 `backend/services`、`backend/routes`、`frontend/src/features/competitor-monitor`、`frontend/src/pages/competitor-monitor`、`frontend/src/services` 和本文档/接口契约里，不在根目录或无关模块新增说明文件。
- 本轮新增防线：`UI 参考` 公开 DTO 只返回标题、截图、来源竞品、可追溯来源字段和时间；前端主界面使用“来自已完成的竞品变化”这类业务说明，不直出来源变化 id，不返回网页正文、HTML、采集 raw、内部网址字段或前端传入的调试字段。

### 分工总表

| 模块 | 主接管 | 输入 | 输出 | 禁止 |
| --- | --- | --- | --- | --- |
| 竞品、任务、变化、报告、洞察 | 后端 | `projectId`、业务对象 id、用户表单字段 | 稳定业务 DTO、中文错误、审计摘要 | route 写状态机、前端本地拼状态 |
| 采集、diff、AI 分析、成本 | 后端/worker | 监控任务、快照证据、内部 adapter 结果 | 公开快照 DTO、变化 DTO、分析摘要 | 把 prompt、模型、token、payload、stack 给前端 |
| 页面和交互 | 前端 | 后端 DTO、设计 MD、权限 DTO | Tab、列表、详情、空/加载/失败态、按钮禁用 | 展示内部枚举、英文装饰眉标、工程说明 |
| 搜索筛选 | 前端 | 中文标签、用户可读摘要、竞品名称 | 可解释的筛选结果 | 搜索 `diffText`、raw enum、内部错误 |
| 权限与审计 | 后端主导，前端消费 | 当前账号、项目成员、业务动作 | `permissions`、`members`、`auditLogs` DTO | 前端自行推导角色、展示审计 raw meta |
| 验收 | 测试/开发共同 | 设计 MD、接口契约、禁用词清单 | 回归测试、构建、禁用文案扫描 | 只手动看页面、不跑测试 |

### 还没完成的计划

- P0 页面质感继续打磨：按设计 MD 强化 `竞品库 / 监控任务 / 变化记录 / 分析报告 / 洞察库 / UI 参考` 的信息层级，尤其是空态、失败态、加载态和下一步动作；首屏不放装饰眉标、长说明和流程 chip，不出现截图红框类无效字。
- P0 DTO 安全继续加固：所有公开报告、UI 参考、收藏、审计、分享页接口都要继续防止 `textContent/html/raw/sourceUrl/payload/stack/debug/worker/model/token` 进入前端展示数据。
- P1 真实采集深化：后端把真实 capture/diff/AI adapter 接稳，保留现有前端 API 不变；前端只展示检测进度、失败原因、截图和业务分析结果。
- P1 报告体验增强：前端继续优化公开分享阅读细节和长报告阅读节奏；后端继续保证版本历史、导出、分享权限和访问审计。
- P1 洞察治理增强：后端完善洞察去重、跨项目引用和知识库沉淀关系；前端继续优化批量整理后的复盘入口。
- P2 团队治理：项目成员增删改、操作日志高级筛选、AI 成本看板、采集失败统计和跨项目 UI 参考检索。

### 实用开发清单

- 开发入口：竞品监控前端只改 `frontend/src/features/competitor-monitor/`、`frontend/src/pages/competitor-monitor/` 和 `frontend/src/services/competitorMonitor.js`；后端只改 `backend/services/competitor-monitor-service.js`、`backend/services/competitor-analysis-adapter.js` 和 `backend/routes/competitors.js`。
- 后端先行：新增字段、状态、失败原因、权限、分享、导出、审计、版本历史和知识库沉淀都先更新 service DTO 与测试，再让前端消费。
- 前端后行：前端只显示 `failureType/recoverySuggestion/failureHistory/actionLabel/summary/fileName/markdown` 等安全业务字段，不读取或展示 `lastError/diffText/action/meta.results/analysisFallbackReason` 等内部字段。
- 报告接口：`GET /api/competitor-monitor/reports`、`POST /api/competitor-monitor/reports/:id/save`、分享和撤销分享都返回前端安全 DTO；`competitorId/changeId/sourceDraftId/sourceSnapshotId/sourceUrl/reportVersions/shareToken/analysisModel/analysisTokenUsage` 只留在后端内部存储或受控版本接口，不作为页面 DTO。
- UI 参考：前端只展示后端返回的 `title/typeLabel/competitorName/screenshotUrl/capturedAt` 等用户可读字段；收藏时只提交 `referenceId/referenceType/title/competitorName/summary`，`sourceSnapshotId/sourceChangeId` 只由后端用于追溯，不作为主界面文案或前端收藏入参；不展示页面原始 URL、网页正文、HTML 或采集 raw。
- UI 参考公开列表和收藏 DTO 都不得返回 `sourceChangeId/sourceSnapshotId/sourceUrl/raw/html/textContent`；后端内部可以保留来源变化和快照关系，用于收藏解析、审计和排障。
- UI 参考页面必须像设计参考库：筛选区给“筛选结果”和当前参考数量，列表卡说明“参考价值”，详情区用截图预览舞台和“设计复用提示”帮助用户判断是否收藏，不要只做普通列表详情。
- UI 参考详情缺摘要时不能只写“暂无参考说明”；必须提示用户可先查看截图、来源竞品和参考类型。
- UI 参考来源竞品缺失时不能只写“未命名竞品”；必须提示“来源竞品待补充”，避免把脏数据感暴露给用户。
- UI 参考筛选空态必须提供“查看全部参考”和“查看变化记录”这类恢复动作；筛选为空不是终点，用户要能一键回到全部素材或回到变化来源继续追踪。
- 操作记录公开 DTO 不得返回 `taskId/changeId/snapshotId/sourceChangeId/sourceSnapshotId/sourceUrl/sourceDraftId/sourceAssetId/materialId/analysisGovernance`；前端只展示 `actionLabel/summary/targetTitle/createdAt` 和安全 `meta` 摘要，证据链与 AI 治理字段由后端内部接管。
- 操作记录空态：按筛选类型写“还没有报告操作记录 / 还没有公开访问记录 / 还没有洞察操作记录 / 还没有我的操作记录”，并说明保存、分享、访问、整理或检测后会出现；不要写“暂无操作记录”或“暂无某类操作记录”。
- 分析报告：报告主界面只展示标题、摘要、章节、状态、分享和编辑动作，不直接展示 `sourceUrl`；来源说明使用“来源于竞品变化分析，可继续编辑和沉淀。”这类业务文案；导出 Markdown 使用 `来源：竞品变化分析`，不写原始 URL、变化记录 id 或快照 id。
- 分析报告：逐章节编辑的输入提示必须说明可补充“结论、证据或后续动作”，不要只写“补充内容”这类无法指导用户的泛化文案。
- 版本复盘：版本摘要缺失时不能只写“暂无摘要”；必须提示用户可打开对比查看章节变化。
- 版本复盘：章节对比缺内容时必须区分“该版本未补充这一章节”和“新版本尚未补充这一章节”，不要只写“暂无内容”。
- 公开报告页：章节缺内容时也不能只写“暂无内容”；必须告诉读者“分享人暂未补充该章节，可先阅读其他章节或联系分享人补充”这类可行动说明。
- 公开报告页：缺省章节标题写“报告章节待补充”，不要写“暂无补充章节”；公开页是给协作方看的阅读页，标题必须像报告状态，不像后台空列表。
- 分享链接：前端可以用 `shareUrl` 执行复制动作，但报告详情卡只展示“链接已生成，可复制发送给协作方。”和分享状态，不把完整分享 URL 裸露成正文内容。
- 分享状态：分享后没有访问记录时写“分享后暂无访问记录”，不要只写“暂无访问”。
- 竞品库列表：卡片只展示竞品名称和监控状态，不展示“关注：xxx”这类泛泛副文案，不展示 `websiteUrl`；官网地址只在右侧“官网地址”字段中展示。
- 官网地址字段缺失时写“官网地址待补充”，不要只写“暂无官网地址”。
- 竞品库搜索：占位文案展示“搜索竞品名称或关注点”，不要把 URL、网址或链接作为主提示；内部搜索仍可支持官网地址命中，方便用户找回对象。
- 监控任务搜索：占位文案展示“搜索竞品、监控范围或状态”，不要把任务地址、URL、网址或链接作为主提示；内部搜索仍可支持任务地址命中，方便用户找回对象。
- 监控对象详情：右侧主标题下方只展示用户填写且足够具体的关注点；`整体 / 全部 / 默认 / 无 / 暂无` 这类泛泛词直接隐藏，官网 URL 只在“官网地址”字段卡中展示，避免像截图红框那样把原始地址或无效词当成页面主说明。
- 任务列表和任务详情：列表副文案与右侧主标题下方都展示 `监控定价页，每周追踪关键变化。` 这类用户任务摘要，任务 URL 只在“任务地址”字段卡中展示，避免把原始地址、任务 id 或内部排期字段放到头部或列表主说明。
- 任务地址字段缺失时写“任务地址待补充”，不要只写“暂无任务地址”。
- 任务排期字段缺失时写“系统生成排期中”，不要只写“待排期”；排期由后端任务状态机生成，前端只展示当前状态，不提示用户手动配置内部排期。
- 前端搜索：搜索索引也属于页面展示边界，只能使用用户可读摘要和中文标签；任务、报告和洞察搜索必须走 `buildTaskSearchText / buildReportSearchText / buildInsightSearchText`，不要把 `diffText/changeType/severity/status/frequency/category/priority/tags` 等原始字段直接加入搜索文本。
- 前端标签：报告要点、报告搜索和洞察搜索里的标签必须走 `reportTagLabel` 和 `safeReportTagLabels`；已知标签转中文，未知标签统一降级为“补充标签”，映射后要去重，不要把 AI 或后端写入的未知 tag 原样展示给用户。
- 洞察依据：前端展示洞察 `evidence` 必须走 `safeInsightEvidenceItems`，只显示安全业务依据；如果证据里混入 URL、raw、内部字段或排障词，页面统一展示“已保留为安全证据，可在报告或变化记录中复盘。”
- 洞察关联需求：未关联需求时不能只写“暂无关联需求”；必须提示用户可在需求选择区选择文档并确认关联。
- 洞察关联需求：需求文档名称缺失时写“需求文档名称待补充”；没有可关联需求时写“当前项目还没有可关联的需求文档，先补充需求资料后再回来关联洞察”，不要写“未命名需求文档”或“当前项目暂无可关联的需求文档”。
- 分享链接：复制动作失败时必须说明“分享链接还没有生成，先生成分享链接后再复制”，不要只写“暂无可复制的分享链接”。
- 洞察导出和知识沉淀：后端导出 Markdown、批量沉淀知识库资料时也必须过滤 `evidence`；如果证据里混入 URL、`sourceChangeId`、`raw`、`payload`、`worker`、`debug`、模型或 token 字段，统一降级为“已保留为安全证据，可在报告或变化记录中复盘。”
- 页面文案：页面只讲用户任务，例如“添加竞品、开始监控、沉淀报告、失败原因、建议处理”；不要出现英文装饰眉标、工程解释、接口名、worker 名、prompt、payload、stack、debug、token、模型名。
- 概览工作台：概览页必须给“趋势摘要”“今日建议”和“优先处理”入口，优先引导用户查看高优先级变化、沉淀报告、整理洞察或添加竞品；不要让用户从静态数字卡里猜下一步。
- 概览变化列表：变化来源和检测时间必须走用户化 helper；缺来源时写“来源竞品待补充”，缺检测时间时写“等待检测时间回写”，不要拼“未命名竞品 · 暂无时间”。
- 概览空 lane：高优先级变化、待沉淀报告和待整理洞察为空时必须解释当前状态和下一步，例如“当前没有需要优先处理的高风险变化”“先完成一次竞品检测”“从变化详情保存值得跟进的发现”，不要只写“暂无”。
- 详情页动作：右侧详情区不能把所有按钮平铺成同权操作；报告、洞察和 UI 参考必须有“主要动作 / 下一步建议 / 参考动作”这类业务行动面板，次级操作放到“更多处理 / 整理与沉淀”分组里；报告动作区必须先说明“先确认报告结论，再生成协作版本”，再展示保存、分享、导出和版本复盘。
- 失败态：列表、详情、分享页、导出页都必须给恢复动作，例如“重新加载”“重新尝试”“联系分享人”“去添加竞品”“稍后重试或确认网址”。
- 空态：`监控任务 / 变化记录 / 分析报告 / 洞察库 / UI 参考` 的列表区和右侧详情区都不能只写“暂无”；必须给用户下一步动作，例如“去添加竞品”“新建监控任务”“去竞品库”“查看监控任务”“查看变化记录”“查看分析报告”“查看洞察库”，把用户带回最小闭环。
- 详情空态：右侧详情区标题必须说清“还没有可查看/可复用/已沉淀的对象”，正文必须解释后续会展示什么，例如监控节奏、报告章节、洞察沉淀动作、UI 截图线索或监控状态；不要用“暂无监控任务 / 暂无分析报告 / 暂无洞察 / 暂无 UI 参考 / 暂无监控对象”当标题。
- 版本历史：没有报告版本时必须提示“先保存正式报告后再回来复盘”，不要只写“暂无版本历史”；版本复盘是报告治理流程的一部分，不是普通空列表。
- 筛选空态：搜索或筛选没有结果时不能只写“没有匹配的对象”；必须说明“没有找到匹配项”，并给出调整关键词、查看全部、回到竞品库、查看监控任务或回到变化记录等恢复方向。
- 变化详情空态：没有选中变化时，右侧详情标题写“变化记录待选择 / 先选择变化记录”，时间位置写“选择记录后显示检测时间”；不能只提示“等待选择变化记录”“选择一条变化记录”或“等待检测”；同时必须提供“查看监控任务”和“去竞品库”入口，引导用户回到检测来源或补充竞品。
- 变化详情证据与分析兜底：截图缺失必须提示“截图待回传”和检测完成后的证据位置；事实观察、AI 解读和设计建议缺失时必须说明会在检测/分析完成后补齐，不能只写“暂无截图”或“当前暂无”。
- 测试节奏：每个切片先写 `tests/competitor-analysis-ui.test.mjs`、`tests/competitor-analysis-engine.test.mjs` 或 `tests/competitor-default-sync.test.mjs` 中对应的回归，确认失败，再实现最小代码，最后跑竞品相关测试、前端构建和禁用文案扫描。
- 交接物：接口字段变化先同步 `docs/design/competitor-monitor-api-contract.md`，执行计划和禁用事项只追加到本文档，不在根目录新建零散说明。

### 开发执行顺序

1. 先做后端契约：后端补 DTO、权限、审计、幂等和错误码，接口契约同步到 `docs/design/competitor-monitor-api-contract.md`。
2. 再做前端页面：前端只按 DTO 渲染 `竞品库 / 监控任务 / 变化记录 / 分析报告 / 洞察库 / UI 参考`，不在页面写工程解释。
3. 每个切片先写 `tests/competitor-analysis-ui.test.mjs`、`tests/competitor-analysis-engine.test.mjs` 或 `tests/competitor-default-sync.test.mjs` 中对应的回归，再实现最小代码，最后跑竞品相关测试、前端构建和禁用文案扫描。
4. 页面验收时重点看“截图红框类内容”：英文装饰眉标、内部枚举、接口名、worker/debug、模型/token/payload/stack 等技术词不能作为主界面文案出现。
5. 另一个进程整理整体架构时，本功能只在既有竞品监控目录内开发，不新建跨模块散落文件。

### 前后端接管顺序

- 后端先接管：竞品、任务、变化、报告、洞察、UI 参考收藏、权限、审计、分享、导出、AI 成本和失败追踪的数据真相。
- 前端后接管：Tab 信息架构、列表/详情、搜索筛选、表单校验、空态/加载/失败态、按钮禁用、中文展示映射和视觉合理性。
- 后端给前端：稳定业务 DTO、中文权限说明、可展示错误 message、审计摘要、导出文件名和公开分享状态。
- 前端给后端：`projectId`、业务对象 id、用户输入字段、筛选条件和用户选择项；不传 worker 配置、不传 AI prompt、不传内部状态机字段。
- 推荐方案：后端主导业务状态，前端主导体验呈现。这比“前端本地拼逻辑、后端只存数据”更符合大厂项目的治理要求，后续接真实采集、权限审计、成本治理和团队协作时风险更低。

### P0：先守住页面质量和架构边界

- 前端：继续把竞品监控业务 UI 放在 `frontend/src/features/competitor-monitor/`，页面入口只留在 `frontend/src/pages/competitor-monitor/`。
- 前端：所有页面文案必须面向用户任务，不展示英文装饰眉标、内部枚举、开发说明、接口名或 worker 状态；后端导出的 Markdown 也按用户界面处理，同样禁止 raw enum 和技术成本字段。
- 前端：列表、Tab、按钮、搜索、输入、文本域继续使用 `frontend/src/components/base/`，不要临时写原生按钮样式。
- 前端：右侧详情空态和筛选空态的动作按钮也必须使用基础组件，例如 `BaseButton`；不要为了补空态临时写原生 `<button>` 和孤立样式。
- 前端：变化详情只展示事实观察、AI 解读和设计建议；不要展示“分析方式、处理耗时、用量已记录”、模型名、token、prompt、payload、stack、worker、debug 或调试字样。
- 后端：继续让 `backend/services/competitor-monitor-service.js` 接管状态机、DTO 聚合、幂等和校验。
- 测试：每次改竞品监控都跑禁用文案扫描，防止截图红框那类内容反弹。

### P1：最值得马上继续做的功能切片

- UI 参考持久化：已把本地收藏升级为项目级收藏，后端负责幂等保存、取消收藏、跨端状态真相和操作审计。
- 洞察批量沉淀：已把已选择洞察批量沉淀到知识库，后端负责幂等、去重和知识资料回写。
- 报告分享权限：已在现有分享链接基础上补充访问控制、过期时间、下载权限、撤销分享、外部访问页、公开读取校验、访问统计和访问审计。
- 操作审计：已记录添加竞品、手动检测、监控任务设置、保存报告、生成分享链接、公开报告访问和撤销分享等关键动作，并支持导出审计记录。
- 报告审计：已记录保存正式报告、导出正式报告、生成分享链接、公开报告访问和撤销分享；导出 Markdown 仍只返回用户可读文件名和正文，不暴露审计 meta。
- 洞察审计：已记录保存洞察、更新洞察、批量整理、导出、批量导出、关联需求、沉淀知识库和批量沉淀等动作。
- UI 参考审计：已记录收藏 UI 参考和取消收藏 UI 参考。
- 权限最小闭环：已由后端输出项目权限 DTO 和协作成员权限列表，并对创建、检测、保存、导出、分享、撤销和洞察管理动作做服务端校验。

### P2：大厂项目后续治理项

- 项目成员权限：已补齐只读协作成员权限入口；后续再接项目设置里的成员增删改。
- 操作审计：已支持筛选和导出审计，监控任务审计已覆盖暂停/恢复、频率和通知设置，报告审计已覆盖保存、导出、分享、公开访问和撤销；后端继续扩展更多批量治理动作。
- AI 成本追踪：已覆盖变化 AI 分析，后端写入 `analysisProvider / analysisModel / analysisDurationMs / analysisTokenUsage / analysisFallbackUsed / analysisFallbackReason`；保存正式报告和保存洞察时，后端内部审计只沉淀安全摘要 `analysisGovernance`，公开审计 DTO、前端主界面和导出任务继续禁止暴露分析耗时、用量记录、模型、provider、prompt、payload、stack、worker、debug 或 token 细项。
- 采集失败追踪：后端已区分网络失败、登录授权、页面阻断、响应超时、分析失败和未知失败，并把恢复建议写入任务、运行摘要、重试摘要、变化记录和操作审计；前端展示中文建议，不展示内部错误枚举。
- 重试治理：后端已按连续失败次数计算 `retrySummary`，检测成功后清空；前端不计算退避策略，只可展示中文恢复建议和必要的重试入口。
- 调度治理：后端已有 `runDueMonitorTasks` 调度入口，并已接入 `POST /api/competitor-monitor/scheduler/run-due` 路由和本地 mock API；该入口只消费到期的失败任务、写入 `monitor-scheduler-ran` 安全审计摘要并返回安全执行摘要；前端不直接接管批量调度，也不展示 worker、payload、stack、debug 或退避策略细节。

## 推荐下一步

推荐下一步做“真实采集和 AI 成本治理深化”，原因：

- 权限、成员只读列表、关键操作审计、导出和分享已形成基础闭环，下一步最影响真实可用性的是“检测结果是否来自真实采集和真实分析”。
- 后端应先把采集、diff、AI worker 作为下游适配器接入，并继续输出稳定 DTO；前端只展示检测进度、失败原因、恢复建议和分析结果。
- AI 成本治理应由后端记录模型、耗时、用量、fallback 和失败原因；前端只展示业务化摘要，避免让用户看到模型名、token 或调试细节。
- 这条路线最符合大厂做法：先把安全、审计、状态机和 DTO 立住，再接真实生产链路，最后做跨项目复用和高级检索。

## 当前前后端交接方式

- 前端创建/点击动作时只传 `projectId`、业务对象 id 和用户编辑字段。
- 后端返回完整 DTO，前端不二次推导任务状态、报告结论、洞察标题或知识内容。
- 后端返回的 `snapshot` 是公开展示 DTO，前端只能用于截图预览、来源 URL 和采集时间展示；不得读取网页正文、HTML、raw 采集结构或 worker 原始结果。
- 洞察沉淀知识库时，后端返回 `material` 或 `materials`，前端只负责切到知识库并打开对应资料。
- 洞察关联需求文档时，前端提交用户选择的需求资料 id；后端写入 `requirementMaterialIds` 和需求材料 `relations`，前端只展示返回结果。
- UI 参考收藏时，前端只提交 `referenceId/referenceType/title/competitorName/summary`；后端按 `projectId + referenceId` 从 UI 参考聚合结果中解析来源变化并保存为 `type="ui-reference-favorite"` 的项目资料关系，前端只展示 `收藏/已收藏`，不直出或传递 `sourceChangeId`。
- 报告分享时，前端提交 `projectId/reportId/expiresInDays/allowDownload`；后端写入 `shareEnabled/shareToken/shareUrl/shareAllowDownload/sharedAt/shareExpiresAt/shareRevokedAt/shareAccessCount/lastSharedAccessAt`，公开读取时只接受合法 token，并由后端递增访问统计和写入 `report-shared-accessed` 审计；外部访问页只调用公开接口，公开下载必须由后端再次校验 `shareAllowDownload`。
- 权限控制时，前端先读取 `GET /api/competitor-monitor/permissions`，只根据返回 DTO 禁用按钮并展示权限说明；后端仍对写动作做最终校验。
- 页面展示所有状态、类型、优先级必须通过 `frontend/src/services/competitorMonitor.js` 转中文。
- 页面搜索所有状态、类型、优先级、频率和标签也必须通过 `frontend/src/services/competitorMonitor.js` 转中文，避免用户通过搜索命中 `ready/high/weekly/strategy/homepage-copy` 这类内部枚举。
- 页面标签遇到未知值时不要猜业务含义，也不要原样直出；统一用“补充标签”兜底并去重，后续需要新标签时先补充映射和测试。
- 页面优先级和洞察分类遇到未知值时也不要默认成“中优先级 / 产品机会”这类强语义词；统一用“待确认优先级 / 待确认分类”兜底，避免误导用户。
- 页面首屏简介和空态文案要短，直接讲用户接下来能做什么，不写“后端统一编排”“前端只消费”之类架构解释。
- 页面时间、名称和摘要兜底必须按场景命名 helper 输出，例如操作记录用“操作时间待回写”、失败历史用“失败时间待回写”、报告版本用“保存时间待回写”、竞品名称用“竞品名称待补充”；不要在模板里散写“暂无时间”或“未命名竞品”。
- 竞品库列表、任务详情和下拉选项里的竞品名称必须统一走 `competitorOptionLabel`；名称缺失写“竞品名称待补充”，不要让卡片标题空白。
- 监控对象详情头部缺名称时写“监控对象待添加”，不要写“还没有竞品”；详情头部要像业务对象状态，不像临时占位符。
- 监控对象关注点：列表不展示“关注：xxx”；详情只展示足够具体的关注点，`整体 / 全部 / 默认 / 无 / 暂无` 必须隐藏，避免把数据录入噪音放到主界面。
- 报告和洞察标题必须走展示 helper；标题缺失时分别写“报告标题待补充”“洞察标题待补充”，不要让列表卡片或详情头部空白。
- UI 参考标题和摘要必须走展示 helper；标题缺失写“UI 参考标题待补充”，摘要缺失继续提示“当前参考暂未补充说明，可先查看截图、来源竞品和参考类型。”，不要让参考卡片空白。
- 洞察关联需求缺失时写“需求待关联，可在上方选择需求文档后确认关联。”，不要写“尚未关联需求”或“暂无关联需求”；这是下一步任务提示，不是空字段占位。
- 后端导出的洞察 Markdown、批量洞察 Markdown 和沉淀到知识库的资料标签必须和前端展示 helper 保持同一口径；未知分类用“待确认分类”，未知优先级用“待确认优先级”，未知 tag 用去重后的“补充标签”，不要在导出或知识资料里原样写 `unknown-category / critical / worker-debug / provider-timeout`。

## 本轮执行计划与分工

1. 前端先接管页面质量：确认 legacy 应用入口只挂载 `CompetitorMonitorPage`，业务页面只来自 `frontend/src/features/competitor-monitor/`；首屏只保留模块标题和业务操作按钮，不放装饰眉标、长说明、“添加竞品 / 监控变化 / 沉淀报告”流程 chip 或截图红框类无效字。
2. 前端继续接管交互状态：空态给下一步动作，加载态说明正在整理哪些业务数据，检测成功提示写“检测完成，变化记录已更新”，不要写“写入后端记录”这类实现表达。
3. 后端继续接管业务真相：本轮不改变状态机；后续真实采集、diff、AI 成本、权限、审计和导出仍由 `backend/services/competitor-monitor-service.js` 输出稳定 DTO。
4. 测试接管回归防线：竞品相关测试要同时检查新版 feature 页面、页面入口和兼容 wrapper，防止旧组件、旧文案或内部字段重新出现在用户可见页面。
5. 后端新增报告 DTO 安全层：`listReports/saveReport/shareReport/revokeReportShare/getSharedReport` 返回给前端的报告对象只保留标题、摘要、章节、状态、中文标签和分享展示状态；`changeId/sourceDraftId/sourceSnapshotId/sourceUrl/reportVersions/shareToken/analysisModel/analysisTokenUsage` 等证据、版本和 AI 成本字段只留在后端内部存储、导出和版本接口中。
6. 契约文档同步安全 DTO：`docs/design/competitor-monitor-api-contract.md` 的报告列表和保存报告示例不得再写证据字段，防止前端按旧字段继续做页面展示。
7. 概览页补齐行动导向：前端在 `概览` 中增加“今日建议”和“优先处理”队列，直接跳转到变化、报告、洞察或竞品库；后端 DTO 不变，仍由现有变化、报告、洞察列表驱动。
8. 报告导出安全层：后端对报告标题、摘要、建议和章节内容统一执行用户可见内容清洗；如果混入 `sourceUrl/sourceChangeId/sourceSnapshotId/change-record/raw/html/textContent/analysisModel/analysisTokenUsage/payload/worker/debug/token` 等内部字段，页面 DTO、项目内导出 Markdown、公开分享页和公开下载统一降级为“已保留为安全报告内容，可在后台证据链路中复盘。”

推荐接管顺序：后端先定 DTO 与状态真相，前端随后按 DTO 做页面和交互，测试最后用源码扫描和业务流测试兜底。这比前端先本地拼逻辑更符合大厂协作，因为权限、审计、采集失败、AI 成本和分享下载都需要后端统一治理。

## 禁止事项

- 不要在 `frontend/src/components/competitor-monitor/` 继续写新业务逻辑；该目录只保留兼容 wrapper。
- 不要在前端组件里拼接采集服务或 AI 服务返回的原始结构。
- 不要在 route 里写业务状态机；route 只转交 handler。
- 不要在页面直出 `content-update`、`monitor-failed`、`active`、`paused` 等枚举。
- 不要展示 `COMPETITOR`、`Competitor Monitor`、`Change Detail`、`Report Draft` 或“后端统一编排监控闭环”。
- 不要把设计说明、接口契约或开发清单散落到根目录。

## 下一阶段排期

1. 分析报告增强：公开访问页长报告阅读细节和协作复盘入口。
2. 洞察增强：跨项目引用、洞察去重规则和批量整理后的复盘入口。
3. UI 参考：设计检索、组件参考详情深化和跨项目引用。
4. 权限与审计：项目成员权限、操作日志、AI 成本和采集失败追踪。

## 验收命令

```bash
node --test tests/competitor-default-sync.test.mjs tests/competitor-analysis-engine.test.mjs tests/competitor-analysis-ui.test.mjs
npm --prefix frontend run build
rg -n "Competitor Monitor|COMPETITOR|Change Detail|Report Draft|后端统一编排监控闭环|content-update|monitor-failed|默认监控|默认监控任务" frontend/src/features/competitor-monitor frontend/src/pages/competitor-monitor frontend/src/components/competitor-monitor -S
node - <<'NODE'
const { spawnSync } = require('node:child_process')
const banned = ['产品' + '/UX', ['产品', 'UX', 'UI'].join('、')]
const result = spawnSync('rg', ['-n', banned.join('|'), 'docs/design/competitor-monitor-api-contract.md', 'docs/design/competitor-monitor-development-checklist.md', '-S'], { encoding: 'utf8' })
process.stdout.write(result.stdout)
process.stderr.write(result.stderr)
process.exit(result.status === 1 ? 0 : result.status || 0)
NODE
```

`rg` 命令没有输出且退出码为 1 表示没有命中禁用文案，是符合预期的结果。
