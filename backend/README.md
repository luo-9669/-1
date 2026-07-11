# 流程通后端开发说明

## 目录职责

后端代码统一放在 `backend/` 目录，前端代码统一放在 `frontend/` 目录。

- `routes/`：HTTP API 路由，只处理请求参数、响应格式和错误状态。
- `services/`：业务服务，例如文档解析、工作流生成、资产保存、竞品分析。
- `models/`：数据结构、字段规范、状态枚举。
- `storage/`：后端本地运行数据，默认位于 `backend/storage/`。
- `tests/`：后端接口和服务测试。
- `fixtures/`：测试样例文件、请求样例、竞品公开资料样例。

## 前后端边界

前端负责：

- 页面布局和交互状态。
- AI 分步工作台展示。
- 上传入口、按钮、提示、错误恢复。
- 调用后端 API 并展示结果。
- 保存到前端状态或转交资产库视图。

后端负责：

- 文件上传解析。
- URL/网页资料抓取与清洗。
- 网页工厂采集质量门禁、HTML 生成响应和视觉校验结果聚合。
- 工作流步骤草稿生成。
- 候选方案、版本记录、重新生成。
- 项目资产持久化。
- 竞品公开资料分析。
- 统一错误原因和恢复建议。

后台管理台负责：

- 内部数据查看、诊断和安全操作，不替代用户前台。
- Workspace 概览、资料筛选删除、还原页面预览/源码入口。
- Skill 管理、系统配置、系统诊断、API 调试、工作区导出和前后端职责说明。
- 危险操作必须调用后端 API，并在界面二次确认。

推荐访问入口：

```text
前台产品工作台：http://localhost:5588
后台管理台：http://localhost:5599/admin
后端 API：http://localhost:5599/api/*
```

本地启动命令：

```bash
npm run api:restart  # 释放 5599 后启动后端和后台管理台
npm run dev          # 启动 5588 前台
npm run dev:all      # 同时启动后端后台和前台
```

`/api/*` 必须保持 JSON 契约；`/admin` 才返回后台 HTML 页面。

## 推荐 API

```text
POST /api/uploads/documents
POST /api/workflows/runs
POST /api/workflows/runs/:runId/steps/:stepId/generate
POST /api/workflows/runs/:runId/steps/:stepId/regenerate
POST /api/workflows/runs/:runId/steps/:stepId/accept
POST /api/workspace/workflow-runs/:id/messages
POST /api/workflows/runs/:runId/complete
GET  /api/workspace/materials?projectId=&type=
POST /api/workspace/materials
POST /api/workspace/materials/import-website
POST /api/workspace/materials/import-blueprint
POST /api/workspace/materials/import-documents
POST /api/workspace/materials/search
POST /api/workspace/materials/governance
POST /api/workspace/materials/export-role-package
PATCH /api/workspace/materials/:id
DELETE /api/workspace/materials/:id
POST /api/workspace/restored-pages
GET  /api/workspace/restored-pages/:id
GET  /api/workspace/restored-pages/:id/preview
GET  /api/workspace/restored-pages/:id/source
GET  /api/workspace/model-settings
PUT  /api/workspace/model-settings
GET  /api/workspace/skill-orchestration-settings
PUT  /api/workspace/skill-orchestration-settings
POST /api/browser-sessions/create
POST /api/browser-sessions/preview
POST /api/browser-sessions/action
POST /api/browser-sessions/close
POST /api/capture/start
POST /api/capture/generate-page
GET  /api/capture/tasks/latest/result
GET  /api/competitor-monitor/overview
GET  /api/competitor-monitor/permissions
GET  /api/competitor-monitor/reports
POST /api/competitor-monitor/reports/:id/share
POST /api/competitor-monitor/reports/:id/share/revoke
GET  /api/competitor-monitor/reports/:id/shared
GET  /api/competitor-monitor/audit-logs
GET  /api/competitor-monitor/insights
POST /api/competitor-monitor/insights/batch-deposit-knowledge
GET  /api/competitors
POST /api/competitors
GET  /api/competitors/:id
GET  /api/monitor-tasks
POST /api/monitor-tasks
PATCH /api/monitor-tasks/:id
POST /api/competitors/:id/check
GET  /api/changes
GET  /api/changes/:id
POST /api/changes/:id/save-as-insight
GET  /api/assets
POST /api/assets
GET  /api/admin/summary
GET  /api/admin/export
GET  /api/admin/records/:collection
POST /api/admin/records/:collection
PATCH /api/admin/records/:collection/:id
DELETE /api/admin/records/:collection/:id
POST /api/admin/records/:collection/batch-delete
```

后台管理接口说明：

- `GET /api/admin/summary`：返回后台概览、健康状态、前后端职责、推荐接口和最近数据。
- `GET /api/admin/export`：导出当前 workspace 快照，供备份或排查使用。
- `GET /api/admin/records/:collection`：读取后台模块列表，当前支持 `projects`、`materials`、`parseJobs`、`assets`、`restoredPages`、`workflowRuns`、`skillRuns`、`skills`、`settings`。
- `POST /api/admin/records/:collection`：新增后台记录。
- `PATCH /api/admin/records/:collection/:id`：编辑后台记录。
- `DELETE /api/admin/records/:collection/:id`：删除单条后台记录。
- `POST /api/admin/records/:collection/batch-delete`：批量删除记录，入参为 `{ "ids": [] }`，用于后台表格框选删除。

资料库接口说明：

- `GET /api/workspace/materials?projectId=&type=`：按项目和资料类型返回资料列表，前端切换知识库、需求文档、竞品监控 tab 时使用。
- `POST /api/workspace/materials`：创建资料。
- `POST /api/workspace/materials/import-website`：由后端抓取或接收 HTML，解析标题、描述、目录、正文分块、CTA、价格/功能信号、来源证据，并以 `type: "knowledge"` 原子写入资料库。前端只负责提交 URL 和展示返回的已落库资料。
- `POST /api/workspace/materials/import-blueprint`：把项目蓝图拆成产品事实、页面结构、交互流程、验收标准等知识条目，后端创建 `sourceType: "blueprint"` 的解析任务并原子落库。
- `POST /api/workspace/materials/import-documents`：把上传文档文本写入需求/竞品/知识资料，后端记录成功数、失败文档和 `sourceType: "document"` 解析任务。
- 三类导入都按项目、规范化来源和知识分类生成稳定资料 ID，重复导入同一来源会幂等更新旧资料，不制造重复知识。
- `POST /api/workspace/materials/search`：按项目、资料类型、角色范围和 query 召回知识片段，返回 `materialId`、`chunk`、`score`、`evidence`、`verification`。前端召回测试和后续 Agent 上下文注入都走这个接口。
- `POST /api/workspace/materials/governance`：批量治理知识资料，支持设置 Owner、可信状态和审核原因，用于后台验证、归档前审核和知识库质检。
- `POST /api/workspace/materials/export-role-package`：按角色导出知识包，返回 Markdown 与 JSON。产品、UX、开发交付包应从该接口生成，避免前端拼接资料。
- `prototype-demo` 资产：后端以 URL 浏览器采集为主流程，逐页保存截图并生成 `screens[]`、`screens[].hotspots[]`、`transitions[]`。每个 hotspot 使用百分比坐标 `rect: { x, y, width, height }` 和 `targetScreenId` 串联到目标页面，前端知识库只读取这些字段做墨刀/蓝湖式播放和评审。读取前端代码属于补充导入源，可用于反推页面结构，但不替代后端截图资产作为项目原型事实源。
- `PATCH /api/workspace/materials/:id`：编辑资料，后端保留原 `id`、`createdAt` 和项目归属。
- `DELETE /api/workspace/materials/:id`：删除资料，返回 `{ id, deleted }`。

模型与 Skill 编排接口说明：

- `GET /api/workspace/model-settings`：读取后端模型配置的脱敏视图，返回 `provider/baseUrl/defaultModel/apiSurface/timeoutMs/fallback/enabled/hasApiKey/apiKeyMasked`，不会返回明文 key。
- `PUT /api/workspace/model-settings`：保存后端模型配置。`apiKey: "__KEEP__"` 表示沿用后端已保存 key；前端不得把 key 写入 `state.apiConfig`。
- `GET /api/workspace/skill-orchestration-settings`：读取后端 Skill 编排策略，前端用于设置页展示。
- `PUT /api/workspace/skill-orchestration-settings`：保存 Skill 编排策略，入参示例为 `{ "enabled": true, "skillOverrides": { "auth-page-generation": { "promptTemplate": "...", "outputSchema": "auth-page", "qualityChecks": ["api-contract"], "fallbackSkillId": "demand-four-step" } } }`。
- `skillOverrides` 由后端在分析链路合并到系统 Skill，影响 promptTemplate、输出 schema、qualityChecks 和 fallbackSkillId；前端技能中心负责编辑草稿，后端编排负责运行时生效。

知识库资料字段约定：

- `sourceType/sourceUrl/sourceAssetId`：原始来源，支持网站、文件、蓝图、截图包、代码或手动资料。
- `content/parsed/chunks`：可读正文、结构化解析结果和 AI 检索分段。`chunks` 是后续召回、引用和上下文注入的最小单位。
- `entities`：结构化事实，例如功能点、价格、FAQ、页面结构、业务规则。
- `relations`：知识关系，例如 `source-page`、`page-link`、`cta-link`，后续可扩展到需求、页面、组件、接口、数据模型。
- `roleScopes`：资料适用角色，当前支持 `product`、`ux`、`development`、`ai-retrieval`。
- `owner/verification/expiresAt/tags`：治理字段。自动解析默认 `verification.status = "unverified"`，正式交付前应由项目 Owner 验证。
- `evidence`：来源证据，必须保留 URL、标题、采集时间或原文片段，避免 AI 或人工决策无来源。

角色消费约定：

- 产品视图读取 `positioning`、目标用户、痛点、功能点、价格、竞品事实、指标、待确认问题。
- UX 视图读取用户场景、页面结构、CTA、信息架构、流程节点、文案和视觉参考。
- 开发视图读取业务规则、接口线索、组件/页面关系、数据字段、边界场景和验收标准。
- AI 检索读取 `chunks`、`entities`、`relations`、`evidence`，回答时必须能回溯到来源资料。
- Agent 上下文注入读取后端召回结果 `retrievedKnowledge`，提示词中必须标注片段内容、证据来源和可信状态。

网页工厂还原资产接口说明：

- `POST /api/workspace/restored-pages`：保存正式还原页面资产。
- `GET /api/workspace/restored-pages/:id`：读取还原页面详情。
- `GET /api/workspace/restored-pages/:id/preview`：读取静态 HTML 预览数据。
- `GET /api/workspace/restored-pages/:id/source`：读取源码文件列表，供查看源码和下载使用。

网页工厂采集接口说明：

- `POST /api/browser-sessions/create`：创建项目内授权浏览器会话。
- `POST /api/browser-sessions/preview`：读取授权浏览器当前截图和 URL。
- `POST /api/browser-sessions/action`：执行授权浏览器导航、点击、输入、滚动、前进后退。
- `POST /api/browser-sessions/close`：关闭授权浏览器会话。
- `POST /api/capture/start`：启动网页采集，返回 SingleFile、DOMSnapshot、截图和节点摘要。
- `POST /api/capture/generate-page`：基于采集结果生成 HTML，并执行质量门禁和视觉校验。
- `GET /api/capture/tasks/latest/result`：读取最近一次采集结果示例。

网页工厂后端分工：

- `routes/capture.js`：只暴露 HTTP 路由，所有能力通过 handlers 注入。
- `services/capture-url-analyzer.js`：规范化 URL，判断页面类型和鉴权倾向。
- `services/capture-template-matcher.js`：基于 URL 特征与 authMode 选择规则模板。
- `services/capture-compiler.js`：将 URL、模板与默认策略编译成标准采集任务。
- `services/capture-dispatcher.js`：在执行前串联 analyzer、matcher、compiler、diagnostics，并把任务交给 `capture-runner`。
- `services/capture-diagnostics.js`：输出稳定的诊断码和恢复动作，供前端直接展示。
- `services/capture-runner.js`：接管 `capture/start` 的采集编排结果组装，包括授权模式归一化、真实采集/兜底采集调用、耗时与预计时间、SingleFile/DOMSnapshot 元数据、summary、raw 诊断信息。
- `services/capture-service.js`：接管 `generate-page` 的业务规则，包括 readiness 检查、quality gate、阻断响应、正式 HTML 响应和 `visualVerification` 聚合。
- `server/mock-api.mjs`：当前仍负责本地采集执行器、SingleFile/DOMSnapshot/Playwright 渲染能力，把 analyzer/matcher/compiler/diagnostics 与 `capture-runner` 组装成 relay dispatcher 注入 `capture/start`，并把 `generatedPageHtml`、`verifyGeneratedPage` 注入给 `capture-service`。该入口位于 `backend/server/mock-api.mjs`，后续接真实 Node 服务时迁移这些执行器，不改前端契约。

竞品监控 Phase 1 接口说明：

- `GET /api/competitor-monitor/overview`：返回项目级竞品监控概览卡片指标，前端只做展示，不拼接底层采集结果。
- `GET /api/competitor-monitor/permissions`：返回当前账号在项目内的竞品监控操作权限；后端负责判断，前端只按 DTO 禁用按钮。
- `GET /api/competitor-monitor/reports`：基于已保存的变化记录、快照和 AI 分析聚合报告草稿，前端只展示草稿和章节，不本地生成报告结论。
- `POST /api/competitor-monitor/reports/:id/share`：为正式报告生成分享链接，支持 `expiresInDays`；后端负责 token、有效期和分享状态。
- `POST /api/competitor-monitor/reports/:id/share/revoke`：撤销正式报告分享；后端写入撤销时间并关闭公开访问。
- `GET /api/competitor-monitor/reports/:id/shared`：按分享 token 读取公开报告；后端校验启用、撤销和过期状态。
- `GET /api/competitor-monitor/audit-logs`：读取项目级操作记录；后端记录添加竞品、检测、保存报告、分享和撤销分享等关键动作，前端只展示。
- `GET /api/competitor-monitor/insights`：返回项目下已保存的竞品洞察，后端负责持久化、排序和项目过滤，前端只展示洞察列表与详情。
- `GET /api/competitors`：返回项目下竞品列表，供竞品库和项目摘要同步使用。
- `POST /api/competitors`：创建竞品，并由后端自动创建默认 `monitor_task`。入参必须包含 `projectId`、`name` 和 http/https `websiteUrl`；校验失败统一返回 `COMPETITOR_INPUT_INVALID`，message 可直接给前端展示。
- `GET /api/competitors/:id`：读取单个竞品详情。
- `GET /api/monitor-tasks`：按 `projectId` 和可选 `competitorId` 返回监控任务列表，前端用它展示监控状态、最近检测、监控频率、下次执行和失败原因。
- `POST /api/monitor-tasks`：新建一个明确的页面监控任务；后端校验项目归属、http/https URL、频率和权限，计算 `nextRunAt` 并写入 `monitor-task-created` 审计。
- `PATCH /api/monitor-tasks/:id`：暂停或恢复监控任务，只允许 `status: "paused"` 或 `status: "active"`。后端负责清空或计算 `nextRunAt`；非法状态返回 `COMPETITOR_TASK_STATUS_INVALID`。
- `POST /api/competitors/:id/check`：触发一次后端主导的手动检测，统一写入快照、变化记录和 AI 分析。
- `GET /api/changes`：按项目或竞品筛选变化记录列表。
- `GET /api/changes/:id`：返回变化详情、最新快照和 AI 分析结果。
- `POST /api/changes/:id/save-as-insight`：把变化记录保存为 `competitor_insight`，由后端根据变化记录和 AI 分析生成标题、摘要、依据、建议和优先级。
- `monitor_task.status` 当前支持 `active`、`paused`、`running`、`succeeded`、`failed`。恢复监控时由后端计算 `nextRunAt`；检测成功时 `lastError` 必须清空；检测失败时 `lastError` 必须写入可读失败原因。
- 检测失败必须创建 `change_record`，其中 `changeType: "monitor-failed"`、`status: "failed"`，前端展示为“检测失败”，不得直接展示原始枚举。
- `frontend/src/pages/competitor-monitor/` 是页面入口，`frontend/src/features/competitor-monitor/` 是功能实现目录；旧的 `frontend/src/components/competitor-monitor/` 只保留兼容 wrapper，不继续承载新业务逻辑。
- 前端只消费上述业务 DTO；截图采集、差异识别、AI 解读、任务状态转换都由后端服务编排。`监控任务` Tab 只展示 `monitor_task` DTO 并调用 PATCH 接口，不在前端伪造排期或任务状态。页面文案必须面向用户任务，不展示 `COMPETITOR MONITOR`、`COMPETITOR`、`Change Detail` 或“后端统一编排监控闭环”等无效/工程说明文案。
- 完整接口契约、DTO 字段、页面文案规则和前后端接管边界见 `docs/design/competitor-monitor-api-contract.md`。
- Phase 1 的 service 支持可替换 capture/AI adapters。本地后端入口 `backend/server/mock-api.mjs` 已把 `captureRunner.makeCaptureResult` 注入竞品监控，用真实采集/兜底采集结果生成 `page_snapshot`；也已通过 `createCompetitorAnalysisAdapter` 接入 workflow agent provider 生成结构化 `ai_analysis`。deterministic adapter 仅用于 service 测试、模型失败 fallback 或显式注入。后续替换真实 AI worker 时只改 service adapter，不改前端产品契约。

## Workflow Agent Provider

右侧 Agent 的按钮和输入框统一走后端 Agent 消息接口。前端只负责交互、草稿态、请求取消标记和画布刷新 loading；后端负责 action 分类、上下文构建、Provider 调用、消息持久化、重试/编辑元信息、取消状态和错误恢复。

Agent 消息接口：

- `POST /api/workspace/workflow-runs/:id/messages`：非流式发送消息，返回完整 `run` 和 `assistantMessage`。
- `POST /api/workspace/workflow-runs/:id/messages/stream`：SSE 流式发送消息，事件包含 `status`、`delta`、`message`、`done`、`error`。成功时 `message` 事件携带 `assistantMessage`；取消时不发送空 `assistantMessage`，只在 `done` 中返回 `cancelled: true`。
- `POST /api/workspace/workflow-runs/:id/messages/cancel`：按 `stepId + clientMessageId` 取消当前生成；Provider 支持中断时会 abort 请求，不支持时后端记录取消，前端丢弃迟到回复。

前端发送字段：

```json
{
  "stepId": "framework",
  "model": "gpt-5.5",
  "clientMessageId": "client-uuid",
  "retryOfMessageId": "assistant-message-id",
  "editOfMessageId": "user-message-id",
  "action": "send | retry | edit-resend | confirm-canvas",
  "message": { "role": "user", "content": "拆模块" },
  "references": [],
  "retrievedKnowledge": [],
  "context": { "activeNode": {}, "knowledgeRetrievalError": "" }
}
```

确认入画布继续走分析修复链路 `POST /api/workspace/analysis/repair`，入参 `type: "agent-supplement"`、`nodeId`、`action`、`confirmedContent` 和当前 `analysis`；后端返回完整 `analysis.canvas` 后，前端整体替换画布。

Provider 环境变量：

```text
WORKFLOW_AGENT_PROVIDER=auto              # auto | deterministic | openai-compatible
WORKFLOW_AGENT_FALLBACK=deterministic     # deterministic | none
OPENAI_API_KEY=                           # 后端专用，前端不能读取
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_DEFAULT_MODEL=gpt-5.5
OPENAI_API_SURFACE=responses              # responses | chat.completions
OPENAI_TIMEOUT_MS=20000
```

本地开发和测试默认使用 deterministic provider。配置 `OPENAI_API_KEY` 且 `WORKFLOW_AGENT_PROVIDER=auto` 时，会切换到 OpenAI-compatible provider；模型失败时默认降级回 deterministic provider。

`/messages` 成功响应包含：

```json
{
  "run": {},
  "assistantMessage": { "role": "assistant", "content": "..." },
  "actionResult": { "type": "module-breakdown", "nodeId": "framework" },
  "usage": { "inputTokens": 0, "outputTokens": 0, "totalTokens": 0 },
  "provider": "deterministic"
}
```

## 状态规范

工作流步骤状态：

```text
locked       未解锁
active       可生成
generated    待确认
challenged   已质疑，待确认
accepted     已确认
completed    已完成
failed       失败
```

上传解析状态：

```text
uploaded     已上传
parsing      解析中
parsed       已解析
needs_review 需人工确认
failed       解析失败
```

## 错误响应格式

```json
{
  "ok": false,
  "code": "DOCUMENT_PARSE_FAILED",
  "message": "文档解析失败",
  "reason": "文件格式不受支持或内容为空",
  "recoveryActions": ["重新上传", "换 DOCX/PDF 格式", "手动粘贴文本"]
}
```

## 开发流程

1. 先写服务层测试，覆盖正常、空输入、失败、恢复建议。
2. 再写服务实现。
3. 补路由测试，确认请求和响应结构。
4. 前端只通过 `frontend/src/services/api.js` 调用后端。
5. 每次新增接口都同步更新本文件的 API 列表。
6. 后端输出必须区分“前端文件”和“后端文件”，方便用户理解交付边界。

## 当前阶段

当前项目使用 `backend/server/mock-api.mjs` 作为本地后端/API 入口，Vite 开发环境通过 `frontend/vite.config.js` 挂载同源 API。后续真实后端实现时，按本目录逐步迁移，不直接在前端组件里写后端逻辑。

## 已落地模块

```text
backend/models/workspace.js
backend/services/workspace-store.js
backend/routes/workspace.js
backend/services/document-parser.js
backend/routes/uploads.js
backend/routes/capture.js
backend/services/capture-runner.js
backend/services/capture-service.js
backend/services/agent-context-builder.js
backend/services/llm-provider.js
backend/services/agent-service.js
backend/services/workflow-runner.js
backend/routes/workflows.js
```

当前 `backend/server/mock-api.mjs` 已经复用：

- `workspaceRoutes()`：项目、资产、资料、运行记录、还原页面。
- `uploadRoutes()`：上传文档解析、失败原因、恢复动作。
- `workflowRoutes()`：创建工作流运行、生成步骤、重新生成、采纳、进入下一步。

前端上传资料已经通过 `frontend/src/services/api.js` 调用 `/api/uploads/documents`，后端不可用时保留本地解析兜底。
