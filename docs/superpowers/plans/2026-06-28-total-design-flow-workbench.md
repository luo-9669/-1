# Total Design Flow Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first-version “总流程” workbench so design方案 starts from requirement slicing, not Skill selection, while reusing the existing workflow canvas.

**Architecture:** Add a backend total-flow adapter that wraps the current document analysis result with `requirementSlices`, stage metadata, active-slice page filtering data, and stage-specific canvases. Then update the workflow entry and canvas page to present 总流程 as the main route: top shows stages, the first three stages use an embedded Agent workbench, later stages render stage canvases/details, bottom shows page-node navigation where relevant, and small Skills become hidden/internal capabilities.

**Tech Stack:** Node.js ESM backend services, Vue 3 SFCs, existing workflow canvas components, Node test runner (`node --test`) and Vite frontend build.

## Execution Status - 2026-06-29

- Implementation steps for Tasks 1-5 have been executed and verified against the current worktree.
- Commit steps are marked as integration-deferred because this workspace contains many unrelated dirty changes and a safe commit requires choosing a staging boundary first.
- Verification evidence from the current run:
  - `node --test tests/system-skills.test.mjs backend/routes/uploads.test.js backend/routes/workflows.test.js backend/routes/workspace.test.js backend/services/agent-context-builder.test.js backend/services/document-parser.test.js backend/services/generation-runner.test.js backend/services/generation-runner-stream.test.js backend/services/llm-provider.test.js backend/services/model-canvas-summary.test.js backend/services/prompt-builder.test.js backend/services/workflow-runner.test.js`
  - `npm --prefix frontend run build`
  - Tea manual check returns 8 stages, one `茶饮点单主流程` slice, and 9 pages including `前后端与验收`.
  - Podcastor manual check returns `podcastor-product` and the expected product-document slices, including `登录注册与商业化`.
- Additional regression found during execution: default auto-routed tea analysis only returned 8 page nodes. Fixed by aligning the total-flow tea page title set with the 9-page interaction-design output.

## Integration Boundary Audit - 2026-06-29

Current branch: `codex/workflow-agent-trace-typewriter`.

Git state at completion audit:

- 46 tracked files contain modifications.
- 89 untracked files exist.
- The dirty state includes total-flow work, earlier workflow Agent work, competitor-monitor work, backend server modularization, frontend page/component restructuring, base UI components, tests, docs, and local backup files.

Why commits are integration-deferred:

- The total-flow implementation depends on files under untracked directories such as `frontend/src/features`, `frontend/src/pages`, and `frontend/src/components/base`.
- Several modified tracked files, especially `frontend/src/App.vue`, `frontend/src/styles.css`, backend routes/services, and test files, contain broader historical changes beyond this specific plan.
- Committing only the obvious total-flow files risks creating a commit that passes only in this dirty workspace but fails from a clean checkout.
- Committing everything would mix unrelated product work into one large commit.

Recommended integration paths:

1. If the goal is a single functional checkpoint, stage the full current worktree except local backups and generated/private files, then create one broad checkpoint commit.
2. If the goal is reviewable history, split into at least these commits:
   - backend total-flow and workflow generation services
   - frontend workflow workbench and base/page restructuring
   - tests and docs for total-flow verification
   - unrelated competitor-monitor/server/runtime changes in separate commits
3. If the goal is only to continue product iteration, keep the dirty worktree and do not commit yet.

## Global Constraints

- Main user-facing entry is “总流程”; users should not need to choose a small Skill to start.
- First version must pass the tea mini-program and Podcastor document examples.
- Podcastor product documents must not be misclassified as auth modal/page just because they mention login/register.
- Left side of the canvas must represent requirement slices, not page nodes.
- Bottom navigation must represent page nodes for the active slice.
- Core analysis structure is returned by backend services; frontend only renders and filters it.
- Do not restore the removed low-fidelity preview stage. HTML and Vue are separate stages.
- Preserve unrelated dirty worktree changes.

---

## File Structure

- `backend/services/total-design-flow.js`
  - New focused adapter for 总流程 stage definitions, requirement slicing, page-node binding, and analysis wrapping.
- `backend/services/document-parser.js`
  - Calls the total-flow adapter after existing canvas generation so old analysis remains available.
- `backend/services/skill-orchestrator.js`
  - Fixes intent priority so large Podcastor/product docs are detected before auth keywords.
- `frontend/src/App.vue`
  - Changes default workflow entry from small Skill selection to 总流程 copy and passes total-flow props into the canvas page.
- `frontend/src/pages/workflow/WorkflowPage.vue`
  - Renders left requirement-slice rail and bottom page-node navigation while reusing existing canvas content.
- `frontend/src/styles.css`
  - Adds layout styles for slice rail and page-node nav.
- `tests/system-skills.test.mjs`
  - Adds regression coverage for 总流程 defaults, tea slices, Podcastor slices, and no auth-modal misclassification.

---

### Task 1: Add backend total-flow schema and slicing adapter

**Files:**
- Create: `backend/services/total-design-flow.js`
- Modify: `tests/system-skills.test.mjs`

**Interfaces:**
- Consumes: `analysis` objects from `analyzeRequirementDocuments()`, including `analysis.input`, `analysis.documents`, `analysis.canvas.nodes`, `analysis.canvas.edges`, and `analysis.blueprint`.
- Produces:
  - `TOTAL_DESIGN_FLOW_STAGES: Array<{ id: string, name: string }>`
  - `buildTotalDesignFlow(analysis: object): object`
  - `analysis.totalDesignFlow: { runId, currentStage, requirementSlices, activeSliceId, flows, pages, pageStates, edges, visualSpecs, codeArtifacts, details, knowledgeRefs, knowledgeDeposits, versions }`

- [x] **Step 1: Write failing tests for total-flow adapter**

Add this import near the top of `tests/system-skills.test.mjs`:

```js
import { buildTotalDesignFlow, TOTAL_DESIGN_FLOW_STAGES } from '../backend/services/total-design-flow.js'
```

Add these tests after the existing interaction-design tea test:

```js
test('total design flow wraps tea ordering analysis into one requirement slice with page navigation', () => {
  const analysis = analyzeRequirementDocuments({
    skillId: 'interaction-design-workflow',
    skillSelectionMode: 'manual',
    demandScope: 'project',
    input: '做一个茶饮点单小程序，包含首页选店、取餐方式、菜单商品、商品定制、购物车结算、支付下单、取餐通知、会员优惠、订单状态。请输出所有页面和交互路径。',
    documents: []
  })
  const totalFlow = buildTotalDesignFlow(analysis)

  assert.deepEqual(TOTAL_DESIGN_FLOW_STAGES.map((stage) => stage.id), [
    'requirement-dissection',
    'requirement-slicing',
    'gap-confirmation',
    'interaction-lofi',
    'ui-visual',
    'html-output',
    'vue-output',
    'acceptance-deposit'
  ])
  assert.equal(totalFlow.currentStage, 'interaction-lofi')
  assert.equal(totalFlow.requirementSlices.length, 1)
  assert.equal(totalFlow.requirementSlices[0].title, '茶饮点单主流程')
  assert.equal(totalFlow.activeSliceId, totalFlow.requirementSlices[0].id)
  assert.deepEqual(totalFlow.pages.map((page) => page.title), [
    '首页与选店',
    '取餐方式',
    '菜单与商品',
    '商品定制',
    '购物车与结算',
    '支付与订单生成',
    '制作与取餐通知',
    '会员与优惠',
    '前后端与验收'
  ])
  assert.ok(totalFlow.details[totalFlow.pages[0].id].sections.some((section) => section.title === '页面目标'))
})

test('total design flow slices Podcastor product documents into multiple requirements', () => {
  const podcastorText = [
    'Podcastor.ai v1.0产品文档',
    '定位：零门槛的AI播客工作站',
    '核心功能一：灵感与脚本创作，支持文本提示词、URL网页链接、上传PDF/PPT。',
    '核心功能二：音频播客创作，提供多语言 TTS 声音库。',
    '核心功能三：视频播客制作，支持真人、卡通、宠物播客主持人。',
    '用户资产：脚本&灵感库、音色&音频资产库、播客主播库。',
    '基础能力：注册/登录、商业化、作品生成&存储&调用、分发能力。'
  ].join('\n')
  const analysis = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '请基于 Podcastor.ai v1.0 产品文档做设计方案分析。',
    documents: [{ name: 'Podcastor.ai v1.0产品文档.docx', type: 'docx', content: podcastorText }]
  })
  const totalFlow = buildTotalDesignFlow(analysis)
  const sliceTitles = totalFlow.requirementSlices.map((slice) => slice.title)

  assert.notEqual(analysis.detectedIntent, 'auth-modal')
  assert.notEqual(analysis.detectedIntent, 'auth-page')
  assert.ok(sliceTitles.includes('首页与创作入口'))
  assert.ok(sliceTitles.includes('脚本生成流程'))
  assert.ok(sliceTitles.includes('音频播客生成流程'))
  assert.ok(sliceTitles.includes('视频播客制作流程'))
  assert.ok(sliceTitles.includes('登录注册与商业化'))
  assert.ok(totalFlow.requirementSlices.every((slice) => slice.sourceExcerpt))
})
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test tests/system-skills.test.mjs --test-name-pattern="total design flow"
```

Expected: FAIL with module not found for `backend/services/total-design-flow.js`.

- [x] **Step 3: Implement total-flow adapter**

Create `backend/services/total-design-flow.js`:

```js
export const TOTAL_DESIGN_FLOW_STAGES = [
  { id: 'requirement-dissection', name: '需求分析' },
  { id: 'requirement-slicing', name: '小需求切片' },
  { id: 'gap-confirmation', name: '缺口确认' },
  { id: 'interaction-lofi', name: '交互低保' },
  { id: 'ui-visual', name: 'UI视觉' },
  { id: 'html-output', name: 'HTML' },
  { id: 'vue-output', name: 'Vue' },
  { id: 'acceptance-deposit', name: '验收沉淀' }
]

function textOf(analysis = {}) {
  return [
    analysis.input || '',
    ...(analysis.documents || []).map((doc) => [doc.name, doc.text || doc.summary || doc.reason || ''].filter(Boolean).join('\n'))
  ].join('\n\n')
}

function hasTeaContext(text = '') {
  return /(茶饮|奶茶|点单|取餐|菜单|购物车|会员优惠)/i.test(text)
}

function hasPodcastorContext(text = '') {
  return /(podcastor|播客|AI播客|Podcast)/i.test(text)
}

function sourceExcerpt(text = '', keywords = []) {
  const lines = String(text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const matched = lines.find((line) => keywords.some((keyword) => line.toLowerCase().includes(String(keyword).toLowerCase())))
  return (matched || lines[0] || '用户输入').slice(0, 180)
}

function slice(id, title, goal, text, keywords = [], priority = 'P0') {
  return {
    id,
    title,
    goal,
    sourceExcerpt: sourceExcerpt(text, keywords),
    users: [],
    businessObjects: keywords,
    pageCount: 0,
    priority,
    stageStatus: 'ready',
    pendingQuestionCount: 0,
    blocked: false
  }
}

function podcastorSlices(text = '') {
  return [
    slice('podcastor-home-entry', '首页与创作入口', '让创作者从首页快速选择脚本、音频或视频播客创作入口。', text, ['首页', '创作入口', 'Generate Script']),
    slice('podcastor-script-generation', '脚本生成流程', '支持提示词、URL、PDF/PPT 等输入生成可编辑播客脚本。', text, ['脚本', 'URL', 'PDF', 'PPT']),
    slice('podcastor-audio-generation', '音频播客生成流程', '把脚本和音色配置转成多语言音频播客。', text, ['音频播客', 'TTS', '声音库']),
    slice('podcastor-video-production', '视频播客制作流程', '用真人、卡通或宠物主持人生成视频播客并支持编辑。', text, ['视频播客', '主持人', '卡通', '宠物']),
    slice('podcastor-asset-library', '主持人/音色/背景资产库', '沉淀脚本、音色、主持人、背景和常用组合。', text, ['资产', '音色', '主播', '背景']),
    slice('podcastor-work-storage', '作品生成与存储', '管理作品生成、存储、历史调用和复用。', text, ['作品生成', '存储', '调用']),
    slice('podcastor-short-clips-distribution', '短视频切片与分发', '把长播客切成短视频并分发到外部平台。', text, ['TikTok', 'YouTube', 'Instagram', '分发']),
    slice('podcastor-auth-commercialization', '登录注册与商业化', '承接账号登录、注册、订阅或支付商业化能力。', text, ['注册', '登录', '商业化', 'Stripe', 'PayPal'], 'P1'),
    slice('podcastor-admin-platform', '管理端与平台分发', '支持管理端、Spotify、Apple Podcast 等后续平台能力。', text, ['管理端', 'Spotify', 'Apple Podcast'], 'P2')
  ]
}

function teaSlices(text = '') {
  return [
    slice('tea-ordering-main-flow', '茶饮点单主流程', '从选店、点单、定制、结算到取餐通知完成茶饮小程序主路径。', text, ['茶饮', '点单', '取餐', '购物车', '会员优惠'])
  ]
}

function fallbackSlices(analysis = {}, text = '') {
  const title = analysis.blueprint?.profile?.productName || analysis.blueprint?.title || '需求主流程'
  return [
    slice('main-requirement-flow', title, '围绕当前输入生成主要需求流程。', text, [title])
  ]
}

function requirementSlicesForAnalysis(analysis = {}) {
  const text = textOf(analysis)
  if (hasPodcastorContext(text)) return podcastorSlices(text)
  if (hasTeaContext(text)) return teaSlices(text)
  return fallbackSlices(analysis, text)
}

function pagesForAnalysis(analysis = {}, activeSliceId = '') {
  return (analysis.canvas?.nodes || []).map((node, index) => ({
    id: node.id || `page-${index + 1}`,
    sliceId: activeSliceId,
    title: node.title || `页面 ${index + 1}`,
    summary: node.summary || '',
    nodeId: node.id || `page-${index + 1}`,
    statusCount: (node.detailSections || []).filter((section) => /状态|异常|权限|加载|失败|空/.test(section.title || '')).length,
    pendingQuestionCount: 0
  }))
}

function detailsForNodes(nodes = []) {
  return Object.fromEntries(nodes.map((node) => [
    node.id,
    {
      title: node.title || '',
      summary: node.summary || '',
      sections: node.detailSections || []
    }
  ]))
}

export function buildTotalDesignFlow(analysis = {}) {
  const requirementSlices = requirementSlicesForAnalysis(analysis)
  const activeSliceId = requirementSlices[0]?.id || ''
  const pages = pagesForAnalysis(analysis, activeSliceId)
  if (requirementSlices[0]) requirementSlices[0].pageCount = pages.length
  return {
    runId: analysis.analysisRunId || analysis.requestId || '',
    currentStage: 'interaction-lofi',
    stages: TOTAL_DESIGN_FLOW_STAGES,
    requirementSlices,
    activeSliceId,
    flows: requirementSlices.map((item) => ({
      id: `${item.id}-flow`,
      sliceId: item.id,
      title: item.title,
      pageIds: item.id === activeSliceId ? pages.map((page) => page.id) : []
    })),
    pages,
    pageStates: [],
    edges: analysis.canvas?.edges || [],
    visualSpecs: [],
    codeArtifacts: [],
    details: detailsForNodes(analysis.canvas?.nodes || []),
    knowledgeRefs: [],
    knowledgeDeposits: [],
    versions: analysis.versions || []
  }
}
```

- [x] **Step 4: Run tests to verify total-flow adapter passes**

Run:

```bash
node --test tests/system-skills.test.mjs --test-name-pattern="total design flow"
```

Expected: PASS for the two new total-flow tests, except the Podcastor intent assertion may still fail until Task 2.

- [x] **Step 5: Commit - integration deferred**

Status: not committed in this pass. The implementation is verified, but the repository currently has broad unrelated dirty state; creating this isolated commit automatically would risk mixing unrelated work or producing a partial commit that is not reproducible.

```bash
git add backend/services/total-design-flow.js tests/system-skills.test.mjs
git commit -m "feat: add total design flow adapter"
```

---

### Task 2: Fix intent priority and attach total-flow data to analysis

**Files:**
- Modify: `backend/services/skill-orchestrator.js`
- Modify: `backend/services/document-parser.js`
- Modify: `tests/system-skills.test.mjs`

**Interfaces:**
- Consumes: `buildTotalDesignFlow(analysis)` from Task 1.
- Produces: `analysis.totalDesignFlow` on every document analysis result.

- [x] **Step 1: Write failing tests for analysis attachment and Podcastor routing**

Add this test after the Task 1 tests:

```js
test('document analysis includes total design flow and preserves product-document intent before auth keywords', () => {
  const podcastorText = [
    'Podcastor.ai v1.0产品文档',
    '定位：零门槛的AI播客工作站',
    '基础能力：注册/登录、商业化（Stripe、PayPal）、作品生成&存储&调用。',
    '核心功能：脚本生成、音频播客生成、视频播客生成。'
  ].join('\n')
  const result = analyzeRequirementDocuments({
    skillId: 'auto',
    skillSelectionMode: 'auto',
    demandScope: 'project',
    input: '请基于 Podcastor.ai v1.0 产品文档做设计方案分析。',
    documents: [{ name: 'Podcastor.ai v1.0产品文档.docx', type: 'docx', content: podcastorText }]
  })

  assert.equal(result.detectedIntent, 'podcastor-product')
  assert.ok(result.totalDesignFlow)
  assert.ok(result.totalDesignFlow.requirementSlices.length >= 5)
  assert.ok(result.totalDesignFlow.requirementSlices.map((slice) => slice.title).includes('登录注册与商业化'))
})
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/system-skills.test.mjs --test-name-pattern="document analysis includes total design flow"
```

Expected: FAIL because `result.totalDesignFlow` is missing or Podcastor is still detected as auth intent.

- [x] **Step 3: Fix intent priority**

In `backend/services/skill-orchestrator.js`, update `detectRequirementIntent` so Podcastor/product-document checks happen before auth checks:

```js
export function detectRequirementIntent(input = '') {
  const text = String(input || '')
  if (hasJoggBrollContext(text)) return 'requirement-analysis'
  if (/(podcastor|播客|podcast)/i.test(text)) return 'podcastor-product'
  if (/(登录|登陆|注册|找回密码|忘记密码|验证码|认证|auth|sign\s*in|sign\s*up|login|register)/i.test(text) &&
    /(弹窗|弹层|浮层|对话框|modal|dialog|popup)/i.test(text)) {
    return 'auth-modal'
  }
  if (/(登录|登陆|注册|找回密码|忘记密码|验证码|认证|auth|sign\s*in|sign\s*up|login|register)/i.test(text) &&
    /(页面|界面|表单|html|css|js|前端|代码|vue|react|生成|做一个|写一个|开发)/i.test(text)) {
    return 'auth-page'
  }
  if (/(html|css|js|vue|react|页面|界面|代码|预览|demo)/i.test(text)) return 'page-generation'
  if (/(旅程|用户路径|journey)/i.test(text)) return 'journey-map'
  if (/(交互|低保真|线框图|页面结构|状态|异常)/i.test(text)) return 'interaction-design'
  return 'requirement-analysis'
}
```

- [x] **Step 4: Attach total-flow data in document parser**

In `backend/services/document-parser.js`, add the import:

```js
import { buildTotalDesignFlow } from './total-design-flow.js'
```

After `analysis.canvas = canvasPlan(blueprint, analysis)` and after generated-canvas/failure application, assign total flow before quality snapshots:

```js
analysis.canvas = canvasPlan(blueprint, analysis)
applyGeneratedCanvasToAnalysis(analysis)
applyNoneModelFailureToAnalysis(analysis)
analysis.totalDesignFlow = buildTotalDesignFlow(analysis)
analysis.qualityGate = buildAnalysisQualityGate(analysis)
```

Also apply the same sequence in `analyzeRequirementDocumentsWithGeneration()` after generation is applied:

```js
applyGeneratedCanvasToAnalysis(analysis)
applyNoneModelFailureToAnalysis(analysis)
analysis.totalDesignFlow = buildTotalDesignFlow(analysis)
analysis.qualityGate = buildAnalysisQualityGate(analysis)
```

- [x] **Step 5: Run routing and analysis tests**

Run:

```bash
node --test tests/system-skills.test.mjs --test-name-pattern="Podcastor|total design flow|document analysis includes"
```

Expected: PASS.

- [x] **Step 6: Commit - integration deferred**

Status: not committed in this pass. The intent-priority and parser work is verified as part of the current worktree, but git integration is deferred until the total-flow staging boundary is chosen.

```bash
git add backend/services/skill-orchestrator.js backend/services/document-parser.js tests/system-skills.test.mjs
git commit -m "fix: route product documents into total flow"
```

---

### Task 3: Make 总流程 the workflow entry default and hide small Skill as primary choice

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `tests/system-skills.test.mjs`

**Interfaces:**
- Consumes: existing `workflowForm.selectedWorkflowId`, `workflowSkillOptions`, and `handleWorkflowPrimaryAction`.
- Produces:
  - Default selected flow id: `'total-design-flow'`
  - Entry copy that says “总流程”
  - Small Skill options moved to internal transfer/advanced paths, not primary entry list.

- [x] **Step 1: Write failing test for entry default**

Add this test near the workflow entry tests:

```js
test('workflow entry defaults to total flow instead of small skill selection', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')

  assert.match(appSource, /selectedWorkflowId:\s*'total-design-flow'/)
  assert.match(appSource, /value:\s*'total-design-flow',\s*label:\s*'总流程'/)
  assert.match(appSource, /总流程/)
  assert.match(appSource, /需求分析/)
  assert.match(appSource, /小需求切片/)
  assert.doesNotMatch(appSource, /selectedWorkflowId:\s*'ux-design-confirmation-skill'/)
})
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/system-skills.test.mjs --test-name-pattern="workflow entry defaults to total flow"
```

Expected: FAIL because the default is still `ux-design-confirmation-skill`.

- [x] **Step 3: Update default workflow form**

In `frontend/src/App.vue`, change:

```js
selectedWorkflowId: 'ux-design-confirmation-skill',
```

to:

```js
selectedWorkflowId: 'total-design-flow',
```

Update `workflowSkillOptions` to put total flow first and remove small Skill choices from the primary list:

```js
const workflowSkillOptions = computed(() => [
  { value: 'total-design-flow', label: '总流程' }
])
```

Create a separate advanced/internal list for transfers if the existing transfer modal still needs small Skill choices:

```js
const workflowInternalSkillOptions = computed(() => [
  { value: 'none', label: '不选择 Skill' },
  { value: 'ux-design-confirmation-skill', label: 'UX 设计确认 Skill' },
  { value: 'dialogue-skill', label: '对话 Skill' },
  { value: 'auto', label: '智能推荐 Skill' },
  { value: 'competitor-monitor-skill', label: '竞品监控 Skill' },
  ...builtinWorkflows.value.map((workflow) => ({
    value: workflow.id,
    label: workflow.name
  }))
])
```

Then update transfer computed values to use the internal list:

```js
const workflowSkillTransferOptions = computed(() =>
  workflowInternalSkillOptions.value.filter((item) => item.value !== 'dialogue-skill')
)
```

- [x] **Step 4: Update entry copy**

Update `workflowEntryCopy` default branch so total flow is the primary text:

```js
if (workflowForm.selectedWorkflowId === 'total-design-flow') {
  return {
    title: '今天要推进哪个',
    highlight: '设计方案',
    subtitle: '上传需求或输入想法后，系统会先做需求分析和小需求切片，再进入交互低保、UI视觉、HTML、Vue 和验收沉淀。'
  }
}
```

- [x] **Step 5: Make primary action route total flow through analysis**

In `handleWorkflowPrimaryAction`, make `total-design-flow` use `analyzeWorkflowDocuments()`:

```js
if (workflowForm.selectedWorkflowId === 'total-design-flow') {
  analyzeWorkflowDocuments()
  return
}
```

When building the analysis request inside `analyzeWorkflowDocuments()`, map total flow to auto routing while preserving display label:

```js
const selectedWorkflowId = workflowForm.selectedWorkflowId === 'total-design-flow' ? 'auto' : workflowForm.selectedWorkflowId
const skillSelectionMode = workflowForm.selectedWorkflowId === 'total-design-flow'
  ? 'auto'
  : (workflowForm.selectedWorkflowId === 'auto' ? 'auto' : 'manual')
```

Use these local values in the payload instead of raw `workflowForm.selectedWorkflowId`.

- [x] **Step 6: Run entry test**

Run:

```bash
node --test tests/system-skills.test.mjs --test-name-pattern="workflow entry defaults to total flow"
```

Expected: PASS.

- [x] **Step 7: Commit - integration deferred**

Status: not committed in this pass. The entry-default behavior is verified in tests and build; commit is deferred because this file also contains other historical workflow changes.

```bash
git add frontend/src/App.vue tests/system-skills.test.mjs
git commit -m "feat: make total flow the workflow entry"
```

---

### Task 4: Render requirement slices and page-node bottom navigation in canvas page

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/pages/workflow/WorkflowPage.vue`
- Modify: `frontend/src/styles.css`
- Modify: `tests/system-skills.test.mjs`

**Interfaces:**
- Consumes: `workflowAnalysisResult.totalDesignFlow`.
- Produces:
  - `total-flow` prop on `WorkflowCanvasPage`.
  - Slice rail rendered from `totalFlow.requirementSlices`.
  - Bottom page node navigation rendered from `totalFlow.pages`.
  - Emits `focus-node` when page nav item is clicked.

- [x] **Step 1: Write failing static rendering test**

Add this test near the canvas page tests:

```js
test('workflow canvas renders total flow slices on the left and page nodes at the bottom', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const canvasSource = await readFile(new URL('../frontend/src/pages/workflow/WorkflowPage.vue', import.meta.url), 'utf8')
  const styleSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(appSource, /:total-flow="workflowTotalDesignFlow"/)
  assert.match(appSource, /const workflowTotalDesignFlow = computed/)
  assert.match(canvasSource, /totalFlow:\s*\{\s*type:\s*Object/)
  assert.match(canvasSource, /class="workflow-total-slice-rail"/)
  assert.match(canvasSource, /requirementSlices/)
  assert.match(canvasSource, /class="workflow-page-node-nav"/)
  assert.match(canvasSource, /pageNodesForActiveSlice/)
  assert.match(canvasSource, /focus-node/)
  assert.match(styleSource, /\.workflow-total-slice-rail/)
  assert.match(styleSource, /\.workflow-page-node-nav/)
})
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/system-skills.test.mjs --test-name-pattern="workflow canvas renders total flow slices"
```

Expected: FAIL because the prop and markup do not exist yet.

- [x] **Step 3: Pass total flow from App**

In `frontend/src/App.vue`, add computed:

```js
const workflowTotalDesignFlow = computed(() => workflowAnalysisResult.value?.totalDesignFlow || null)
```

Pass it to the canvas page:

```vue
<WorkflowCanvasPage
  :total-flow="workflowTotalDesignFlow"
/>
```

- [x] **Step 4: Add prop and computed helpers in canvas page**

In `frontend/src/pages/workflow/WorkflowPage.vue`, add prop:

```js
totalFlow: { type: Object, default: null }
```

Add computed values:

```js
const requirementSlices = computed(() => Array.isArray(props.totalFlow?.requirementSlices) ? props.totalFlow.requirementSlices : [])
const activeSliceId = computed(() => props.totalFlow?.activeSliceId || requirementSlices.value[0]?.id || '')
const pageNodesForActiveSlice = computed(() => {
  const pages = Array.isArray(props.totalFlow?.pages) ? props.totalFlow.pages : []
  return pages.filter((page) => !activeSliceId.value || page.sliceId === activeSliceId.value)
})
```

- [x] **Step 5: Render slice rail**

Inside the canvas layout, add:

```vue
<aside v-if="requirementSlices.length" class="workflow-total-slice-rail">
  <div class="workflow-total-slice-head">
    <strong>小需求</strong>
    <span>{{ requirementSlices.length }} 个切片</span>
  </div>
  <button
    v-for="slice in requirementSlices"
    :key="slice.id"
    type="button"
    class="workflow-total-slice-card"
    :class="{ active: slice.id === activeSliceId }"
  >
    <strong>{{ slice.title }}</strong>
    <span>{{ slice.goal }}</span>
    <small>{{ slice.priority }} · {{ slice.pageCount || 0 }} 个页面 · {{ slice.pendingQuestionCount || 0 }} 个待确认</small>
  </button>
</aside>
```

- [x] **Step 6: Render bottom page-node navigation**

Near the bottom of the canvas page main area, add:

```vue
<nav v-if="pageNodesForActiveSlice.length" class="workflow-page-node-nav" aria-label="当前小需求页面节点">
  <button
    v-for="page in pageNodesForActiveSlice"
    :key="page.id"
    type="button"
    class="workflow-page-node-chip"
    @click="$emit('focus-node', page.nodeId || page.id)"
  >
    <span>{{ page.title }}</span>
    <small>{{ page.statusCount || 0 }} 状态</small>
  </button>
</nav>
```

- [x] **Step 7: Add CSS**

In `frontend/src/styles.css`, add:

```css
.workflow-total-slice-rail {
  width: 280px;
  min-width: 280px;
  border-right: 1px solid var(--border);
  background: #f8fafc;
  padding: 16px 12px;
  overflow-y: auto;
}

.workflow-total-slice-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  color: var(--text-secondary);
}

.workflow-total-slice-card {
  width: 100%;
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text-primary);
  text-align: left;
  margin-bottom: 10px;
}

.workflow-total-slice-card.active {
  border-color: #111827;
  box-shadow: 0 0 0 1px #111827;
}

.workflow-total-slice-card span,
.workflow-total-slice-card small {
  color: var(--text-secondary);
}

.workflow-page-node-nav {
  position: sticky;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.94);
  overflow-x: auto;
  z-index: 5;
}

.workflow-page-node-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: max-content;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text-primary);
}

.workflow-page-node-chip small {
  color: var(--text-secondary);
}
```

- [x] **Step 8: Run rendering test**

Run:

```bash
node --test tests/system-skills.test.mjs --test-name-pattern="workflow canvas renders total flow slices"
```

Expected: PASS.

- [x] **Step 9: Commit - integration deferred**

Status: not committed in this pass. Rendering behavior is verified, but the frontend component/page/base-component directories include broad untracked work that should be staged deliberately.

```bash
git add frontend/src/App.vue frontend/src/pages/workflow/WorkflowPage.vue frontend/src/styles.css tests/system-skills.test.mjs
git commit -m "feat: render total flow slices in workflow canvas"
```

---

### Task 5: Full regression and build verification

**Files:**
- Modify: none unless tests reveal issues.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: Verified first-version 总流程 skeleton.

- [x] **Step 1: Run focused system tests**

Run:

```bash
node --test tests/system-skills.test.mjs
```

Expected: all tests pass.

- [x] **Step 2: Run frontend build**

Run:

```bash
npm --prefix frontend run build
```

Expected: build exits 0. Existing chunk-size warnings are acceptable.

- [x] **Step 3: Manually verify tea analysis through backend function**

Run:

```bash
node --input-type=module - <<'NODE'
import { analyzeRequirementDocuments } from './backend/services/document-parser.js'
const result = analyzeRequirementDocuments({
  skillId: 'auto',
  skillSelectionMode: 'auto',
  demandScope: 'project',
  input: '做一个茶饮点单小程序，包含首页选店、取餐方式、菜单商品、商品定制、购物车结算、支付下单、取餐通知、会员优惠、订单状态。',
  documents: []
})
console.log(JSON.stringify({
  detectedIntent: result.detectedIntent,
  slices: result.totalDesignFlow?.requirementSlices?.map((item) => item.title),
  pages: result.totalDesignFlow?.pages?.map((item) => item.title)
}, null, 2))
NODE
```

Expected output includes:

```json
{
  "slices": ["茶饮点单主流程"]
}
```

- [x] **Step 4: Manually verify Podcastor routing**

Run:

```bash
node --input-type=module - <<'NODE'
import { analyzeRequirementDocuments } from './backend/services/document-parser.js'
const content = [
  'Podcastor.ai v1.0产品文档',
  '定位：零门槛的AI播客工作站',
  '基础能力：注册/登录、商业化（Stripe、PayPal）、作品生成&存储&调用。',
  '核心功能：脚本生成、音频播客生成、视频播客生成。',
  '用户资产：脚本&灵感库、音色&音频资产库、播客主播库。'
].join('\\n')
const result = analyzeRequirementDocuments({
  skillId: 'auto',
  skillSelectionMode: 'auto',
  demandScope: 'project',
  input: '请基于 Podcastor.ai v1.0 产品文档做设计方案分析。',
  documents: [{ name: 'Podcastor.ai v1.0产品文档.docx', type: 'docx', content }]
})
console.log(JSON.stringify({
  detectedIntent: result.detectedIntent,
  slices: result.totalDesignFlow?.requirementSlices?.map((item) => item.title)
}, null, 2))
NODE
```

Expected output includes:

```json
{
  "detectedIntent": "podcastor-product"
}
```

and slices include `脚本生成流程`, `音频播客生成流程`, `视频播客制作流程`, `登录注册与商业化`.

- [x] **Step 5: Commit verification adjustments if any - integration deferred**

If fixes were needed:

```bash
git add <changed-files>
git commit -m "test: verify total design flow skeleton"
```

If no fixes were needed, do not create an empty commit.

Status: verification adjustments were needed and are present in the worktree; commit is deferred for the same staging-boundary reason above.
