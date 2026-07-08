# Skill Workbench IA Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Skill area into a usable workflow with separate Project Diagnosis, Workflow Runner, Asset Library, and Skill Center pages, plus a built-in Interaction Design workflow.

**Architecture:** Keep the current Vue 3 single-file app and local state model, but split the current overloaded `skills` view into four focused views. Keep workflow domain logic in `src/services/workflows.js`; keep UI state and persistence in `src/App.vue`; keep styling in `src/styles.css`.

**Tech Stack:** Vue 3, Vite, plain JavaScript modules, Node `assert` tests, local browser state persistence.

## Global Constraints

- Do not connect a real remote AI service in this phase.
- Do not implement real GitHub Skill installation in this phase.
- Do not add multi-user permissions, team collaboration, or cloud sync.
- Do not add Figma auto-generation or full RAG vector retrieval.
- Use current frontend state and persistence; no backend database migration.
- Running records must not be displayed as a full inline list on the main diagnosis or workflow page.
- User-created Skill editing must keep both form mode and Markdown mode.
- This workspace is not a git repository, so replace commit steps with a local change summary check.

---

## File Structure

- Modify: `src/services/workflows.js`
  - Owns built-in workflow definitions and deterministic local output generation.
  - Add `interaction-design-workflow`.
  - Add `produceInteractionOutput(step, input, rawDemand)`.

- Modify: `tests/workflows.test.mjs`
  - Owns workflow unit tests.
  - Add tests for the interaction workflow definition, output generation, step advancement, and markdown export.

- Modify: `src/App.vue`
  - Owns page layout, navigation, UI state, workflow actions, asset actions, and Skill editor actions.
  - Replace overloaded `activeView === 'skills'` page with `diagnosis`, `workflow`, `assets`, and `skillCenter`.
  - Keep old `factory`, `materials`, and `settings`.

- Modify: `src/styles.css`
  - Owns layout and visual polish.
  - Add focused styles for diagnosis dashboard, recommendation cards, workflow runner, asset library, asset detail, and Skill Center.
  - Remove or reduce styles that only supported the single overloaded Skill Workbench page.

- Modify: `index.html`
  - Bump the cachebuster query on `/src/main.js` after implementation so the browser does not keep stale UI.

## Task 1: Add Failing Tests For The Interaction Design Workflow

**Files:**
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `getBuiltinWorkflows()`, `createWorkflowRun(workflow, input)`, `canAdvanceStep(run)`, `produceStepOutput(run)`, `completeCurrentStep(run, content)`, `exportWorkflowRunMarkdown(run)`
- Produces: Test expectations for `interaction-design-workflow`

- [ ] **Step 1: Add workflow definition test**

Append this test to `tests/workflows.test.mjs`:

```js
test('provides interaction design workflow with seven precise steps', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'interaction-design-workflow')
  assert.ok(workflow)
  assert.equal(workflow.name, '交互方案生成')
  assert.equal(workflow.assetType, '交互方案')
  assert.deepEqual(workflow.steps.map((step) => step.id), [
    'interaction-diagnosis',
    'information-architecture',
    'core-task-flow',
    'page-structure',
    'component-states',
    'interaction-review',
    'delivery-breakdown'
  ])
  workflow.steps.forEach((step) => {
    assert.ok(step.title)
    assert.ok(step.goal)
    assert.ok(Array.isArray(step.requiredFields))
    assert.ok(step.requiredFields.length > 0)
    assert.ok(step.outputTitle)
  })
})
```

- [ ] **Step 2: Add gate and output test**

Append this test:

```js
test('interaction design workflow blocks missing fields and produces diagnosis output', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'interaction-design-workflow')
  const run = createWorkflowRun(workflow, '后台 Skill 工作台全部挤在一个页面，用户无法完整点击流程')

  assert.deepEqual(canAdvanceStep(run), {
    ok: false,
    missing: ['目标用户', '核心问题', '成功标准']
  })

  run.stepInputs[run.currentStepId] = {
    目标用户: '产品交互设计师',
    核心问题: '功能都堆在一个页面，主流程不清楚',
    成功标准: '用户能从诊断进入流程并保存资产'
  }

  const output = produceStepOutput(run)
  assert.equal(output.title, '需求诊断卡')
  assert.match(output.content, /# 需求诊断卡/)
  assert.match(output.content, /产品交互设计师/)
  assert.match(output.content, /推荐下一步/)
})
```

- [ ] **Step 3: Add advancement and export test**

Append this test:

```js
test('interaction design workflow advances and exports all confirmed outputs', () => {
  const workflow = getBuiltinWorkflows().find((item) => item.id === 'interaction-design-workflow')
  let run = createWorkflowRun(workflow, '重构流程通 Skill 工作台')
  const requiredInputsByStep = {
    'interaction-diagnosis': {
      目标用户: '交互设计师',
      核心问题: '页面信息架构混乱',
      成功标准: '完整流程可点击'
    },
    'information-architecture': {
      核心对象: '项目、Skill、流程、资产',
      导航结构: '项目诊断、流程运行、资产库、Skill 中心'
    },
    'core-task-flow': {
      主任务: '从需求进入 Skill 流程',
      关键分支: '信息不足时先诊断，信息足够时开始流程'
    },
    'page-structure': {
      关键页面: '项目诊断页、流程运行页、资产库页',
      主操作: '开始流程、确认步骤、保存资产'
    },
    'component-states': {
      关键组件: '步骤导航、输入表单、输出编辑器',
      异常状态: '缺少必填字段、输出为空、重复保存'
    },
    'interaction-review': {
      评审维度: '效率、一致性、可恢复性',
      主要风险: '用户不知道下一步动作'
    },
    'delivery-breakdown': {
      交付对象: '设计任务和开发任务',
      验收标准: '用户能完成至少前两步并保存资产'
    }
  }

  workflow.steps.forEach((step) => {
    run.stepInputs[run.currentStepId] = requiredInputsByStep[step.id]
    const output = produceStepOutput(run)
    run = completeCurrentStep(run, output.content)
  })

  assert.equal(run.status, 'completed')
  const markdown = exportWorkflowRunMarkdown(run)
  assert.match(markdown, /# 交互方案生成/)
  assert.match(markdown, /## Step 4：页面结构/)
  assert.match(markdown, /## Step 7：交付拆解/)
})
```

- [ ] **Step 4: Run tests to confirm failure**

Run:

```bash
npm test
```

Expected: fails because `interaction-design-workflow` is not implemented yet.

- [ ] **Step 5: Change summary check**

Run:

```bash
git status --short
```

Expected: this may fail with `not a git repository`; if so, note that only `tests/workflows.test.mjs` changed in this task.

## Task 2: Implement The Interaction Design Workflow

**Files:**
- Modify: `src/services/workflows.js`

**Interfaces:**
- Consumes: Existing workflow object shape `{ id, name, assetType, description, steps }`
- Produces: New built-in workflow id `interaction-design-workflow`
- Produces: `produceStepOutput(run)` support for interaction design workflow

- [ ] **Step 1: Add workflow definition**

In `src/services/workflows.js`, add this constant after `journeyMapFlow`:

```js
const interactionDesignFlow = {
  id: 'interaction-design-workflow',
  name: '交互方案生成',
  assetType: '交互方案',
  description: '把模糊需求或改版目标转成信息架构、任务流、页面结构、组件状态、交互评审和交付拆解。',
  recommendedFor: ['交互设计', '已有项目改版', 'B 端复杂流程', '页面结构梳理'],
  steps: [
    {
      id: 'interaction-diagnosis',
      title: 'Step 1：需求诊断',
      goal: '明确目标用户、核心问题、业务背景、成功标准、约束和缺失信息。',
      requiredFields: ['目标用户', '核心问题', '成功标准'],
      outputTitle: '需求诊断卡'
    },
    {
      id: 'information-architecture',
      title: 'Step 2：信息架构',
      goal: '拆分核心对象、导航结构、页面层级、内容分组和权限入口。',
      requiredFields: ['核心对象', '导航结构'],
      outputTitle: '信息架构建议'
    },
    {
      id: 'core-task-flow',
      title: 'Step 3：核心任务流',
      goal: '梳理主路径、分支路径、回退路径和关键决策点。',
      requiredFields: ['主任务', '关键分支'],
      outputTitle: '核心任务流'
    },
    {
      id: 'page-structure',
      title: 'Step 4：页面结构',
      goal: '定义关键页面的模块、主次动作、输入输出和跳转关系。',
      requiredFields: ['关键页面', '主操作'],
      outputTitle: '页面结构表'
    },
    {
      id: 'component-states',
      title: 'Step 5：组件状态与异常',
      goal: '补充表单、列表、详情、弹窗、空状态、错误状态、加载状态和权限状态。',
      requiredFields: ['关键组件', '异常状态'],
      outputTitle: '状态与异常清单'
    },
    {
      id: 'interaction-review',
      title: 'Step 6：交互评审',
      goal: '用一致性、效率、可理解性、可恢复性和可测试性检查方案。',
      requiredFields: ['评审维度', '主要风险'],
      outputTitle: '交互评审'
    },
    {
      id: 'delivery-breakdown',
      title: 'Step 7：交付拆解',
      goal: '转成设计任务、开发任务、验收标准和后续风险。',
      requiredFields: ['交付对象', '验收标准'],
      outputTitle: '交付清单'
    }
  ]
}
```

- [ ] **Step 2: Include workflow in built-ins**

Replace `getBuiltinWorkflows()` with:

```js
export function getBuiltinWorkflows() {
  return [clone(demandFourStep), clone(journeyMapFlow), clone(interactionDesignFlow)]
}
```

- [ ] **Step 3: Add output renderer**

Add this function after `produceJourneyOutput`:

```js
function produceInteractionOutput(step, input, rawDemand) {
  if (step.id === 'interaction-diagnosis') {
    return `# 需求诊断卡

## 原始需求
${rawDemand}

## 当前理解
- 目标用户：${input.目标用户 || '未明确'}
- 核心问题：${input.核心问题 || '未明确'}
- 成功标准：${input.成功标准 || '未明确'}

## 设计判断
当前需求需要先把页面和流程拆开，再把每一步转成可确认的中间产物。

## 缺失信息
- 具体业务规则
- 关键角色权限
- 当前页面或流程截图

## 推荐下一步
进入信息架构步骤，先定义对象、导航和页面层级。`
  }
  if (step.id === 'information-architecture') {
    return `# 信息架构建议

## 核心对象
${input.核心对象 || '项目、用户、流程、资产'}

## 导航结构
${input.导航结构 || '项目诊断、流程运行、资产库、Skill 中心'}

## 页面层级
| 层级 | 页面 | 作用 |
| --- | --- | --- |
| 一级 | 项目诊断 | 输入需求并推荐 Skill |
| 一级 | 流程运行 | 分步执行 Skill |
| 一级 | 资产库 | 管理最终产物和运行链路 |
| 一级 | Skill 中心 | 管理系统 Skill 和我的 Skill |`
  }
  if (step.id === 'core-task-flow') {
    return `# 核心任务流

## 主任务
${input.主任务 || '从需求输入进入完整 Skill 流程'}

## 推荐流程
1. 用户输入原始需求。
2. 系统诊断需求清晰度。
3. 系统推荐 Skill。
4. 用户进入流程运行页。
5. 用户逐步生成、编辑并确认输出。
6. 系统保存为资产。

## 关键分支
${input.关键分支 || '信息不足时先追问；信息足够时直接开始流程。'}`
  }
  if (step.id === 'page-structure') {
    return `# 页面结构表

| 页面 | 核心模块 | 主操作 | 次操作 |
| --- | --- | --- | --- |
| 项目诊断 | 需求输入、推荐 Skill、最近活动 | 开始流程 | 查看推荐理由 |
| 流程运行 | 步骤导航、输入表单、输出编辑器、质量检查 | 确认并进入下一步 | 导出 Markdown |
| 资产库 | 资产列表、资产详情、版本历史 | 查看资产 | 查看运行链路 |

## 关键页面
${input.关键页面 || '项目诊断页、流程运行页、资产库页'}

## 主操作
${input.主操作 || '开始流程、确认步骤、保存资产'}`
  }
  if (step.id === 'component-states') {
    return `# 状态与异常清单

## 关键组件
${input.关键组件 || '步骤导航、输入表单、输出编辑器'}

## 状态
- 空状态：提示输入需求或选择流程。
- 运行中：显示当前步骤和可执行动作。
- 待补充：标出缺少字段。
- 待确认：输出已生成但未确认。
- 已完成：允许保存资产和导出。

## 异常状态
${input.异常状态 || '缺少必填字段、输出为空、重复保存'}`
  }
  if (step.id === 'interaction-review') {
    return `# 交互评审

## 评审维度
${input.评审维度 || '效率、一致性、可理解性、可恢复性、可测试性'}

## 主要风险
${input.主要风险 || '用户不知道下一步动作'}

## 修改建议
- 主页面只保留诊断和推荐，不展示完整运行记录。
- 流程页只处理当前 Skill 的步骤执行。
- 资产库承载最终产物、版本和运行链路。`
  }
  return `# 交付清单

## 交付对象
${input.交付对象 || '设计任务和开发任务'}

## 开发任务
- 新增交互方案 workflow。
- 拆分 Skill 工作台视图。
- 新增资产库详情和运行链路入口。
- 调整样式和浏览器验证。

## 验收标准
${input.验收标准 || '用户能完成至少前两步并保存资产'}

## 后续风险
- 外部 Skill 导入仍需要网络和安全审核。
- 真实知识库检索需要后续接入 RAG。`
}
```

- [ ] **Step 4: Route output generation**

Replace the `content` assignment inside `produceStepOutput(run)` with:

```js
  let content
  if (run.workflowId === 'user-journey-map-flow') {
    content = produceJourneyOutput(step, input, run.input)
  } else if (run.workflowId === 'interaction-design-workflow') {
    content = produceInteractionOutput(step, input, run.input)
  } else {
    content = produceDemandOutput(step, input, run.input)
  }
```

- [ ] **Step 5: Run workflow tests**

Run:

```bash
npm test
```

Expected: all workflow tests pass.

- [ ] **Step 6: Change summary check**

Run:

```bash
git status --short
```

Expected: this may fail with `not a git repository`; if so, note that `src/services/workflows.js` and `tests/workflows.test.mjs` changed.

## Task 3: Split Navigation And Move Diagnosis Into Its Own Page

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: Existing `workbenchForm`, `skillWorkbenchStatus`, `skillWorkbenchResult`, `runWorkbenchSkill()`, `availableSkills`
- Produces: `activeView` values `diagnosis`, `workflow`, `assets`, `skillCenter`
- Produces: `recommendedWorkflows` computed list
- Produces: `startRecommendedWorkflow(workflowId)` action

- [ ] **Step 1: Update initial active view**

Replace:

```js
const activeView = ref('factory')
```

with:

```js
const activeView = ref('diagnosis')
```

- [ ] **Step 2: Replace navigation items**

Replace the `navItems` array with:

```js
const navItems = [
  { key: 'diagnosis', label: '项目诊断', icon: '01' },
  { key: 'workflow', label: '流程运行', icon: '02' },
  { key: 'assets', label: '资产库', icon: '03' },
  { key: 'skillCenter', label: 'Skill 中心', icon: '04' },
  { key: 'factory', label: '网页工厂', icon: '05' },
  { key: 'materials', label: '资料库', icon: '06' },
  { key: 'settings', label: '设置', icon: '07' }
]
```

- [ ] **Step 3: Add recommendation computeds**

Add after `builtinWorkflows`:

```js
const recentActivities = computed(() => state.skillRuns.slice(0, 3))
const latestAssets = computed(() => state.assets.slice(0, 4))
const recommendedWorkflows = computed(() => {
  const input = workbenchForm.input.trim()
  const workflows = builtinWorkflows.value
  if (!input) return workflows.slice(0, 3)
  const text = input.toLowerCase()
  const preferred = workflows.filter((workflow) => {
    const haystack = `${workflow.name} ${workflow.description || ''} ${(workflow.recommendedFor || []).join(' ')}`.toLowerCase()
    return ['交互', '页面', '流程', '改版', '后台', '体验', 'journey', '需求'].some((keyword) =>
      text.includes(keyword.toLowerCase()) && haystack.includes(keyword.toLowerCase())
    )
  })
  return (preferred.length ? preferred : workflows).slice(0, 3)
})
```

- [ ] **Step 4: Add action to start a recommended workflow**

Add after `startWorkflowRun()`:

```js
function startRecommendedWorkflow(workflowId) {
  workflowForm.selectedWorkflowId = workflowId
  workflowForm.input = workbenchForm.input || workflowForm.input
  if (!workflowForm.input.trim()) {
    setStatus(skillWorkbenchStatus, 'failed', '请先输入原始需求')
    return
  }
  startWorkflowRun()
  activeView.value = 'workflow'
}
```

- [ ] **Step 5: Replace old `activeView === 'skills'` diagnosis area**

Remove the old `activeView === 'skills'` section from the template and add this new section before the `workflow` section added in Task 4:

```vue
<section v-if="activeView === 'diagnosis'" class="view-panel diagnosis-view">
  <section class="panel diagnosis-hero">
    <div class="panel-head">
      <div>
        <h3>项目诊断</h3>
        <p>先输入需求，系统会用默认通用 Skill 判断清晰度、读取当前资料，并推荐下一步流程。</p>
      </div>
      <StatusBadge :status="skillWorkbenchStatus.status" />
    </div>
    <textarea
      v-model="workbenchForm.input"
      placeholder="例如：现在 Skill 工作台全部堆在一个页面，用户不知道怎么从需求进入完整流程"
    ></textarea>
    <div class="form-grid">
      <label>
        使用 Skill
        <select v-model="workbenchForm.selectedSkillId">
          <option v-for="skill in availableSkills" :key="skill.id" :value="skill.id">
            {{ skill.source === 'system' ? '系统 · ' : '我的 · ' }}{{ skill.name }}
          </option>
        </select>
      </label>
      <label>
        执行模式
        <select v-model="workbenchForm.mode">
          <option value="diagnose">先诊断</option>
          <option value="execute">直接执行所选 Skill</option>
        </select>
      </label>
    </div>
    <div class="actions">
      <button class="primary" type="button" @click="runWorkbenchSkill">执行诊断</button>
      <button type="button" @click="activeView = 'skillCenter'; startCreateSkill()">新建我的 Skill</button>
    </div>
    <Notice :result="skillWorkbenchStatus" />
  </section>

  <section class="panel diagnosis-result-panel">
    <div class="panel-head">
      <div>
        <h3>诊断结果</h3>
        <p>这里保留当前诊断结论；完整运行链路会沉淀到资产库。</p>
      </div>
    </div>
    <pre class="code-block tall">{{ skillWorkbenchResult }}</pre>
  </section>

  <section class="panel">
    <ListHeader title="推荐流程" :count="recommendedWorkflows.length" />
    <div class="recommendation-grid">
      <button
        v-for="workflow in recommendedWorkflows"
        :key="workflow.id"
        class="recommendation-card"
        type="button"
        @click="startRecommendedWorkflow(workflow.id)"
      >
        <strong>{{ workflow.name }}</strong>
        <span>{{ workflow.description }}</span>
        <small>开始流程</small>
      </button>
    </div>
  </section>

  <section class="panel">
    <ListHeader title="最近活动" :count="recentActivities.length" />
    <DataList :items="recentActivities" empty="暂无最近活动" />
  </section>
</section>
```

- [ ] **Step 6: Run build for template syntax**

Run:

```bash
npm run build
```

Expected: build passes. If it fails, fix only syntax errors introduced in this task.

## Task 4: Move Workflow Runner To Its Own Page

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `workflowForm`, `builtinWorkflows`, `activeWorkflowRun`, `activeWorkflowStep`, `workflowGate`, `workflowStepDraft`, `workflowStepOutput`
- Produces: focused `activeView === 'workflow'` page

- [ ] **Step 1: Add standalone workflow page**

Add this template section after the diagnosis page:

```vue
<section v-if="activeView === 'workflow'" class="view-panel workflow-view">
  <section class="panel workflow-runner-panel">
    <div class="panel-head">
      <div>
        <h3>流程运行</h3>
        <p>选择一个 Skill 流程，逐步补信息、生成中间产物、确认后进入下一步。</p>
      </div>
      <StatusBadge :status="skillWorkbenchStatus.status" />
    </div>
    <div class="form-grid">
      <label>
        流程 Skill
        <select v-model="workflowForm.selectedWorkflowId">
          <option v-for="workflow in builtinWorkflows" :key="workflow.id" :value="workflow.id">
            {{ workflow.name }}
          </option>
        </select>
      </label>
      <label>
        原始需求
        <input v-model="workflowForm.input" placeholder="例如：想优化后台审批流程，感觉现在很乱" />
      </label>
    </div>
    <div class="actions">
      <button class="primary" type="button" @click="startWorkflowRun">开始完整流程</button>
      <button type="button" :disabled="!activeWorkflowRun" @click="saveWorkflowAsset">保存资产</button>
      <button type="button" :disabled="!activeWorkflowRun" @click="downloadWorkflowMarkdown">导出 Markdown</button>
    </div>
  </section>

  <section v-if="activeWorkflowRun" class="workflow-shell">
    <aside class="workflow-steps">
      <button
        v-for="step in activeWorkflowRun.steps"
        :key="step.id"
        :class="{ active: step.id === activeWorkflowRun.currentStepId, completed: step.status === 'completed', locked: step.status === 'locked' }"
        type="button"
        :disabled="step.status === 'locked'"
        @click="selectWorkflowStep(step.id)"
      >
        <strong>{{ step.title }}</strong>
        <span>{{ step.status === 'completed' ? '已完成' : step.status === 'active' ? '进行中' : '未解锁' }}</span>
      </button>
    </aside>

    <section v-if="activeWorkflowStep" class="panel workflow-current">
      <div class="panel-head">
        <div>
          <h3>{{ activeWorkflowStep.title }}</h3>
          <p>{{ activeWorkflowStep.goal }}</p>
        </div>
      </div>
      <div class="workflow-fields">
        <label v-for="field in activeWorkflowStep.requiredFields" :key="field">
          {{ field }}
          <input v-model="workflowStepDraft[field]" :placeholder="`填写${field}`" />
        </label>
      </div>
      <div v-if="!workflowGate.ok" class="validation-box">
        <strong>需要补充后才能进入下一步</strong>
        <span>缺失：{{ workflowGate.missing.join('、') }}</span>
      </div>
      <div class="actions">
        <button type="button" @click="generateWorkflowStepOutput">生成当前步骤</button>
        <button class="primary" type="button" :disabled="!workflowStepOutput || !workflowGate.ok" @click="confirmWorkflowStep">确认并进入下一步</button>
      </div>
      <textarea v-model="workflowStepOutput" class="workflow-output-editor" placeholder="当前步骤输出会出现在这里，可编辑后再确认。"></textarea>
    </section>
  </section>

  <section v-else class="panel empty-workflow-panel">
    <h3>还没有运行中的流程</h3>
    <p>可以从项目诊断页选择推荐流程，也可以直接在这里选择 Skill 开始。</p>
  </section>
</section>
```

- [ ] **Step 2: Preserve current workflow behavior**

Run:

```bash
npm test
```

Expected: workflow tests pass. If they fail, fix only workflow state mutations.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

## Task 5: Move Assets And Skill Center To Separate Pages

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `state.assets`, `state.skillRuns`, `availableSkills`, `skillEditor`, `skillImportForm`, `skillValidation`
- Produces: `selectedAssetId`, `selectedAsset`, asset detail page, focused Skill Center page

- [ ] **Step 1: Add asset selection state**

Add near other refs:

```js
const selectedAssetId = ref(state.assets[0]?.id || '')
```

- [ ] **Step 2: Add selected asset computed**

Add after `latestAssets`:

```js
const selectedAsset = computed(() =>
  state.assets.find((asset) => asset.id === selectedAssetId.value) || state.assets[0] || null
)
```

- [ ] **Step 3: Update `saveWorkflowAsset` to save richer asset metadata**

Replace the asset creation inside `saveWorkflowAsset()` with:

```js
  const runId = crypto.randomUUID()
  const asset = {
    id: crypto.randomUUID(),
    title: state.activeWorkflowRun.workflowName,
    meta: state.activeWorkflowRun.assetType,
    status: state.activeWorkflowRun.status === 'completed' ? '已完成' : '草稿',
    workflowId: state.activeWorkflowRun.workflowId,
    skillId: state.activeWorkflowRun.workflowId,
    runId,
    versions: [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        content
      }
    ],
    hiddenRunRecords: [
      {
        id: runId,
        title: `${state.activeWorkflowRun.workflowName} 运行记录`,
        meta: `${state.activeWorkflowRun.assetType} · ${new Date().toLocaleString()}`,
        status: state.activeWorkflowRun.status === 'completed' ? '已完成' : '草稿',
        content
      }
    ],
    content
  }
  state.assets.unshift(asset)
  selectedAssetId.value = asset.id
  state.skillRuns.unshift(asset.hiddenRunRecords[0])
  state.activeWorkflowRun.lastSavedAssetId = asset.id
```

Keep the final status line:

```js
  setStatus(skillWorkbenchStatus, 'success', '完整流程资产已保存')
```

- [ ] **Step 4: Update `runWorkbenchSkill` asset creation**

Replace the `state.assets.unshift({ ... })` block in `runWorkbenchSkill()` with:

```js
  const asset = {
    id: crypto.randomUUID(),
    title: runRecord.title,
    meta: runResult.assetType || skill.name,
    status: '已保存',
    skillId: skill.id,
    runId: runRecord.id,
    versions: [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        content: skillWorkbenchResult.value
      }
    ],
    hiddenRunRecords: [runRecord],
    content: skillWorkbenchResult.value
  }
  state.assets.unshift(asset)
  selectedAssetId.value = asset.id
```

- [ ] **Step 5: Add asset library page**

Add this template section after the workflow page:

```vue
<section v-if="activeView === 'assets'" class="view-panel assets-view">
  <section class="panel asset-list-panel">
    <ListHeader title="资产库" :count="state.assets.length" />
    <div class="asset-list">
      <button
        v-for="asset in state.assets"
        :key="asset.id"
        :class="{ active: selectedAsset?.id === asset.id }"
        type="button"
        @click="selectedAssetId = asset.id"
      >
        <strong>{{ asset.title }}</strong>
        <span>{{ asset.meta }} · {{ asset.status }}</span>
      </button>
    </div>
  </section>

  <section class="panel asset-detail-panel">
    <template v-if="selectedAsset">
      <div class="panel-head">
        <div>
          <h3>{{ selectedAsset.title }}</h3>
          <p>{{ selectedAsset.meta }} · {{ selectedAsset.status }}</p>
        </div>
      </div>
      <pre class="code-block tall">{{ selectedAsset.content }}</pre>
      <div class="asset-meta-grid">
        <div>
          <strong>版本</strong>
          <span>{{ selectedAsset.versions?.length || 1 }}</span>
        </div>
        <div>
          <strong>运行链路</strong>
          <span>{{ selectedAsset.hiddenRunRecords?.length || 0 }} 条</span>
        </div>
      </div>
      <details class="run-record-details">
        <summary>查看运行链路</summary>
        <DataList :items="selectedAsset.hiddenRunRecords || []" empty="暂无运行链路" />
      </details>
    </template>
    <template v-else>
      <h3>暂无资产</h3>
      <p>完成诊断或流程后，结果会保存到这里。</p>
    </template>
  </section>
</section>
```

- [ ] **Step 6: Add Skill Center page**

Add this template section after the asset page:

```vue
<section v-if="activeView === 'skillCenter'" class="view-panel skill-center-view">
  <section class="panel skill-library-panel">
    <div class="panel-head">
      <div>
        <h3>Skill 中心</h3>
        <p>系统 Skill 可复制为我的 Skill；自定义 Skill 支持表单模式和 Markdown 高级模式。</p>
      </div>
      <button class="primary" type="button" @click="startCreateSkill">新建我的 Skill</button>
    </div>
    <div class="skill-list">
      <button
        v-for="skill in availableSkills"
        :key="skill.id"
        :class="{ active: skillEditor.activeId === skill.id }"
        type="button"
        @click="editSkill(skill)"
      >
        <strong>{{ skill.name }}</strong>
        <span>{{ skill.category }} · {{ skill.source === 'system' ? '系统' : skill.status === 'pending-review' ? '待审核' : '我的' }}</span>
      </button>
    </div>
  </section>

  <section class="panel skill-editor-panel">
    <div class="panel-head">
      <div>
        <h3>Skill 编辑器</h3>
        <p>初级用户用表单，高级用户可切换 Markdown。</p>
      </div>
      <div class="actions">
        <button type="button" @click="skillEditor.mode = skillEditor.mode === 'form' ? 'markdown' : 'form'">
          {{ skillEditor.mode === 'form' ? '切到 Markdown' : '切到表单' }}
        </button>
        <button class="primary" type="button" @click="saveSkillDraft">保存 Skill</button>
      </div>
    </div>

    <div v-if="skillEditor.draft && skillEditor.mode === 'form'" class="skill-editor-grid">
      <label>名称<input v-model="skillEditor.draft.name" /></label>
      <label>分类<select v-model="skillEditor.draft.category">
        <option value="需求理解">需求理解</option>
        <option value="用户研究">用户研究</option>
        <option value="产品方案">产品方案</option>
        <option value="交互设计">交互设计</option>
        <option value="交付验证">交付验证</option>
        <option value="自定义">自定义</option>
      </select></label>
      <label class="wide">描述<textarea v-model="skillEditor.draft.description"></textarea></label>
      <label>适用场景<textarea v-model="skillEditor.draft.applicableScenariosText"></textarea></label>
      <label>需要输入<textarea v-model="skillEditor.draft.requiredInputsText"></textarea></label>
      <label>知识库检索范围<textarea v-model="skillEditor.draft.knowledgeScopesText"></textarea></label>
      <label>工作步骤<textarea v-model="skillEditor.draft.stepsText"></textarea></label>
      <label>追问规则<textarea v-model="skillEditor.draft.followUpRulesText"></textarea></label>
      <label class="wide">输出格式<textarea v-model="skillEditor.draft.outputFormat"></textarea></label>
      <label class="wide">验收标准<textarea v-model="skillEditor.draft.qualityChecksText"></textarea></label>
    </div>

    <textarea
      v-if="skillEditor.draft && skillEditor.mode === 'markdown'"
      v-model="skillEditor.markdown"
      class="markdown-editor"
    ></textarea>

    <div class="skill-import-box">
      <strong>外部 Skill 导入</strong>
      <input v-model="skillImportForm.url" placeholder="GitHub 或网页链接，只会导入为待审核草稿" />
      <textarea v-model="skillImportForm.raw" placeholder="也可以粘贴 Markdown Skill 内容"></textarea>
      <button type="button" @click="importSkillDraft">导入为草稿</button>
    </div>

    <div v-if="skillEditor.draft" class="validation-box">
      <strong>{{ skillValidation.ok ? '结构检查通过' : '结构需要补齐' }}</strong>
      <span v-if="skillValidation.missing.length">缺失：{{ skillValidation.missing.join('、') }}</span>
      <span v-for="warning in skillValidation.warnings" :key="warning">{{ warning }}</span>
    </div>
  </section>
</section>
```

- [ ] **Step 7: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

## Task 6: Add Styles And Cachebuster

**Files:**
- Modify: `src/styles.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: CSS class names introduced in Tasks 3-5
- Produces: non-overlapping responsive page layouts

- [ ] **Step 1: Add focused page styles**

Append to `src/styles.css`:

```css
.diagnosis-view,
.workflow-view,
.assets-view,
.skill-center-view {
  display: grid;
  gap: 18px;
}

.diagnosis-view {
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
  align-items: start;
}

.diagnosis-hero,
.diagnosis-result-panel {
  min-width: 0;
}

.recommendation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.recommendation-card,
.asset-list button {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  text-align: left;
  padding: 14px;
  display: grid;
  gap: 8px;
  cursor: pointer;
}

.recommendation-card:hover,
.asset-list button:hover,
.asset-list button.active {
  border-color: var(--primary);
}

.recommendation-card span,
.asset-list button span {
  color: var(--muted);
  line-height: 1.5;
}

.recommendation-card small {
  color: var(--primary);
  font-weight: 700;
}

.workflow-view .workflow-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.empty-workflow-panel {
  min-height: 180px;
}

.assets-view {
  grid-template-columns: 320px minmax(0, 1fr);
  align-items: start;
}

.asset-list {
  display: grid;
  gap: 10px;
}

.asset-detail-panel {
  min-width: 0;
}

.asset-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.asset-meta-grid div {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  display: grid;
  gap: 6px;
}

.asset-meta-grid span {
  color: var(--muted);
}

.run-record-details {
  margin-top: 14px;
}

.run-record-details summary {
  cursor: pointer;
  font-weight: 700;
}

.skill-center-view {
  grid-template-columns: 320px minmax(0, 1fr);
  align-items: start;
}

@media (max-width: 980px) {
  .diagnosis-view,
  .workflow-view .workflow-shell,
  .assets-view,
  .skill-center-view {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Verify CSS variables**

Run:

```bash
rg -n "--border|--panel|--text|--muted|--primary" src/styles.css
```

Expected: all variables are defined in the existing stylesheet. If one is missing, replace it with the closest existing variable instead of adding a new palette.

- [ ] **Step 3: Bump cachebuster**

In `index.html`, replace the existing script source query with:

```html
<script type="module" src="/src/main.js?v=skill-workflow-v3"></script>
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

## Task 7: Browser Verification And Final Fixes

**Files:**
- Modify only files needed to fix verification defects from previous tasks.

**Interfaces:**
- Consumes: completed UI and workflow logic
- Produces: verified local app

- [ ] **Step 1: Run all automated checks**

Run:

```bash
npm test
npm run build
```

Expected: both pass.

- [ ] **Step 2: Ensure dev server is available**

Run:

```bash
lsof -nP -iTCP:5288 -sTCP:LISTEN
```

Expected: one Vite process is listening. If no process is listening, run:

```bash
npm run dev -- --port 5288
```

- [ ] **Step 3: Verify main navigation in browser**

Open:

```text
http://localhost:5288/
```

Expected:

- `项目诊断` is the active first page.
- Navigation includes `流程运行`, `资产库`, and `Skill 中心`.
- Old `Skill 工作台`, `PM Skill`, and `UX Skill` are not top-level navigation items.

- [ ] **Step 4: Verify interaction workflow happy path**

In the browser:

1. Enter this diagnosis input:

```text
现在流程通的 Skill 工作台全部堆在一个页面，用户无法从需求进入完整流程，也不知道运行记录和输出资产在哪里。
```

2. Click `交互方案生成` from recommended workflows.
3. Fill Step 1:

```text
目标用户：产品交互设计师
核心问题：功能都堆在一个页面，主流程不清楚
成功标准：用户能从诊断进入流程并保存资产
```

4. Generate current step.
5. Confirm and enter Step 2.

Expected:

- Browser moves to `流程运行`.
- Step 1 output contains `需求诊断卡`.
- Step 2 becomes active.

- [ ] **Step 5: Verify records are not inline on diagnosis**

Return to `项目诊断`.

Expected:

- There is no full `运行记录` list on this page.
- Only a compact `最近活动` block is visible.

- [ ] **Step 6: Verify asset library**

Complete or save the current workflow asset.

Expected:

- `资产库` shows the saved asset.
- Asset detail shows content.
- Running chain appears only inside `查看运行链路`.

- [ ] **Step 7: Verify Skill Center**

Open `Skill 中心`.

Expected:

- Existing system Skills are listed.
- Clicking a system Skill opens an editable copy.
- Form mode is visible.
- Switching to Markdown mode works.
- Import box still saves external content as draft.

- [ ] **Step 8: Final change summary**

Run:

```bash
git status --short
```

Expected: this may fail with `not a git repository`. If so, manually summarize changed files:

- `src/services/workflows.js`
- `tests/workflows.test.mjs`
- `src/App.vue`
- `src/styles.css`
- `index.html`
- `docs/superpowers/plans/2026-06-20-skill-workbench-ia-redesign.md`

## Self-Review

### Spec Coverage

- New information architecture: Tasks 3, 4, and 5.
- Separate project diagnosis page: Task 3.
- Separate workflow runner page: Task 4.
- Separate asset library page: Task 5.
- Separate Skill Center page: Task 5.
- Interaction Design Skill: Tasks 1 and 2.
- Hide run records from main page: Tasks 3 and 5.
- Keep form and Markdown Skill editing: Task 5.
- Tests and browser verification: Tasks 1, 2, and 7.

### Placeholder Scan

The plan contains no unresolved placeholders, deferred implementation notes, or missing function definitions.

### Type Consistency

- Workflow id is consistently `interaction-design-workflow`.
- Step ids are consistent across tests and implementation.
- New view keys are consistently `diagnosis`, `workflow`, `assets`, and `skillCenter`.
- Asset metadata fields match the spec: `workflowId`, `skillId`, `runId`, `versions`, and `hiddenRunRecords`.
