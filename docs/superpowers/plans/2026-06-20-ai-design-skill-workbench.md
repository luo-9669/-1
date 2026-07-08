# AI Design Skill Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP loop for a product/UX design Skill workbench: default general Skill, system Skills, user Skills, Skill editor, knowledge-aware execution, and saved run records.

**Architecture:** Keep the current Vue/Vite app and local mock API. Add focused client-side service modules for Skill definitions, validation, Markdown conversion, and local execution fallback, then wire them into a new unified Skill Workbench view. Preserve the existing PM/UX mock API routes while adding generic `/api/skills/*` routes so the MVP works with or without a configured backend.

**Tech Stack:** Vue 3 Composition API, Vite, browser localStorage, local mock Node API, existing CSS system in `src/styles.css`.

## Global Constraints

- Do not build a Skill marketplace in MVP.
- Do not execute GitHub or external repository code.
- External Skill import can only produce a pending review draft.
- First version stores output assets as Markdown-like text records.
- Figma/Jira/Confluence publishing is out of scope.
- High-fidelity page generation is out of scope for this Skill MVP.
- Preserve existing webpage factory functionality.
- Current project is not a git repository; skip commit steps unless a git repo is initialized before execution.

---

## File Structure

- Create `src/services/skills.js`: owns Skill seed data, Skill schema normalization, validation, Markdown serialization/parsing, and execution payload helpers.
- Create `src/services/skillRunner.js`: owns local fallback execution for general diagnosis, user journey map, and PRD/interaction plan generation when API is unconfigured.
- Modify `src/services/api.js`: add generic Skill endpoints: diagnose, execute, import draft.
- Modify `server/mock-api.mjs`: add mock generic Skill routes.
- Modify `src/App.vue`: add Skill Workbench state, navigation item, editor UI, execution UI, run record persistence, and asset persistence. Keep existing PM/UX views for compatibility during MVP.
- Modify `src/styles.css`: add layout styles for Skill Workbench, Skill editor, diagnosis card, source chips, and run records.
- Create `docs/superpowers/specs/2026-06-20-ai-design-skill-workbench-design.md`: already exists and remains the source spec.

## Task 1: Add Skill Model Utilities

**Files:**
- Create: `src/services/skills.js`

**Interfaces:**
- Produces: `createSystemSkills(): SkillDefinition[]`
- Produces: `createDefaultGeneralSkill(): SkillDefinition`
- Produces: `normalizeSkill(input: Partial<SkillDefinition>): SkillDefinition`
- Produces: `validateSkill(skill: SkillDefinition): SkillValidationResult`
- Produces: `skillToMarkdown(skill: SkillDefinition): string`
- Produces: `markdownToSkill(markdown: string): SkillDefinition`
- Produces: `buildSkillExecutionContext(state: object, skill: SkillDefinition, input: string): SkillExecutionContext`

- [ ] **Step 1: Create the file with model helpers**

Create `src/services/skills.js` with:

```js
export const SKILL_CATEGORIES = [
  '需求理解',
  '用户研究',
  '产品方案',
  '交互设计',
  '交付验证',
  '自定义'
]

const requiredSections = [
  'name',
  'description',
  'applicableScenarios',
  'requiredInputs',
  'knowledgeScopes',
  'steps',
  'outputFormat',
  'qualityChecks'
]

function idFromName(name = 'skill') {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'skill'
}

function asArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(/\n|,/)
      .map((item) => item.replace(/^[-*\d.]+\s*/, '').trim())
      .filter(Boolean)
  }
  return []
}

export function normalizeSkill(input = {}) {
  const name = input.name || '未命名 Skill'
  return {
    id: input.id || `${idFromName(name)}-${crypto.randomUUID?.() || Date.now()}`,
    name,
    description: input.description || '',
    category: input.category || '自定义',
    source: input.source || 'user',
    status: input.status || 'active',
    applicableScenarios: asArray(input.applicableScenarios),
    nonApplicableScenarios: asArray(input.nonApplicableScenarios),
    requiredInputs: asArray(input.requiredInputs),
    knowledgeScopes: asArray(input.knowledgeScopes),
    steps: asArray(input.steps),
    followUpRules: asArray(input.followUpRules),
    outputFormat: input.outputFormat || '',
    qualityChecks: asArray(input.qualityChecks),
    exampleInput: input.exampleInput || '',
    exampleOutput: input.exampleOutput || '',
    markdown: input.markdown || ''
  }
}

export function createDefaultGeneralSkill() {
  return normalizeSkill({
    id: 'default-general-design-skill',
    name: '默认通用 Skill',
    description: '先诊断模糊需求、读取项目知识库、识别缺失信息，再推荐或调用合适的产品/交互设计 Skill。',
    category: '需求理解',
    source: 'system',
    applicableScenarios: ['用户没有选择 Skill', '需求模糊', '需要判断任务类型', '需要先读取项目知识库'],
    nonApplicableScenarios: ['用户已经提供完整方案且只需要格式转换'],
    requiredInputs: ['用户原始需求', '当前项目', '项目知识库', '历史需求', '竞品资料'],
    knowledgeScopes: ['业务背景', '用户角色', '业务流程', '历史需求', '竞品资料', '设计规范'],
    steps: [
      '判断需求清晰度',
      '判断任务场景',
      '检索相关知识',
      '识别缺失信息',
      '提出最多 3 个高价值澄清问题',
      '推荐 Skill 链或整理目标 Skill 输入',
      '标注知识库事实和 AI 推断'
    ],
    followUpRules: ['关键信息缺失时先追问', '知识库已有答案时不重复追问'],
    outputFormat: '需求诊断卡：当前理解、需求类型、已知信息、缺失信息、推荐 Skill、下一步动作。',
    qualityChecks: ['不得跳过知识库读取', '不得把 AI 推断伪装成项目事实', '输出必须包含下一步动作']
  })
}

export function createSystemSkills() {
  return [
    createDefaultGeneralSkill(),
    normalizeSkill({
      id: 'system-clarify-ambiguous-requirement',
      name: '模糊需求澄清',
      description: '把一句粗略想法整理成可继续推进的产品/交互设计任务。',
      category: '需求理解',
      source: 'system',
      applicableScenarios: ['需求只有一句话', '缺少目标用户', '缺少成功标准', '不知道先做 PRD 还是流程'],
      requiredInputs: ['用户原始需求', '项目背景'],
      knowledgeScopes: ['业务背景', '用户角色', '历史需求', '竞品资料'],
      steps: ['复述当前理解', '判断需求类型', '列出已知信息', '列出缺失信息', '推荐下一步 Skill 链'],
      followUpRules: ['最多提出 3 个关键问题', '问题必须能改变后续方案方向'],
      outputFormat: '## 当前理解\n## 需求类型\n## 已知信息\n## 缺失信息\n## 推荐下一步',
      qualityChecks: ['不得直接生成完整 PRD', '必须明确缺失信息']
    }),
    normalizeSkill({
      id: 'system-user-journey-map',
      name: '用户旅程地图',
      description: '梳理用户完成目标时的阶段、触点、行为、情绪、痛点、机会点和设计建议。',
      category: '用户研究',
      source: 'system',
      applicableScenarios: ['体验优化', '新功能规划', '跨触点服务流程', '需要定位痛点机会'],
      requiredInputs: ['用户角色', '用户目标', '当前流程', '业务目标'],
      knowledgeScopes: ['用户画像', '业务流程', '用户反馈', '竞品资料'],
      steps: ['确定用户角色和目标', '拆解旅程阶段', '补充行为和触点', '标注情绪和痛点', '归纳机会点', '输出设计建议'],
      followUpRules: ['缺少用户角色或目标时先追问'],
      outputFormat: '| 阶段 | 用户目标 | 用户行为 | 触点 | 情绪 | 痛点 | 机会点 | 设计建议 |\n| --- | --- | --- | --- | --- | --- | --- | --- |',
      qualityChecks: ['每个阶段必须有痛点或机会点', '必须引用项目上下文或标注推断']
    }),
    normalizeSkill({
      id: 'system-prd-interaction-plan',
      name: 'PRD/交互方案生成',
      description: '基于项目上下文生成产品需求、核心流程、页面模块、状态异常和验收标准。',
      category: '产品方案',
      source: 'system',
      applicableScenarios: ['需要形成 PRD', '需要交互方案', '已有足够背景', 'B 端复杂模块设计'],
      requiredInputs: ['背景目标', '用户场景', '核心流程', '约束条件'],
      knowledgeScopes: ['业务背景', '业务流程', '设计规范', '历史需求', '竞品资料'],
      steps: ['整理背景和目标', '定义范围和非范围', '描述核心流程', '拆页面和模块', '补状态异常', '给方案对比', '写验收标准'],
      followUpRules: ['缺少范围或成功标准时先追问'],
      outputFormat: '## 背景和目标\n## 用户和场景\n## 范围和非范围\n## 核心流程\n## 页面/模块说明\n## 状态和异常\n## 方案对比\n## 验收标准\n## 待确认问题',
      qualityChecks: ['必须有范围和非范围', '必须有验收标准', '必须列出待确认问题']
    })
  ]
}

export function validateSkill(skill) {
  const normalized = normalizeSkill(skill)
  const missing = requiredSections.filter((key) => {
    const value = normalized[key]
    return Array.isArray(value) ? value.length === 0 : !String(value || '').trim()
  })
  const warnings = []
  if (!normalized.followUpRules.length) warnings.push('建议补充追问规则，避免需求模糊时直接生成。')
  if (!normalized.nonApplicableScenarios.length) warnings.push('建议补充不适用场景，降低误用风险。')
  return {
    ok: missing.length === 0,
    missing,
    warnings
  }
}

function listBlock(title, items) {
  return `## ${title}\n${asArray(items).map((item) => `- ${item}`).join('\n') || '- 暂无'}`
}

export function skillToMarkdown(skill) {
  const normalized = normalizeSkill(skill)
  return [
    `# Skill: ${normalized.name}`,
    '',
    `## 描述\n${normalized.description || '暂无'}`,
    '',
    listBlock('适用场景', normalized.applicableScenarios),
    '',
    listBlock('不适用场景', normalized.nonApplicableScenarios),
    '',
    listBlock('需要输入', normalized.requiredInputs),
    '',
    listBlock('知识库检索范围', normalized.knowledgeScopes),
    '',
    listBlock('工作步骤', normalized.steps),
    '',
    listBlock('追问规则', normalized.followUpRules),
    '',
    `## 输出格式\n${normalized.outputFormat || '暂无'}`,
    '',
    listBlock('验收标准', normalized.qualityChecks),
    '',
    `## 示例输入\n${normalized.exampleInput || '暂无'}`,
    '',
    `## 示例输出\n${normalized.exampleOutput || '暂无'}`
  ].join('\n')
}

function section(markdown, title) {
  const pattern = new RegExp(`## ${title}\\n([\\s\\S]*?)(?=\\n## |$)`)
  return markdown.match(pattern)?.[1]?.trim() || ''
}

export function markdownToSkill(markdown = '') {
  const name = markdown.match(/^# Skill:\s*(.+)$/m)?.[1]?.trim() || '导入 Skill'
  return normalizeSkill({
    name,
    description: section(markdown, '描述'),
    applicableScenarios: section(markdown, '适用场景'),
    nonApplicableScenarios: section(markdown, '不适用场景'),
    requiredInputs: section(markdown, '需要输入'),
    knowledgeScopes: section(markdown, '知识库检索范围'),
    steps: section(markdown, '工作步骤'),
    followUpRules: section(markdown, '追问规则'),
    outputFormat: section(markdown, '输出格式'),
    qualityChecks: section(markdown, '验收标准'),
    exampleInput: section(markdown, '示例输入'),
    exampleOutput: section(markdown, '示例输出'),
    markdown
  })
}

export function buildSkillExecutionContext(state, skill, input) {
  return {
    projectId: state.currentProjectId,
    input,
    skill: normalizeSkill(skill),
    knowledge: state.knowledge || [],
    requirements: state.requirements || [],
    competitors: state.competitors || [],
    palette: state.palette || {},
    generatedAt: new Date().toISOString()
  }
}
```

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: Vite build succeeds with no import errors.

## Task 2: Add Local Skill Runner

**Files:**
- Create: `src/services/skillRunner.js`

**Interfaces:**
- Consumes: `SkillExecutionContext` from `src/services/skills.js`
- Produces: `runSkillLocally(context: SkillExecutionContext): SkillRunResult`
- Produces: result shape `{ title: string, content: string, diagnosis: object, sources: Array, assetType: string }`

- [ ] **Step 1: Create deterministic local execution**

Create `src/services/skillRunner.js` with:

```js
function sourceSummary(context) {
  return [
    ...(context.knowledge || []).slice(0, 3).map((item) => ({ type: '知识库', title: item.title, meta: item.meta || item.status || '' })),
    ...(context.requirements || []).slice(0, 2).map((item) => ({ type: '需求', title: item.title, meta: item.meta || item.status || '' })),
    ...(context.competitors || []).slice(0, 2).map((item) => ({ type: '竞品', title: item.title, meta: item.meta || item.status || '' }))
  ]
}

function inferScenario(input = '') {
  if (/审批|权限|后台|B\s*端|表单|流程|状态/.test(input)) return 'B 端复杂系统设计'
  if (/优化|改版|不好用|很乱|体验/.test(input)) return '已有项目改版优化'
  if (/新|从 0|0 到 1|想做|搭一个/.test(input)) return '新项目从 0 到 1 梳理'
  return '模糊需求诊断'
}

function diagnosis(context) {
  const input = context.input || ''
  const sources = sourceSummary(context)
  const missing = []
  if (!/用户|角色|客户|设计师|产品/.test(input)) missing.push('目标用户或角色')
  if (!/目标|指标|成功|提升|降低|减少/.test(input)) missing.push('成功标准')
  if (!/流程|页面|场景|任务|路径/.test(input)) missing.push('关键使用场景或流程')
  return {
    clarity: missing.length >= 2 ? '模糊' : missing.length === 1 ? '初步' : '较明确',
    scenario: inferScenario(input),
    missing,
    recommendedSkills: missing.length ? ['模糊需求澄清', '用户旅程地图'] : ['用户旅程地图', 'PRD/交互方案生成'],
    sourceCount: sources.length
  }
}

function renderSources(sources) {
  if (!sources.length) return '- 暂无已引用资料，以下内容主要基于用户输入和 AI 推断。'
  return sources.map((source) => `- ${source.type}：${source.title}${source.meta ? `（${source.meta}）` : ''}`).join('\n')
}

function renderDiagnosis(context, diag, sources) {
  return `# 需求诊断\n\n## 当前理解\n${context.input || '用户尚未输入明确需求。'}\n\n## 需求类型\n${diag.scenario}\n\n## 需求成熟度\n${diag.clarity}\n\n## 已引用资料\n${renderSources(sources)}\n\n## 缺失信息\n${diag.missing.length ? diag.missing.map((item) => `- ${item}`).join('\n') : '- 暂无明显缺失，可以进入方案生成。'}\n\n## 推荐 Skill 链\n${diag.recommendedSkills.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\n## 下一步\n${diag.missing.length ? '先补齐缺失信息，再进入用户旅程或 PRD/交互方案生成。' : '可以直接执行用户旅程地图或 PRD/交互方案生成。'}`
}

function renderJourney(context, sources) {
  return `# 用户旅程地图\n\n## 已引用资料\n${renderSources(sources)}\n\n| 阶段 | 用户目标 | 用户行为 | 触点 | 情绪 | 痛点 | 机会点 | 设计建议 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| 发现问题 | 明确当前要解决什么 | 描述需求、上传资料、选择项目 | 项目诊断台 | 困惑 | 需求模糊，资料分散 | 用默认 Skill 先诊断 | 提供需求诊断卡和推荐 Skill 链 |\n| 补齐上下文 | 让 AI 理解项目 | 导入知识库、竞品、流程资料 | 知识库 | 谨慎 | 担心 AI 编造 | 展示引用来源 | 输出区区分知识库事实和 AI 推断 |\n| 生成方案 | 获得可比较方案 | 选择系统或自定义 Skill 执行 | Skill 工作台 | 期待 | 不知道方案取舍 | 输出多方案与风险 | 给出推荐方案、适用条件和验收标准 |\n| 沉淀资产 | 后续可复用 | 保存结果到运行记录和资产库 | 运行记录 | 稳定 | 聊天结果难追溯 | 资产化保存 | 保存输入、Skill、引用资料和版本 |`
}

function renderPrd(context, diag, sources) {
  return `# ${context.skill.name}\n\n## 背景和目标\n基于用户输入“${context.input || '未提供'}”生成第一版产品/交互方案。当前判断为：${diag.scenario}。\n\n## 用户和场景\n- 主要用户：产品经理、交互设计师、体验设计师。\n- 场景：围绕项目知识库和 Skill 编排完成需求澄清、方案生成和资产沉淀。\n\n## 范围和非范围\n- 范围：默认通用 Skill、系统 Skill、用户自定义 Skill、知识库引用、执行记录。\n- 非范围：Skill 市场、直接执行 GitHub 代码、Figma/Jira/Confluence 自动发布。\n\n## 已引用资料\n${renderSources(sources)}\n\n## 核心流程\n1. 用户输入需求。\n2. 默认通用 Skill 诊断需求并读取知识库。\n3. 系统推荐 Skill 链或用户选择自己的 Skill。\n4. 目标 Skill 生成结构化结果。\n5. 系统保存运行记录和输出资产。\n\n## 待确认问题\n${diag.missing.length ? diag.missing.map((item) => `- 请补充：${item}`).join('\n') : '- 当前输入可以进入下一轮细化。'}\n\n## 验收标准\n- 输出必须包含引用资料或说明暂无引用。\n- 输出必须区分已知事实和 AI 推断。\n- 执行结果必须保存到运行记录。`
}

export function runSkillLocally(context) {
  const diag = diagnosis(context)
  const sources = sourceSummary(context)
  const skillName = context.skill?.name || ''
  let content = renderDiagnosis(context, diag, sources)
  let assetType = '需求诊断'

  if (/旅程/.test(skillName)) {
    content = renderJourney(context, sources)
    assetType = '用户旅程地图'
  } else if (/PRD|交互方案/.test(skillName)) {
    content = renderPrd(context, diag, sources)
    assetType = 'PRD/交互方案'
  }

  return {
    title: `${context.skill.name} · ${assetType}`,
    content,
    diagnosis: diag,
    sources,
    assetType
  }
}
```

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: Vite build succeeds.

## Task 3: Add Generic Skill API Client and Mock Routes

**Files:**
- Modify: `src/services/api.js`
- Modify: `server/mock-api.mjs`

**Interfaces:**
- Produces API methods:
  - `api.skills.diagnose(config, payload)`
  - `api.skills.execute(config, payload)`
  - `api.skills.importDraft(config, payload)`

- [ ] **Step 1: Update client API**

In `src/services/api.js`, add this object inside `export const api = { ... }` before `settings`:

```js
  skills: {
    diagnose(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/skills/diagnose', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    execute(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/skills/execute', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    importDraft(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/skills/import-draft', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  },
```

- [ ] **Step 2: Add mock routes**

In `server/mock-api.mjs`, add these route handlers before the existing `POST /api/pm/question` route:

```js
  'POST /api/skills/diagnose': async (payload) => {
    const input = payload.input || ''
    const missing = []
    if (!/用户|角色|客户|设计师|产品/.test(input)) missing.push('目标用户或角色')
    if (!/目标|指标|成功|提升|降低|减少/.test(input)) missing.push('成功标准')
    if (!/流程|页面|场景|任务|路径/.test(input)) missing.push('关键使用场景或流程')
    return {
      diagnosis: {
        clarity: missing.length >= 2 ? '模糊' : missing.length === 1 ? '初步' : '较明确',
        missing,
        recommendedSkills: missing.length ? ['模糊需求澄清', '用户旅程地图'] : ['用户旅程地图', 'PRD/交互方案生成']
      }
    }
  },
  'POST /api/skills/execute': async (payload) => ({
    run: {
      id: randomUUID(),
      title: `${payload.skill?.name || 'Skill'} 执行结果`,
      assetType: payload.skill?.name || 'Skill 输出',
      sources: [
        ...(payload.knowledge || []).slice(0, 3).map((item) => ({ type: '知识库', title: item.title, meta: item.meta || item.status || '' }))
      ],
      content: `# ${payload.skill?.name || 'Skill'}\n\n## 当前输入\n${payload.input || '未输入'}\n\n## 输出\n本地 API 已接收项目知识库、需求文档、竞品资料和 Skill 定义。真实服务接入后会按 Skill 工作步骤生成完整结果。\n\n## 下一步\n- 检查引用资料是否完整\n- 补齐缺失信息\n- 保存为项目资产`
    }
  }),
  'POST /api/skills/import-draft': async (payload) => ({
    draft: {
      id: randomUUID(),
      name: payload.name || '外部导入 Skill 草稿',
      status: 'pending-review',
      sourceUrl: payload.url || '',
      riskNotes: ['外部内容仅作为待审核草稿保存', '未执行任何外部代码']
    }
  }),
```

- [ ] **Step 3: Run API and smoke test**

Run: `npm run api`

Expected: terminal prints `流程通本地 API 已启动：http://localhost:5288`.

In a second terminal run:

```bash
curl -sS -X POST http://127.0.0.1:5288/api/skills/diagnose \
  -H 'Content-Type: application/json' \
  -d '{"input":"想优化后台审批流程，感觉现在很乱"}'
```

Expected JSON includes `"recommendedSkills"` and `"missing"`.

Stop the API server before moving on.

## Task 4: Extend App State for Skills, Runs, and Assets

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `createSystemSkills`, `skillToMarkdown`, `markdownToSkill`, `validateSkill`, `buildSkillExecutionContext`
- Consumes: `runSkillLocally`
- Produces state fields: `skills`, `skillRuns`, `assets`

- [ ] **Step 1: Add imports**

In `src/App.vue`, replace the current service imports with added Skill imports:

```js
import { api, defaultApiConfig, isConfigured } from './services/api'
import { loadState, saveState } from './services/storage'
import { createVueViteFiles, downloadZip } from './services/zip'
import { parseWebsnapFile } from './services/websnap'
import { designPalette, designRules } from './designRules'
import {
  buildSkillExecutionContext,
  createSystemSkills,
  markdownToSkill,
  skillToMarkdown,
  validateSkill
} from './services/skills'
import { runSkillLocally } from './services/skillRunner'
```

- [ ] **Step 2: Add boot state fields**

In `bootState`, add:

```js
  skills: createSystemSkills(),
  skillRuns: [],
  assets: [],
```

immediately after `competitors: [],`.

After `sanitizeLegacyNames(bootState)`, add:

```js
if (!Array.isArray(bootState.skills) || !bootState.skills.length) {
  bootState.skills = createSystemSkills()
}
if (!bootState.skills.some((skill) => skill.id === 'default-general-design-skill')) {
  bootState.skills.unshift(createSystemSkills()[0])
}
if (!Array.isArray(bootState.skillRuns)) bootState.skillRuns = []
if (!Array.isArray(bootState.assets)) bootState.assets = []
```

- [ ] **Step 3: Add refs and computed values**

After `const uxForm = reactive(...)`, add:

```js
const workbenchForm = reactive({
  input: '',
  selectedSkillId: 'default-general-design-skill',
  mode: 'diagnose'
})
const skillEditor = reactive({
  activeId: '',
  mode: 'form',
  draft: null,
  markdown: ''
})
const skillImportForm = reactive({ url: '', raw: '' })
const skillWorkbenchResult = ref('等待输入需求并执行 Skill。')
const skillWorkbenchStatus = refStatus()
```

After `const hasGeneratedCode = computed(...)`, add:

```js
const availableSkills = computed(() => state.skills || [])
const selectedWorkbenchSkill = computed(() =>
  availableSkills.value.find((skill) => skill.id === workbenchForm.selectedSkillId) || availableSkills.value[0]
)
const skillValidation = computed(() => skillEditor.draft ? validateSkill(skillEditor.draft) : { ok: true, missing: [], warnings: [] })
```

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: build succeeds. The UI is not wired yet, but imports and state compile.

## Task 5: Add Unified Skill Workbench View

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: state and computed values from Task 4.
- Produces user workflow for diagnosis and execution.

- [ ] **Step 1: Add nav item**

In `navItems`, insert before PM Skill:

```js
  { key: 'skills', label: 'Skill 工作台', icon: '03' },
```

Then renumber existing PM/UX/settings icons to `04`, `05`, `06`.

- [ ] **Step 2: Add template section**

Add this section before the existing PM section:

```vue
      <section v-if="activeView === 'skills'" class="view-panel skill-workbench">
        <section class="panel skill-diagnosis-panel">
          <div class="panel-head">
            <div>
              <h3>项目诊断台</h3>
              <p>输入模糊需求或明确任务，默认通用 Skill 会先读取项目资料、判断需求类型并推荐下一步。</p>
            </div>
            <StatusBadge :status="skillWorkbenchStatus.status" />
          </div>
          <textarea
            v-model="workbenchForm.input"
            placeholder="例如：想优化后台审批流程，感觉现在很乱；或者：帮我为新项目生成用户旅程和 PRD"
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
            <button class="primary" type="button" @click="runWorkbenchSkill">执行</button>
            <button type="button" @click="startCreateSkill">新建我的 Skill</button>
          </div>
          <Notice :result="skillWorkbenchStatus" />
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h3>执行结果</h3>
              <p>结果会标注引用资料、AI 推断和推荐下一步，并保存到运行记录。</p>
            </div>
          </div>
          <pre class="code-block tall">{{ skillWorkbenchResult }}</pre>
        </section>

        <section class="panel">
          <ListHeader title="运行记录" :count="state.skillRuns.length" />
          <DataList :items="state.skillRuns" empty="暂无运行记录" />
        </section>

        <section class="panel">
          <ListHeader title="输出资产" :count="state.assets.length" />
          <DataList :items="state.assets" empty="暂无输出资产" />
        </section>
      </section>
```

- [ ] **Step 3: Add execution methods**

Add these methods before `buildSkillPayload`:

```js
async function runWorkbenchSkill() {
  if (!workbenchForm.input.trim()) {
    setStatus(skillWorkbenchStatus, 'failed', '请先输入需求或任务')
    return
  }

  const skill = selectedWorkbenchSkill.value
  const context = buildSkillExecutionContext(state, skill, workbenchForm.input)
  setStatus(skillWorkbenchStatus, 'loading', '正在执行 Skill...')

  const endpoint = workbenchForm.mode === 'diagnose' ? api.skills.diagnose : api.skills.execute
  const result = await endpoint(state.apiConfig, context)
  const data = applyApiResult(skillWorkbenchStatus, result, 'Skill 服务未配置，已使用本地执行')
  const local = runSkillLocally(context)
  const runResult = data?.run || {
    id: crypto.randomUUID(),
    ...local
  }

  if (data?.diagnosis && !data?.run) {
    runResult.diagnosis = data.diagnosis
  }

  skillWorkbenchResult.value = runResult.content || local.content
  const runRecord = {
    id: runResult.id || crypto.randomUUID(),
    title: runResult.title || `${skill.name} 执行结果`,
    meta: `${skill.name} · ${new Date().toLocaleString()}`,
    status: '已完成',
    content: skillWorkbenchResult.value
  }
  state.skillRuns.unshift(runRecord)
  state.assets.unshift({
    id: crypto.randomUUID(),
    title: runRecord.title,
    meta: runResult.assetType || skill.name,
    status: '已保存',
    content: skillWorkbenchResult.value
  })
  setStatus(skillWorkbenchStatus, 'success', 'Skill 执行完成，结果已保存')
}
```

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: build succeeds.

## Task 6: Add Skill Center and Editor

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `skillEditor`, `skillValidation`, `skillToMarkdown`, `markdownToSkill`, `validateSkill`
- Produces: create/edit custom Skill in local state.

- [ ] **Step 1: Add Skill editor template**

Inside the `activeView === 'skills'` section, after the output assets panel, add:

```vue
        <section class="panel skill-library-panel">
          <div class="panel-head">
            <div>
              <h3>Skill 中心</h3>
              <p>系统 Skill 可复制为我的 Skill；自定义 Skill 支持表单模式和 Markdown 高级模式。</p>
            </div>
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

          <div v-if="skillEditor.draft" class="validation-box">
            <strong>{{ skillValidation.ok ? '结构检查通过' : '结构需要补齐' }}</strong>
            <span v-if="skillValidation.missing.length">缺失：{{ skillValidation.missing.join('、') }}</span>
            <span v-for="warning in skillValidation.warnings" :key="warning">{{ warning }}</span>
          </div>
        </section>
```

- [ ] **Step 2: Add editor methods**

Add these helper methods before `runWorkbenchSkill`:

```js
function textDraft(skill) {
  return {
    ...skill,
    applicableScenariosText: (skill.applicableScenarios || []).join('\n'),
    requiredInputsText: (skill.requiredInputs || []).join('\n'),
    knowledgeScopesText: (skill.knowledgeScopes || []).join('\n'),
    stepsText: (skill.steps || []).join('\n'),
    followUpRulesText: (skill.followUpRules || []).join('\n'),
    qualityChecksText: (skill.qualityChecks || []).join('\n')
  }
}

function draftFromText() {
  const draft = skillEditor.draft
  return {
    ...draft,
    source: draft.source === 'system' ? 'user' : draft.source,
    id: draft.source === 'system' ? crypto.randomUUID() : draft.id,
    status: draft.status === 'pending-review' ? 'active' : draft.status,
    applicableScenarios: draft.applicableScenariosText,
    requiredInputs: draft.requiredInputsText,
    knowledgeScopes: draft.knowledgeScopesText,
    steps: draft.stepsText,
    followUpRules: draft.followUpRulesText,
    qualityChecks: draft.qualityChecksText
  }
}

function startCreateSkill() {
  const base = {
    id: crypto.randomUUID(),
    name: '我的新 Skill',
    description: '',
    category: '自定义',
    source: 'user',
    status: 'active',
    applicableScenarios: [],
    requiredInputs: [],
    knowledgeScopes: [],
    steps: [],
    followUpRules: [],
    outputFormat: '',
    qualityChecks: []
  }
  skillEditor.activeId = base.id
  skillEditor.draft = textDraft(base)
  skillEditor.markdown = skillToMarkdown(base)
}

function editSkill(skill) {
  const editable = skill.source === 'system' ? { ...skill, id: crypto.randomUUID(), name: `${skill.name} 副本`, source: 'user' } : skill
  skillEditor.activeId = skill.id
  skillEditor.draft = textDraft(editable)
  skillEditor.markdown = skillToMarkdown(editable)
}

function saveSkillDraft() {
  if (!skillEditor.draft) return
  const source = skillEditor.mode === 'markdown' ? markdownToSkill(skillEditor.markdown) : draftFromText()
  const skill = {
    ...source,
    id: source.id || skillEditor.draft.id || crypto.randomUUID(),
    source: 'user',
    status: 'active'
  }
  const validation = validateSkill(skill)
  if (!validation.ok) {
    setStatus(skillWorkbenchStatus, 'failed', `Skill 缺失字段：${validation.missing.join('、')}`)
    return
  }
  const existingIndex = state.skills.findIndex((item) => item.id === skill.id)
  if (existingIndex >= 0) state.skills.splice(existingIndex, 1, skill)
  else state.skills.unshift(skill)
  workbenchForm.selectedSkillId = skill.id
  setStatus(skillWorkbenchStatus, 'success', 'Skill 已保存')
}
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: build succeeds.

## Task 7: Add External Skill Draft Import

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `api.skills.importDraft`
- Produces pending-review Skill draft.

- [ ] **Step 1: Add import UI**

Inside the Skill editor panel, before the validation box, add:

```vue
          <div class="skill-import-box">
            <strong>外部 Skill 导入</strong>
            <input v-model="skillImportForm.url" placeholder="GitHub 或网页链接，只会导入为待审核草稿" />
            <textarea v-model="skillImportForm.raw" placeholder="也可以粘贴 Markdown Skill 内容"></textarea>
            <button type="button" @click="importSkillDraft">导入为草稿</button>
          </div>
```

- [ ] **Step 2: Add import method**

Add this method before `saveSkillDraft`:

```js
async function importSkillDraft() {
  if (!skillImportForm.url && !skillImportForm.raw.trim()) {
    setStatus(skillWorkbenchStatus, 'failed', '请粘贴链接或 Markdown 内容')
    return
  }
  const markdownSkill = skillImportForm.raw.trim() ? markdownToSkill(skillImportForm.raw) : null
  const result = await api.skills.importDraft(state.apiConfig, {
    url: skillImportForm.url,
    name: markdownSkill?.name,
    raw: skillImportForm.raw
  })
  const data = applyApiResult(skillWorkbenchStatus, result, '外部导入服务未配置，已保存为本地待审核草稿')
  const draft = {
    ...(markdownSkill || {
      id: crypto.randomUUID(),
      name: '外部导入 Skill 草稿',
      description: '从外部链接导入的待审核 Skill。',
      category: '自定义',
      applicableScenarios: ['待审核后补充'],
      requiredInputs: ['待审核后补充'],
      knowledgeScopes: ['待审核后补充'],
      steps: ['待审核后补充'],
      outputFormat: '待审核后补充',
      qualityChecks: ['不得执行外部代码']
    }),
    id: data?.draft?.id || crypto.randomUUID(),
    source: 'user',
    status: 'pending-review',
    sourceUrl: skillImportForm.url
  }
  state.skills.unshift(draft)
  editSkill(draft)
  setStatus(skillWorkbenchStatus, 'success', '已导入为待审核草稿，保存前请检查内容和风险')
}
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: build succeeds.

## Task 8: Add Styles

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Produces styles for classes used in Tasks 5-7.

- [ ] **Step 1: Append CSS**

Append to `src/styles.css`:

```css
.skill-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.9fr);
  gap: 16px;
}

.skill-workbench .panel {
  min-width: 0;
}

.skill-diagnosis-panel textarea,
.skill-editor-panel textarea,
.markdown-editor,
.skill-import-box textarea {
  width: 100%;
  min-height: 128px;
  resize: vertical;
}

.skill-library-panel,
.skill-editor-panel {
  grid-column: 1 / -1;
}

.skill-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.skill-list button {
  text-align: left;
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
}

.skill-list button.active,
.skill-list button:hover {
  border-color: #222529;
}

.skill-list strong {
  color: #222529;
}

.skill-list span,
.validation-box span {
  color: #7f8792;
  font-size: 13px;
}

.skill-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.skill-editor-grid .wide {
  grid-column: 1 / -1;
}

.markdown-editor {
  min-height: 420px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.validation-box,
.skill-import-box {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid #e8eaec;
  border-radius: 8px;
  background: #f7f8fa;
  display: grid;
  gap: 8px;
}

.skill-import-box input {
  width: 100%;
}

@media (max-width: 980px) {
  .skill-workbench {
    grid-template-columns: 1fr;
  }

  .skill-editor-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: build succeeds.

## Task 9: Manual Verification

**Files:**
- No code changes.

**Interfaces:**
- Verifies full MVP flow.

- [ ] **Step 1: Start services**

Run API:

```bash
npm run api
```

Run app:

```bash
npm run dev
```

Expected:

- API prints `流程通本地 API 已启动：http://localhost:5288`.
- Vite prints a local URL, usually `http://localhost:5173/`.

- [ ] **Step 2: Verify workbench flow**

Open the Vite URL and perform:

1. Go to `Skill 工作台`.
2. Enter `想优化后台审批流程，感觉现在很乱`.
3. Keep `默认通用 Skill`.
4. Click `执行`.

Expected:

- Result panel shows a demand diagnosis.
- Running records count increases by 1.
- Output assets count increases by 1.

- [ ] **Step 3: Verify system Skill execution**

1. Select `系统 · 用户旅程地图`.
2. Enter `为产品交互设计师做一个 AI Skill 工作台，从模糊需求到 PRD 和用户旅程`.
3. Set mode to `直接执行所选 Skill`.
4. Click `执行`.

Expected:

- Result includes a journey map table.
- Running records and output assets increase.

- [ ] **Step 4: Verify custom Skill editor**

1. Click `新建我的 Skill`.
2. Fill required form fields with:
   - 名称: `设计评审 Skill`
   - 描述: `检查方案是否符合项目目标、用户路径和交互验收标准。`
   - 适用场景: `交互方案评审`
   - 需要输入: `方案说明`
   - 知识库检索范围: `设计规范`
   - 工作步骤: `检查目标\n检查流程\n检查风险`
   - 输出格式: `## 问题\n## 建议\n## 风险`
   - 验收标准: `必须列出高风险问题`
3. Click `保存 Skill`.

Expected:

- Status says Skill saved.
- New Skill appears in the selector.

- [ ] **Step 5: Verify external draft import**

1. Paste Markdown:

```md
# Skill: 外部用户旅程模板

## 描述
从外部资料整理的用户旅程模板。

## 适用场景
- 体验优化

## 需要输入
- 用户角色

## 知识库检索范围
- 用户反馈

## 工作步骤
- 拆阶段
- 找痛点

## 输出格式
旅程表格

## 验收标准
- 不执行外部代码
```

2. Click `导入为草稿`.

Expected:

- A pending-review Skill is added.
- Status warns it is a draft.

- [ ] **Step 6: Stop services**

Stop API and Vite terminals with `Ctrl-C`.

## Self-Review Checklist

- Spec coverage:
  - Default general Skill: Task 1, Task 2, Task 5.
  - System Skill library: Task 1, Task 6.
  - User custom Skill with form and Markdown: Task 6.
  - External import as pending review: Task 7.
  - Knowledge-aware execution: Task 2, Task 5.
  - Run records and output assets: Task 5.
  - Mock API support: Task 3.
- Deferred by spec:
  - Skill marketplace, Figma/Jira/Confluence publishing, external code execution, and high-fidelity generation are explicitly excluded.
- Placeholder scan:
  - The only `待审核后补充` strings are user-visible safe draft placeholders for imported unsafe external drafts. They are intentional runtime content, not plan placeholders.
