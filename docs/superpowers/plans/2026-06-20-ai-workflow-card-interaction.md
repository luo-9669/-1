# AI Workflow Card Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the workflow runner into card-based AI work units where each step can be generated, challenged, regenerated, accepted, versioned, and then advanced.

**Architecture:** Keep the existing Vue 3 single-page app and workflow service module. Add workflow-run state helpers in `src/services/workflows.js`, keep UI orchestration in `src/App.vue`, and add focused card styles in `src/styles.css`.

**Tech Stack:** Vue 3, Vite, plain JavaScript modules, Node `assert` tests, local browser state persistence.

## Global Constraints

- Do not connect a real remote AI service in this phase.
- Do not add multi-user collaboration comments.
- Do not add a rich text editor.
- Do not add visual whiteboard or flowchart drag-and-drop.
- Do not add Figma auto-generation.
- Prioritize the workflow runner page; do not restructure Project Diagnosis, Asset Library, or Skill Center.
- Keep existing `交互方案生成` workflow available.
- Add `需求拆解卡片流` workflow without removing existing `需求拆解四步法`.
- This workspace is not a git repository, so replace commit steps with a local change summary check.

---

## File Structure

- Modify: `src/services/workflows.js`
  - Owns workflow definitions and deterministic local workflow behavior.
  - Add `demand-card-flow`.
  - Add card-state fields to `createWorkflowRun`.
  - Add helper functions for draft generation, challenge regeneration, accepting a step, checking whether a step can advance, and exporting challenge/version history.

- Modify: `tests/workflows.test.mjs`
  - Owns unit tests for workflow behavior.
  - Add tests for card state, generation, challenge regeneration, acceptance, blocking advancement before acceptance, and Markdown export.

- Modify: `src/App.vue`
  - Owns workflow runner UI and page orchestration.
  - Replace the current single active-step textarea with a vertical card flow.
  - Add challenge input, quick challenge buttons, version list, accept action, and next-step action.

- Modify: `src/styles.css`
  - Owns page presentation.
  - Add card-flow, challenge, version, and accepted-summary styles.

- Modify: `index.html`
  - Bump the script cachebuster to `skill-workflow-v4`.

## Task 1: Add Failing Tests For Card Workflow State

**Files:**
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes existing exports: `getBuiltinWorkflows()`, `createWorkflowRun(workflow, input)`, `exportWorkflowRunMarkdown(run)`
- Produces expectations for new exports:
  - `generateStepDraft(run, challenge = '')`
  - `acceptCurrentStep(run, content)`
  - `canEnterNextStep(run)`
  - `regenerateStepDraft(run, challenge)`

- [ ] **Step 1: Update imports**

Modify the import from `../src/services/workflows.js` to include:

```js
  acceptCurrentStep,
  canEnterNextStep,
  generateStepDraft,
  regenerateStepDraft,
```

The full import should be:

```js
import {
  acceptCurrentStep,
  canAdvanceStep,
  canEnterNextStep,
  createWorkflowRun,
  getBuiltinWorkflows,
  produceStepOutput,
  completeCurrentStep,
  exportWorkflowRunMarkdown,
  generateStepDraft,
  regenerateStepDraft
} from '../src/services/workflows.js'
```

- [ ] **Step 2: Add demand card flow definition test**

Append this test:

```js
test('provides demand card flow with six card steps', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  assert.ok(workflow)
  assert.equal(workflow.name, '需求拆解卡片流')
  assert.equal(workflow.assetType, '需求拆解卡片资产')
  assert.deepEqual(workflow.steps.map((step) => step.id), [
    'card-requirement-understanding',
    'card-requirement-challenge',
    'card-scenario-breakdown',
    'card-solution-generation',
    'card-interaction-transform',
    'card-quality-validation'
  ])
})
```

- [ ] **Step 3: Add initial card state test**

Append this test:

```js
test('workflow run starts with card state stores', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  const run = createWorkflowRun(workflow, '做一个 AI 需求拆解工具')

  assert.deepEqual(run.stepDraftOutputs, {})
  assert.deepEqual(run.stepChallenges, {})
  assert.deepEqual(run.stepVersions, {})
  assert.equal(canEnterNextStep(run).ok, false)
  assert.equal(canEnterNextStep(run).reason, '当前步骤还未采纳')
})
```

- [ ] **Step 4: Add generation and acceptance test**

Append this test:

```js
test('generates draft output and accepts current card step', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  const run = createWorkflowRun(workflow, '想把模糊需求拆成可执行交互方案')
  run.stepInputs[run.currentStepId] = {
    目标用户: '产品交互设计师',
    原始目标: '减少需求理解偏差'
  }

  const generated = generateStepDraft(run)
  assert.match(generated.stepDraftOutputs[run.currentStepId], /# 需求理解/)
  assert.equal(generated.stepVersions[run.currentStepId].length, 1)
  assert.equal(generated.stepVersions[run.currentStepId][0].accepted, false)

  const accepted = acceptCurrentStep(generated, generated.stepDraftOutputs[generated.currentStepId])
  assert.equal(accepted.stepOutputs['card-requirement-understanding'], generated.stepDraftOutputs[generated.currentStepId])
  assert.equal(accepted.stepVersions['card-requirement-understanding'][0].accepted, true)
  assert.equal(canEnterNextStep(accepted).ok, true)
})
```

- [ ] **Step 5: Add challenge regeneration test**

Append this test:

```js
test('regenerates card output from challenge and records versions', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  const run = createWorkflowRun(workflow, '审批流程太乱，需要重新拆解')
  run.stepInputs[run.currentStepId] = {
    目标用户: '审批发起人',
    原始目标: '减少审批返工'
  }

  const generated = generateStepDraft(run)
  const challenged = regenerateStepDraft(generated, '补充 B 端权限和异常状态，不要只写主流程')

  assert.equal(challenged.stepChallenges[run.currentStepId].length, 1)
  assert.equal(challenged.stepVersions[run.currentStepId].length, 2)
  assert.match(challenged.stepDraftOutputs[run.currentStepId], /补充 B 端权限和异常状态/)
})
```

- [ ] **Step 6: Add markdown export test**

Append this test:

```js
test('exports accepted card outputs with challenge history', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'demand-card-flow')
  let run = createWorkflowRun(workflow, '拆解 AI 工作流卡片')
  run.stepInputs[run.currentStepId] = {
    目标用户: 'UX 设计师',
    原始目标: '让 AI 产出可质疑'
  }

  run = generateStepDraft(run)
  run = regenerateStepDraft(run, '增加质疑和重新生成机制')
  run = acceptCurrentStep(run, run.stepDraftOutputs[run.currentStepId])

  const markdown = exportWorkflowRunMarkdown(run)
  assert.match(markdown, /# 需求拆解卡片流/)
  assert.match(markdown, /## Step 1：需求理解/)
  assert.match(markdown, /### 质疑记录/)
  assert.match(markdown, /增加质疑和重新生成机制/)
})
```

- [ ] **Step 7: Run tests and verify failure**

Run:

```bash
npm test
```

Expected: fails because `demand-card-flow` and card helper exports do not exist.

## Task 2: Implement Card Workflow Domain Logic

**Files:**
- Modify: `src/services/workflows.js`

**Interfaces:**
- Produces:
  - `generateStepDraft(run, challenge = '') => run`
  - `regenerateStepDraft(run, challenge) => run`
  - `acceptCurrentStep(run, content) => run`
  - `canEnterNextStep(run) => { ok: boolean, reason: string }`
  - Built-in workflow `demand-card-flow`

- [ ] **Step 1: Add demand card workflow**

Add this constant after `demandFourStep`:

```js
const demandCardFlow = {
  id: 'demand-card-flow',
  name: '需求拆解卡片流',
  assetType: '需求拆解卡片资产',
  description: '用卡片式 AI 工作流完成需求理解、质疑、场景拆解、方案生成、交互转化和质量校验。',
  recommendedFor: ['需求拆解', '模糊需求', '交互设计', 'AI 工作流'],
  steps: [
    {
      id: 'card-requirement-understanding',
      title: 'Step 1：需求理解',
      goal: '明确当前理解、目标用户、业务目标、成功标准和缺失信息。',
      requiredFields: ['目标用户', '原始目标'],
      outputTitle: '需求理解'
    },
    {
      id: 'card-requirement-challenge',
      title: 'Step 2：需求质疑',
      goal: '指出需求不清楚的问题、冲突点、风险和关键追问。',
      requiredFields: ['关键疑点', '主要风险'],
      outputTitle: '需求质疑'
    },
    {
      id: 'card-scenario-breakdown',
      title: 'Step 3：场景拆解',
      goal: '拆解用户场景、主流程、异常流程和边界条件。',
      requiredFields: ['核心场景', '异常场景'],
      outputTitle: '场景拆解'
    },
    {
      id: 'card-solution-generation',
      title: 'Step 4：方案生成',
      goal: '生成 MVP、完整方案和低风险方案。',
      requiredFields: ['推荐方向'],
      outputTitle: '方案生成'
    },
    {
      id: 'card-interaction-transform',
      title: 'Step 5：交互转化',
      goal: '转成页面结构、核心组件、关键状态和反馈机制。',
      requiredFields: ['关键页面', '核心组件'],
      outputTitle: '交互转化'
    },
    {
      id: 'card-quality-validation',
      title: 'Step 6：质量校验',
      goal: '输出验收标准、风险清单、待确认问题和开发任务。',
      requiredFields: ['验收标准', '待确认问题'],
      outputTitle: '质量校验'
    }
  ]
}
```

- [ ] **Step 2: Include workflow in built-ins**

Replace `getBuiltinWorkflows()` with:

```js
export function getBuiltinWorkflows() {
  return [clone(demandFourStep), clone(demandCardFlow), clone(journeyMapFlow), clone(interactionDesignFlow)]
}
```

- [ ] **Step 3: Add card state fields in `createWorkflowRun`**

Add these fields after `stepOutputs: {},`:

```js
    stepDraftOutputs: {},
    stepChallenges: {},
    stepVersions: {},
```

- [ ] **Step 4: Add previous accepted output renderer**

Add after `renderKeyValues`:

```js
function renderAcceptedContext(run, currentStepId) {
  const accepted = run.steps
    .filter((step) => step.id !== currentStepId && run.stepOutputs?.[step.id])
    .map((step) => `### ${step.title}\n${run.stepOutputs[step.id]}`)
  return accepted.length ? accepted.join('\n\n') : '暂无已采纳上文'
}
```

- [ ] **Step 5: Add card output renderer**

Add after `produceDemandOutput`:

```js
function produceCardOutput(step, input, rawDemand, context = '暂无已采纳上文', challenge = '') {
  const challengeBlock = challenge
    ? `\n\n## 根据质疑修订\n${challenge}\n\n## 修订重点\n- 回应用户质疑，不覆盖原始目标。\n- 补充遗漏的角色、场景、状态或约束。\n- 保留可以进入下一步的明确结论。`
    : ''

  if (step.id === 'card-requirement-understanding') {
    return `# 需求理解

## 原始需求
${rawDemand}

## 当前理解
- 目标用户：${input.目标用户 || '未明确'}
- 原始目标：${input.原始目标 || '未明确'}
- 业务目标：减少需求理解偏差，让后续交互方案更可靠。
- 成功标准：用户能看懂、质疑、修正并采纳每一步结论。

## 缺失信息
- 业务约束
- 关键角色权限
- 当前流程样例

## 下一步建议
进入需求质疑，先检查这个理解是否可靠。${challengeBlock}`
  }
  if (step.id === 'card-requirement-challenge') {
    return `# 需求质疑

## 关键疑点
${input.关键疑点 || '目标用户、业务边界、成功指标是否清楚。'}

## 主要风险
${input.主要风险 || 'AI 直接生成方案会掩盖需求不清晰的问题。'}

## 需要追问
- 谁是主用户，谁是审批或决策角色？
- 当前流程最痛的阻塞点是什么？
- 哪些规则必须保留？

## 已采纳上文
${context}${challengeBlock}`
  }
  if (step.id === 'card-scenario-breakdown') {
    return `# 场景拆解

## 核心场景
${input.核心场景 || '用户输入需求，系统逐步拆解并生成交互方案。'}

## 主流程
1. 输入需求。
2. 生成需求理解。
3. 用户质疑并重新生成。
4. 采纳本步进入下一步。

## 异常场景
${input.异常场景 || '输入缺失、理解偏差、权限不足、输出不可采纳。'}${challengeBlock}`
  }
  if (step.id === 'card-solution-generation') {
    return `# 方案生成

## MVP 方案
先做卡片式流程、质疑输入、重新生成、采纳和版本记录。

## 完整方案
增加知识库引用、版本对比、资产评审和团队协作。

## 低风险方案
保留原流程页结构，只替换当前步骤为卡片交互。

## 推荐方向
${input.推荐方向 || 'MVP 方案'}${challengeBlock}`
  }
  if (step.id === 'card-interaction-transform') {
    return `# 交互转化

## 关键页面
${input.关键页面 || '流程运行页'}

## 核心组件
${input.核心组件 || '步骤卡片、质疑输入、版本记录、采纳按钮'}

## 状态
- 待输入
- 已生成
- 已质疑
- 已采纳
- 已锁定${challengeBlock}`
  }
  return `# 质量校验

## 验收标准
${input.验收标准 || '用户必须能生成、质疑、重新生成、采纳并进入下一步。'}

## 待确认问题
${input.待确认问题 || '是否需要接入真实知识库和大模型。'}

## 开发任务
- 增加卡片状态数据。
- 增加重新生成和版本记录。
- 改造流程运行页 UI。
- 导出质疑记录。${challengeBlock}`
}
```

- [ ] **Step 6: Add card helper functions**

Add before `completeCurrentStep`:

```js
function makeVersion(content, challenge = '', accepted = false) {
  return {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    content,
    challenge,
    accepted,
    createdAt: nowIso()
  }
}

export function generateStepDraft(run, challenge = '') {
  const next = clone(run)
  const step = getCurrentStep(next)
  const input = next.stepInputs[step.id] || {}
  const context = renderAcceptedContext(next, step.id)
  const content = next.workflowId === 'demand-card-flow'
    ? produceCardOutput(step, input, next.input, context, challenge)
    : produceStepOutput(next).content
  next.stepDraftOutputs ||= {}
  next.stepChallenges ||= {}
  next.stepVersions ||= {}
  next.stepDraftOutputs[step.id] = content
  next.stepVersions[step.id] ||= []
  next.stepVersions[step.id].push(makeVersion(content, challenge))
  next.steps = next.steps.map((item) =>
    item.id === step.id ? { ...item, status: challenge ? 'challenged' : 'generated' } : item
  )
  next.updatedAt = nowIso()
  return next
}

export function regenerateStepDraft(run, challenge) {
  const trimmed = String(challenge || '').trim()
  if (!trimmed) return clone(run)
  const next = clone(run)
  const step = getCurrentStep(next)
  next.stepChallenges ||= {}
  next.stepChallenges[step.id] ||= []
  next.stepChallenges[step.id].push({
    id: crypto.randomUUID?.() || `${Date.now()}`,
    content: trimmed,
    createdAt: nowIso()
  })
  return generateStepDraft(next, trimmed)
}

export function acceptCurrentStep(run, content) {
  const next = clone(run)
  const step = getCurrentStep(next)
  const acceptedContent = String(content || next.stepDraftOutputs?.[step.id] || '').trim()
  if (!acceptedContent) return next
  next.stepOutputs[step.id] = acceptedContent
  next.stepDraftOutputs ||= {}
  next.stepDraftOutputs[step.id] = acceptedContent
  next.stepVersions ||= {}
  next.stepVersions[step.id] ||= []
  if (!next.stepVersions[step.id].length) {
    next.stepVersions[step.id].push(makeVersion(acceptedContent, '', true))
  } else {
    next.stepVersions[step.id] = next.stepVersions[step.id].map((version, index, versions) => ({
      ...version,
      accepted: index === versions.length - 1
    }))
  }
  next.steps = next.steps.map((item) =>
    item.id === step.id ? { ...item, status: 'accepted' } : item
  )
  next.updatedAt = nowIso()
  return next
}

export function canEnterNextStep(run) {
  const step = getCurrentStep(run)
  if (!run.stepOutputs?.[step.id]) {
    return { ok: false, reason: '当前步骤还未采纳' }
  }
  return { ok: true, reason: '' }
}
```

- [ ] **Step 7: Update `completeCurrentStep` to preserve accepted status**

Replace:

```js
  next.stepOutputs[step.id] = content
  next.steps[stepIndex].status = 'completed'
```

with:

```js
  next.stepOutputs[step.id] = content
  next.steps[stepIndex].status = next.steps[stepIndex].status === 'accepted' ? 'accepted' : 'completed'
```

- [ ] **Step 8: Update Markdown export**

Inside `exportWorkflowRunMarkdown(run)`, after each step output line, add challenge history:

```js
    const challenges = run.stepChallenges?.[step.id] || []
    if (challenges.length) {
      lines.push('### 质疑记录', '')
      challenges.forEach((challenge) => {
        lines.push(`- ${challenge.content}`, '')
      })
    }
```

This block must be inside the `run.steps.forEach((step) => { ... })` loop after:

```js
    lines.push(run.stepOutputs[step.id] || '未完成', '')
```

- [ ] **Step 9: Run tests**

Run:

```bash
npm test
```

Expected: all workflow tests pass.

## Task 3: Wire Card State Into App Workflow Actions

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes new workflow exports:
  - `acceptCurrentStep`
  - `canEnterNextStep`
  - `generateStepDraft`
  - `regenerateStepDraft`
- Produces UI state:
  - `workflowStepChallenge`
  - `activeWorkflowVersions`
  - `activeWorkflowChallenges`
  - `currentStepAccepted`
  - `quickChallenges`

- [ ] **Step 1: Update workflow imports**

Add these names to the import from `./services/workflows`:

```js
  acceptCurrentStep,
  canEnterNextStep,
  generateStepDraft,
  regenerateStepDraft,
```

- [ ] **Step 2: Add challenge state**

Add after `const workflowStepOutput = ref('')`:

```js
const workflowStepChallenge = ref('')
```

- [ ] **Step 3: Add computed helpers**

Add after `workflowGate`:

```js
const activeWorkflowVersions = computed(() => {
  if (!activeWorkflowRun.value || !activeWorkflowStep.value) return []
  return activeWorkflowRun.value.stepVersions?.[activeWorkflowStep.value.id] || []
})

const activeWorkflowChallenges = computed(() => {
  if (!activeWorkflowRun.value || !activeWorkflowStep.value) return []
  return activeWorkflowRun.value.stepChallenges?.[activeWorkflowStep.value.id] || []
})

const currentStepAccepted = computed(() => {
  if (!activeWorkflowRun.value || !activeWorkflowStep.value) return false
  return Boolean(activeWorkflowRun.value.stepOutputs?.[activeWorkflowStep.value.id])
})

const quickChallenges = [
  '哪里不清楚？',
  '有什么风险？',
  '补异常场景',
  '更贴近 B 端',
  '重新结合知识库'
]
```

- [ ] **Step 4: Sync draft output from new card fields**

Replace this line in `syncWorkflowDraftFromRun()`:

```js
  workflowStepOutput.value = activeWorkflowRun.value.stepOutputs[activeWorkflowStep.value.id] || ''
```

with:

```js
  workflowStepOutput.value =
    activeWorkflowRun.value.stepDraftOutputs?.[activeWorkflowStep.value.id] ||
    activeWorkflowRun.value.stepOutputs?.[activeWorkflowStep.value.id] ||
    ''
  workflowStepChallenge.value = ''
```

- [ ] **Step 5: Update `generateWorkflowStepOutput`**

Replace:

```js
  const output = produceStepOutput(state.activeWorkflowRun)
  workflowStepOutput.value = output.content
  setStatus(skillWorkbenchStatus, 'success', `${activeWorkflowStep.value.title} 已生成，可编辑后确认`)
```

with:

```js
  state.activeWorkflowRun = generateStepDraft(state.activeWorkflowRun)
  workflowStepOutput.value = state.activeWorkflowRun.stepDraftOutputs[activeWorkflowStep.value.id] || ''
  setStatus(skillWorkbenchStatus, 'success', `${activeWorkflowStep.value.title} 已生成，可质疑、编辑或采纳`)
```

- [ ] **Step 6: Add quick challenge and regenerate actions**

Add after `generateWorkflowStepOutput()`:

```js
function appendQuickChallenge(text) {
  workflowStepChallenge.value = workflowStepChallenge.value
    ? `${workflowStepChallenge.value}\n${text}`
    : text
}

function regenerateWorkflowStepOutput() {
  if (!state.activeWorkflowRun) return
  persistWorkflowStepInput()
  const challenge = workflowStepChallenge.value.trim()
  if (!challenge) {
    setStatus(skillWorkbenchStatus, 'failed', '请先写下质疑或修改意见')
    return
  }
  state.activeWorkflowRun = regenerateStepDraft(state.activeWorkflowRun, challenge)
  workflowStepOutput.value = state.activeWorkflowRun.stepDraftOutputs[activeWorkflowStep.value.id] || ''
  workflowStepChallenge.value = ''
  setStatus(skillWorkbenchStatus, 'success', `${activeWorkflowStep.value.title} 已根据质疑重新生成`)
}
```

- [ ] **Step 7: Replace `confirmWorkflowStep` with accept-then-next behavior**

Replace the full `confirmWorkflowStep()` function with:

```js
function acceptWorkflowStep() {
  if (!state.activeWorkflowRun || !workflowStepOutput.value.trim()) {
    setStatus(skillWorkbenchStatus, 'failed', '请先生成或填写当前步骤输出')
    return
  }
  persistWorkflowStepInput()
  state.activeWorkflowRun = acceptCurrentStep(state.activeWorkflowRun, workflowStepOutput.value)
  syncWorkflowDraftFromRun()
  setStatus(skillWorkbenchStatus, 'success', `${activeWorkflowStep.value.title} 已采纳，可以进入下一步`)
}

function confirmWorkflowStep() {
  if (!state.activeWorkflowRun) return
  const gate = canEnterNextStep(state.activeWorkflowRun)
  if (!gate.ok) {
    setStatus(skillWorkbenchStatus, 'failed', gate.reason)
    return
  }
  state.activeWorkflowRun = completeCurrentStep(
    state.activeWorkflowRun,
    state.activeWorkflowRun.stepOutputs[activeWorkflowStep.value.id]
  )
  syncWorkflowDraftFromRun()
  const completed = state.activeWorkflowRun.status === 'completed'
  setStatus(skillWorkbenchStatus, 'success', completed ? '完整流程已完成，可以保存资产' : '已进入下一步')
}
```

- [ ] **Step 8: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

## Task 4: Replace Current Step UI With Card Interaction

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes app state/actions from Task 3
- Produces card UI with fields, output, challenge input, versions, accept, and next actions

- [ ] **Step 1: Replace current step card template**

Inside the workflow page, replace the entire:

```vue
<section v-if="activeWorkflowStep" class="panel workflow-current">
...
</section>
```

with:

```vue
<section v-if="activeWorkflowStep" class="workflow-card-stack">
  <article
    v-for="step in activeWorkflowRun.steps"
    :key="step.id"
    class="workflow-card"
    :class="{ active: step.id === activeWorkflowRun.currentStepId, accepted: step.status === 'accepted', locked: step.status === 'locked' }"
  >
    <div class="workflow-card-head">
      <div>
        <h3>{{ step.title }}</h3>
        <p>{{ step.goal }}</p>
      </div>
      <span>{{ step.status === 'accepted' ? '已采纳' : step.status === 'locked' ? '未解锁' : step.id === activeWorkflowRun.currentStepId ? '当前卡片' : '已生成' }}</span>
    </div>

    <div v-if="step.id !== activeWorkflowRun.currentStepId" class="workflow-card-summary">
      <pre v-if="activeWorkflowRun.stepOutputs?.[step.id]" class="code-block">{{ activeWorkflowRun.stepOutputs[step.id] }}</pre>
      <p v-else>完成前置卡片后解锁。</p>
    </div>

    <div v-else class="workflow-card-body">
      <div class="workflow-fields">
        <label v-for="field in activeWorkflowStep.requiredFields" :key="field">
          {{ field }}
          <input v-model="workflowStepDraft[field]" :placeholder="`填写${field}`" />
        </label>
      </div>

      <div v-if="!workflowGate.ok" class="validation-box">
        <strong>需要补充后才能生成本步</strong>
        <span>缺失：{{ workflowGate.missing.join('、') }}</span>
      </div>

      <section class="workflow-output-card">
        <div class="panel-head">
          <div>
            <h3>AI 产出</h3>
            <p>可以直接编辑，编辑后的内容也可以被采纳。</p>
          </div>
          <span>{{ activeWorkflowVersions.length }} 个版本</span>
        </div>
        <textarea v-model="workflowStepOutput" class="workflow-output-editor" placeholder="点击生成本步后，AI 产出会出现在这里。"></textarea>
      </section>

      <section class="challenge-panel">
        <div class="panel-head">
          <div>
            <h3>质疑与修改</h3>
            <p>指出哪里不对，系统会基于你的质疑重新生成。</p>
          </div>
        </div>
        <div class="quick-challenge-row">
          <button v-for="item in quickChallenges" :key="item" type="button" @click="appendQuickChallenge(item)">
            {{ item }}
          </button>
        </div>
        <textarea v-model="workflowStepChallenge" placeholder="例如：目标用户不对；补充 B 端权限；异常场景不够；不要只写主流程。"></textarea>
      </section>

      <div v-if="activeWorkflowChallenges.length" class="challenge-history">
        <strong>质疑记录</strong>
        <ul>
          <li v-for="challenge in activeWorkflowChallenges" :key="challenge.id">{{ challenge.content }}</li>
        </ul>
      </div>

      <div v-if="activeWorkflowVersions.length" class="version-list">
        <strong>版本记录</strong>
        <button
          v-for="version in activeWorkflowVersions"
          :key="version.id"
          type="button"
          :class="{ active: version.accepted }"
          @click="workflowStepOutput = version.content"
        >
          {{ version.accepted ? '已采纳' : '版本' }} · {{ new Date(version.createdAt).toLocaleTimeString() }}
        </button>
      </div>

      <div class="actions">
        <button type="button" :disabled="!workflowGate.ok" @click="generateWorkflowStepOutput">生成本步</button>
        <button type="button" :disabled="!workflowStepChallenge.trim()" @click="regenerateWorkflowStepOutput">重新生成</button>
        <button type="button" :disabled="!workflowStepOutput.trim()" @click="acceptWorkflowStep">采纳本步</button>
        <button class="primary" type="button" :disabled="!currentStepAccepted" @click="confirmWorkflowStep">进入下一步</button>
      </div>
    </div>
  </article>
</section>
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

## Task 5: Add Card Interaction Styles And Cachebuster

**Files:**
- Modify: `src/styles.css`
- Modify: `index.html`

**Interfaces:**
- Consumes class names from Task 4
- Produces readable, non-overlapping card workflow layout

- [ ] **Step 1: Add card styles**

Append to `src/styles.css`:

```css
.workflow-card-stack {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.workflow-card {
  border: 1px solid #e8eaec;
  border-radius: 8px;
  background: #fff;
  padding: 16px;
  display: grid;
  gap: 14px;
}

.workflow-card.active {
  border-color: #222529;
  box-shadow: 0 14px 36px rgba(34, 37, 41, 0.08);
}

.workflow-card.accepted {
  border-color: rgba(24, 160, 88, 0.42);
  background: #fbfffc;
}

.workflow-card.locked {
  color: #9da3ac;
  background: #f7f8fa;
}

.workflow-card-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.workflow-card-head h3,
.workflow-card-head p {
  margin: 0;
}

.workflow-card-head span {
  flex: none;
  color: #4c535c;
  font-size: 12px;
  font-weight: 800;
}

.workflow-card-body {
  display: grid;
  gap: 14px;
}

.workflow-card-summary .code-block {
  max-height: 180px;
  overflow: auto;
}

.workflow-output-card,
.challenge-panel,
.challenge-history,
.version-list {
  border: 1px solid #e8eaec;
  border-radius: 8px;
  background: #f7f8fa;
  padding: 14px;
  display: grid;
  gap: 10px;
}

.workflow-output-card .panel-head,
.challenge-panel .panel-head {
  margin-bottom: 0;
}

.workflow-output-card .panel-head > span {
  color: #7f8792;
  font-size: 12px;
  font-weight: 800;
}

.quick-challenge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-challenge-row button,
.version-list button {
  height: 32px;
  font-size: 12px;
}

.challenge-history ul {
  margin: 0;
  padding-left: 18px;
  color: #4c535c;
}

.version-list {
  grid-template-columns: repeat(auto-fit, minmax(140px, max-content));
  align-items: center;
}

.version-list > strong {
  grid-column: 1 / -1;
}

.version-list button.active {
  border-color: rgba(24, 160, 88, 0.48);
  background: #ecfdf3;
}
```

- [ ] **Step 2: Bump cachebuster**

In `index.html`, replace:

```html
<script type="module" src="/src/main.js?v=skill-workflow-v3"></script>
```

with:

```html
<script type="module" src="/src/main.js?v=skill-workflow-v4"></script>
```

- [ ] **Step 3: Run checks**

Run:

```bash
npm test
npm run build
```

Expected: both pass.

## Task 6: Browser Verification

**Files:**
- Modify only files required to fix verification failures.

**Interfaces:**
- Consumes completed domain logic and UI
- Produces verified local app behavior

- [ ] **Step 1: Ensure dev server is available**

Run:

```bash
lsof -nP -iTCP:5288 -sTCP:LISTEN
```

Expected: one Vite process is listening. If no process is listening, run:

```bash
npm run dev -- --port 5288
```

- [ ] **Step 2: Verify card workflow in browser**

Open:

```text
http://localhost:5288/
```

Actions:

1. Go to `流程运行`.
2. Select `需求拆解卡片流`.
3. Fill original demand:

```text
我想把一个模糊需求拆成可质疑、可重新生成、可采纳的交互方案流程。
```

4. Start the flow.
5. Fill Step 1 fields:

```text
目标用户：产品交互设计师
原始目标：减少需求理解偏差
```

6. Click `生成本步`.
7. Enter challenge:

```text
补充 B 端权限和异常状态，不要只写主流程。
```

8. Click `重新生成`.
9. Click `采纳本步`.
10. Click `进入下一步`.

Expected:

- Current card shows `AI 产出`.
- Version count increases after regeneration.
- Challenge history shows the entered challenge.
- `进入下一步` is disabled until `采纳本步`.
- After entering next step, active card is `Step 2：需求质疑`.

- [ ] **Step 3: Verify asset export includes challenge**

After accepting at least one step, click `保存资产`, then open `资产库`.

Expected:

- Saved asset content includes `质疑记录`.
- Saved asset content includes the challenge text.

- [ ] **Step 4: Final checks**

Run:

```bash
npm test
npm run build
```

Expected: both pass.

## Self-Review

### Spec Coverage

- Card-based current step UI: Tasks 3 and 4.
- Challenge input and quick challenge buttons: Tasks 3, 4, and 5.
- Regeneration action: Tasks 1, 2, 3, and 4.
- Version record: Tasks 1, 2, 4, and 5.
- Accept-before-next behavior: Tasks 1, 2, 3, 4, and 6.
- Previous accepted output context: Task 2.
- Markdown export with challenge history: Tasks 1 and 2.
- New `需求拆解卡片流` workflow: Tasks 1 and 2.
- Browser validation: Task 6.

### Placeholder Scan

The plan contains no unresolved placeholders or missing function definitions.

### Type Consistency

- Workflow id is consistently `demand-card-flow`.
- Card state fields are consistently `stepDraftOutputs`, `stepChallenges`, and `stepVersions`.
- UI functions are consistently named `appendQuickChallenge`, `regenerateWorkflowStepOutput`, `acceptWorkflowStep`, and `confirmWorkflowStep`.
