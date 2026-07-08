# Project Workspace Skill Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a project-scoped AI design workspace where project switching controls knowledge, assets, runs, and editable custom Skills with structured inputs, knowledge scope selection, workflow candidate options, and final conclusions.

**Architecture:** Add focused service helpers for project scoping instead of embedding filtering rules directly in `App.vue`. Extend existing `skills.js` and `workflows.js` models in place, then wire the UI to those helpers with current Vue patterns and localStorage state.

**Tech Stack:** Vue 3 Composition API, Vite, plain JavaScript ES modules, Node `assert` tests run by `npm test`, localStorage persistence.

## Global Constraints

- Current directory is not a git repository; skip commit steps and do not claim commits.
- Do not add backend, account system, vector database, real LLM API, Figma generation, or visual flow builder.
- Preserve existing local-first prototype behavior.
- All legacy local items without `projectId` must migrate to default project `project-flow`.
- System Skills are visible in all projects and copied before editing.
- User Skills can be `visibility: global` or `visibility: project`.
- Workflow steps generate 3 candidate options and final step completion creates `finalConclusion`.
- Assets should show final conclusion as main content and keep run records hidden.

---

## File Structure

- Create `src/services/projectWorkspace.js`
  - Owns project normalization, legacy migration, scoped list filtering, and available Skill filtering.
- Modify `src/services/skills.js`
  - Normalizes `visibility`, `projectId`, `inputFields`, and `knowledgeScopeConfig`.
  - Builds Skill execution context from project/knowledge scope instead of all global arrays.
- Modify `src/services/workflows.js`
  - Adds `candidateOptions`, option generation, option selection, and final conclusion helpers.
  - Exports Markdown with final conclusion first.
- Modify `tests/workflows.test.mjs`
  - Adds focused tests for project scoping, Skill model, context filtering, candidate options, and final conclusion.
- Modify `src/App.vue`
  - Uses scoped computed lists.
  - Adds project creation UI.
  - Adds Skill Builder structured field and knowledge scope controls.
  - Shows workflow candidate options and final conclusion.
  - Writes `projectId` on created knowledge, requirements, competitors, assets, runs, and workflow runs.
- Modify `src/styles.css`
  - Adds compact styles for project controls, Skill fields, scope selectors, candidate options, and final conclusion.

---

### Task 1: Project Workspace Service

**Files:**
- Create: `src/services/projectWorkspace.js`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Produces: `DEFAULT_PROJECT_ID`, `createProject(input)`, `normalizeWorkspaceState(state)`, `scopeItems(items, projectId)`, `availableProjectSkills(skills, projectId)`, `projectScopedContext(state, config)`
- Consumes: Existing state shape from `App.vue`.

- [ ] **Step 1: Write failing project workspace tests**

Append to `tests/workflows.test.mjs`:

```js
import {
  availableProjectSkills,
  createProject,
  DEFAULT_PROJECT_ID,
  normalizeWorkspaceState,
  projectScopedContext,
  scopeItems
} from '../src/services/projectWorkspace.js'

test('normalizes legacy workspace data into the default project', () => {
  const state = normalizeWorkspaceState({
    currentProjectId: 'missing-project',
    projects: [],
    knowledge: [{ id: 'k1', title: '旧知识' }],
    requirements: [{ id: 'r1', title: '旧需求' }],
    competitors: [{ id: 'c1', title: '旧竞品' }],
    assets: [{ id: 'a1', title: '旧资产' }],
    skillRuns: [{ id: 'run1', title: '旧运行' }],
    skills: []
  })

  assert.equal(state.currentProjectId, DEFAULT_PROJECT_ID)
  assert.equal(state.projects[0].id, DEFAULT_PROJECT_ID)
  assert.equal(state.knowledge[0].projectId, DEFAULT_PROJECT_ID)
  assert.equal(state.requirements[0].projectId, DEFAULT_PROJECT_ID)
  assert.equal(state.competitors[0].projectId, DEFAULT_PROJECT_ID)
  assert.equal(state.assets[0].projectId, DEFAULT_PROJECT_ID)
  assert.equal(state.skillRuns[0].projectId, DEFAULT_PROJECT_ID)
})

test('filters project scoped items by current project', () => {
  const items = [
    { id: 'one', projectId: 'project-a' },
    { id: 'two', projectId: 'project-b' },
    { id: 'legacy' }
  ]

  assert.deepEqual(scopeItems(items, 'project-a').map((item) => item.id), ['one'])
})

test('filters available skills by system global and current project visibility', () => {
  const skills = [
    { id: 'system', source: 'system' },
    { id: 'global', source: 'user', visibility: 'global' },
    { id: 'current', source: 'user', visibility: 'project', projectId: 'project-a' },
    { id: 'other', source: 'user', visibility: 'project', projectId: 'project-b' }
  ]

  assert.deepEqual(availableProjectSkills(skills, 'project-a').map((skill) => skill.id), [
    'system',
    'global',
    'current'
  ])
})

test('builds context from selected project scope and source types', () => {
  const state = normalizeWorkspaceState({
    currentProjectId: 'project-a',
    projects: [{ id: 'project-a', name: 'A' }, { id: 'project-b', name: 'B' }],
    knowledge: [{ id: 'k1', projectId: 'project-a' }, { id: 'k2', projectId: 'project-b' }],
    requirements: [{ id: 'r1', projectId: 'project-a' }],
    competitors: [{ id: 'c1', projectId: 'project-a' }],
    assets: [{ id: 'a1', projectId: 'project-a' }]
  })

  const context = projectScopedContext(state, {
    mode: 'current-project',
    sourceTypes: ['knowledge', 'assets']
  })

  assert.deepEqual(context.knowledge.map((item) => item.id), ['k1'])
  assert.deepEqual(context.assets.map((item) => item.id), ['a1'])
  assert.deepEqual(context.requirements, [])
  assert.deepEqual(context.competitors, [])
})

test('creates a project with stable required fields', () => {
  const project = createProject({
    name: '审批后台',
    description: '优化审批链路',
    domain: 'B 端后台',
    targetUsers: '审批发起人',
    stage: 'design'
  })

  assert.equal(project.name, '审批后台')
  assert.equal(project.stage, 'design')
  assert.ok(project.id)
  assert.ok(project.createdAt)
  assert.ok(project.updatedAt)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL with module not found for `src/services/projectWorkspace.js`.

- [ ] **Step 3: Implement project workspace service**

Create `src/services/projectWorkspace.js`:

```js
export const DEFAULT_PROJECT_ID = 'project-flow'

const PROJECT_SCOPED_KEYS = ['knowledge', 'requirements', 'competitors', 'assets', 'skillRuns']
const SOURCE_TYPES = ['knowledge', 'requirements', 'competitors', 'assets']

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function nowIso() {
  return new Date().toISOString()
}

export function createProject(input = {}) {
  const now = nowIso()
  return {
    id: input.id || `project-${randomId()}`,
    name: input.name || '未命名项目',
    description: input.description || '',
    domain: input.domain || '',
    targetUsers: input.targetUsers || '',
    stage: input.stage || 'discovery',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }
}

function defaultProject() {
  return createProject({
    id: DEFAULT_PROJECT_ID,
    name: '流程通默认项目',
    description: '本地默认项目，用于承接旧数据和快速试用。',
    stage: 'design'
  })
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeProjectList(projects) {
  const list = normalizeArray(projects).map((project) => createProject(project))
  if (!list.length) return [defaultProject()]
  if (!list.some((project) => project.id === DEFAULT_PROJECT_ID)) return [defaultProject(), ...list]
  return list
}

function withProjectId(item, projectId) {
  return item && typeof item === 'object' && !item.projectId ? { ...item, projectId } : item
}

export function normalizeWorkspaceState(state = {}) {
  const projects = normalizeProjectList(state.projects)
  const projectIds = new Set(projects.map((project) => project.id))
  const currentProjectId = projectIds.has(state.currentProjectId) ? state.currentProjectId : projects[0].id
  const normalized = { ...state, projects, currentProjectId }

  PROJECT_SCOPED_KEYS.forEach((key) => {
    normalized[key] = normalizeArray(state[key]).map((item) => withProjectId(item, currentProjectId || DEFAULT_PROJECT_ID))
  })

  if (normalized.activeWorkflowRun && !normalized.activeWorkflowRun.projectId) {
    normalized.activeWorkflowRun = { ...normalized.activeWorkflowRun, projectId: currentProjectId }
  }

  return normalized
}

export function scopeItems(items = [], projectId) {
  return normalizeArray(items).filter((item) => item?.projectId === projectId)
}

export function availableProjectSkills(skills = [], projectId) {
  return normalizeArray(skills).filter((skill) => {
    if (skill.source === 'system') return true
    if ((skill.visibility || 'global') === 'global') return true
    return skill.projectId === projectId
  })
}

function idsForMode(state, config = {}) {
  if (config.mode === 'all-projects') return new Set(normalizeArray(state.projects).map((project) => project.id))
  if (config.mode === 'selected-projects') return new Set(normalizeArray(config.projectIds))
  return new Set([state.currentProjectId])
}

function filterByItemIds(items, itemIds) {
  const ids = new Set(normalizeArray(itemIds))
  if (!ids.size) return items
  return items.filter((item) => ids.has(item.id))
}

export function projectScopedContext(state = {}, config = {}) {
  const sourceTypes = normalizeArray(config.sourceTypes).length ? config.sourceTypes : SOURCE_TYPES
  const projectIds = idsForMode(state, config)
  const result = {
    knowledge: [],
    requirements: [],
    competitors: [],
    assets: []
  }

  SOURCE_TYPES.forEach((key) => {
    if (!sourceTypes.includes(key)) return
    const scoped = normalizeArray(state[key]).filter((item) => projectIds.has(item.projectId))
    result[key] = config.mode === 'selected-items' ? filterByItemIds(scoped, config.itemIds) : scoped
  })

  return result
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS for existing tests and new project workspace tests.

---

### Task 2: Skill Model and Execution Context

**Files:**
- Modify: `src/services/skills.js`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `projectScopedContext(state, config)` from `src/services/projectWorkspace.js`
- Produces: normalized Skill properties `visibility`, `projectId`, `inputFields`, `knowledgeScopeConfig`

- [ ] **Step 1: Write failing Skill model tests**

Append to `tests/workflows.test.mjs`:

```js
import { buildSkillExecutionContext, normalizeSkill } from '../src/services/skills.js'

test('normalizes skill builder fields visibility and knowledge scope config', () => {
  const skill = normalizeSkill({
    name: '交互评审',
    source: 'user',
    projectId: 'project-a',
    visibility: 'project',
    inputFields: [
      {
        id: 'scene',
        label: '场景',
        type: 'textarea',
        required: true,
        placeholder: '描述业务场景',
        options: 'A\\nB'
      }
    ],
    knowledgeScopeConfig: {
      mode: 'selected-projects',
      projectIds: ['project-a'],
      sourceTypes: ['knowledge']
    }
  })

  assert.equal(skill.visibility, 'project')
  assert.equal(skill.projectId, 'project-a')
  assert.equal(skill.inputFields[0].type, 'textarea')
  assert.deepEqual(skill.inputFields[0].options, ['A', 'B'])
  assert.equal(skill.knowledgeScopeConfig.mode, 'selected-projects')
  assert.deepEqual(skill.knowledgeScopeConfig.sourceTypes, ['knowledge'])
})

test('skill execution context respects knowledge scope config', () => {
  const state = normalizeWorkspaceState({
    currentProjectId: 'project-a',
    projects: [{ id: 'project-a', name: 'A' }, { id: 'project-b', name: 'B' }],
    knowledge: [{ id: 'k1', projectId: 'project-a' }, { id: 'k2', projectId: 'project-b' }],
    requirements: [{ id: 'r1', projectId: 'project-a' }],
    competitors: [{ id: 'c1', projectId: 'project-a' }],
    assets: [{ id: 'a1', projectId: 'project-a' }],
    palette: { primary: '#000' }
  })
  const skill = normalizeSkill({
    name: '只读知识',
    knowledgeScopeConfig: {
      mode: 'current-project',
      sourceTypes: ['knowledge']
    }
  })

  const context = buildSkillExecutionContext(state, skill, '生成方案')

  assert.deepEqual(context.knowledge.map((item) => item.id), ['k1'])
  assert.deepEqual(context.requirements, [])
  assert.deepEqual(context.competitors, [])
  assert.deepEqual(context.assets, [])
  assert.equal(context.projectId, 'project-a')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because `normalizeSkill` does not preserve new fields and context still includes all arrays.

- [ ] **Step 3: Modify imports and helpers in `skills.js`**

At the top of `src/services/skills.js`, add:

```js
import { projectScopedContext } from './projectWorkspace.js'
```

Add helper functions after `asArray`:

```js
function normalizeInputField(field = {}, index = 0) {
  return {
    id: field.id || `field-${index + 1}`,
    label: field.label || field.name || `字段 ${index + 1}`,
    type: ['text', 'textarea', 'single-select', 'multi-select', 'number', 'boolean'].includes(field.type)
      ? field.type
      : 'text',
    required: Boolean(field.required),
    placeholder: field.placeholder || '',
    helpText: field.helpText || '',
    options: asArray(field.options),
    defaultValue: field.defaultValue || ''
  }
}

function normalizeKnowledgeScopeConfig(config = {}) {
  const mode = ['current-project', 'selected-projects', 'selected-items', 'all-projects'].includes(config.mode)
    ? config.mode
    : 'current-project'
  const sourceTypes = asArray(config.sourceTypes).length
    ? asArray(config.sourceTypes)
    : ['knowledge', 'requirements', 'competitors', 'assets']
  return {
    mode,
    projectIds: asArray(config.projectIds),
    itemIds: asArray(config.itemIds),
    sourceTypes
  }
}
```

- [ ] **Step 4: Extend `normalizeSkill`**

Inside the returned object in `normalizeSkill`, add:

```js
    visibility: input.visibility || (input.source === 'system' ? 'global' : 'global'),
    projectId: input.projectId || '',
    inputFields: Array.isArray(input.inputFields)
      ? input.inputFields.map((field, index) => normalizeInputField(field, index))
      : [],
    knowledgeScopeConfig: normalizeKnowledgeScopeConfig(input.knowledgeScopeConfig),
```

- [ ] **Step 5: Update `buildSkillExecutionContext`**

Replace `buildSkillExecutionContext` with:

```js
export function buildSkillExecutionContext(state, skill, input) {
  const normalizedSkill = normalizeSkill(skill)
  const scoped = projectScopedContext(state, normalizedSkill.knowledgeScopeConfig)
  return {
    projectId: state.currentProjectId,
    input,
    skill: normalizedSkill,
    ...scoped,
    palette: state.palette || {},
    generatedAt: new Date().toISOString()
  }
}
```

- [ ] **Step 6: Run tests**

Run: `npm test`

Expected: PASS.

---

### Task 3: Workflow Candidate Options and Final Conclusion

**Files:**
- Modify: `src/services/workflows.js`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Produces: `generateCandidateOptions(run, stepId)`, `applyCandidateOption(run, optionId)`, `ensureFinalConclusion(run)`, updated `generateStepDraft`, `regenerateStepDraft`, `createWorkflowRun`, `exportWorkflowRunMarkdown`

- [ ] **Step 1: Write failing workflow tests**

Append to `tests/workflows.test.mjs`:

```js
test('workflow draft generation creates three candidate options', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  const run = createWorkflowRun(workflow, '优化审批流程')
  run.stepInputs[run.currentStepId] = {
    目标用户: '审批发起人',
    原始目标: '减少返工'
  }

  const generated = generateStepDraft(run)
  const options = generated.candidateOptions[generated.currentStepId]

  assert.equal(options.length, 3)
  assert.deepEqual(options.map((option) => option.title), ['低风险方案', '推荐方案', '完整方案'])
  assert.match(options[1].content, /推荐方案/)
})

test('can apply a candidate option to current workflow draft', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  let run = createWorkflowRun(workflow, '优化审批流程')
  run.stepInputs[run.currentStepId] = {
    目标用户: '审批发起人',
    原始目标: '减少返工'
  }
  run = generateStepDraft(run)
  const optionId = run.candidateOptions[run.currentStepId][1].id

  run = applyCandidateOption(run, optionId)

  assert.match(run.stepDraftOutputs[run.currentStepId], /推荐方案/)
})

test('final workflow completion creates final conclusion and exports it first', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  let run = createWorkflowRun(workflow, '拆解 AI 需求工具')

  workflow.steps.forEach((step) => {
    run.stepInputs[run.currentStepId] = Object.fromEntries(step.requiredFields.map((field) => [field, `${field} 内容`]))
    run = generateStepDraft(run)
    run = acceptCurrentStep(run, run.stepDraftOutputs[run.currentStepId])
    run = completeCurrentStep(run, run.stepOutputs[step.id])
  })

  assert.equal(run.status, 'completed')
  assert.ok(run.finalConclusion)
  assert.match(run.finalConclusion.recommendedPlan, /推荐方案/)

  const markdown = exportWorkflowRunMarkdown(run)
  assert.match(markdown, /## 最终结论/)
  assert.ok(markdown.indexOf('## 最终结论') < markdown.indexOf('## Step 1：需求理解'))
})
```

Also update the workflow import block to include:

```js
  applyCandidateOption,
  ensureFinalConclusion,
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because candidate and final conclusion functions do not exist.

- [ ] **Step 3: Extend workflow run state**

In `createWorkflowRun`, add:

```js
    candidateOptions: {},
    finalConclusion: null,
    projectId: '',
```

- [ ] **Step 4: Add candidate option helpers**

In `src/services/workflows.js`, add before `generateStepDraft`:

```js
function optionId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function generateCandidateOptions(run, stepId = run.currentStepId) {
  const step = run.steps.find((item) => item.id === stepId) || getCurrentStep(run)
  const base = run.stepDraftOutputs?.[step.id] || renderStepOutput(run, step)
  return [
    {
      id: optionId('low-risk'),
      title: '低风险方案',
      summary: '优先复用现有流程和页面结构，降低改动成本。',
      content: `${base}\n\n## 低风险方案\n- 优先沿用当前流程，只调整阻塞点和必要状态。\n- 适合资源紧张、需要快速验证的阶段。`,
      tradeoffs: ['上线快', '组织阻力小', '创新空间有限']
    },
    {
      id: optionId('recommended'),
      title: '推荐方案',
      summary: '平衡体验收益、实现成本和后续扩展。',
      content: `${base}\n\n## 推荐方案\n- 围绕当前项目目标重组主流程和关键页面。\n- 兼顾用户效率、异常处理和后续迭代空间。`,
      tradeoffs: ['收益和成本平衡', '适合进入设计评审', '需要补齐关键约束']
    },
    {
      id: optionId('complete'),
      title: '完整方案',
      summary: '覆盖主流程、分支、异常、验收和交付拆解。',
      content: `${base}\n\n## 完整方案\n- 同时覆盖主路径、异常路径、权限状态、数据状态和交付验收。\n- 适合复杂项目或需要一次性对齐多方的场景。`,
      tradeoffs: ['覆盖完整', '评审充分', '设计和开发成本更高']
    }
  ]
}

export function applyCandidateOption(run, optionIdToApply) {
  const next = clone(run)
  const step = getCurrentStep(next)
  const option = (next.candidateOptions?.[step.id] || []).find((item) => item.id === optionIdToApply)
  if (!option) return next
  next.stepDraftOutputs[step.id] = option.content
  next.updatedAt = nowIso()
  return next
}
```

- [ ] **Step 5: Wire candidate options into generation**

In `generateStepDraft`, after setting `stepDraftOutputs`, add:

```js
  next.candidateOptions[step.id] = generateCandidateOptions(next, step.id)
```

In `regenerateStepDraft`, after setting `stepDraftOutputs`, add:

```js
  next.candidateOptions[step.id] = generateCandidateOptions(next, step.id)
```

- [ ] **Step 6: Add final conclusion helper and completion hook**

Add:

```js
export function ensureFinalConclusion(run) {
  const next = clone(run)
  if (next.finalConclusion) return next
  const accepted = next.steps
    .map((step) => ({ step, content: next.stepOutputs?.[step.id] || '' }))
    .filter((item) => item.content.trim())
  next.finalConclusion = {
    title: `${next.workflowName} 最终结论`,
    summary: `基于 ${accepted.length} 个已采纳步骤，形成可进入设计评审和交付拆解的方案。`,
    recommendedPlan: '推荐方案：以当前采纳步骤为主线，优先推进用户主路径、关键页面结构、异常状态和验收标准。',
    keyDecisions: accepted.slice(0, 4).map((item) => `${item.step.title}：采用已采纳输出作为后续依据。`),
    risks: ['知识库资料不足时，需要标注 AI 推断并补充项目事实。', '进入开发前需要确认权限、异常状态和验收标准。'],
    openQuestions: ['是否还有未覆盖的关键用户角色？', '是否存在必须遵守的业务或技术约束？'],
    nextTasks: ['整理为 PRD/交互说明', '补齐关键页面状态', '组织设计评审', '拆分开发验收任务'],
    createdAt: nowIso()
  }
  next.updatedAt = nowIso()
  return next
}
```

In `completeCurrentStep`, when status becomes completed, return `ensureFinalConclusion(next)` instead of `next`.

- [ ] **Step 7: Update Markdown export**

At the top of exported Markdown body, insert:

```js
  if (run.finalConclusion) {
    lines.push(
      '## 最终结论',
      '',
      `### 摘要\n${run.finalConclusion.summary}`,
      '',
      `### 推荐方案\n${run.finalConclusion.recommendedPlan}`,
      '',
      '### 关键决策',
      ...(run.finalConclusion.keyDecisions || []).map((item) => `- ${item}`),
      '',
      '### 风险',
      ...(run.finalConclusion.risks || []).map((item) => `- ${item}`),
      '',
      '### 待确认问题',
      ...(run.finalConclusion.openQuestions || []).map((item) => `- ${item}`),
      '',
      '### 下一步任务',
      ...(run.finalConclusion.nextTasks || []).map((item) => `- ${item}`),
      ''
    )
  }
```

- [ ] **Step 8: Run tests**

Run: `npm test`

Expected: PASS.

---

### Task 4: Wire Project Scoping and Creation UI

**Files:**
- Modify: `src/App.vue`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `normalizeWorkspaceState`, `createProject`, `scopeItems`, `availableProjectSkills`
- Produces: scoped computed lists used by templates and save/create operations.

- [ ] **Step 1: Import project helpers**

In `src/App.vue`, add:

```js
import {
  availableProjectSkills,
  createProject,
  normalizeWorkspaceState,
  scopeItems
} from './services/projectWorkspace'
```

- [ ] **Step 2: Normalize boot state**

After `sanitizeLegacyNames(bootState)`, add:

```js
Object.assign(bootState, normalizeWorkspaceState(bootState))
```

- [ ] **Step 3: Add project form state**

Near other reactive forms, add:

```js
const projectForm = reactive({
  name: '',
  description: '',
  domain: '',
  targetUsers: '',
  stage: 'discovery'
})
const showProjectForm = ref(false)
```

- [ ] **Step 4: Add scoped computed values**

Replace direct global list computeds with:

```js
const currentKnowledge = computed(() => scopeItems(state.knowledge, state.currentProjectId))
const currentRequirements = computed(() => scopeItems(state.requirements, state.currentProjectId))
const currentCompetitors = computed(() => scopeItems(state.competitors, state.currentProjectId))
const currentAssets = computed(() => scopeItems(state.assets, state.currentProjectId))
const currentSkillRuns = computed(() => scopeItems(state.skillRuns, state.currentProjectId))
const availableSkills = computed(() => availableProjectSkills(state.skills || [], state.currentProjectId))
const recentActivities = computed(() => currentSkillRuns.value.slice(0, 3))
const latestAssets = computed(() => currentAssets.value.slice(0, 4))
const selectedAsset = computed(() =>
  currentAssets.value.find((asset) => asset.id === selectedAssetId.value) || currentAssets.value[0] || null
)
```

- [ ] **Step 5: Update visible list bindings**

In the template:

```vue
<ListHeader title="知识条目" :count="currentKnowledge.length" />
<DataList :items="currentKnowledge" empty="暂无知识条目" />
<ListHeader title="需求文档" :count="currentRequirements.length" />
<DataList :items="currentRequirements" empty="暂无需求文档" />
<ListHeader title="竞品记录" :count="currentCompetitors.length" />
<DataList :items="currentCompetitors" empty="暂无竞品记录" />
<ListHeader title="资产库" :count="currentAssets.length" />
<button v-for="asset in currentAssets" ...>
```

- [ ] **Step 6: Add project creation controls to topbar**

Inside `.project-switcher`, after the select, add:

```vue
<button type="button" @click="showProjectForm = !showProjectForm">
  {{ showProjectForm ? '收起' : '新建项目' }}
</button>
```

After `.project-switcher`, add:

```vue
<div v-if="showProjectForm" class="project-create-panel">
  <input v-model="projectForm.name" placeholder="项目名称" />
  <input v-model="projectForm.domain" placeholder="业务领域" />
  <input v-model="projectForm.targetUsers" placeholder="目标用户" />
  <select v-model="projectForm.stage">
    <option value="discovery">探索期</option>
    <option value="design">设计中</option>
    <option value="delivery">交付中</option>
    <option value="iteration">迭代中</option>
  </select>
  <textarea v-model="projectForm.description" placeholder="项目说明"></textarea>
  <button class="primary" type="button" @click="addProject">创建并切换</button>
</div>
```

- [ ] **Step 7: Add `addProject` function**

Add near project helpers:

```js
function addProject() {
  if (!projectForm.name.trim()) {
    setStatus(settingsStatus, 'failed', '请填写项目名称')
    return
  }
  const project = createProject(projectForm)
  state.projects.unshift(project)
  state.currentProjectId = project.id
  selectedAssetId.value = ''
  Object.assign(projectForm, {
    name: '',
    description: '',
    domain: '',
    targetUsers: '',
    stage: 'discovery'
  })
  showProjectForm.value = false
  setStatus(settingsStatus, 'success', '项目已创建并切换')
}
```

- [ ] **Step 8: Write `projectId` on created records**

For every local unshift/create in `App.vue`, add `projectId: state.currentProjectId`:

```js
state.knowledge.unshift({ id: crypto.randomUUID(), projectId: state.currentProjectId, ... })
state.requirements.unshift({ id: crypto.randomUUID(), projectId: state.currentProjectId, ... })
state.competitors.unshift({ id: crypto.randomUUID(), projectId: state.currentProjectId, ... })
state.assets.unshift({ id: crypto.randomUUID(), projectId: state.currentProjectId, ... })
state.skillRuns.unshift({ id: crypto.randomUUID(), projectId: state.currentProjectId, ... })
```

Also assign:

```js
state.activeWorkflowRun.projectId = state.currentProjectId
```

after `createWorkflowRun`.

- [ ] **Step 9: Add compact styles**

In `src/styles.css`, add:

```css
.project-switcher {
  display: flex;
  align-items: end;
  gap: 8px;
  flex-wrap: wrap;
}

.project-create-panel {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
  margin-top: 12px;
}

.project-create-panel textarea {
  grid-column: 1 / -1;
  min-height: 72px;
}
```

- [ ] **Step 10: Run verification**

Run: `npm test && npm run build`

Expected: both PASS.

---

### Task 5: Skill Builder Form Fields and Knowledge Scope UI

**Files:**
- Modify: `src/App.vue`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `normalizeSkill` behavior from Task 2.
- Produces: editor draft fields `inputFields` and `knowledgeScopeConfig` saved into `state.skills`.

- [ ] **Step 1: Import `normalizeSkill` if not already imported**

Update skills import in `src/App.vue`:

```js
import {
  buildSkillExecutionContext,
  createSystemSkills,
  markdownToSkill,
  normalizeSkill,
  skillToMarkdown,
  validateSkill
} from './services/skills'
```

- [ ] **Step 2: Preserve new fields in `textDraft`**

Update return value:

```js
return {
  ...skill,
  visibility: skill.visibility || (skill.source === 'system' ? 'global' : 'project'),
  projectId: skill.projectId || state.currentProjectId,
  inputFields: [...(skill.inputFields || [])],
  knowledgeScopeConfig: {
    mode: skill.knowledgeScopeConfig?.mode || 'current-project',
    projectIds: [...(skill.knowledgeScopeConfig?.projectIds || [])],
    itemIds: [...(skill.knowledgeScopeConfig?.itemIds || [])],
    sourceTypes: [...(skill.knowledgeScopeConfig?.sourceTypes || ['knowledge', 'requirements', 'competitors', 'assets'])]
  },
  applicableScenariosText: (skill.applicableScenarios || []).join('\n'),
  requiredInputsText: (skill.requiredInputs || []).join('\n'),
  knowledgeScopesText: (skill.knowledgeScopes || []).join('\n'),
  stepsText: (skill.steps || []).join('\n'),
  followUpRulesText: (skill.followUpRules || []).join('\n'),
  qualityChecksText: (skill.qualityChecks || []).join('\n')
}
```

- [ ] **Step 3: Update `draftFromText`**

Ensure returned object includes:

```js
visibility: draft.visibility || 'project',
projectId: draft.visibility === 'project' ? (draft.projectId || state.currentProjectId) : '',
inputFields: draft.inputFields || [],
knowledgeScopeConfig: draft.knowledgeScopeConfig,
```

- [ ] **Step 4: Default new Skill to current project**

In `startCreateSkill`, include:

```js
visibility: 'project',
projectId: state.currentProjectId,
inputFields: [
  {
    id: crypto.randomUUID(),
    label: '原始需求',
    type: 'textarea',
    required: true,
    placeholder: '描述你希望 AI 处理的需求或设计任务',
    helpText: '',
    options: [],
    defaultValue: ''
  }
],
knowledgeScopeConfig: {
  mode: 'current-project',
  projectIds: [],
  itemIds: [],
  sourceTypes: ['knowledge', 'requirements', 'competitors', 'assets']
}
```

- [ ] **Step 5: Add field editor functions**

Add:

```js
function addSkillInputField() {
  skillEditor.draft.inputFields.push({
    id: crypto.randomUUID(),
    label: '新字段',
    type: 'text',
    required: false,
    placeholder: '',
    helpText: '',
    options: [],
    defaultValue: ''
  })
}

function removeSkillInputField(fieldId) {
  skillEditor.draft.inputFields = skillEditor.draft.inputFields.filter((field) => field.id !== fieldId)
}

function fieldOptionsText(field) {
  return (field.options || []).join('\n')
}

function updateFieldOptions(field, value) {
  field.options = value.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
}

function toggleScopeType(type) {
  const selected = new Set(skillEditor.draft.knowledgeScopeConfig.sourceTypes || [])
  if (selected.has(type)) selected.delete(type)
  else selected.add(type)
  skillEditor.draft.knowledgeScopeConfig.sourceTypes = [...selected]
}
```

- [ ] **Step 6: Add Skill Builder UI sections**

Inside `.skill-editor-grid`, after category, add:

```vue
<label>可见范围<select v-model="skillEditor.draft.visibility">
  <option value="project">当前项目</option>
  <option value="global">所有项目</option>
</select></label>
```

After basic text fields, add:

```vue
<section class="skill-builder-section wide">
  <div class="section-title-row">
    <strong>运行表单字段</strong>
    <button type="button" @click="addSkillInputField">添加字段</button>
  </div>
  <div v-for="field in skillEditor.draft.inputFields" :key="field.id" class="skill-field-row">
    <input v-model="field.label" placeholder="字段名" />
    <select v-model="field.type">
      <option value="text">单行文本</option>
      <option value="textarea">多行文本</option>
      <option value="single-select">单选</option>
      <option value="multi-select">多选</option>
      <option value="number">数字</option>
      <option value="boolean">开关</option>
    </select>
    <label class="inline-check"><input v-model="field.required" type="checkbox" /> 必填</label>
    <input v-model="field.placeholder" placeholder="占位提示" />
    <textarea
      v-if="field.type === 'single-select' || field.type === 'multi-select'"
      :value="fieldOptionsText(field)"
      placeholder="选项，一行一个"
      @input="updateFieldOptions(field, $event.target.value)"
    ></textarea>
    <button type="button" @click="removeSkillInputField(field.id)">删除</button>
  </div>
</section>

<section class="skill-builder-section wide">
  <strong>知识库范围</strong>
  <select v-model="skillEditor.draft.knowledgeScopeConfig.mode">
    <option value="current-project">当前项目</option>
    <option value="selected-projects">指定项目</option>
    <option value="selected-items">指定知识条目</option>
    <option value="all-projects">全部项目</option>
  </select>
  <div class="scope-chip-row">
    <label v-for="type in ['knowledge', 'requirements', 'competitors', 'assets']" :key="type">
      <input
        type="checkbox"
        :checked="skillEditor.draft.knowledgeScopeConfig.sourceTypes.includes(type)"
        @change="toggleScopeType(type)"
      />
      {{ type }}
    </label>
  </div>
  <select
    v-if="skillEditor.draft.knowledgeScopeConfig.mode === 'selected-projects'"
    v-model="skillEditor.draft.knowledgeScopeConfig.projectIds"
    multiple
  >
    <option v-for="project in state.projects" :key="project.id" :value="project.id">
      {{ displayProjectName(project) }}
    </option>
  </select>
</section>
```

- [ ] **Step 7: Normalize before save**

In `saveSkillDraft`, build `skill` with:

```js
const skill = normalizeSkill({
  ...source,
  id: source.id || skillEditor.draft.id || crypto.randomUUID(),
  source: 'user',
  status: 'active',
  visibility: source.visibility || skillEditor.draft.visibility || 'project',
  projectId: (source.visibility || skillEditor.draft.visibility) === 'global' ? '' : (source.projectId || state.currentProjectId)
})
```

- [ ] **Step 8: Add styles**

In `src/styles.css`, add:

```css
.skill-builder-section {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  display: grid;
  gap: 10px;
}

.section-title-row,
.scope-chip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.skill-field-row {
  display: grid;
  grid-template-columns: 1.2fr 140px 90px 1.5fr auto;
  gap: 8px;
  align-items: start;
}

.skill-field-row textarea {
  grid-column: 1 / -2;
  min-height: 64px;
}

.inline-check {
  display: flex;
  align-items: center;
  gap: 6px;
}
```

- [ ] **Step 9: Run verification**

Run: `npm test && npm run build`

Expected: both PASS.

---

### Task 6: Workflow UI Candidate Options, Final Conclusion, and Asset Save

**Files:**
- Modify: `src/App.vue`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `applyCandidateOption`, `ensureFinalConclusion`, updated workflow run fields.
- Produces: UI that lets users select a candidate option and saves final conclusion as main asset content.

- [ ] **Step 1: Import workflow helpers**

Update workflow import:

```js
import {
  acceptCurrentStep,
  applyCandidateOption,
  canAdvanceStep,
  canEnterNextStep,
  completeCurrentStep,
  createWorkflowRun,
  ensureFinalConclusion,
  exportWorkflowRunMarkdown,
  generateStepDraft,
  getBuiltinWorkflows,
  getCurrentStep,
  regenerateStepDraft
} from './services/workflows'
```

- [ ] **Step 2: Add active candidate computed**

Add:

```js
const activeWorkflowOptions = computed(() => {
  if (!activeWorkflowRun.value || !activeWorkflowStep.value) return []
  return activeWorkflowRun.value.candidateOptions?.[activeWorkflowStep.value.id] || []
})
```

- [ ] **Step 3: Add option apply function**

Add:

```js
function chooseWorkflowOption(optionId) {
  if (!state.activeWorkflowRun) return
  state.activeWorkflowRun = applyCandidateOption(state.activeWorkflowRun, optionId)
  workflowStepOutput.value = state.activeWorkflowRun.stepDraftOutputs[activeWorkflowStep.value.id] || ''
  setStatus(skillWorkbenchStatus, 'success', '已选择候选方案，可以继续编辑或采纳')
}
```

- [ ] **Step 4: Show candidate options in workflow card**

After the AI output editor section, add:

```vue
<section v-if="activeWorkflowOptions.length" class="candidate-options">
  <div class="panel-head">
    <div>
      <h3>候选方案</h3>
      <p>选择一个方案填入当前输出，再继续编辑、质疑或采纳。</p>
    </div>
  </div>
  <button
    v-for="option in activeWorkflowOptions"
    :key="option.id"
    type="button"
    class="candidate-option"
    @click="chooseWorkflowOption(option.id)"
  >
    <strong>{{ option.title }}</strong>
    <span>{{ option.summary }}</span>
    <small>{{ option.tradeoffs.join(' / ') }}</small>
  </button>
</section>
```

- [ ] **Step 5: Ensure final conclusion before saving**

At the top of `saveWorkflowAsset`, before content generation:

```js
if (state.activeWorkflowRun.status === 'completed') {
  state.activeWorkflowRun = ensureFinalConclusion(state.activeWorkflowRun)
}
```

Build asset content:

```js
const content = exportWorkflowRunMarkdown(state.activeWorkflowRun)
```

Ensure asset and hidden run record include:

```js
projectId: state.currentProjectId,
finalConclusion: state.activeWorkflowRun.finalConclusion || null,
```

- [ ] **Step 6: Add final conclusion panel**

After workflow shell, add:

```vue
<section v-if="activeWorkflowRun?.finalConclusion" class="panel final-conclusion-panel">
  <div class="panel-head">
    <div>
      <h3>最终结论</h3>
      <p>{{ activeWorkflowRun.finalConclusion.summary }}</p>
    </div>
  </div>
  <pre class="code-block">{{ activeWorkflowRun.finalConclusion.recommendedPlan }}</pre>
  <div class="final-grid">
    <div>
      <strong>关键决策</strong>
      <span v-for="item in activeWorkflowRun.finalConclusion.keyDecisions" :key="item">{{ item }}</span>
    </div>
    <div>
      <strong>下一步任务</strong>
      <span v-for="item in activeWorkflowRun.finalConclusion.nextTasks" :key="item">{{ item }}</span>
    </div>
  </div>
</section>
```

- [ ] **Step 7: Add styles**

In `src/styles.css`, add:

```css
.candidate-options {
  display: grid;
  gap: 8px;
}

.candidate-option {
  display: grid;
  gap: 4px;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--surface);
}

.candidate-option small {
  color: var(--muted);
}

.final-conclusion-panel {
  margin-top: 16px;
}

.final-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.final-grid div {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  display: grid;
  gap: 6px;
}
```

- [ ] **Step 8: Run final local verification**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

- [ ] **Step 9: Browser verification**

With dev server at `http://localhost:5288/`, verify:

1. Create a new project and switch to it.
2. Import one knowledge item and confirm it only appears in that project.
3. Create a project Skill with at least two form fields.
4. Save and reopen the Skill.
5. Start `需求拆解卡片流`.
6. Generate step 1 and choose `推荐方案`.
7. Accept all steps through completion.
8. Confirm final conclusion appears.
9. Save asset and confirm asset is visible only in current project.

Expected: no console errors, build remains green, full flow is clickable.

---

## Self-Review

- Spec coverage: project scoping is Task 1 and Task 4; Skill Builder model and UI are Task 2 and Task 5; workflow 3 options and final conclusion are Task 3 and Task 6; tests and browser verification are included.
- Placeholder scan: no TBD/TODO/fill-later language remains.
- Type consistency: `visibility`, `projectId`, `inputFields`, `knowledgeScopeConfig`, `candidateOptions`, and `finalConclusion` use the same names across service tests, services, and UI tasks.
