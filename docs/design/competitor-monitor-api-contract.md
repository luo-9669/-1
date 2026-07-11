# 竞品监控 API 契约与前后端分工

## 目标

竞品监控按大厂项目的分层方式开发：前端负责页面体验和用户操作入口，业务后端负责领域对象、状态机、任务编排和数据真相。前端不得直接拼接采集服务、AI 服务或 worker 的原始结果；后端不得把页面文案、布局和交互状态塞进业务 DTO。

## 推荐方案

推荐采用“业务后端主导编排，前端消费稳定 DTO”的方案。

选择原因：

- 状态真相集中在后端，便于权限、审计、重试、排障和后续接真实 worker。
- 前端只依赖一套业务 API，不需要理解采集失败、模型失败、diff 失败等多套底层协议。
- 采集服务、AI 服务、diff worker 后续可替换，不影响前端页面契约。
- 团队并行更清晰：前端做体验闭环，后端做任务闭环，测试按接口和页面状态分别验收。

## 前后端职责

前端负责：

- `frontend/src/pages/competitor-monitor/`：页面入口和路由级承接。
- `frontend/src/features/competitor-monitor/`：竞品监控业务 UI、状态展示、筛选、表单校验、空/加载/失败状态。
- `frontend/src/services/api.js`：只封装业务 API 调用，不拼接 worker 协议。
- `frontend/src/services/competitorMonitor.js`：枚举展示文案、概览卡片、排序等纯前端展示辅助逻辑。
- 页面文案必须面向用户任务，不要出现英文装饰眉标、工程说明、内部链路描述或直接暴露枚举值。

业务后端负责：

- `backend/models/workspace.js`：定义 `competitor`、`monitor_task`、`page_snapshot`、`change_record`、`ai_analysis` 字段和默认值。
- `backend/services/competitor-monitor-service.js`：创建竞品、默认任务、手动检测、快照写入、变化记录、AI 分析、任务状态转换、输入校验。
- `backend/routes/competitors.js`：暴露前端可调用的业务 API，路由只做参数转交和 handler 注入。
- 后续真实采集、diff、AI worker 接入时，只替换 service adapter 或内部 worker 调用，不改变前端业务 API。

## 前端可调用 API

### GET /api/competitor-monitor/overview

查询项目级概览。

请求参数：

```text
projectId=project-flow
```

返回字段：

```json
{
  "metrics": {
    "activeCompetitors": 1,
    "weeklyChanges": 3,
    "highSeverityChanges": 1,
    "pendingAnalyses": 0
  },
  "importantChanges": [],
  "recentReports": [],
  "pendingInsights": []
}
```

### GET /api/competitor-monitor/permissions

查询当前账号在项目内的竞品监控操作权限。后端按 `currentUserId`、项目 `ownerUserId`、全局用户角色和项目 `members` 生成 DTO；前端只消费结果控制按钮状态，不自行推导权限。

请求参数：

```text
projectId=project-flow
```

返回字段：

```json
{
  "projectId": "project-flow",
  "actorUserId": "user-local-default",
  "actorName": "流程通用户",
  "role": "owner",
  "roleLabel": "负责人",
  "canView": true,
  "canCreateCompetitor": true,
  "canRunCheck": true,
  "canSaveReport": true,
  "canExportReport": true,
  "canShareReport": true,
  "canRevokeShare": true,
  "canManageInsights": true,
  "reason": "",
  "allowedActions": ["查看竞品监控", "添加竞品", "立即检测", "保存报告", "导出报告", "分享报告", "整理洞察"],
  "restrictedActions": [],
  "guidance": "你可以执行当前项目开放的竞品监控动作。"
}
```

规则：

- `owner`：项目负责人或全局 `owner` 用户，可以执行创建、检测、保存、导出、分享、撤销和洞察管理动作。
- `editor`：项目 `members` 中角色为 `editor` 的协作者，可以执行创建、检测、保存、导出、分享、撤销和洞察管理动作。
- `viewer` / `guest`：可以查看项目内竞品监控数据，但不能执行写动作；后端对写动作抛出 `COMPETITOR_PERMISSION_DENIED`，message 可直接给前端展示。
- `roleLabel / allowedActions / restrictedActions / guidance` 由后端生成中文说明；前端优先展示这些字段，不在页面组件里重新解释角色语义。
- 前端按钮禁用只是体验保护，真实安全边界必须以后端校验为准。

### GET /api/competitor-monitor/members

读取项目协作成员及其竞品监控权限摘要。该接口只做只读展示，成员增删改仍交给项目设置或后续成员管理模块。

请求参数：

```text
projectId=project-flow
```

返回字段：

```json
[
  {
    "userId": "user-owner",
    "name": "项目负责人",
    "role": "owner",
    "roleLabel": "负责人",
    "isCurrentUser": true,
    "allowedActions": ["查看竞品监控", "添加竞品", "立即检测", "保存报告", "导出报告", "分享报告", "整理洞察"],
    "restrictedActions": []
  }
]
```

规则：

- 后端按项目负责人和 `project.members` 聚合成员列表。
- `roleLabel / allowedActions / restrictedActions` 由后端生成，前端只展示。
- 不返回邮箱、密钥、登录态、内部权限表达式或项目外成员信息。

### GET /api/competitor-monitor/reports

查询项目下的分析报告。未保存时由后端从 `change_record`、`page_snapshot` 和 `ai_analysis` 聚合为草稿；保存后返回正式 `competitor_report`，前端不本地生成报告结论。

请求参数：

```text
projectId=project-flow
```

返回字段：

```json
[
  {
    "id": "report-draft-change-record-id",
    "projectId": "project-flow",
    "title": "Figma 变化分析报告",
    "status": "draft",
    "summary": "竞品正在强化当前首页定位表达。",
    "factualObservation": "首页主文案发生变化",
    "productImpact": "需关注对方定位与卖点收敛方式。",
    "uxImpact": "重点检查信息层级和 CTA 是否同步调整。",
    "uiImpact": "视觉层暂按文案变化记录，不额外夸大 UI 结论。",
    "recommendation": "把该变化加入后续产品与体验对比清单。",
    "tags": ["官网首页文案", "高优先级"],
    "severity": "high",
    "sections": []
  }
]
```

规则：

- 报告列表返回的是前端安全 DTO，只包含标题、摘要、章节、状态、优先级、中文标签、分享状态和时间字段。
- 标题、摘要、建议和章节内容都属于用户可见内容，后端必须统一清洗；如果混入 `sourceUrl / sourceChangeId / sourceSnapshotId / change-record / raw / html / textContent / analysisModel / analysisTokenUsage / payload / worker / debug / token` 等内部字段，前端 DTO 统一降级为“已保留为安全报告内容，可在后台证据链路中复盘。”。
- 后端内部可以保存 `competitorId / changeId / sourceDraftId / sourceSnapshotId / sourceUrl / reportVersions / shareToken / analysisModel / analysisTokenUsage` 等证据和治理字段，但不得放进列表 DTO。
- 前端报告标题区统一使用“来源于竞品变化分析，可继续编辑和沉淀。”这类业务说明；如后续需要证据追溯，应新开后端授权接口，不在主界面直出原始证据字段。

### POST /api/competitor-monitor/reports/:id/save

把报告草稿保存为正式报告，或更新已保存报告。前端只提交用户编辑后的标题、摘要和章节内容；竞品、变化、快照和状态由后端按报告来源补齐。逐章节编辑时前端可以只提交当前章节，后端按 `section.key` 合并旧章节并追加版本快照。

请求体：

```json
{
  "projectId": "project-flow",
  "title": "Figma 首页变化正式报告",
  "summary": "正式沉淀首页定位变化",
  "sections": [
    { "key": "recommendation", "title": "设计建议", "content": "跟进首页 CTA 和首屏信息层级。" }
  ]
}
```

返回字段：

```json
{
  "id": "competitor-report-change-record-id",
  "projectId": "project-flow",
  "title": "Figma 首页变化正式报告",
  "status": "ready",
  "summary": "正式沉淀首页定位变化",
  "sections": []
}
```

规则：

- 保存报告返回的是前端安全 DTO，字段边界与 `GET /api/competitor-monitor/reports` 保持一致。
- 保存报告时前端可以提交用户编辑的标题、摘要、建议和章节内容，但后端返回给前端、版本快照和导出使用的可见内容必须走同一套安全清洗；混入内部字段时统一降级为“已保留为安全报告内容，可在后台证据链路中复盘。”。
- 后端内部仍维护报告来源、版本历史、分享 token 和 AI 分析治理摘要，用于审计、回滚、分享校验和排障；前端不得依赖这些内部字段。

错误规则：

- 报告不存在或不属于当前项目时抛出 `COMPETITOR_REPORT_NOT_FOUND`。

### GET /api/competitor-monitor/reports/:id/export

导出正式报告或草稿报告。Markdown 内容由后端根据报告 DTO 生成，前端只负责下载。
导出正文必须使用用户语言，`sourceUrl`、变化记录 id、快照 id 和内部审计字段只允许留在后端追溯，不写入 Markdown。
项目内导出和公开下载必须共用报告可见内容清洗规则：标题、摘要、建议和章节内容如果包含 `sourceUrl / sourceChangeId / sourceSnapshotId / change-record / raw / html / textContent / analysisModel / analysisTokenUsage / payload / worker / debug / token` 等内部字段，Markdown 统一写“已保留为安全报告内容，可在后台证据链路中复盘。”。

请求参数：

```text
projectId=project-flow
```

返回字段：

```json
{
  "fileName": "Figma 首页变化正式报告.md",
  "markdown": "# Figma 首页变化正式报告\n\n状态：已生成\n来源：竞品变化分析\n\n## 摘要\n正式沉淀首页定位变化\n"
}
```

### POST /api/competitor-monitor/reports/:id/share

为已保存正式报告生成分享链接。前端只传项目 id、用户选择的有效期和是否允许下载，后端负责校验报告归属、开启分享状态、计算过期时间并返回稳定链接。

请求体：

```json
{
  "projectId": "project-flow",
  "expiresInDays": 7,
  "allowDownload": false
}
```

返回字段：

```json
{
  "id": "competitor-report-change-record-id",
  "shareEnabled": true,
  "shareUrl": "/competitor-monitor/reports/competitor-report-change-record-id?share=share-competitor-report-change-record-id",
  "shareAllowDownload": false,
  "sharedAt": "2026-06-24T09:00:00.000Z",
  "shareExpiresAt": "2026-07-01T09:00:00.000Z",
  "shareRevokedAt": "",
  "shareAccessCount": 0,
  "lastSharedAccessAt": ""
}
```

规则：

- `expiresInDays` 为空时默认 7 天；传 `0` 表示长期有效。
- `allowDownload` 默认 `false`；仅当传 `true` 时公开分享才允许下载 Markdown。
- 重新分享会恢复 `shareEnabled`、清空 `shareRevokedAt`，并更新 `shareAllowDownload`。
- 报告不存在、不是正式报告或不属于当前项目时抛出 `COMPETITOR_REPORT_NOT_FOUND`。

### POST /api/competitor-monitor/reports/:id/share/revoke

撤销正式报告分享。前端只传项目 id，后端负责校验报告归属并关闭分享状态；撤销后的旧 token 不能再公开读取。

请求体：

```json
{
  "projectId": "project-flow"
}
```

返回字段：

```json
{
  "id": "competitor-report-change-record-id",
  "shareEnabled": false,
  "shareRevokedAt": "2026-06-24T10:00:00.000Z"
}
```

错误规则：

- 报告不存在、不是正式报告或不属于当前项目时抛出 `COMPETITOR_REPORT_NOT_FOUND`。

### GET /api/competitor-monitor/reports/:id/shared

按分享 token 读取公开报告。该接口不依赖 `projectId`，访问控制完全由后端根据 token、启用状态、撤销状态和过期时间判断。
校验通过后，后端必须递增 `shareAccessCount` 并写入 `lastSharedAccessAt`，同时写入一条 `report-shared-accessed` 项目审计记录；无效、撤销或过期访问不计入统计，也不写访问审计。

前端外部访问页使用 `/competitor-monitor/reports/:id?share=:shareToken` 承接分享链接，只调用公开读取和公开下载接口，不读取项目权限、不展示项目内操作入口。

返回字段必须是公开报告 DTO，只包含标题、摘要、章节、分享有效期、下载权限、访问次数和最近访问时间等展示字段；不得返回 `projectId / competitorId / sourceDraftId / sourceSnapshotId / sourceUrl / reportVersions / shareToken / shareUrl` 或任何审计 `meta`。公开报告 DTO 同样必须清洗标题、摘要、建议和章节内容；混入内部字段时统一降级为“已保留为安全报告内容，可在后台证据链路中复盘。”。

请求参数：

```text
shareToken=share-competitor-report-change-record-id
```

错误规则：

- token 缺失、错误或报告不存在时抛出 `COMPETITOR_REPORT_SHARE_INVALID`。
- 分享已撤销或未启用时抛出 `COMPETITOR_REPORT_SHARE_REVOKED`。
- 分享已过期时抛出 `COMPETITOR_REPORT_SHARE_EXPIRED`。

### GET /api/competitor-monitor/reports/:id/shared/export

按分享 token 导出公开报告 Markdown。该接口同样不依赖 `projectId`，但后端必须先校验 token、启用状态、撤销状态、过期时间和 `shareAllowDownload`。
公开下载必须复用项目内报告导出的安全内容规则，不得因为外部访问页没有项目权限就绕过标题、摘要、建议和章节内容清洗。

请求参数：

```text
shareToken=share-competitor-report-change-record-id
```

返回字段：

```json
{
  "fileName": "Figma 首页变化正式报告.md",
  "markdown": "# Figma 首页变化正式报告\n\n## 摘要\n正式沉淀首页定位变化\n"
}
```

错误规则：

- token 缺失、错误或报告不存在时抛出 `COMPETITOR_REPORT_SHARE_INVALID`。
- 分享已撤销或未启用时抛出 `COMPETITOR_REPORT_SHARE_REVOKED`。
- 分享已过期时抛出 `COMPETITOR_REPORT_SHARE_EXPIRED`。
- 分享未允许下载时抛出 `COMPETITOR_REPORT_SHARE_DOWNLOAD_DENIED`。

### GET /api/competitor-monitor/reports/:id/versions

读取正式报告版本历史。版本由后端在每次保存正式报告时追加，前端只展示返回列表。

请求参数：

```text
projectId=project-flow
```

返回字段：

```json
[
  {
    "id": "report-version-competitor-report-change-record-id-2",
    "version": 2,
    "title": "Figma 首页变化正式报告",
    "summary": "第二版摘要",
    "sections": [],
    "savedAt": "2026-06-24T09:01:00.000Z"
  }
]
```

### GET /api/competitor-monitor/audit-logs

读取项目级竞品监控操作记录。审计记录由后端在关键业务动作成功后写入，前端只展示最近动作，不自行拼接日志。

请求参数：

```text
projectId=project-flow
action=report-shared
targetType=report
actorUserId=user-editor
limit=30
```

筛选规则：

- `action`：按动作类型筛选，例如 `report-shared`、`insight-saved`。
- `targetType`：按对象类型筛选，例如 `report`、`insight`、`competitor`。
- `actorUserId`：按操作者筛选，前端“我操作的”只传后端权限 DTO 中的 `actorUserId`。
- `limit`：默认返回最近 30 条，最大 100 条。
- `action` 只作为后端筛选码和审计归档字段；前端如需展示动作类型，必须使用后端返回的 `actionLabel`，不得把 `report-saved / insight-saved / report-shared-accessed` 等原始动作码显示给用户。

审计治理规则：

- `report-saved` 和 `insight-saved` 的后端审计 `meta.analysisGovernance` 可记录 AI 分析治理摘要，字段只允许包含 `analysisRecorded / analysisDurationMs / analysisFallbackUsed / analysisTokenTotal`。
- `meta.analysisGovernance` 用于后端排障、成本治理和审计，不作为前端页面主文案来源，也不得出现在公开审计 DTO。
- 审计 `meta` 不得写入 `analysisProvider / analysisModel / analysisFallbackReason`、模型名、prompt、provider 原始响应、payload、stack、worker、debug、密钥或 token 细项。
- `GET /api/competitor-monitor/audit-logs` 返回的是公开审计 DTO，`meta` 只允许保留前端可展示或可筛选的安全摘要，例如 `checkedAt / totalDue / succeeded / failed / failureType / recoverySuggestion / fileName / count`；不得返回 `results / payload / stack / worker / debug / raw`、任务 id、变化记录 id、快照 id、来源变化 id、来源快照 id、来源 URL、报告草稿 id、资料 id、资产 id 或 `analysisGovernance`。内部 workspace 审计记录可以保留证据关系和安全治理明细，用于后端排障、追溯和成本统计。

返回字段：

```json
[
  {
    "id": "competitor-audit-id",
    "projectId": "project-flow",
    "actorUserId": "user-local-default",
    "actorName": "流程通用户",
    "action": "report-share-revoked",
    "actionLabel": "撤销分享",
    "summary": "撤销报告「Linear 首页变化正式报告」分享",
    "targetType": "report",
    "targetId": "competitor-report-change-record-id",
    "targetTitle": "Linear 首页变化正式报告",
    "createdAt": "2026-06-24T10:04:00.000Z"
  }
]
```

### GET /api/competitor-monitor/audit-logs/export

导出项目级竞品监控操作记录。筛选参数与操作记录列表一致，Markdown 内容由后端根据审计 DTO 生成；前端只负责下载，不拼接内部动作枚举或调试信息。

请求参数：

```text
projectId=project-flow
action=report-shared
targetType=report
actorUserId=user-editor
limit=100
```

返回字段：

```json
{
  "fileName": "竞品监控操作记录.md",
  "markdown": "# 竞品监控操作记录\n\n记录数量：2\n"
}
```

规则：

- 导出内容只包含时间、操作者、动作摘要和业务对象。
- 导出内容必须使用 `actionLabel` 对应的中文动作名，例如 `执行调度`；不得导出 `monitor-scheduler-ran` 这类内部 action。
- 不导出内部 `payload`、错误栈、worker 名称、调试字段、审计 `meta` 或调度 `results` 明细。
- 默认最多导出最近 100 条符合筛选条件的记录。

当前记录动作：

- `competitor-created`：添加竞品。
- `competitor-check-ran`：完成一次手动检测。
- `competitor-check-failed`：检测失败。
- `monitor-scheduler-ran`：执行监控调度。
- `monitor-task-status-updated`：暂停或恢复监控任务。
- `monitor-task-frequency-updated`：调整监控任务频率。
- `monitor-task-notification-updated`：更新监控任务通知设置。
- `report-saved`：保存正式报告。
- `report-exported`：导出正式报告。
- `report-shared`：生成报告分享链接。
- `report-shared-accessed`：分享链接校验成功并访问公开报告。
- `report-share-revoked`：撤销报告分享。
- `insight-saved`：保存变化为洞察。
- `insight-updated`：更新洞察分类或备注。
- `insights-batch-updated`：批量整理洞察。
- `insight-exported`：导出单条洞察。
- `insights-batch-exported`：批量导出洞察。
- `insight-requirements-linked`：关联洞察到需求文档。
- `insight-knowledge-deposited`：沉淀单条洞察到知识库。
- `insights-batch-knowledge-deposited`：批量沉淀洞察到知识库。
- `ui-reference-favorited`：收藏 UI 参考。
- `ui-reference-unfavorited`：取消收藏 UI 参考。

### GET /api/competitor-monitor/reports/:id/versions/compare

对比正式报告的两个历史版本。前端只传版本号，后端负责读取版本快照、比较摘要和章节内容，并返回稳定差异 DTO。

请求参数：

```text
projectId=project-flow
fromVersion=1
toVersion=2
```

返回字段：

```json
{
  "fromVersion": {
    "id": "report-version-competitor-report-change-record-id-1",
    "version": 1,
    "summary": "第一版摘要",
    "savedAt": "2026-06-24T09:00:00.000Z"
  },
  "toVersion": {
    "id": "report-version-competitor-report-change-record-id-2",
    "version": 2,
    "summary": "第二版摘要",
    "savedAt": "2026-06-24T09:01:00.000Z"
  },
  "summaryChanged": true,
  "sectionDiffs": [
    {
      "key": "recommendation",
      "title": "设计建议",
      "previousContent": "跟进首页 CTA。",
      "nextContent": "跟进首页 CTA 和首屏信息层级。",
      "changed": true
    }
  ]
}
```

错误规则：

- 报告不存在或不属于当前项目时抛出 `COMPETITOR_REPORT_NOT_FOUND`。
- 指定版本不存在时抛出 `COMPETITOR_REPORT_VERSION_NOT_FOUND`。

### GET /api/competitor-monitor/ui-references

查询项目下可用于页面设计复盘的 UI 参考。后端从已保存截图、变化记录、AI 分析和洞察中聚合真实 `screenshots/components/visualTags`，前端只展示和筛选，不伪造截图、组件或标签。

请求参数：

```text
projectId=project-flow
```

返回字段：

```json
{
  "screenshots": [
    {
      "id": "ui-screenshot-page-snapshot-id",
      "projectId": "project-flow",
      "competitorId": "competitor-id",
      "competitorName": "Linear",
      "title": "Linear 首页",
      "screenshotUrl": "https://cdn.example.com/linear-home.png",
      "capturedAt": "2026-06-24T09:00:00.000Z"
    }
  ],
  "components": [
    {
      "id": "ui-component-change-record-id-CTA",
      "projectId": "project-flow",
      "name": "CTA",
      "competitorId": "competitor-id",
      "competitorName": "Linear",
      "summary": "Linear 首页监控发现新变化",
      "updatedAt": "2026-06-24T09:00:00.000Z"
    }
  ],
  "visualTags": [
    {
      "id": "ui-tag-change-record-id-首页",
      "projectId": "project-flow",
      "name": "首页",
      "competitorId": "competitor-id",
      "competitorName": "Linear",
      "summary": "Linear 首页监控发现新变化",
      "updatedAt": "2026-06-24T09:00:00.000Z"
    }
  ]
}
```

规则：

- `screenshots/components/visualTags` 都是公开展示 DTO，不返回网页正文、HTML、采集 raw、内部网址字段、来源变化 id、来源快照 id 或 worker 调试结构。
- UI 参考只给前端展示标题、截图、来源竞品、参考类型、摘要和时间；页面如果要提示来源，使用“来自已完成检测的页面截图”这类用户语言。
- 后端内部可以用来源变化 id 和来源快照 id 解析收藏关系、审计和追溯，但前端不消费、不展示、不透传。

### GET /api/competitor-monitor/ui-reference-favorites

查询项目级 UI 参考收藏。后端从 `materials(type="ui-reference-favorite")` 返回稳定 DTO，前端只用 `referenceId` 标记“已收藏”。

请求参数：

```text
projectId=project-flow
```

返回字段：

```json
[
  {
    "id": "material-ui-reference-favorite-project-flow-ui-screenshot-id",
    "projectId": "project-flow",
    "referenceId": "ui-screenshot-id",
    "referenceType": "screenshot",
    "title": "Linear 首页",
    "competitorName": "Linear",
    "createdAt": "2026-06-24T09:00:00.000Z",
    "updatedAt": "2026-06-24T09:00:00.000Z"
  }
]
```

规则：

- 收藏 DTO 只用于前端标记 `referenceId` 是否已收藏，不返回 `sourceChangeId / sourceSnapshotId / sourceUrl / raw / html / textContent`。
- 后端内部 material 关系和审计摘要可以保留来源变化 id，用于追溯和排障；前端不消费、不展示、不透传。

### POST /api/competitor-monitor/ui-reference-favorites

收藏 UI 参考。前端提交当前参考的展示信息，后端按 `projectId + referenceId` 幂等保存为项目资料关系，避免刷新页面或跨设备后收藏状态丢失。

请求体：

```json
{
  "projectId": "project-flow",
  "referenceId": "ui-screenshot-id",
  "referenceType": "screenshot",
  "title": "Linear 首页",
  "competitorName": "Linear",
  "summary": "来自已完成检测的页面截图"
}
```

规则：

- 前端只提交用户选中的参考和展示摘要，不提交 `sourceChangeId / sourceSnapshotId / sourceUrl / raw / html / textContent`。
- 后端必须根据 `projectId + referenceId` 从当前项目的 UI 参考聚合结果中解析来源变化，再写入内部 material 关系和审计摘要。
- 返回字段同单条收藏 DTO。重复收藏同一 `referenceId` 返回同一条收藏记录。

### DELETE /api/competitor-monitor/ui-reference-favorites/:id

取消收藏 UI 参考。`:id` 使用 UI 参考 id，不直接暴露 material id；后端按项目和 `sourceAssetId` 查找后删除。

请求参数：

```text
projectId=project-flow
```

返回字段：

```json
{
  "referenceId": "ui-screenshot-id",
  "deleted": true
}
```

### GET /api/competitor-monitor/insights

查询项目下已保存的竞品洞察。洞察由后端持久化，前端只负责列表、搜索、详情展示和用户动作入口。

请求参数：

```text
projectId=project-flow
```

返回字段：

```json
[
  {
    "id": "competitor-insight-id",
    "projectId": "project-flow",
    "competitorId": "competitor-id",
    "changeId": "change-record-id",
    "category": "product",
    "title": "Figma 产品机会洞察",
    "summary": "竞品正在强化首页定位表达。",
    "recommendation": "把该变化加入后续产品与体验对比清单。",
    "evidence": ["首页主文案发生变化"],
    "priority": "high",
    "status": "saved",
    "note": "由变化详情保存",
    "knowledgeMaterialId": "material-competitor-insight-id",
    "requirementMaterialIds": ["requirement-material-id"]
  }
]
```

### PATCH /api/competitor-monitor/insights/:id

更新已保存洞察的分类和备注。前端只提交用户选择，后端负责校验项目归属并持久化。

请求体：

```json
{
  "projectId": "project-flow",
  "category": "ux",
  "note": "重点关注首屏转化和 CTA 语气"
}
```

返回字段为更新后的 `competitorInsight`。

错误规则：

- 洞察不存在或不属于当前项目时抛出 `COMPETITOR_INSIGHT_NOT_FOUND`。

### PATCH /api/competitor-monitor/insights/batch

批量整理已保存洞察。前端提交用户选中的洞察 id、目标分类和可选备注，后端负责去重、校验项目归属并统一持久化。

请求体：

```json
{
  "projectId": "project-flow",
  "insightIds": ["competitor-insight-id-a", "competitor-insight-id-b"],
  "category": "strategy",
  "note": "批量整理为策略观察"
}
```

返回字段：

```json
{
  "updatedCount": 2,
  "insights": []
}
```

错误规则：

- 洞察为空、不存在或不属于当前项目时抛出 `COMPETITOR_INSIGHT_NOT_FOUND`。

### POST /api/competitor-monitor/insights/batch-export

批量导出已保存洞察。Markdown 由后端生成，前端只负责下载文件。

请求体：

```json
{
  "projectId": "project-flow",
  "insightIds": ["competitor-insight-id-a", "competitor-insight-id-b"]
}
```

返回字段：

```json
{
  "count": 2,
  "fileName": "竞品洞察批量导出.md",
  "markdown": "# 竞品洞察批量导出\n\n共 2 条洞察\n"
}
```

错误规则：

- 洞察为空、不存在或不属于当前项目时抛出 `COMPETITOR_INSIGHT_NOT_FOUND`。

### POST /api/competitor-monitor/insights/:id/link-requirements

把已保存洞察关联到需求文档资料。前端提交用户选择的一个或多个需求材料 id，后端负责校验需求资料归属、更新洞察 `requirementMaterialIds`，并给需求材料追加 `competitor-insight` relation，避免页面伪造关联。

请求体：

```json
{
  "projectId": "project-flow",
  "requirementMaterialIds": ["requirement-material-id"]
}
```

返回字段：

```json
{
  "insight": {
    "id": "competitor-insight-id",
    "requirementMaterialIds": ["requirement-material-id"]
  },
  "requirements": [
    {
      "id": "requirement-material-id",
      "type": "requirements",
      "relations": [
        { "type": "competitor-insight", "id": "competitor-insight-id", "title": "Figma 产品机会洞察" }
      ]
    }
  ]
}
```

错误规则：

- 洞察不存在或不属于当前项目时抛出 `COMPETITOR_INSIGHT_NOT_FOUND`。
- 需求文档不存在、不属于当前项目或不是 `requirements` 类型时抛出 `COMPETITOR_REQUIREMENT_NOT_FOUND`。

### GET /api/competitor-monitor/insights/:id/export

导出已保存洞察。Markdown 内容由后端根据洞察 DTO 生成，前端只负责下载。

请求参数：

```text
projectId=project-flow
```

返回字段：

```json
{
  "fileName": "Figma 产品机会洞察.md",
  "markdown": "# Figma 产品机会洞察\n\n## 摘要\n竞品正在强化首页定位表达\n"
}
```

### POST /api/competitor-monitor/insights/:id/deposit-knowledge

把已保存洞察沉淀为知识库资料。前端只提交项目和洞察 id，后端负责生成知识内容、写入 `materials(type="knowledge")`，并把 `knowledgeMaterialId` 回写到洞察。重复沉淀同一条洞察时返回同一个知识资料，避免生成重复资料。

请求体：

```json
{
  "projectId": "project-flow"
}
```

返回字段：

```json
{
  "insight": {
    "id": "competitor-insight-id",
    "knowledgeMaterialId": "material-competitor-insight-id"
  },
  "material": {
    "id": "material-competitor-insight-id",
    "projectId": "project-flow",
    "type": "knowledge",
    "sourceType": "competitor-insight",
    "sourceUrl": "change-record-id",
    "sourceAssetId": "competitor-insight-id",
    "roleScopes": ["product", "ux", "development", "ai-retrieval"],
    "relations": [
      { "type": "competitor-insight", "id": "competitor-insight-id" },
      { "type": "change-record", "id": "change-record-id" }
    ]
  }
}
```

错误规则：

- 洞察不存在或不属于当前项目时抛出 `COMPETITOR_INSIGHT_NOT_FOUND`。

### POST /api/competitor-monitor/insights/batch-deposit-knowledge

把多条已保存洞察批量沉淀为知识库资料。前端只提交项目和选中的洞察 id；后端负责去重、校验项目归属、复用单条沉淀的幂等规则、写入 `materials(type="knowledge")`，并把每条洞察的 `knowledgeMaterialId` 回写。

请求体：

```json
{
  "projectId": "project-flow",
  "insightIds": ["competitor-insight-id-a", "competitor-insight-id-b"]
}
```

返回字段：

```json
{
  "depositedCount": 2,
  "insights": [
    {
      "id": "competitor-insight-id-a",
      "knowledgeMaterialId": "material-competitor-insight-id-a"
    }
  ],
  "materials": [
    {
      "id": "material-competitor-insight-id-a",
      "projectId": "project-flow",
      "type": "knowledge",
      "sourceType": "competitor-insight",
      "sourceAssetId": "competitor-insight-id-a"
    }
  ]
}
```

错误规则：

- 洞察为空、不存在或不属于当前项目时抛出 `COMPETITOR_INSIGHT_NOT_FOUND`。
- 重复提交同一洞察不会生成重复知识资料。

### POST /api/changes/:id/save-as-insight

把一条变化记录保存为洞察。前端只传用户选择和备注；标题、摘要、依据、建议、优先级由后端根据 `change_record` 和 `ai_analysis` 生成。

请求体：

```json
{
  "projectId": "project-flow",
  "category": "product",
  "note": "由变化详情保存"
}
```

错误规则：

- 变化记录不存在或不属于当前项目时抛出 `COMPETITOR_CHANGE_NOT_FOUND`。

### GET /api/competitors

查询项目下竞品列表。

请求参数：

```text
projectId=project-flow
```

返回 `competitor[]`。

### POST /api/competitors

创建竞品，并由后端自动创建默认 `monitor_task`。

请求体：

```json
{
  "projectId": "project-flow",
  "name": "Figma",
  "websiteUrl": "https://www.figma.com",
  "notes": "首页定位、CTA、价格页结构"
}
```

校验规则：

- `projectId` 必填。
- `name` 必填。
- `websiteUrl` 只允许 `http` 或 `https`。
- 校验失败统一抛出 `COMPETITOR_INPUT_INVALID`，message 直接给前端展示。

### GET /api/competitors/:id

查询单个竞品详情。前端用于详情区或后续抽屉，不用于推导任务状态。

### GET /api/monitor-tasks

查询监控任务列表，是前端展示“监控状态、最近检测、监控频率、通知设置、下次执行、失败原因、失败历史”的唯一来源。

请求参数：

```text
projectId=project-flow&competitorId=competitor-id
```

返回 `monitor_task[]`。

### POST /api/monitor-tasks

新建一个明确的页面监控任务。前端只提交用户选择的竞品、监控页面 URL、页面类型和频率；后端负责项目归属校验、权限校验、排期、通知配置归一化和审计记录。

请求体：

```json
{
  "projectId": "project-flow",
  "competitorId": "competitor-id",
  "url": "https://www.figma.com/pricing",
  "pageType": "Pricing",
  "frequency": "daily",
  "notification": {
    "enabled": true,
    "channels": ["in-app", "email"]
  }
}
```

规则：

- `projectId / competitorId / url` 必填，`url` 只允许 `http` 或 `https`。
- `competitorId` 必须属于当前项目。
- `frequency` 只允许 `daily / weekly / monthly`。
- 创建成功后，后端计算 `nextRunAt`，写入 `monitor-task-created` 操作记录。
- 前端不得本地伪造任务状态，创建成功后必须重新读取 `GET /api/monitor-tasks`。

### PATCH /api/monitor-tasks/:id

暂停、恢复、更新监控频率或更新通知设置。前端只提交用户动作，后端负责校验状态、频率、通知渠道，写入任务设置并计算 `nextRunAt`。

请求体：

```json
{
  "projectId": "project-flow",
  "status": "paused"
}
```

更新频率请求体：

```json
{
  "projectId": "project-flow",
  "frequency": "daily"
}
```

更新通知请求体：

```json
{
  "projectId": "project-flow",
  "notification": {
    "enabled": true,
    "channels": ["in-app", "email"],
    "recipients": ["product@example.com"]
  }
}
```

状态规则：

- 只允许用户切换到 `paused` 或 `active`。
- `paused` 会清空 `nextRunAt`，表示不再进入后续排期。
- `active` 会按任务 `frequency` 由后端计算新的 `nextRunAt`，并清空 `lastError`。
- 非法状态统一抛出 `COMPETITOR_TASK_STATUS_INVALID`，前端展示 message。
- 频率只允许 `daily`、`weekly`、`monthly`，非法频率统一抛出 `COMPETITOR_TASK_FREQUENCY_INVALID`。
- 更新频率时，后端按新频率重新计算 `nextRunAt`；如果任务已暂停，则继续保持 `nextRunAt` 为空。
- 通知渠道只允许 `in-app`、`email`、`webhook`，非法通知渠道统一抛出 `COMPETITOR_TASK_NOTIFICATION_INVALID`。
- 更新通知时，后端会规范化 `enabled`、`channels`、`recipients` 并写入 `notification.updatedAt`；前端不得自行持久化通知配置。

### POST /api/competitors/:id/check

触发一次后端主导的手动检测。前端只发起动作并刷新业务数据，不直接执行采集、diff 或 AI 分析。

请求体：

```json
{
  "projectId": "project-flow"
}
```

成功返回：

```json
{
  "competitor": {},
  "task": {},
  "snapshot": {},
  "change": {},
  "analysis": {
    "factualObservation": "首页首屏定位表达发生变化",
    "recommendation": "加入下次首页对比评审",
    "analysisMode": "智能分析",
    "analysisDurationMs": 1280,
    "analysisUsageRecorded": true,
    "analysisFallbackUsed": false
  }
}
```

规则：

- `snapshot` 是公开快照 DTO，只包含 `id / projectId / competitorId / taskId / url / title / screenshotUrl / status / capturedAt / createdAt / updatedAt`，不得返回 `textContent / html / raw / singleFileHtml / staticHtml` 等网页正文或采集原始结构。
- `analysis` 与变化详情接口保持同一安全 DTO，不返回 `analysisProvider / analysisModel / analysisTokenUsage / analysisFallbackReason`；`analysisDurationMs / analysisUsageRecorded / analysisFallbackUsed` 只用于后端治理和必要状态判断，不作为前端主界面文案展示。
- 前端成功后只使用 `change.id` 刷新列表和详情，不根据手动检测响应自行生成报告、洞察或成本展示。

失败时后端必须：

- 将对应 `monitor_task.status` 更新为 `failed`。
- 在内部写入 `monitor_task.lastError`，公开任务 DTO 仍清空该字段。
- 将本次失败追加到 `monitor_task.failureHistory`，最新失败在前；公开任务 DTO 只返回失败类型、恢复建议和失败时间。
- 创建 `change_record`，其 `changeType` 为 `monitor-failed`，`status` 为 `failed`。
- 抛出原始错误，供前端展示失败态并提供重试入口。

### POST /api/competitor-monitor/scheduler/run-due

后端调度器或本地运维入口调用。只执行已到 `retrySummary.nextRetryAt`、状态为失败且未暂停的监控任务。

请求：

```json
{
  "projectId": "project-flow"
}
```

响应：

```json
{
  "projectId": "project-flow",
  "checkedAt": "2026-06-24T10:05:30.000Z",
  "totalDue": 1,
  "succeeded": 1,
  "failed": 0,
  "results": [
    {
      "taskId": "monitor-task-1",
      "competitorId": "competitor-1",
      "status": "succeeded",
      "changeId": "change-record-1",
      "snapshotId": "page-snapshot-1"
    }
  ]
}
```

规则：

- 前端页面不直接调用，不需要展示调度按钮。
- 后端必须复用 `runCompetitorCheck`，让权限、审计、失败历史、重试摘要和运行摘要保持一致。
- 返回结果只允许包含安全摘要，不返回原始错误、worker、payload、stack、debug、模型提示词或底层采集日志。
- 调度完成后写入 `monitor-scheduler-ran` 内部操作记录，内部审计 `meta` 可以记录 `checkedAt / totalDue / succeeded / failed / results` 安全摘要；公开审计 DTO 只返回 `checkedAt / totalDue / succeeded / failed`，不返回 `results` 明细。导出操作记录时只能展示中文动作名和摘要，不展示内部 action、`meta` 或 `results`。

### GET /api/changes

查询变化记录列表。

请求参数：

```text
projectId=project-flow&competitorId=competitor-id
```

返回 `change_record[]`。

### GET /api/changes/:id

查询变化详情，返回变化记录、最新快照和 AI 分析。

返回字段：

```json
{
  "change": {},
  "snapshot": {},
  "analysis": {}
}
```

`snapshot` 必须只返回公开快照 DTO，不返回网页正文、HTML、采集原始结构或内部 raw 字段。`page_snapshot.textContent` 只保留在后端，用于 diff、报告聚合、AI 分析和排障。

`analysis` 必须只返回安全摘要，不返回 provider、模型名、token 细项、fallback 原因、prompt、provider 原始 payload、错误堆栈或密钥信息。主界面只展示事实观察、AI 解读和设计建议；`analysisDurationMs / analysisUsageRecorded / analysisFallbackUsed` 只保留为治理摘要或后续受控看板输入，不直接作为页面文案。完整成本字段只保留在后端内部记录和安全审计摘要里：

```json
{
  "factualObservation": "首页首屏定位表达发生变化",
  "interpretation": "竞品正在强化转化主张",
  "recommendation": "加入下次首页对比评审",
  "analysisMode": "智能分析",
  "analysisDurationMs": 1280,
  "analysisUsageRecorded": true,
  "analysisFallbackUsed": false
}
```

## DTO 字段约定

`competitor`：

```json
{
  "id": "competitor-id",
  "projectId": "project-flow",
  "name": "Figma",
  "websiteUrl": "https://www.figma.com",
  "notes": "",
  "status": "active",
  "createdAt": "2026-06-24T00:00:00.000Z",
  "updatedAt": "2026-06-24T00:00:00.000Z"
}
```

`monitor_task`：

```json
{
  "id": "monitor-task-id",
  "projectId": "project-flow",
  "module": "competitors",
  "competitorId": "competitor-id",
  "url": "https://www.figma.com",
  "pageType": "Homepage",
  "frequency": "weekly",
  "status": "active",
  "notification": {
    "enabled": false,
    "channels": ["in-app"],
    "recipients": [],
    "updatedAt": ""
  },
  "lastRunAt": "",
  "nextRunAt": "",
  "lastError": "",
  "failureType": "",
  "recoverySuggestion": "",
  "failureHistory": [
    {
      "message": "capture unavailable",
      "failureType": "network",
      "recoverySuggestion": "页面暂时无法访问，请稍后重试或确认网址是否可打开。",
      "failedAt": "2026-06-24T08:01:00.000Z",
      "status": "failed"
    }
  ],
  "createdAt": "2026-06-24T00:00:00.000Z",
  "updatedAt": "2026-06-24T00:00:00.000Z"
}
```

`change_record`：

```json
{
  "id": "change-record-id",
  "projectId": "project-flow",
  "module": "competitors",
  "competitorId": "competitor-id",
  "taskId": "monitor-task-id",
  "oldSnapshotId": "",
  "newSnapshotId": "page-snapshot-id",
  "changeType": "homepage-copy",
  "changeSummary": "首页监控发现新变化",
  "diffText": "",
  "severity": "high",
  "status": "ready",
  "failureType": "",
  "recoverySuggestion": "",
  "detectedAt": "2026-06-24T00:00:00.000Z"
}
```

规则：

- `diffText` 是后端内部证据字段，公开列表、详情和手动检测响应必须返回空字符串。
- 前端展示变化时只使用 `changeSummary / changeType / severity / status / failureType / recoverySuggestion` 等安全字段。

## 状态机

`monitor_task.status`：

- `active`：默认监控已创建，等待调度或手动检测。
- `paused`：用户已暂停监控，`nextRunAt` 为空。
- `running`：当前检测正在执行，前端禁用重复点击。
- `succeeded`：最近一次检测成功，`lastError` 必须为空。
- `failed`：最近一次检测失败，`lastError` 必须写入可读失败原因，`failureType` 和 `recoverySuggestion` 必须给前端展示可行动恢复建议。
- `failureHistory`：由后端追加维护，最多保留最近失败记录，每条包含 `message / failureType / recoverySuggestion / failedAt / status`，前端只展示不加工。
- `runHistory`：由后端追加维护，最多保留最近检测运行摘要，每条只包含 `status / runAt / changeId / snapshotId / failureType / recoverySuggestion`，用于后续调度、重试和治理统计；不得包含原始错误、payload、stack、worker、debug 或模型提示词。
- `retrySummary`：由后端按连续失败次数计算，字段为 `failureCount / nextRetryAt / backoffSeconds / failureType / recoverySuggestion`；检测成功后清空为零值。前端可以用 `nextRetryAt` 提示“稍后自动重试”，但不能展示退避策略、worker 或底层错误。
- `runDueMonitorTasks`：后端调度器入口，只执行已到 `retrySummary.nextRetryAt` 且未暂停的失败任务；返回 `checkedAt / totalDue / succeeded / failed / results` 安全摘要，不返回原始错误、worker、payload 或堆栈。前端不直接调用该入口。
- `failureType`：由业务后端归类，当前支持 `network / login-required / blocked / timeout / analysis / unknown`，前端必须映射成中文展示，不直接展示英文枚举。
- `recoverySuggestion`：由业务后端生成，面向用户说明下一步处理方式，不能包含 worker、采集器、堆栈、模型密钥或内部 payload。

`change_record.status`：

- `ready`：变化和 AI 分析已准备好。
- `failed`：检测失败或分析失败，需要在列表中可见，不能静默吞掉。

`change_record.changeType`：

- `homepage-copy`：首页文案变化。
- `visual-update`：视觉变化。
- `content-update`：内容变化兜底值，只能通过中文映射展示。
- `monitor-failed`：检测失败记录，前端展示为“检测失败”。

## 页面文案规则

竞品监控页面必须使用面向用户任务的中文文案：

- 保留：`竞品监控`、`概览`、`竞品库`、`监控任务`、`变化记录`、`分析报告`、`洞察库`、`监控对象`、`立即检测`、`保存为洞察`、`失败原因`。
- 禁止：`COMPETITOR MONITOR`、`COMPETITOR`、`Change Detail`。
- 禁止展示：`content-update`、`monitor-failed` 等原始枚举值。
- 禁止把“后端统一编排监控闭环”这类工程说明展示给用户。

## 开发接管建议

当前 Phase 1 由业务后端接管主流程，前端接管页面体验，这是最推荐的方案。

前端接管开发：

- 页面结构、二级 tab、列表/详情联动、表单校验、加载/空/错误状态。
- 枚举到中文的展示映射。
- 视觉设计合理化，减少无效字和工程文案。
- 暂停/恢复监控的入口，但不在本地伪造任务状态，必须等待后端 DTO 刷新。

后端接管开发：

- 输入校验、默认任务创建、检测状态转换、失败记录、变化详情聚合。
- 任务暂停/恢复校验、`nextRunAt` 排期计算和 `lastError` 清理。
- 真实采集/AI adapter 接入。当前本地后端通过 `captureRunner.makeCaptureResult` 接入网页采集，并在竞品监控 service 内归一化为 `page_snapshot`，前端不消费 capture runner 原始结构。
- 真实分析接入。当前本地后端通过 `createCompetitorAnalysisAdapter` 调用 workflow agent provider 生成结构化 `ai_analysis`；模型失败、非 JSON 或 provider 未配置时，后端使用 deterministic fallback，前端仍只消费 `analysis` DTO。
- AI 成本追踪：`ai_analysis` 由后端写入 `analysisProvider / analysisModel / analysisDurationMs / analysisTokenUsage / analysisFallbackUsed / analysisFallbackReason`；前端主界面不展示“分析记录、处理耗时、用量已记录”、prompt、原始响应、密钥、堆栈或 worker 调试信息。后续如做成本看板，应由后端单独提供受权限控制的治理 DTO。
- API 兼容性和错误码稳定性。

测试接管验收：

- 后端服务行为测试：创建竞品、任务状态、失败落库、错误码。
- 前端源守卫：无英文装饰眉标、无工程说明、无原始枚举直出。
- 构建验证：`npm --prefix frontend run build`。

## 开发执行清单

### 当前 Phase 1 必须收口

- 前端页面当前保留 `概览`、`竞品库`、`监控任务`、`变化记录`、`分析报告`、`洞察库`、`UI 参考` 七个可用入口；`UI 参考` 只展示后端聚合的真实截图、组件线索和视觉标签。
- 竞品库支持添加竞品、搜索竞品、选择竞品、查看默认监控状态、暂停/恢复监控、立即检测。
- 监控任务支持列表、搜索、任务详情、状态/频率/最近检测/下次执行展示、暂停/恢复和立即检测入口。
- 变化记录支持列表、搜索、严重度/状态中文展示、详情区截图、事实观察、AI 解读和设计建议。
- 分析报告支持列表、搜索、报告草稿详情、正式保存、Markdown 导出、分享有效期、撤销分享、报告要点和结构化章节展示；报告结论和分享权限由后端处理。
- 洞察库支持列表、搜索、洞察详情、分类选择、备注编辑、Markdown 导出和从变化详情保存洞察；洞察内容由后端从变化记录和 AI 分析生成，前端不本地编写结论。
- 页面顶部说明只讲用户价值，例如“跟踪竞品主页变化，沉淀可复盘的截图、摘要和分析”，不得展示工程链路说明。
- 所有枚举必须通过前端展示 helper 映射为中文，不允许在页面直出 `content-update`、`monitor-failed`、`active`、`paused`。
- 暂停任务后前端必须禁用“立即检测”，但状态真相以 `GET /api/monitor-tasks` 刷新结果为准。
- 检测失败时前端展示后端返回的可读失败原因，并保留重试/恢复入口，不吞掉失败记录。

### 后端给前端的数据

- `GET /api/competitor-monitor/overview` 给概览卡片数据，前端只渲染，不本地重算业务口径。
- `GET /api/competitor-monitor/permissions` 给当前账号的项目操作权限，前端只按 DTO 禁用按钮，不自行推导角色。
- `GET /api/competitors` 给竞品库列表，前端用 `competitor.id` 关联任务和变化记录。
- `GET /api/monitor-tasks` 给监控状态、频率、最近检测、下次执行、失败原因，前端不得用竞品字段推导任务状态。
- `POST /api/competitors/:id/check` 返回 `competitor`、`task`、公开 `snapshot` DTO、`change`、`analysis`，前端成功后刷新列表和详情。
- `GET /api/changes` 给变化记录列表，后端负责按项目/竞品过滤。
- `GET /api/changes/:id` 给变化详情聚合，包含 `change`、公开 `snapshot` DTO、`analysis`，前端不得再次拼接采集服务或模型原始输出，也不得读取网页正文原文。
- `GET /api/competitor-monitor/reports` 给分析报告草稿或已保存正式报告，后端负责从变化记录和 AI 分析生成章节。
- `POST /api/competitor-monitor/reports/:id/save` 把报告草稿保存为正式报告，后端负责持久化和幂等更新。
- `GET /api/competitor-monitor/reports/:id/export` 导出 Markdown，后端负责生成文件名和内容。
- 报告、洞察和批量洞察导出 Markdown 属于用户可见界面，后端必须把状态、分类、优先级转成中文业务标签，例如 `状态：已生成`、`分类：体验建议`、`优先级：高优先级`；不得导出 `ready / draft / product / strategy / high / medium` 等原始枚举。
- 导出 Markdown 不得包含 `analysisProvider / analysisModel / analysisTokenUsage`、模型名、token、prompt、payload、stack、worker 或 debug 字段；AI 成本字段只留在后端治理和稳定 DTO 中。
- `POST /api/competitor-monitor/reports/:id/share` 生成正式报告分享链接，后端负责分享状态、有效期、下载权限和链接字段。
- `POST /api/competitor-monitor/reports/:id/share/revoke` 撤销正式报告分享，后端负责关闭分享状态和记录撤销时间。
- `GET /api/competitor-monitor/reports/:id/shared` 按分享 token 读取公开报告，后端负责校验启用、撤销和过期状态。
- `GET /api/competitor-monitor/reports/:id/shared/export` 按分享 token 导出公开报告，后端负责校验 `shareAllowDownload`，前端不得自行放开下载。
- 外部访问页只展示公开报告、有效期和下载权限；链接无效、撤销、过期或不允许下载时，前端必须把 `COMPETITOR_REPORT_SHARE_*` 错误码映射成中文恢复建议，例如“请联系分享人重新生成链接”或“请联系分享人开启下载权限”，不得展示内部错误码。
- 分享访问统计由后端写入 `shareAccessCount / lastSharedAccessAt`，成功公开访问同时写入 `report-shared-accessed` 审计记录；前端只展示“访问次数”“最近访问”和操作记录，不在本地自增或伪造日志。
- `GET /api/competitor-monitor/audit-logs` 返回项目级操作记录，后端负责记录关键动作，前端只展示。
- `GET /api/competitor-monitor/reports/:id/versions` 返回报告版本历史，前端只展示。
- `GET /api/competitor-monitor/ui-references` 给 UI 参考聚合数据，后端负责从快照、变化、分析和洞察生成真实截图、组件线索和视觉标签。
- `GET /api/competitor-monitor/ui-reference-favorites` 给项目级 UI 参考收藏状态，前端只按 `referenceId` 标记收藏。
- `POST /api/competitor-monitor/ui-reference-favorites` 收藏 UI 参考，后端负责幂等和资料关系持久化。
- `DELETE /api/competitor-monitor/ui-reference-favorites/:id` 取消收藏 UI 参考，后端负责按项目过滤后删除。
- `GET /api/competitor-monitor/insights` 给洞察库列表，后端负责持久化、排序和项目过滤。
- `PATCH /api/competitor-monitor/insights/:id` 更新洞察分类和备注，后端负责项目归属校验和持久化。
- `PATCH /api/competitor-monitor/insights/batch` 批量整理洞察分类和备注，后端负责去重、项目归属校验和持久化。
- `POST /api/competitor-monitor/insights/:id/link-requirements` 把洞察关联到需求文档，后端负责双向关系写入。
- `GET /api/competitor-monitor/insights/:id/export` 导出洞察 Markdown，后端负责生成文件名和内容。
- `POST /api/competitor-monitor/insights/batch-export` 批量导出洞察 Markdown，后端负责生成汇总文件。
- `POST /api/competitor-monitor/insights/batch-deposit-knowledge` 批量沉淀洞察到知识库，后端负责去重、幂等和知识资料回写。
- `POST /api/changes/:id/save-as-insight` 把变化记录保存为洞察，前端只传 `projectId`、分类和备注。

### 前端继续开发边界

- 新页面入口放在 `frontend/src/pages/competitor-monitor/`。
- 新业务 UI 放在 `frontend/src/features/competitor-monitor/`。
- 共享基础组件才放 `frontend/src/components/base/`，不要把竞品监控业务组件放回 `frontend/src/components/competitor-monitor/`。
- API client 只维护在 `frontend/src/services/api.js`，展示 helper 只维护在 `frontend/src/services/competitorMonitor.js`。
- 设计和接口说明放 `docs/design/`，不要散落在根目录或页面组件注释里。

### 后端继续开发边界

- 领域模型只扩展 `backend/models/workspace.js` 或后续真实数据库模型层。
- 业务编排只放 `backend/services/competitor-monitor-service.js`。
- AI 分析适配只放 `backend/services/competitor-analysis-adapter.js`，不要让 route 直接拼 prompt。
- HTTP 路由只放 `backend/routes/competitors.js`，保持薄路由，不写业务状态机。
- 本地运行注入只放 `backend/server/mock-api.mjs`，后续接真实 worker 时替换 adapter，不改前端契约。

### 下一阶段计划

1. 分析报告增强：更细粒度章节编辑体验、分享访问日志、外部访问页和下载权限。
2. 洞察增强：批量整理、跨项目引用和关联选择器优化。
3. UI 参考：沉淀截图、页面类型、组件参考和视觉标签，服务设计师检索。
4. 权限与审计：项目成员权限、操作日志、AI 成本和采集失败追踪。

### 验收口径

- `rg -n "Competitor Monitor|COMPETITOR|Change Detail|后端统一编排监控闭环" frontend/src/features/competitor-monitor frontend/src/pages/competitor-monitor frontend/src/components/competitor-monitor -S` 不应命中页面源码。
- `node --test tests/competitor-default-sync.test.mjs tests/competitor-analysis-engine.test.mjs tests/competitor-analysis-ui.test.mjs` 覆盖主要竞品分析行为。
- `npm --prefix frontend run build` 必须通过。
