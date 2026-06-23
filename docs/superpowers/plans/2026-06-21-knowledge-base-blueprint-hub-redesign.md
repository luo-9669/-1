# Knowledge Base Blueprint Hub Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目入口迁移到头像/账号弹窗，侧边栏改为当前项目工作模块，并把知识库重构为以项目蓝图为主索引的项目知识中枢。

**Architecture:** 账号/项目切换进入顶部头像弹窗，侧边栏只保留当前项目内的需求文档、知识库、设计方案、工程开发、交付资产、技能中心。需求文档是独立项目模块；知识库只沉淀蓝图索引、知识卡片、设计决策、证据和召回能力；后端继续负责资料、解析任务和幂等落库。

**Tech Stack:** Vue 3 + Vite, existing `src/App.vue`, existing backend workspace APIs, Node test runner in `tests/workflows.test.mjs`.

## Global Constraints

- 不新增依赖。
- 使用现有后端 API：`/api/workspace/materials/*`、`/api/workspace/parse-jobs`。
- 前端不能重新接管持久化，资料新增、更新、删除、导入仍走后端。
- 删除“不对的结构”只删除前端旧信息架构和无用样式，不删除用户已有资料数据。
- 知识库主界面必须以项目蓝图为导航，不再以普通资料列表作为第一屏。
- 项目空间不再作为侧边栏入口，项目选择/新建/切换统一放到头像账号弹窗。
- 系统设置不再作为侧边栏入口，放到头像账号弹窗。
- 需求文档是独立侧边栏模块，不放进知识库作为子分类。
- 设计方案后续调用知识时，必须能定位到蓝图节点，并拿到关联原始资料、知识卡片、设计决策和证据。

---

## Existing Structure To Delete Or Demote

删除或降级以下结构：

- 删除侧边栏里的 `项目空间`，迁移到头像账号弹窗里的当前项目卡和项目列表。
- 删除侧边栏里的 `系统设置`，迁移到头像账号弹窗里的设置入口。
- 删除知识库主界面的 `TabBar v-model="materialsTab"` 作为第一层导航。
- 删除顶层 `materialsTabs = [知识库, 需求文档, 竞品监控]` 的信息架构。需求文档保留为独立模块；竞品监控若暂不放侧边栏，则进入需求文档模块的“竞品资料/外部研究”子页，不作为知识库主分类。
- 删除知识库第一屏的 `knowledge-role-tabs`。产品/UX/开发/AI 检索改为“知识卡片”里的筛选器。
- 删除主界面裸露的 `materials-knowledge-tools`。网站导入、召回测试、解析任务改为知识中枢内的工具入口或子页。
- 删除主界面直接展示 `materials-grid` 作为知识库首页的结构。资料卡片保留，但只在“原始资料/知识卡片/设计决策”子视图出现。
- 删除与旧结构强绑定且不再使用的 CSS，例如主界面专用的 `.knowledge-role-tabs`、旧的顶部 `.materials-toolbar` 布局规则；保留可复用卡片样式并重命名到新结构。

保留以下能力：

- 批量选择和批量删除。
- 新建/编辑/详情抽屉。
- 网站导入、蓝图导入、文档导入。
- 需求文档独立模块的上传、解析和一键沉淀知识库。
- 召回测试。
- 解析任务查看。
- 角色范围字段 `roleScopes`，但位置移动到知识卡片筛选。

---

### Task 0: Move Project And Settings Into Account Popover

**Files:**
- Modify: `src/services/navigation.js`
- Modify: `src/App.vue`
- Modify: `src/styles.css`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Produces side nav keys: `requirements`, `materials`, `workflow`, `factory`, `assets`, `skillCenter`.
- Produces account popover with current project, project switching, create project, personal settings, system settings, logout placeholder.

- [ ] **Step 1: Write failing tests**

Add tests to `tests/workflows.test.mjs`:

```js
testAsync('app shell moves project and settings into account popover', async () => {
  const navSource = await readFile(new URL('../src/services/navigation.js', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(navSource, /key: 'projects'/)
  assert.doesNotMatch(navSource, /key: 'settings'/)
  assert.match(navSource, /key: 'requirements', label: '需求文档'/)
  assert.match(navSource, /key: 'materials', label: '知识库'/)
  assert.match(navSource, /key: 'workflow', label: '设计方案'/)
  assert.match(navSource, /key: 'factory', label: '工程开发'/)
  assert.match(navSource, /key: 'assets', label: '交付资产'/)
  assert.match(navSource, /key: 'skillCenter', label: '技能中心'/)
  assert.match(appSource, /class="account-project-popover"/)
  assert.match(appSource, /切换项目/)
  assert.match(appSource, /个人设置/)
  assert.match(appSource, /系统设置/)
})
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- --test-name-pattern="account popover"
```

Expected: fail while project/settings are still in the sidebar.

- [ ] **Step 3: Update sidebar navigation**

Change `src/services/navigation.js` to:

```js
const SIDEBAR_NAV_ITEMS = [
  { key: 'requirements', label: '需求文档', icon: 'file-text' },
  { key: 'materials', label: '知识库', icon: 'database' },
  { key: 'workflow', label: '设计方案', icon: 'route' },
  { key: 'factory', label: '工程开发', icon: 'layout' },
  { key: 'assets', label: '交付资产', icon: 'archive' },
  { key: 'skillCenter', label: '技能中心', icon: 'spark' }
]

export function getSidebarNavItems() {
  return SIDEBAR_NAV_ITEMS.map((item) => ({ ...item }))
}
```

- [ ] **Step 4: Replace sidebar project card with top account trigger**

In `src/App.vue`, remove `.sidebar-project-card` from the sidebar and add a top-right account trigger in the main shell. The popover must include current project, project list, new project, personal settings, system settings, logout placeholder.

- [ ] **Step 5: Preserve project picker logic**

Reuse existing `showProjectPicker`, `selectProject`, `openProjectCreateFromPicker`, `addProject`; do not create a second project switching state.

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- --test-name-pattern="account popover|sidebar navigation"
```

Expected: pass after updating any old nav-label tests.

---

### Task 1: Add Knowledge Hub View Model

**Files:**
- Create: `src/services/knowledgeHub.js`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: project object, current project blueprint asset, knowledge materials array, parseJobs array. Requirement documents remain in the independent requirements module and are only referenced as evidence after being transformed into knowledge cards.
- Produces:
  - `buildKnowledgeHubView({ project, blueprintAsset, materials, parseJobs })`
  - `buildBlueprintIndex(blueprintAsset)`
  - `classifyKnowledgeMaterial(material)`
  - `relatedKnowledgeForBlueprintNode(node, materials)`

- [ ] **Step 1: Write failing tests**

Add tests to `tests/workflows.test.mjs`:

```js
import {
  buildKnowledgeHubView,
  buildBlueprintIndex,
  classifyKnowledgeMaterial,
  relatedKnowledgeForBlueprintNode
} from '../src/services/knowledgeHub.js'

test('knowledge hub builds blueprint led project knowledge structure', () => {
  const blueprintAsset = {
    id: 'asset-blueprint',
    title: '项目蓝图',
    blueprint: {
      profile: {
        positioning: 'AI 项目工作台',
        targetUsers: '产品、UX、开发',
        primaryGoal: '从需求生成方案和工程页面',
        coreScenarios: ['上传资料', '生成设计方案']
      },
      pages: [
        { id: 'upload', name: '上传资料页', goal: '导入原始资料', states: ['empty', 'loading', 'failed'] }
      ],
      flows: [
        { id: 'upload-flow', title: '上传资料流程', steps: ['选择文件', '后端解析', '写入知识库'] }
      ],
      acceptance: ['失败时保留文件名和原因']
    }
  }
  const materials = [
    { id: 'card-1', type: 'knowledge', title: '上传失败处理规则', content: '保留文件名和失败原因', sourceType: 'blueprint', category: 'interaction-flow', roleScopes: ['ux'] },
    { id: 'decision-1', type: 'knowledge', title: '上传入口位置', category: 'design-decision', content: '上传入口放在输入框下方' }
  ]
  const hub = buildKnowledgeHubView({
    project: { id: 'project-a', name: '项目 A' },
    blueprintAsset,
    materials,
    parseJobs: [{ id: 'job-a', status: 'succeeded' }]
  })

  assert.equal(hub.overview.projectName, '项目 A')
  assert.equal(hub.overview.blueprintNodeCount > 0, true)
  assert.equal(hub.sections.map((section) => section.key).join(','), 'overview,blueprint,sources,cards,decisions,retrieval,jobs')
  assert.ok(hub.blueprint.nodes.some((node) => node.type === 'flow' && node.title === '上传资料流程'))
  assert.equal(hub.sources.items.length, 0)
  assert.equal(hub.cards.items.length, 1)
  assert.equal(hub.decisions.items.length, 1)
})

test('knowledge hub relates materials to a blueprint node for design context', () => {
  const node = { id: 'upload-flow', title: '上传资料流程', keywords: ['上传', '失败'] }
  const related = relatedKnowledgeForBlueprintNode(node, [
    { id: 'a', title: '上传失败处理规则', content: '失败时保留文件名', type: 'knowledge' },
    { id: 'b', title: '定价规则', content: 'Pro 套餐', type: 'knowledge' }
  ])

  assert.deepEqual(related.map((item) => item.id), ['a'])
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- --test-name-pattern="knowledge hub"
```

Expected: fail because `src/services/knowledgeHub.js` does not exist.

- [ ] **Step 3: Implement view model**

Create `src/services/knowledgeHub.js`:

```js
function text(value = '') {
  return String(value || '').trim()
}

function compactTokens(...values) {
  return [...new Set(values.join(' ').split(/[^a-zA-Z0-9\u4e00-\u9fa5]+/).map((item) => item.trim()).filter((item) => item.length > 1))]
}

export function classifyKnowledgeMaterial(material = {}) {
  if (material.category === 'design-decision' || /设计决策|已确认方案/.test(material.meta || material.title || '')) return 'decision'
  if (material.type === 'knowledge' && ['document', 'website', 'blueprint'].includes(material.sourceType)) return 'card'
  return 'card'
}

export function buildBlueprintIndex(blueprintAsset = null) {
  const blueprint = blueprintAsset?.blueprint || null
  if (!blueprint) return { assetId: '', title: '暂无项目蓝图', nodes: [] }

  const nodes = []
  const addNode = (node) => nodes.push({
    id: node.id,
    type: node.type,
    title: node.title,
    summary: node.summary || '',
    keywords: compactTokens(node.title, node.summary || '', node.type)
  })

  if (blueprint.profile) {
    addNode({
      id: 'profile',
      type: 'profile',
      title: '项目目标',
      summary: [blueprint.profile.positioning, blueprint.profile.primaryGoal, blueprint.profile.targetUsers].filter(Boolean).join(' · ')
    })
  }

  ;(blueprint.pages || []).forEach((page) => addNode({
    id: `page-${page.id || page.name}`,
    type: 'page',
    title: page.name || page.title || page.id,
    summary: [page.goal, ...(page.states || [])].filter(Boolean).join(' · ')
  }))

  ;(blueprint.flows || blueprint.interactionFlows || []).forEach((flow) => addNode({
    id: `flow-${flow.id || flow.title}`,
    type: 'flow',
    title: flow.title || flow.name || flow.id,
    summary: [...(flow.steps || []), flow.summary || ''].filter(Boolean).join(' · ')
  }))

  ;(blueprint.acceptance || blueprint.acceptanceCriteria || []).forEach((item, index) => addNode({
    id: `acceptance-${index + 1}`,
    type: 'acceptance',
    title: `验收标准 ${index + 1}`,
    summary: text(item)
  }))

  return {
    assetId: blueprintAsset.id || '',
    title: blueprintAsset.title || blueprint.title || '项目蓝图',
    nodes
  }
}

export function relatedKnowledgeForBlueprintNode(node = {}, materials = []) {
  const tokens = compactTokens(node.title, ...(node.keywords || []))
  return materials.filter((material) => {
    const haystack = [material.title, material.meta, material.content, material.summary, material.sourceUrl].join(' ')
    return tokens.some((token) => haystack.includes(token))
  })
}

export function buildKnowledgeHubView({ project = {}, blueprintAsset = null, materials = [], parseJobs = [] } = {}) {
  const blueprint = buildBlueprintIndex(blueprintAsset)
  const sources = materials.filter((item) => classifyKnowledgeMaterial(item) === 'source')
  const cards = materials.filter((item) => classifyKnowledgeMaterial(item) === 'card')
  const decisions = materials.filter((item) => classifyKnowledgeMaterial(item) === 'decision')
  return {
    overview: {
      projectName: project.name || '未命名项目',
      blueprintNodeCount: blueprint.nodes.length,
      sourceCount: sources.length,
      cardCount: cards.length,
      decisionCount: decisions.length,
      parseJobCount: parseJobs.length,
      completeness: Math.min(100, Math.round((Boolean(blueprint.nodes.length) + Boolean(sources.length) + Boolean(cards.length) + Boolean(decisions.length)) / 4 * 100))
    },
    sections: [
      { key: 'overview', label: '总览' },
      { key: 'blueprint', label: '蓝图索引' },
      { key: 'sources', label: '原始资料' },
      { key: 'cards', label: '知识卡片' },
      { key: 'decisions', label: '设计决策' },
      { key: 'retrieval', label: '召回测试' },
      { key: 'jobs', label: '解析任务' }
    ],
    blueprint,
    sources: { items: sources },
    cards: { items: cards },
    decisions: { items: decisions },
    jobs: { items: parseJobs }
  }
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- --test-name-pattern="knowledge hub"
```

Expected: pass.

---

### Task 2: Replace Knowledge Base Top-Level IA

**Files:**
- Modify: `src/App.vue`
- Modify: `src/styles.css`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `buildKnowledgeHubView()` from Task 1.
- Produces:
  - `knowledgeHubSection`
  - `knowledgeHubView`
  - new knowledge hub layout in `activeView === 'materials'`

- [ ] **Step 1: Write failing UI source tests**

Add tests:

```js
testAsync('knowledge base uses blueprint hub instead of old material tabs', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const materialsStart = appSource.indexOf('activeView === \\'materials\\'')
  const materialsEnd = appSource.indexOf('activeView === \\'skills\\'', materialsStart)
  const materialsSource = appSource.slice(materialsStart, materialsEnd)

  assert.match(appSource, /buildKnowledgeHubView/)
  assert.match(appSource, /const knowledgeHubSection = ref\('overview'\)/)
  assert.match(materialsSource, /knowledge-hub-layout/)
  assert.match(materialsSource, /蓝图索引/)
  assert.match(materialsSource, /原始资料/)
  assert.match(materialsSource, /知识卡片/)
  assert.match(materialsSource, /设计决策/)
  assert.doesNotMatch(materialsSource, /<TabBar v-model="materialsTab"/)
  assert.doesNotMatch(materialsSource, /class="knowledge-role-tabs"/)
  assert.match(cssSource, /\.knowledge-hub-layout\s*\{/)
  assert.match(cssSource, /\.blueprint-index-panel\s*\{/)
})
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- --test-name-pattern="blueprint hub instead of old material tabs"
```

Expected: fail because the old `TabBar` and `knowledge-role-tabs` still exist in the materials view.

- [ ] **Step 3: Modify script imports and state**

In `src/App.vue`, import:

```js
import { buildKnowledgeHubView, relatedKnowledgeForBlueprintNode } from './services/knowledgeHub.js'
```

Add state:

```js
const knowledgeHubSection = ref('overview')
const selectedBlueprintNodeId = ref('')
const selectedKnowledgeCardRole = ref('all')
```

Add computed values near current material computed values:

```js
const currentBlueprintAsset = computed(() => selectedProjectBlueprintAsset.value || currentAssets.value.find((item) => item.blueprint))
const knowledgeHubView = computed(() => buildKnowledgeHubView({
  project: currentProject.value,
  blueprintAsset: currentBlueprintAsset.value,
  materials: [
    ...currentKnowledge.value,
    ...currentRequirements.value,
    ...currentCompetitors.value
  ],
  parseJobs: knowledgeParseJobs.value
}))
const selectedBlueprintNode = computed(() =>
  knowledgeHubView.value.blueprint.nodes.find((node) => node.id === selectedBlueprintNodeId.value) ||
  knowledgeHubView.value.blueprint.nodes[0] ||
  null
)
const selectedBlueprintRelatedKnowledge = computed(() =>
  selectedBlueprintNode.value
    ? relatedKnowledgeForBlueprintNode(selectedBlueprintNode.value, [
        ...currentKnowledge.value,
        ...currentRequirements.value,
        ...currentCompetitors.value
      ])
    : []
)
```

- [ ] **Step 4: Replace materials view template**

Replace the current `activeView === 'materials'` block with:

```vue
<section v-if="activeView === 'materials'" class="view-panel knowledge-hub-layout">
  <aside class="knowledge-hub-nav">
    <div>
      <span class="eyebrow">Project Knowledge</span>
      <h3>{{ knowledgeHubView.overview.projectName }}</h3>
      <p>以项目蓝图为索引，组织原始资料、知识卡片、设计决策和解析任务。</p>
    </div>
    <button
      v-for="section in knowledgeHubView.sections"
      :key="section.key"
      type="button"
      :class="{ active: knowledgeHubSection === section.key }"
      @click="knowledgeHubSection = section.key"
    >
      {{ section.label }}
    </button>
  </aside>

  <main class="knowledge-hub-main">
    <section v-if="knowledgeHubSection === 'overview'" class="knowledge-overview-grid">
      <article class="panel knowledge-health-card">
        <span>知识完整度</span>
        <strong>{{ knowledgeHubView.overview.completeness }}%</strong>
        <p>蓝图、原始资料、知识卡片、设计决策共同决定项目知识是否可用于设计和开发。</p>
      </article>
      <article class="panel"><span>蓝图节点</span><strong>{{ knowledgeHubView.overview.blueprintNodeCount }}</strong></article>
      <article class="panel"><span>来源证据</span><strong>{{ knowledgeHubView.overview.sourceCount }}</strong></article>
      <article class="panel"><span>知识卡片</span><strong>{{ knowledgeHubView.overview.cardCount }}</strong></article>
      <article class="panel"><span>设计决策</span><strong>{{ knowledgeHubView.overview.decisionCount }}</strong></article>
      <article class="panel"><span>解析任务</span><strong>{{ knowledgeHubView.overview.parseJobCount }}</strong></article>
    </section>

    <section v-if="knowledgeHubSection === 'blueprint'" class="blueprint-index-panel">
      <div class="blueprint-node-list">
        <button
          v-for="node in knowledgeHubView.blueprint.nodes"
          :key="node.id"
          type="button"
          :class="{ active: selectedBlueprintNode?.id === node.id }"
          @click="selectedBlueprintNodeId = node.id"
        >
          <small>{{ node.type }}</small>
          <strong>{{ node.title }}</strong>
          <span>{{ node.summary }}</span>
        </button>
      </div>
      <article class="panel blueprint-node-detail">
        <h3>{{ selectedBlueprintNode?.title || '暂无蓝图节点' }}</h3>
        <p>{{ selectedBlueprintNode?.summary || '先在设计方案中生成项目蓝图，或从资产库导入蓝图到知识库。' }}</p>
        <div class="knowledge-context-list">
          <strong>关联知识</strong>
          <button
            v-for="item in selectedBlueprintRelatedKnowledge"
            :key="item.id"
            type="button"
            @click="openMaterialDetail(item)"
          >
            {{ item.title }}
          </button>
        </div>
      </article>
    </section>

    <section v-if="knowledgeHubSection === 'sources'" class="materials-grid">
      <button v-for="item in knowledgeHubView.sources.items" :key="item.id" type="button" class="material-card" @click="openMaterialDetail(item)">
        <strong>{{ item.title }}</strong>
        <span>{{ item.meta || item.sourceType || item.type }}</span>
        <small>{{ item.status || '已保存' }}</small>
      </button>
    </section>

    <section v-if="knowledgeHubSection === 'cards'" class="knowledge-card-section">
      <div class="knowledge-card-filter">
        <button v-for="role in knowledgeRoleTabs" :key="role.key" type="button" :class="{ active: selectedKnowledgeCardRole === role.key }" @click="selectedKnowledgeCardRole = role.key">
          {{ role.label }}
        </button>
      </div>
      <div class="materials-grid">
        <button v-for="item in knowledgeHubView.cards.items" :key="item.id" type="button" class="material-card" @click="openMaterialDetail(item)">
          <strong>{{ item.title }}</strong>
          <span>{{ item.meta || item.category || '知识卡片' }}</span>
          <small>{{ roleScopeLabels(item.roleScopes).join(' / ') || '全部角色' }}</small>
        </button>
      </div>
    </section>

    <section v-if="knowledgeHubSection === 'decisions'" class="materials-grid">
      <button v-for="item in knowledgeHubView.decisions.items" :key="item.id" type="button" class="material-card" @click="openMaterialDetail(item)">
        <strong>{{ item.title }}</strong>
        <span>{{ item.content || item.summary || '已确认设计决策' }}</span>
        <small>{{ item.updatedAt || item.createdAt || '' }}</small>
      </button>
    </section>

    <section v-if="knowledgeHubSection === 'retrieval'" class="panel knowledge-retrieval-panel">
      <div>
        <strong>召回测试</strong>
        <span>模拟设计方案或 Agent 提问，检查命中片段和证据。</span>
      </div>
      <input v-model="knowledgeRetrievalForm.query" placeholder="例如：上传失败应该如何处理？" />
      <select v-model="knowledgeRetrievalForm.roleScope" aria-label="召回角色">
        <option v-for="role in knowledgeRoleTabs" :key="role.key" :value="role.key">{{ role.label }}</option>
      </select>
      <button type="button" @click="runKnowledgeRetrievalTest">测试召回</button>
      <div v-if="knowledgeRetrievalResults.length" class="retrieval-result-list">
        <article v-for="result in knowledgeRetrievalResults" :key="`${result.materialId}-${result.chunk?.id || result.title}`">
          <div><strong>{{ result.title }}</strong><span>Score {{ result.score }}</span></div>
          <p>{{ result.snippet }}</p>
          <small>命中证据：{{ result.evidence?.[0]?.url || result.sourceUrl || '暂无来源' }}</small>
        </article>
      </div>
    </section>

    <section v-if="knowledgeHubSection === 'jobs'" class="panel parse-job-panel">
      <div><strong>解析任务</strong><span>查看网站、蓝图和文档导入任务。</span></div>
      <button type="button" @click="refreshParseJobs">刷新任务</button>
      <div v-if="knowledgeParseJobs.length" class="parse-job-list">
        <article v-for="job in knowledgeParseJobs" :key="job.id">
          <strong>{{ job.action || 'parse' }} · {{ job.status }}</strong>
          <span>{{ job.sourceUrl || job.sourceType || '暂无来源' }}</span>
          <small>{{ job.materialCount || 0 }} 条资料 · {{ job.durationMs || 0 }}ms</small>
        </article>
      </div>
    </section>
  </main>
</section>
```

- [ ] **Step 5: Delete old main structure**

Remove from the old materials view:

```vue
<TabBar v-model="materialsTab" :tabs="materialsTabs" />
<section v-if="materialsTab === 'knowledge'" class="knowledge-role-tabs">...</section>
<section v-if="materialsTab === 'knowledge'" class="materials-knowledge-tools">...</section>
```

Keep the material editor modal and existing detail drawer.

- [ ] **Step 6: Add CSS**

Add CSS:

```css
.knowledge-hub-layout {
  grid-template-columns: 240px minmax(0, 1fr);
  align-items: start;
}

.knowledge-hub-nav {
  position: sticky;
  top: 92px;
  display: grid;
  gap: 8px;
  border-right: 1px solid #e8eaec;
  padding-right: 16px;
}

.knowledge-hub-nav h3,
.knowledge-hub-nav p {
  margin: 0;
}

.knowledge-hub-nav p {
  color: #7f8792;
  line-height: 1.6;
  font-size: 13px;
}

.knowledge-hub-nav button {
  justify-content: flex-start;
  text-align: left;
}

.knowledge-hub-nav button.active {
  background: #222529;
  border-color: #222529;
  color: #fff;
}

.knowledge-hub-main {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.knowledge-overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.knowledge-overview-grid .panel {
  min-height: 120px;
  align-content: center;
}

.knowledge-overview-grid strong {
  font-size: 28px;
}

.blueprint-index-panel {
  display: grid;
  grid-template-columns: minmax(280px, 0.92fr) minmax(360px, 1.08fr);
  gap: 16px;
}

.blueprint-node-list {
  display: grid;
  gap: 10px;
}

.blueprint-node-list button {
  height: auto;
  display: grid;
  gap: 6px;
  text-align: left;
  padding: 14px;
}

.blueprint-node-list button.active {
  border-color: #222529;
  background: #f7f8fa;
}

.blueprint-node-list small,
.blueprint-node-list span,
.knowledge-context-list button {
  color: #7f8792;
  font-size: 12px;
}

.blueprint-node-detail {
  align-content: start;
}

.knowledge-context-list {
  display: grid;
  gap: 8px;
}

.knowledge-context-list button {
  height: auto;
  text-align: left;
  justify-content: flex-start;
}

.knowledge-card-section {
  display: grid;
  gap: 14px;
}

.knowledge-card-filter {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.knowledge-card-filter button.active {
  background: #222529;
  border-color: #222529;
  color: #fff;
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm test -- --test-name-pattern="blueprint hub instead of old material tabs|knowledge hub"
```

Expected: pass.

---

### Task 3: Restore Create/Import/Bulk Actions In New IA

**Files:**
- Modify: `src/App.vue`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: existing functions `openMaterialCreate`, `importMaterialFiles`, `toggleMaterialBatchMode`, `deleteSelectedMaterials`, `openMaterialTool`.
- Produces: action bar that works in new knowledge hub sections.

- [ ] **Step 1: Write failing tests**

Add:

```js
testAsync('knowledge hub keeps creation import and batch delete actions', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const hubStart = appSource.indexOf('class="view-panel knowledge-hub-layout"')
  const hubEnd = appSource.indexOf('activeView === \\'factory\\'', hubStart)
  const hubSource = appSource.slice(hubStart, hubEnd)

  assert.match(hubSource, /openMaterialCreate/)
  assert.match(hubSource, /materialFileInput/)
  assert.match(hubSource, /importMaterialFiles/)
  assert.match(hubSource, /toggleMaterialBatchMode/)
  assert.match(hubSource, /deleteSelectedMaterials/)
  assert.match(hubSource, /openMaterialTool\('website-import'\)/)
})
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- --test-name-pattern="creation import and batch delete actions"
```

Expected: fail until the new hub action bar includes the actions.

- [ ] **Step 3: Add hub action bar**

Inside `knowledge-hub-main`, before section content:

```vue
<section class="knowledge-hub-actions">
  <input
    ref="materialFileInput"
    class="hidden-file-input"
    type="file"
    multiple
    accept=".pdf,.docx,.md,.txt,.xlsx,.csv,.json"
    @change="importMaterialFiles"
  />
  <button class="primary" type="button" @click="openMaterialCreate">新建知识</button>
  <button type="button" @click="materialFileInput?.click()">导入文件</button>
  <button type="button" @click="openMaterialTool('website-import')">导入网站</button>
  <button type="button" @click="toggleMaterialBatchMode">{{ materialBatchMode ? '退出管理' : '批量管理' }}</button>
  <button class="danger" type="button" :disabled="!currentSelectedMaterialIds.length" @click="deleteSelectedMaterials">删除所选</button>
</section>
```

- [ ] **Step 4: Ensure section-specific type mapping**

Update `openMaterialCreate()` or create a helper:

```js
function materialTypeForHubSection(section = knowledgeHubSection.value) {
  if (section === 'sources') return 'requirements'
  if (section === 'decisions') return 'knowledge'
  return 'knowledge'
}
```

When creating from the new hub, set:

```js
materialsTab.value = materialTypeForHubSection()
```

This preserves existing editor behavior while removing the old top-level tabs.

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- --test-name-pattern="creation import and batch delete actions|blueprint hub"
```

Expected: pass.

---

### Task 4: Design Context From Blueprint Node

**Files:**
- Modify: `src/services/knowledgeHub.js`
- Modify: `src/App.vue`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Produces:
  - `buildDesignContextFromBlueprintNode(node, materials)`
  - UI button text `用于设计方案`

- [ ] **Step 1: Write failing tests**

Add:

```js
test('knowledge hub builds design context from selected blueprint node', () => {
  const context = buildDesignContextFromBlueprintNode(
    { id: 'flow-upload', title: '上传资料流程', type: 'flow', summary: '选择文件、后端解析、写入知识库' },
    [
      { id: 'raw', title: 'PRD', type: 'requirements', content: '上传失败保留原因' },
      { id: 'card', title: '上传失败处理规则', type: 'knowledge', content: '保留文件名和失败原因', category: 'interaction-rule' },
      { id: 'decision', title: '上传入口位置', type: 'knowledge', content: '放在输入框下方', category: 'design-decision' }
    ]
  )

  assert.equal(context.blueprintNode.title, '上传资料流程')
  assert.deepEqual(context.sources.map((item) => item.id), ['raw'])
  assert.deepEqual(context.cards.map((item) => item.id), ['card'])
  assert.deepEqual(context.decisions.map((item) => item.id), ['decision'])
  assert.match(context.prompt, /上传资料流程/)
  assert.match(context.prompt, /上传失败处理规则/)
})

testAsync('knowledge hub exposes selected blueprint node to design plan', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  assert.match(appSource, /buildDesignContextFromBlueprintNode/)
  assert.match(appSource, /用于设计方案/)
  assert.match(appSource, /selectedDesignKnowledgeContext/)
})
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- --test-name-pattern="design context from selected blueprint node|exposes selected blueprint node"
```

Expected: fail.

- [ ] **Step 3: Implement service function**

In `src/services/knowledgeHub.js`:

```js
export function buildDesignContextFromBlueprintNode(node = {}, materials = []) {
  const related = relatedKnowledgeForBlueprintNode(node, materials)
  const sources = related.filter((item) => classifyKnowledgeMaterial(item) === 'source')
  const cards = related.filter((item) => classifyKnowledgeMaterial(item) === 'card')
  const decisions = related.filter((item) => classifyKnowledgeMaterial(item) === 'decision')
  const prompt = [
    `基于蓝图节点「${node.title || '未命名节点'}」生成设计方案。`,
    node.summary ? `蓝图摘要：${node.summary}` : '',
    cards.length ? `知识卡片：${cards.map((item) => item.title).join('、')}` : '',
    decisions.length ? `已确认设计决策：${decisions.map((item) => item.title).join('、')}` : '',
    sources.length ? `来源证据：${sources.map((item) => item.title).join('、')}` : ''
  ].filter(Boolean).join('\n')

  return {
    blueprintNode: node,
    sources,
    cards,
    decisions,
    prompt
  }
}
```

- [ ] **Step 4: Add UI action**

In `src/App.vue` blueprint node detail:

```vue
<button class="primary" type="button" :disabled="!selectedBlueprintNode" @click="useBlueprintNodeForDesignPlan">
  用于设计方案
</button>
```

Add script:

```js
const selectedDesignKnowledgeContext = ref(null)

function useBlueprintNodeForDesignPlan() {
  if (!selectedBlueprintNode.value) return
  selectedDesignKnowledgeContext.value = buildDesignContextFromBlueprintNode(
    selectedBlueprintNode.value,
    [
      ...currentKnowledge.value,
      ...currentRequirements.value,
      ...currentCompetitors.value
    ]
  )
  activeView.value = 'workflow'
  setStatus(skillWorkbenchStatus, 'success', `已将「${selectedBlueprintNode.value.title}」作为设计方案知识上下文`)
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- --test-name-pattern="design context from selected blueprint node|exposes selected blueprint node"
```

Expected: pass.

---

### Task 5: Cleanup Old State And Styles

**Files:**
- Modify: `src/App.vue`
- Modify: `src/styles.css`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Produces: no references to deleted old top-level IA.

- [ ] **Step 1: Write cleanup tests**

Add:

```js
testAsync('old knowledge base top level structures are removed', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const materialsStart = appSource.indexOf('class="view-panel knowledge-hub-layout"')
  const materialsEnd = appSource.indexOf('activeView === \\'factory\\'', materialsStart)
  const hubSource = appSource.slice(materialsStart, materialsEnd)

  assert.doesNotMatch(hubSource, /materialsTabs/)
  assert.doesNotMatch(hubSource, /materials-toolbar/)
  assert.doesNotMatch(hubSource, /knowledge-role-tabs/)
  assert.doesNotMatch(cssSource, /\.knowledge-role-tabs\s*\{/)
  assert.doesNotMatch(cssSource, /\.materials-toolbar\s*\{/)
})
```

- [ ] **Step 2: Remove dead constants only after tests fail**

If no code uses it after Task 2, remove:

```js
const materialsTabs = [
  { key: 'knowledge', label: '知识库' },
  { key: 'requirements', label: '需求文档' },
  { key: 'competitors', label: '竞品监控' }
]
```

Keep `materialsTab` only if existing create/edit/import/delete functions still rely on it internally. If Task 3 replaces that internal routing, remove `materialsTab` too.

- [ ] **Step 3: Remove dead styles**

Remove old primary-view styles when no longer referenced:

```css
.knowledge-role-tabs { ... }
.knowledge-role-tabs button { ... }
.knowledge-role-tabs button.active { ... }
.knowledge-role-tabs span,
.material-source { ... }
.materials-toolbar { ... }
```

Keep `.material-source` only if cards still use it inside subviews.

- [ ] **Step 4: Run cleanup tests**

Run:

```bash
npm test -- --test-name-pattern="old knowledge base top level structures are removed"
```

Expected: pass.

---

### Task 6: Full Verification

**Files:**
- No production edits unless failures require fixes.

- [ ] **Step 1: Syntax checks**

Run:

```bash
node --check src/services/knowledgeHub.js
node --check src/services/api.js
node --check 后端/routes/workspace.js
node --check 后端/services/workspace-store.js
```

Expected: all exit 0.

- [ ] **Step 2: Full tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Production build**

Run:

```bash
npm run build
```

Expected: Vite build succeeds.

---

## Recommended Execution Order

1. Task 1: 先建知识中枢视图模型。
2. Task 2: 删除旧主界面结构，替换为蓝图驱动界面。
4. Task 3: 把新建、导入、批量删除能力接回新界面。
5. Task 4: 接通“蓝图节点用于设计方案”的知识上下文。
6. Task 5: 清理旧状态和旧 CSS。
7. Task 6: 全量验证。

## Self-Review

- Spec coverage: 覆盖了头像账号弹窗、项目切换、侧边栏重排、需求文档独立、蓝图索引、知识卡片、设计决策、召回测试、解析任务、删除旧结构、设计方案调用上下文。
- Placeholder scan: 无 TBD/TODO。
- Type consistency: `buildKnowledgeHubView`、`buildBlueprintIndex`、`relatedKnowledgeForBlueprintNode`、`buildDesignContextFromBlueprintNode` 在任务中定义并被后续任务消费。
