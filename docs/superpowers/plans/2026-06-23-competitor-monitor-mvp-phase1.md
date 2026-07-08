# Competitor Monitor MVP Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the competitor monitor Phase 1 closed loop inside the existing workspace app: create a competitor, auto-create a default monitor task, run a backend-owned manual check that persists snapshots/change/AI analysis, and render overview/library/change detail in the frontend.

**Architecture:** Extend the current `frontend + backend + tests` workspace instead of creating a second app. Backend owns the new competitor-monitor domain objects and product APIs, while the frontend mounts a dedicated competitor-monitor view under the existing `competitors` nav and consumes only backend-shaped DTOs. Phase 1 uses deterministic backend adapters for capture and AI so the full loop is testable now and replaceable later with real workers.

**Tech Stack:** Vue 3 SFCs, existing frontend service layer, Node ESM backend routes/services, workspace JSON store, root Node regression suite in `tests/workflows.test.mjs`

## Global Constraints

- Use `业务后端主导编排，前端做纯消费与轻交互，采集/AI 作为后端下游能力服务`.
- `业务状态真相只保存在业务后端`.
- `采集服务和 AI 服务是可替换能力，不直接定义用户看到的产品状态`.
- `前端消费统一业务对象，不拼接底层原始抓取结果和模型原始输出`.
- `任务型能力全部异步化，避免前端阻塞等待长耗时接口`.
- This plan implements only `Phase 1: Foundational Closed Loop`.
- `监控任务` 不建议一开始作为独立高心智 Tab，而是先收进竞品详情页或竞品详情抽屉中的一个区块。
- First version excludes login-state monitoring, browser plugins, Figma plugins, real-time monitoring, and advanced visual recognition.

## File Map

- Modify: `backend/models/workspace.js`
  - Add factories for `competitor`, `monitorTask`, `pageSnapshot`, `changeRecord`, and `aiAnalysis`.
- Modify: `backend/services/workspace-store.js`
  - Persist new domain collections and expose helper methods used by the competitor-monitor service.
- Create: `backend/services/competitor-monitor-service.js`
  - Own the Phase 1 orchestration: create competitor, create default monitor task, run deterministic capture, build change record, build AI analysis, and compute overview DTOs.
- Create: `backend/routes/competitors.js`
  - Expose product APIs for overview, competitor CRUD, change list/detail, and manual check trigger.
- Modify: `backend/server/mock-api.mjs`
  - Mount the competitor-monitor routes by injecting the workspace store and deterministic service handlers.
- Modify: `frontend/src/services/api.js`
  - Replace the single `check` helper with a complete competitor-monitor client.
- Create: `frontend/src/services/competitorMonitor.js`
  - Add pure frontend helpers for cards, tabs, severity/status labels, sorting, and summary syncing back into `state.competitors`.
- Create: `frontend/src/components/competitor-monitor/CompetitorMonitorView.vue`
  - Render the dedicated Phase 1 UI shell and own backend data loading for overview, competitor list, and changes.
- Create: `frontend/src/components/competitor-monitor/ChangeDetailPanel.vue`
  - Render the selected change detail with screenshot placeholders, diff summary, and AI analysis sections.
- Modify: `frontend/src/App.vue`
  - Replace the current inline competitor form/check logic with the dedicated competitor-monitor view and keep the global project-scoped `state.competitors` summary in sync.
- Modify: `frontend/src/styles.css`
  - Add Phase 1 competitor-monitor layout, cards, list, drawer, and status styles.
- Modify: `tests/workflows.test.mjs`
  - Add regression coverage for models, store snapshot, backend orchestration, API client methods, and frontend mount contract.
- Modify: `backend/README.md`
  - Document the new competitor-monitor product APIs and clarify that Phase 1 uses deterministic backend-owned capture/AI adapters.

---

### Task 1: Add competitor-monitor domain models and workspace persistence

**Files:**
- Modify: `backend/models/workspace.js`
- Modify: `backend/services/workspace-store.js`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: Existing `createDefaultWorkspaceStore()`, `workspaceSnapshot(store)`, and `persistStore(store)` behavior.
- Produces:
  - `createWorkspaceCompetitor(input = {})`
  - `createWorkspaceMonitorTask(input = {})`
  - `createWorkspacePageSnapshot(input = {})`
  - `createWorkspaceChangeRecord(input = {})`
  - `createWorkspaceAiAnalysis(input = {})`
  - `addCompetitor(store, payload)`, `listCompetitors(store, payload)`, `getCompetitor(store, id)`
  - `addMonitorTask(store, payload)`, `listMonitorTasks(store, payload)`
  - `addPageSnapshot(store, payload)`, `listPageSnapshots(store, payload)`
  - `addChangeRecord(store, payload)`, `listChangeRecords(store, payload)`, `getChangeRecord(store, id)`
  - `addAiAnalysis(store, payload)`, `getAiAnalysisByChangeId(store, changeId)`

- [ ] **Step 1: Write the failing test**

```js
import {
  createWorkspaceCompetitor,
  createWorkspaceMonitorTask,
  createWorkspacePageSnapshot,
  createWorkspaceChangeRecord,
  createWorkspaceAiAnalysis
} from '../backend/models/workspace.js'
import {
  createWorkspaceStore,
  workspaceSnapshot,
  addCompetitor,
  listCompetitors,
  addMonitorTask,
  listMonitorTasks,
  addPageSnapshot,
  listPageSnapshots,
  addChangeRecord,
  listChangeRecords,
  addAiAnalysis,
  getAiAnalysisByChangeId
} from '../backend/services/workspace-store.js'

testAsync('workspace store persists competitor monitor domain records', async () => {
  const workspace = createWorkspaceStore({ filePath: '' })
  const competitor = await addCompetitor(workspace, createWorkspaceCompetitor({
    id: 'competitor-notion',
    projectId: 'project-flow',
    name: 'Notion',
    websiteUrl: 'https://www.notion.so'
  }))
  await addMonitorTask(workspace, createWorkspaceMonitorTask({
    id: 'task-notion-home',
    projectId: 'project-flow',
    competitorId: competitor.id,
    url: 'https://www.notion.so',
    pageType: 'Homepage'
  }))
  const snapshot = await addPageSnapshot(workspace, createWorkspacePageSnapshot({
    id: 'snapshot-notion-home-1',
    projectId: 'project-flow',
    competitorId: competitor.id,
    taskId: 'task-notion-home',
    url: 'https://www.notion.so',
    title: 'Notion - Home'
  }))
  const change = await addChangeRecord(workspace, createWorkspaceChangeRecord({
    id: 'change-notion-home-1',
    projectId: 'project-flow',
    competitorId: competitor.id,
    taskId: 'task-notion-home',
    oldSnapshotId: 'snapshot-notion-home-0',
    newSnapshotId: snapshot.id,
    changeType: 'homepage-copy',
    severity: 'high'
  }))
  await addAiAnalysis(workspace, createWorkspaceAiAnalysis({
    id: 'analysis-notion-home-1',
    projectId: 'project-flow',
    competitorId: competitor.id,
    changeId: change.id,
    factualObservation: '首页主标题发生变化'
  }))

  const summary = workspaceSnapshot(workspace)

  assert.equal(listCompetitors(workspace, { projectId: 'project-flow' }).length, 1)
  assert.equal(listMonitorTasks(workspace, { projectId: 'project-flow' }).length, 1)
  assert.equal(listPageSnapshots(workspace, { projectId: 'project-flow' }).length, 1)
  assert.equal(listChangeRecords(workspace, { projectId: 'project-flow' }).length, 1)
  assert.equal(getAiAnalysisByChangeId(workspace, change.id).factualObservation, '首页主标题发生变化')
  assert.equal(summary.competitors[0].name, 'Notion')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/workflows.test.mjs`
Expected: FAIL with import or assertion errors because the competitor-monitor factories, store helpers, and snapshot collection do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
export function createWorkspaceCompetitor(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `competitor-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    module: 'competitors',
    name: input.name || '未命名竞品',
    websiteUrl: input.websiteUrl || '',
    status: input.status || 'active',
    notes: input.notes || '',
    tags: Array.isArray(input.tags) ? input.tags : [],
    lastCheckedAt: input.lastCheckedAt || '',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceMonitorTask(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `monitor-task-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    competitorId: input.competitorId || '',
    url: input.url || '',
    pageType: input.pageType || 'Homepage',
    frequency: input.frequency || 'weekly',
    status: input.status || 'active',
    lastRunAt: input.lastRunAt || '',
    nextRunAt: input.nextRunAt || '',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspacePageSnapshot(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `page-snapshot-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    competitorId: input.competitorId || '',
    taskId: input.taskId || '',
    url: input.url || '',
    title: input.title || '',
    textContent: input.textContent || '',
    screenshotUrl: input.screenshotUrl || '',
    status: input.status || 'succeeded',
    capturedAt: input.capturedAt || now,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceChangeRecord(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `change-record-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    competitorId: input.competitorId || '',
    taskId: input.taskId || '',
    oldSnapshotId: input.oldSnapshotId || '',
    newSnapshotId: input.newSnapshotId || '',
    changeType: input.changeType || 'content-update',
    changeSummary: input.changeSummary || '',
    diffText: input.diffText || '',
    severity: input.severity || 'medium',
    status: input.status || 'ready',
    detectedAt: input.detectedAt || now,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

export function createWorkspaceAiAnalysis(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `ai-analysis-${randomUUID()}`,
    projectId: input.projectId || 'project-flow',
    competitorId: input.competitorId || '',
    changeId: input.changeId || '',
    factualObservation: input.factualObservation || '',
    interpretation: input.interpretation || '',
    productImpact: input.productImpact || '',
    uxImpact: input.uxImpact || '',
    uiImpact: input.uiImpact || '',
    recommendation: input.recommendation || '',
    tags: Array.isArray(input.tags) ? input.tags : [],
    severitySuggestion: input.severitySuggestion || 'medium',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}
```

```js
export function createDefaultWorkspaceStore() {
  return {
    currentUserId: defaultUser.id,
    currentProjectId: 'project-flow',
    users: [defaultUser],
    projects: [defaultProject],
    assets: [],
    skillRuns: [],
    materials: [],
    restoredPages: [],
    workflowRuns: [],
    skills: [],
    settings: [],
    competitors: [],
    monitorTasks: [],
    pageSnapshots: [],
    changeRecords: [],
    aiAnalyses: []
  }
}

export async function addCompetitor(store, payload = {}) {
  const competitor = createWorkspaceCompetitor(payload)
  const index = store.competitors.findIndex((item) => item.id === competitor.id)
  if (index >= 0) store.competitors.splice(index, 1, competitor)
  else store.competitors.unshift(competitor)
  await persistStore(store)
  return competitor
}

export function listCompetitors(store, payload = {}) {
  const projectId = payload.projectId || ''
  return store.competitors.filter((item) => !projectId || item.projectId === projectId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/workflows.test.mjs`
Expected: PASS for `workspace store persists competitor monitor domain records`.

- [ ] **Step 5: Commit**

```bash
git add backend/models/workspace.js backend/services/workspace-store.js tests/workflows.test.mjs docs/superpowers/plans/2026-06-23-competitor-monitor-mvp-phase1.md
git commit -m "feat: add competitor monitor workspace domain models"
```

### Task 2: Add backend competitor-monitor orchestration service and product routes

**Files:**
- Create: `backend/services/competitor-monitor-service.js`
- Create: `backend/routes/competitors.js`
- Modify: `backend/server/mock-api.mjs`
- Modify: `backend/README.md`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes:
  - `addCompetitor`, `getCompetitor`, `addMonitorTask`, `listMonitorTasks`
  - `addPageSnapshot`, `listPageSnapshots`
  - `addChangeRecord`, `listChangeRecords`, `getChangeRecord`
  - `addAiAnalysis`, `getAiAnalysisByChangeId`
- Produces:
  - `createCompetitorMonitorService({ store, now, captureAdapter, aiAdapter })`
  - Service methods:
    - `getOverview({ projectId })`
    - `listCompetitors({ projectId })`
    - `createCompetitor(payload)`
    - `runCompetitorCheck({ competitorId, projectId })`
    - `listChanges({ projectId, competitorId })`
    - `getChangeDetail({ changeId, projectId })`
  - `competitorRoutes(handlers)` with:
    - `GET /api/competitor-monitor/overview`
    - `GET /api/competitors`
    - `POST /api/competitors`
    - `GET /api/competitors/:id`
    - `POST /api/competitors/:id/check`
    - `GET /api/changes`
    - `GET /api/changes/:id`

- [ ] **Step 1: Write the failing test**

```js
import { competitorRoutes } from '../backend/routes/competitors.js'
import { createCompetitorMonitorService } from '../backend/services/competitor-monitor-service.js'

testAsync('competitor monitor service creates default monitor task and ready change analysis', async () => {
  const workspace = createWorkspaceStore({ filePath: '' })
  const service = createCompetitorMonitorService({ store: workspace })

  const competitor = await service.createCompetitor({
    projectId: 'project-flow',
    name: 'Figma',
    websiteUrl: 'https://www.figma.com'
  })
  const check = await service.runCompetitorCheck({
    projectId: 'project-flow',
    competitorId: competitor.id
  })
  const overview = await service.getOverview({ projectId: 'project-flow' })
  const routes = competitorRoutes({
    getOverview: (payload) => service.getOverview(payload),
    listCompetitors: (payload) => service.listCompetitors(payload),
    createCompetitor: (payload) => service.createCompetitor(payload),
    getCompetitor: ({ id }) => service.getCompetitor({ competitorId: id }),
    runCompetitorCheck: ({ id, projectId }) => service.runCompetitorCheck({ competitorId: id, projectId }),
    listChanges: (payload) => service.listChanges(payload),
    getChangeDetail: ({ id, projectId }) => service.getChangeDetail({ changeId: id, projectId })
  })

  assert.equal(overview.metrics.activeCompetitors, 1)
  assert.equal(check.change.status, 'ready')
  assert.equal(check.analysis.factualObservation.length > 0, true)
  assert.ok(routes['GET /api/competitor-monitor/overview'])
  assert.ok(routes['POST /api/competitors/:id/check'])
  assert.ok(routes['GET /api/changes/:id'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/workflows.test.mjs`
Expected: FAIL because the competitor-monitor service and route module do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
import { randomUUID } from 'node:crypto'
import {
  addCompetitor,
  getCompetitor,
  addMonitorTask,
  listMonitorTasks,
  addPageSnapshot,
  listPageSnapshots,
  addChangeRecord,
  listChangeRecords,
  getChangeRecord,
  addAiAnalysis,
  getAiAnalysisByChangeId
} from './workspace-store.js'
import {
  createWorkspaceCompetitor,
  createWorkspaceMonitorTask,
  createWorkspacePageSnapshot,
  createWorkspaceChangeRecord,
  createWorkspaceAiAnalysis
} from '../models/workspace.js'

function deterministicCapture(competitor = {}, task = {}) {
  const stamp = new Date().toISOString().slice(0, 10)
  return {
    title: `${competitor.name} ${task.pageType}`,
    textContent: `${competitor.name} ${task.pageType} 文案更新于 ${stamp}`,
    screenshotUrl: `https://dummyimage.com/1200x800/f6f7f9/222529&text=${encodeURIComponent(competitor.name)}`
  }
}

function deterministicAiAnalysis(change = {}, competitor = {}) {
  return createWorkspaceAiAnalysis({
    competitorId: competitor.id,
    changeId: change.id,
    factualObservation: `${competitor.name} 首页主文案发生变化`,
    interpretation: '竞品正在强化当前首页定位表达。',
    productImpact: '需关注对方定位与卖点收敛方式。',
    uxImpact: '重点检查信息层级和 CTA 是否同步调整。',
    uiImpact: '视觉层暂按文案变化记录，不额外夸大 UI 结论。',
    recommendation: '把该变化加入后续产品/UX 对比清单。',
    tags: [change.changeType, change.severity],
    severitySuggestion: change.severity
  })
}

export function createCompetitorMonitorService({ store, now = () => new Date().toISOString() } = {}) {
  return {
    async getOverview({ projectId }) {
      const competitors = await this.listCompetitors({ projectId })
      const changes = await this.listChanges({ projectId })
      return {
        metrics: {
          activeCompetitors: competitors.length,
          weeklyChanges: changes.length,
          highSeverityChanges: changes.filter((item) => item.severity === 'high').length,
          pendingAnalyses: changes.filter((item) => item.status !== 'ready').length
        },
        importantChanges: changes.slice(0, 5),
        recentReports: [],
        pendingInsights: []
      }
    },

    async listCompetitors({ projectId }) {
      return listCompetitors(store, { projectId })
    },

    async getCompetitor({ competitorId }) {
      return getCompetitor(store, competitorId)
    },

    async createCompetitor(payload = {}) {
      const competitor = await addCompetitor(store, createWorkspaceCompetitor(payload))
      await addMonitorTask(store, createWorkspaceMonitorTask({
        projectId: competitor.projectId,
        competitorId: competitor.id,
        url: competitor.websiteUrl,
        pageType: 'Homepage'
      }))
      return competitor
    },

    async runCompetitorCheck({ competitorId, projectId }) {
      const competitor = getCompetitor(store, competitorId)
      const task = listMonitorTasks(store, { projectId, competitorId })[0]
      const currentCapture = deterministicCapture(competitor, task)
      const previousSnapshot = listPageSnapshots(store, { projectId, competitorId })[0] || null
      const snapshot = await addPageSnapshot(store, createWorkspacePageSnapshot({
        id: `page-snapshot-${randomUUID()}`,
        projectId,
        competitorId,
        taskId: task.id,
        url: task.url,
        title: currentCapture.title,
        textContent: currentCapture.textContent,
        screenshotUrl: currentCapture.screenshotUrl,
        capturedAt: now()
      }))
      const change = await addChangeRecord(store, createWorkspaceChangeRecord({
        projectId,
        competitorId,
        taskId: task.id,
        oldSnapshotId: previousSnapshot?.id || '',
        newSnapshotId: snapshot.id,
        changeType: 'homepage-copy',
        changeSummary: `${competitor.name} 首页监控发现新变化`,
        diffText: previousSnapshot ? `${previousSnapshot.textContent}\n---\n${snapshot.textContent}` : snapshot.textContent,
        severity: previousSnapshot ? 'medium' : 'high',
        status: 'ready',
        detectedAt: now()
      }))
      const analysis = await addAiAnalysis(store, deterministicAiAnalysis(change, competitor))
      return { competitor, snapshot, change, analysis }
    },

    async listChanges({ projectId, competitorId = '' }) {
      return listChangeRecords(store, { projectId, competitorId })
    },

    async getChangeDetail({ changeId }) {
      const change = getChangeRecord(store, changeId)
      return {
        change,
        analysis: getAiAnalysisByChangeId(store, change.id)
      }
    }
  }
}
```

```js
function requiredHandler(handlers = {}, name = '') {
  if (typeof handlers[name] === 'function') return handlers[name]
  return async () => {
    throw new Error(`Competitor route handler is not configured: ${name}`)
  }
}

export function competitorRoutes(handlers = {}) {
  const getOverview = requiredHandler(handlers, 'getOverview')
  const listCompetitors = requiredHandler(handlers, 'listCompetitors')
  const createCompetitor = requiredHandler(handlers, 'createCompetitor')
  const getCompetitor = requiredHandler(handlers, 'getCompetitor')
  const runCompetitorCheck = requiredHandler(handlers, 'runCompetitorCheck')
  const listChanges = requiredHandler(handlers, 'listChanges')
  const getChangeDetail = requiredHandler(handlers, 'getChangeDetail')

  return {
    'GET /api/competitor-monitor/overview': async (payload = {}) => getOverview(payload),
    'GET /api/competitors': async (payload = {}) => listCompetitors(payload),
    'POST /api/competitors': async (payload = {}) => createCompetitor(payload),
    'GET /api/competitors/:id': async (payload = {}) => getCompetitor(payload),
    'POST /api/competitors/:id/check': async (payload = {}) => runCompetitorCheck(payload),
    'GET /api/changes': async (payload = {}) => listChanges(payload),
    'GET /api/changes/:id': async (payload = {}) => getChangeDetail(payload)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/workflows.test.mjs`
Expected: PASS for `competitor monitor service creates default monitor task and ready change analysis`.

- [ ] **Step 5: Commit**

```bash
git add backend/services/competitor-monitor-service.js backend/routes/competitors.js backend/server/mock-api.mjs backend/README.md tests/workflows.test.mjs
git commit -m "feat: add competitor monitor backend phase 1 routes"
```

### Task 3: Replace the frontend competitor API stub with a full product client and pure view helpers

**Files:**
- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/services/competitorMonitor.js`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes:
  - `GET /api/competitor-monitor/overview`
  - `GET /api/competitors`
  - `POST /api/competitors`
  - `POST /api/competitors/:id/check`
  - `GET /api/changes`
  - `GET /api/changes/:id`
- Produces:
  - `api.competitors.getOverview(config, projectId)`
  - `api.competitors.list(config, projectId)`
  - `api.competitors.create(config, payload)`
  - `api.competitors.get(config, id, projectId)`
  - `api.competitors.check(config, id, payload)`
  - `api.competitors.listChanges(config, payload)`
  - `api.competitors.getChange(config, id, projectId)`
  - `buildCompetitorOverviewCards(overview)`
  - `buildCompetitorWorkspaceSummary(competitors)`
  - `severityLabel(severity)`
  - `changeStatusLabel(status)`
  - `sortChangesByDetectedAt(changes)`

- [ ] **Step 1: Write the failing test**

```js
import {
  buildCompetitorOverviewCards,
  buildCompetitorWorkspaceSummary,
  severityLabel,
  changeStatusLabel,
  sortChangesByDetectedAt
} from '../frontend/src/services/competitorMonitor.js'

testAsync('frontend competitor monitor helpers expose overview cards and summary rows', async () => {
  const apiSource = await readFile(new URL('../frontend/src/services/api.js', import.meta.url), 'utf8')
  assert.match(apiSource, /getOverview\(config, projectId\)/)
  assert.match(apiSource, /list\(config, projectId\)/)
  assert.match(apiSource, /create\(config, payload\)/)
  assert.match(apiSource, /listChanges\(config, payload\)/)
  assert.match(apiSource, /getChange\(config, id, projectId\)/)

  const overviewCards = buildCompetitorOverviewCards({
    metrics: {
      activeCompetitors: 3,
      weeklyChanges: 9,
      highSeverityChanges: 2,
      pendingAnalyses: 1
    }
  })
  const workspaceRows = buildCompetitorWorkspaceSummary([{
    id: 'competitor-figma',
    projectId: 'project-flow',
    name: 'Figma',
    websiteUrl: 'https://www.figma.com',
    status: 'active'
  }])
  const sorted = sortChangesByDetectedAt([
    { id: 'old', detectedAt: '2026-06-22T08:00:00.000Z' },
    { id: 'new', detectedAt: '2026-06-23T08:00:00.000Z' }
  ])

  assert.deepEqual(overviewCards.map((item) => item.key), ['activeCompetitors', 'weeklyChanges', 'highSeverityChanges', 'pendingAnalyses'])
  assert.equal(workspaceRows[0].title, 'Figma')
  assert.equal(severityLabel('high'), '高优先级')
  assert.equal(changeStatusLabel('ready'), '已就绪')
  assert.equal(sorted[0].id, 'new')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/workflows.test.mjs`
Expected: FAIL because the helper module and expanded API client do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
competitors: {
  getOverview(config, projectId) {
    return request(config.competitorBaseUrl || config.apiBaseUrl, `/api/competitor-monitor/overview?projectId=${encodeURIComponent(projectId)}`)
  },
  list(config, projectId) {
    return request(config.competitorBaseUrl || config.apiBaseUrl, `/api/competitors?projectId=${encodeURIComponent(projectId)}`)
  },
  create(config, payload) {
    return request(config.competitorBaseUrl || config.apiBaseUrl, '/api/competitors', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  get(config, id, projectId) {
    return request(config.competitorBaseUrl || config.apiBaseUrl, `/api/competitors/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`)
  },
  check(config, id, payload) {
    return request(config.competitorBaseUrl || config.apiBaseUrl, `/api/competitors/${encodeURIComponent(id)}/check`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  listChanges(config, payload = {}) {
    const params = new URLSearchParams({
      projectId: payload.projectId || '',
      competitorId: payload.competitorId || ''
    })
    return request(config.competitorBaseUrl || config.apiBaseUrl, `/api/changes?${params.toString()}`)
  },
  getChange(config, id, projectId) {
    return request(config.competitorBaseUrl || config.apiBaseUrl, `/api/changes/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`)
  }
}
```

```js
export function buildCompetitorOverviewCards(overview = {}) {
  const metrics = overview.metrics || {}
  return [
    { key: 'activeCompetitors', label: '监控竞品数', value: metrics.activeCompetitors || 0 },
    { key: 'weeklyChanges', label: '本周变化数', value: metrics.weeklyChanges || 0 },
    { key: 'highSeverityChanges', label: '高优先级变化', value: metrics.highSeverityChanges || 0 },
    { key: 'pendingAnalyses', label: '待处理分析', value: metrics.pendingAnalyses || 0 }
  ]
}

export function buildCompetitorWorkspaceSummary(competitors = []) {
  return competitors.map((item) => ({
    id: item.id,
    projectId: item.projectId,
    title: item.name,
    meta: item.websiteUrl,
    status: item.status === 'active' ? '监控中' : '待监控',
    notes: item.notes || ''
  }))
}

export function severityLabel(severity = '') {
  return severity === 'high' ? '高优先级' : severity === 'low' ? '低优先级' : '中优先级'
}

export function changeStatusLabel(status = '') {
  return status === 'ready' ? '已就绪' : status === 'analyzing' ? '分析中' : status === 'failed' ? '失败' : '待检测'
}

export function sortChangesByDetectedAt(changes = []) {
  return [...changes].sort((a, b) => new Date(b.detectedAt || 0) - new Date(a.detectedAt || 0))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/workflows.test.mjs`
Expected: PASS for `frontend competitor monitor helpers expose overview cards and summary rows`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/api.js frontend/src/services/competitorMonitor.js tests/workflows.test.mjs
git commit -m "feat: add competitor monitor frontend api client"
```

### Task 4: Mount the dedicated competitor-monitor Phase 1 UI in the existing app

**Files:**
- Create: `frontend/src/components/competitor-monitor/CompetitorMonitorView.vue`
- Create: `frontend/src/components/competitor-monitor/ChangeDetailPanel.vue`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/styles.css`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes:
  - `api.competitors.getOverview(config, projectId)`
  - `api.competitors.list(config, projectId)`
  - `api.competitors.create(config, payload)`
  - `api.competitors.check(config, id, payload)`
  - `api.competitors.listChanges(config, payload)`
  - `api.competitors.getChange(config, id, projectId)`
  - `buildCompetitorOverviewCards(overview)`
  - `buildCompetitorWorkspaceSummary(competitors)`
  - `severityLabel(severity)`
  - `changeStatusLabel(status)`
- Produces:
  - `<CompetitorMonitorView :api-config="state.apiConfig" :project-id="state.currentProjectId" @sync-competitors="syncWorkspaceCompetitors" />`
  - Emits: `sync-competitors(summaryRows: Array<{ id, projectId, title, meta, status, notes }>)`

- [ ] **Step 1: Write the failing test**

```js
testAsync('app mounts dedicated competitor monitor view under competitors tab', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const viewSource = await readFile(new URL('../frontend/src/components/competitor-monitor/CompetitorMonitorView.vue', import.meta.url), 'utf8')
  const detailSource = await readFile(new URL('../frontend/src/components/competitor-monitor/ChangeDetailPanel.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(appSource, /import CompetitorMonitorView from '.\/components\/competitor-monitor\/CompetitorMonitorView.vue'/)
  assert.match(appSource, /<CompetitorMonitorView[\s\S]*@sync-competitors="syncWorkspaceCompetitors"/)
  assert.match(appSource, /function syncWorkspaceCompetitors\(items = \[\]\)/)

  assert.match(viewSource, /概览/)
  assert.match(viewSource, /竞品库/)
  assert.match(viewSource, /变化记录/)
  assert.match(viewSource, /function handleCreateCompetitor\(\)/)
  assert.match(viewSource, /function handleRunCheck\(competitorId\)/)
  assert.match(viewSource, /function handleSelectChange\(changeId\)/)

  assert.match(detailSource, /事实观察/)
  assert.match(detailSource, /AI 解读/)
  assert.match(detailSource, /设计建议/)

  assert.match(styles, /\.competitor-monitor-view/)
  assert.match(styles, /\.competitor-change-detail/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/workflows.test.mjs`
Expected: FAIL because the dedicated competitor-monitor components and App mount hook do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```vue
<template>
  <section class="competitor-monitor-view">
    <header class="competitor-monitor-header">
      <div>
        <p class="eyebrow">Competitor Monitor</p>
        <h2>竞品监控</h2>
        <span>持续追踪竞品页面变化并生成结构化分析。</span>
      </div>
      <div class="competitor-monitor-actions">
        <button type="button" @click="handleCreateCompetitor">添加竞品</button>
      </div>
    </header>

    <nav class="competitor-monitor-tabs">
      <button v-for="item in tabs" :key="item.key" type="button" :class="{ active: activeTab === item.key }" @click="activeTab = item.key">
        {{ item.label }}
      </button>
    </nav>

    <section v-if="activeTab === 'overview'" class="competitor-monitor-overview">
      <article v-for="card in overviewCards" :key="card.key" class="competitor-overview-card">
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </article>
    </section>

    <section v-else-if="activeTab === 'library'" class="competitor-monitor-library">
      <form class="competitor-form" @submit.prevent="handleCreateCompetitor">
        <input v-model="form.name" placeholder="竞品名称" />
        <input v-model="form.websiteUrl" placeholder="官网 URL" />
        <textarea v-model="form.notes" placeholder="关注点 / 备注"></textarea>
        <button class="primary" type="submit">添加并创建默认监控</button>
      </form>
      <button v-for="item in competitors" :key="item.id" type="button" class="competitor-list-item" @click="handleRunCheck(item.id)">
        <strong>{{ item.name }}</strong>
        <span>{{ item.websiteUrl }}</span>
      </button>
    </section>

    <section v-else class="competitor-monitor-changes">
      <button v-for="item in changes" :key="item.id" type="button" class="competitor-change-row" @click="handleSelectChange(item.id)">
        <strong>{{ item.changeSummary }}</strong>
        <span>{{ severityLabel(item.severity) }} · {{ changeStatusLabel(item.status) }}</span>
      </button>
      <ChangeDetailPanel :detail="selectedChangeDetail" />
    </section>
  </section>
</template>
```

```js
function syncWorkspaceCompetitors(items = []) {
  const projectId = state.currentProjectId
  const otherProjects = state.competitors.filter((item) => item.projectId !== projectId)
  state.competitors = [...items, ...otherProjects]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/workflows.test.mjs`
Expected: PASS for `app mounts dedicated competitor monitor view under competitors tab`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/competitor-monitor/CompetitorMonitorView.vue frontend/src/components/competitor-monitor/ChangeDetailPanel.vue frontend/src/App.vue frontend/src/styles.css tests/workflows.test.mjs
git commit -m "feat: mount competitor monitor phase 1 workspace ui"
```

### Task 5: Run the full Phase 1 flow regression and document the deterministic handoff seams

**Files:**
- Modify: `tests/workflows.test.mjs`
- Modify: `backend/README.md`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes:
  - `createCompetitorMonitorService`
  - `api.competitors.*`
  - `CompetitorMonitorView.vue`
- Produces:
  - One end-to-end regression that exercises the in-memory service flow.
  - README notes for replacing deterministic adapters with real capture/AI workers later without changing product APIs.

- [ ] **Step 1: Write the failing test**

```js
testAsync('competitor monitor phase 1 flow stays backend-owned end to end', async () => {
  const workspace = createWorkspaceStore({ filePath: '' })
  const service = createCompetitorMonitorService({ store: workspace })

  const competitor = await service.createCompetitor({
    projectId: 'project-flow',
    name: 'Linear',
    websiteUrl: 'https://linear.app'
  })
  await service.runCompetitorCheck({ projectId: 'project-flow', competitorId: competitor.id })

  const overview = await service.getOverview({ projectId: 'project-flow' })
  const competitors = await service.listCompetitors({ projectId: 'project-flow' })
  const changes = await service.listChanges({ projectId: 'project-flow' })
  const detail = await service.getChangeDetail({ projectId: 'project-flow', changeId: changes[0].id })
  const readme = await readFile(new URL('../backend/README.md', import.meta.url), 'utf8')

  assert.equal(overview.metrics.activeCompetitors, 1)
  assert.equal(competitors[0].name, 'Linear')
  assert.equal(changes[0].status, 'ready')
  assert.equal(detail.analysis.recommendation.length > 0, true)
  assert.match(readme, /GET  \/api\/competitor-monitor\/overview/)
  assert.match(readme, /Phase 1 uses deterministic backend-owned capture\/AI adapters/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/workflows.test.mjs`
Expected: FAIL until the README documents the new APIs and the deterministic Phase 1 handoff note.

- [ ] **Step 3: Write minimal implementation**

```md
GET  /api/competitor-monitor/overview
GET  /api/competitors
POST /api/competitors
GET  /api/competitors/:id
POST /api/competitors/:id/check
GET  /api/changes
GET  /api/changes/:id
```

```md
Phase 1 uses deterministic backend-owned capture/AI adapters so the closed loop is testable before real workers are wired in. When real capture or AI workers are ready, replace only the service adapters inside `backend/services/competitor-monitor-service.js`; do not change the frontend product contract.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/workflows.test.mjs`
Expected: PASS, with the Phase 1 flow proving that competitor creation, default task creation, snapshot/change persistence, and AI analysis stay backend-owned.

- [ ] **Step 5: Commit**

```bash
git add tests/workflows.test.mjs backend/README.md
git commit -m "docs: finalize competitor monitor phase 1 handoff contract"
```

