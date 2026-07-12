import { projectScopedContext } from './projectWorkspace.js'

export const SKILL_CATEGORIES = [
  '需求理解',
  '用户研究',
  '竞品分析',
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

function normalizeStage(stage = {}, index = 0) {
  return {
    id: stage.id || `stage-${index + 1}`,
    name: stage.name || stage.title || `阶段 ${index + 1}`,
    goal: stage.goal || '',
    expectedOutput: stage.expectedOutput || '',
    confirmation: stage.confirmation || '',
    canvasAction: stage.canvasAction || '',
    checks: asArray(stage.checks)
  }
}

function normalizeAgentInteraction(interaction = {}) {
  return {
    style: interaction.style || '',
    nextActions: Array.isArray(interaction.nextActions)
      ? interaction.nextActions.map((action, index) => ({
        id: action.id || `action-${index + 1}`,
        label: action.label || action.name || `动作 ${index + 1}`,
        targetStageId: action.targetStageId || '',
        intent: action.intent || ''
      }))
      : [],
    rules: asArray(interaction.rules)
  }
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function normalizeSkill(input = {}) {
  const name = input.name || '未命名 Skill'
  return {
    id: input.id || `${idFromName(name)}-${randomId()}`,
    name,
    description: input.description || '',
    category: input.category || '自定义',
    source: input.source || 'user',
    visibility: input.visibility || 'global',
    projectId: input.projectId || '',
    status: input.status || 'active',
    inputFields: Array.isArray(input.inputFields)
      ? input.inputFields.map((field, index) => normalizeInputField(field, index))
      : [],
    knowledgeScopeConfig: normalizeKnowledgeScopeConfig(input.knowledgeScopeConfig),
    applicableScenarios: asArray(input.applicableScenarios),
    nonApplicableScenarios: asArray(input.nonApplicableScenarios),
    requiredInputs: asArray(input.requiredInputs),
    knowledgeScopes: asArray(input.knowledgeScopes),
    steps: asArray(input.steps),
    followUpRules: asArray(input.followUpRules),
    outputFormat: input.outputFormat || '',
    qualityChecks: asArray(input.qualityChecks),
    mode: input.mode || '',
    stages: Array.isArray(input.stages) ? input.stages.map((stage, index) => normalizeStage(stage, index)) : [],
    agentInteraction: normalizeAgentInteraction(input.agentInteraction),
    outputTypes: asArray(input.outputTypes),
    exampleInput: input.exampleInput || '',
    exampleOutput: input.exampleOutput || '',
    markdown: input.markdown || '',
    sourceUrl: input.sourceUrl || ''
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

export function createUxDesignConfirmationSkill() {
  return normalizeSkill({
    id: 'ux-design-confirmation-skill',
    name: 'UX 设计确认 Skill',
    description: '让 Agent 先和用户分阶段确认需求、竞品、策略和 UX 流程，再把已确认结果转成可编辑的低保真流程画布与需求文档。',
    category: '交互设计',
    source: 'system',
    mode: 'agent-confirmation',
    applicableScenarios: ['从一个需求开始做完整 UX 方案', '需要 Agent 逐步确认再转画布', '需要先做竞品分析再定流程', '需要低保真流程图和需求文档一起沉淀'],
    nonApplicableScenarios: ['只想自由聊天不希望进入阶段流程', '只需要监控竞品长期变化', '已有完整高保真稿只需要代码还原'],
    requiredInputs: ['用户原始需求', '业务目标或项目背景', '目标用户或使用场景', '可选项目知识库', '可选竞品资料', '当前画布状态'],
    knowledgeScopes: ['项目背景', '历史需求', '用户角色', '业务流程', '竞品资料', '设计规范', '当前画布状态'],
    steps: [
      '需求澄清：复述目标、用户、场景、边界和待确认问题，信息足够时可以直接进入下一阶段',
      '竞品分析：围绕用户任务、页面结构、核心交互、状态反馈和可借鉴/不可照搬点做证据层分析',
      '设计策略：明确本次方案的体验原则、信息架构方向、主路径和非范围',
      'UX 流程确认：拆入口、页面/节点、用户动作、系统反馈、异常状态、权限和数据依赖',
      '低保真画布：把每个页面或业务阶段转成画布节点，节点之间用主路径、分支和异常回路连接',
      '转需求文档：基于已确认结果输出 PRD/交互说明、前后端分工和验收清单'
    ],
    stages: [
      {
        id: 'requirement-clarification',
        name: '需求澄清',
        goal: '确认目标用户、业务目标、核心任务、约束边界和信息缺口。',
        expectedOutput: '需求理解卡、已确认事实、AI 推断、待确认问题、建议下一步。',
        confirmation: '用户确认核心目标和边界后进入竞品分析；信息足够时 Agent 可说明理由并继续。',
        canvasAction: '暂不生成画布，只沉淀确认卡。'
      },
      {
        id: 'competitor-analysis',
        name: '竞品分析',
        goal: '把竞品作为设计判断证据，提炼结构、交互、状态和机会点。',
        expectedOutput: '竞品对比表、可借鉴点、风险点、差异化机会、对本方案的影响。',
        confirmation: '用户确认竞品结论是否纳入设计策略。',
        canvasAction: '可在画布生成时作为节点证据引用，不单独替代流程节点。'
      },
      {
        id: 'design-strategy',
        name: '设计策略',
        goal: '确定体验原则、信息架构方向、范围和非范围。',
        expectedOutput: '设计策略卡、范围边界、优先级、关键假设。',
        confirmation: '用户确认策略后才拆 UX 流程。',
        canvasAction: '生成策略节点或作为后续流程节点的全局说明。'
      },
      {
        id: 'ux-flow',
        name: 'UX 流程确认',
        goal: '拆解入口、页面节点、动作、反馈、异常、权限和数据依赖。',
        expectedOutput: '主流程、分支流程、异常流程、页面/节点清单。',
        confirmation: '用户确认流程覆盖后进入低保真画布。',
        canvasAction: '准备 nodes、edges、groups 的结构化数据。'
      },
      {
        id: 'lofi-canvas',
        name: '低保真画布',
        goal: '把已确认流程转成可编辑画布，像流程总览一样一眼看到项目交互全貌。',
        expectedOutput: '低保真流程画布、节点摘要、边关系、状态说明。',
        confirmation: '用户可继续让 Agent 调整节点、补状态或转文档。',
        canvasAction: '创建或刷新画布节点和连线。'
      },
      {
        id: 'requirement-doc',
        name: '转需求文档',
        goal: '把确认后的方案沉淀成可交付 PRD/交互说明。',
        expectedOutput: '需求文档、前后端分工、接口/数据依赖、验收清单。',
        confirmation: '用户确认是否进入工程开发或继续迭代。',
        canvasAction: '将文档和画布建立引用关系。'
      }
    ],
    agentInteraction: {
      style: 'progressive-confirmation',
      nextActions: [
        { id: 'continue-next-stage', label: '下一步', targetStageId: 'next', intent: '进入下一阶段' },
        { id: 'revise-current-stage', label: '调整本阶段', targetStageId: 'current', intent: '修改当前结论' },
        { id: 'generate-canvas', label: '转低保真画布', targetStageId: 'lofi-canvas', intent: '把已确认结果生成画布' }
      ],
      rules: [
        '不要把阶段做成死板问卷；信息充分时允许 Agent 推进并说明依据',
        '每阶段都要区分已确认事实、AI 推断、待确认问题和下一步动作',
        '设计方案页面未勾选项目时不要默认检索项目知识库',
        '选择项目时先读取相关知识和竞品资料，再结合 Skill 阶段目标分析',
        '低保真画布节点必须包含页面目标、用户任务、入口、模块、主动作、次动作、状态、权限/异常、数据依赖和验收点'
      ]
    },
    followUpRules: ['一次最多追问 3 个会改变方案方向的问题', '用户说“继续/下一步”时推进阶段而不是重复总结', '用户要求转画布时必须使用已确认结果生成节点和连线'],
    outputTypes: ['阶段确认卡', '竞品分析结论', 'UX 流程清单', '低保真画布', '需求文档'],
    outputFormat: 'Agent 阶段方案：当前阶段、已确认事实、AI 推断、待确认问题、下一步按钮；最终输出低保真画布 nodes/edges/groups 和需求文档。',
    qualityChecks: ['progressive-confirmation', 'knowledge-scope-respect', 'competitor-evidence', 'ux-flow-completeness', 'lofi-canvas-ready', 'handoff-checklist'],
    exampleInput: '帮我做一个流程通的设计方案，从需求确认到低保真流程画布。',
    exampleOutput: '先输出需求澄清卡，确认后进入竞品分析和设计策略，再把 UX 流程转成低保真画布节点，最后沉淀需求文档。'
  })
}

export function createDialogueSkill() {
  return normalizeSkill({
    id: 'dialogue-skill',
    name: '对话 Skill',
    description: '先进入纯模型对话和分析，不预先生成画布；用户确认对话完成后，再把结论转成页面串联画布。',
    category: '产品方案',
    source: 'system',
    mode: 'dialogue-agent',
    applicableScenarios: ['想先自由对话分析需求', '不希望 Skill 阶段固定死', '希望聊清楚后再生成页面画布', '需要把完整方案转成页面串联节点'],
    nonApplicableScenarios: ['需要严格按 UX 阶段推进确认', '需要长期竞品分析', '已有完整文档只需要直接生成固定画布'],
    requiredInputs: ['用户原始需求', '可选上传资料', '可选项目知识', '对话中逐步确认的信息'],
    knowledgeScopes: ['用户输入', '上传资料', '可选项目知识', '当前对话上下文'],
    steps: [
      '纯模型对话：先理解目标、用户、场景、边界和不确定点',
      '自由分析：根据对话内容自主判断下一步，不套固定阶段问卷',
      '持续确认：围绕缺口、假设、页面范围和主流程继续追问或总结',
      '对话完成后生成页面串联画布：每个页面作为画布节点，节点之间用主路径连接'
    ],
    stages: [
      {
        id: 'dialogue-agent',
        name: '纯模型对话',
        goal: '先通过自然对话把需求聊清楚，不立即生成画布。',
        expectedOutput: '对话分析、页面范围、主流程假设、待确认问题。',
        confirmation: '用户点击生成方案画布后再转页面串联画布。',
        canvasAction: '对话完成前不创建画布；完成后创建页面节点和连线。'
      }
    ],
    agentInteraction: {
      style: 'open-dialogue',
      nextActions: [
        { id: 'continue-analysis', label: '继续分析', targetStageId: 'dialogue-agent', intent: '继续对话分析' },
        { id: 'organize-pages', label: '整理页面', targetStageId: 'dialogue-agent', intent: '梳理页面范围和主路径' },
        { id: 'generate-page-canvas', label: '生成方案画布', targetStageId: 'dialogue-agent', intent: '把对话结论转成页面串联画布' }
      ],
      rules: [
        'Skill 只约束交互方式，不限制模型判断',
        '进入后只打开 Agent 对话，不先生成画布',
        '设计方案页面未选择项目时不要默认检索项目知识库',
        '对话完成后输出页面串联画布，每个页面一个节点并用边连接'
      ]
    },
    followUpRules: ['信息不足时自然追问', '用户要求生成画布时使用已有对话结论', '生成画布后节点详情第一块展示纯模型内容'],
    outputTypes: ['页面串联画布', '方案画布', '对话分析结论'],
    outputFormat: '对话完成后输出页面串联画布：orderedTabs、nodes、edges；每个节点包含页面目标、核心模块、主动作、状态、数据接口和验收点。',
    qualityChecks: ['dialogue-first', 'no-initial-canvas', 'page-node-canvas', 'pure-model-detail', 'flow-edges'],
    exampleInput: '先跟我聊清楚小程序方案，确认后再生成页面画布。',
    exampleOutput: '先在 Agent 中持续对话；点击生成方案画布后，把入口页、主流程、异常兜底、结果页等转成页面节点并串联。'
  })
}

export function createAdvancedUxRequirementAnalysisSkill() {
  return normalizeSkill({
    id: 'advanced-ux-requirement-analysis',
    name: '高级 UX 需求分析',
    description: '复制总流程运行链路，但需求分析第一阶段按最新高级 UX 10 节点论证链推进，并在后续阶段生成页面交互框架、Draw.io 和低保真线框图产物。',
    category: '交互设计',
    source: 'system',
    mode: 'total-design-flow',
    applicableScenarios: ['需要深度 UX 需求分析', '需要从模糊需求收敛到可执行方案', '需要评审前完整论证链', '需要置信度、风险和验证提示', '需要继续产出页面交互文档、低保真和流程/状态可视化规划'],
    nonApplicableScenarios: ['只需要自由聊天', '只需要快速生成页面代码', '只需要单页视觉润色'],
    requiredInputs: ['用户原始需求', 'PRD/需求描述/附件', '业务目标', '用户场景', '约束条件'],
    knowledgeScopes: ['业务背景', '用户角色', '需求文档', '历史需求', '竞品资料', '设计规范'],
    steps: [
      '原始需求分析：识别原始输入、真实诉求、需求清晰度、GWT 行为表、5 Whys、关键缺口和追问清单',
      '设计问题定义：把需求转译为目标矩阵、体验矛盾、HMW 问题、非目标和成功判断标准',
      '用户与场景：定义目标用户、关键场景、核心任务、Journey Map、体验风险和页面优先级',
      '假设与验证：沉淀假设分类总表、高风险假设聚焦和后续假设回检点',
      '设计机会：基于功能缺口、体验痛点和风险转化输出设计机会总表、Top 机会和机会到步骤映射',
      '整体交互链路：梳理主流程、页面三件套、弹窗/抽屉、状态机、信息架构、关键断点和全局交互规范',
      '三套设计方案：围绕关键节点输出稳妥/效率/引导三套完整设计方案、对比矩阵和关键节点低保真对比',
      '异常流补充：补齐取消、返回、校验失败、接口错误、网络、权限、过期、重复提交、中断恢复和再次进入',
      '推荐方案建议：完成 Problem-Solution Fit、六顶思考帽、推荐决策、假设回检、数据埋点和验收标准',
      '设计优先级与分阶段计划：输出优先级排序总览、分期交付计划和待确认决策',
      '页面交互文档规划：说明下一产物为 [产品名]-页面交互框架与说明.md，覆盖页面总览、页面流转、主流程、状态机、逐页交互、全局交互规范、低保真和 Draw.io 触发条件'
    ],
    stages: [
      { id: 'ux-original-requirement-analysis', name: '原始需求分析' },
      { id: 'ux-design-problem-definition', name: '设计问题定义' },
      { id: 'ux-user-scenario', name: '用户与场景' },
      { id: 'ux-assumption-validation', name: '假设与验证' },
      { id: 'ux-design-opportunity', name: '设计机会' },
      { id: 'ux-interaction-chain', name: '整体交互链路' },
      { id: 'ux-three-design-solutions', name: '三套设计方案' },
      { id: 'ux-exception-flow', name: '异常流补充' },
      { id: 'ux-recommendation-decision', name: '推荐方案建议' },
      { id: 'ux-priority-phasing', name: '设计优先级与分阶段计划' }
    ],
    agentInteraction: {
      style: 'total-flow-compatible',
      nextActions: [
        { id: 'run-advanced-ux', label: '开始高级 UX 分析', targetStageId: 'ux-original-requirement-analysis', intent: '按 10 步链路分析' },
        { id: 'continue-total-flow', label: '进入交互低保', targetStageId: 'interaction-lofi', intent: '复用总流程下游阶段' }
      ],
      rules: ['每个判断标注置信度', '事实、推断、建议、风险必须分层', '信息不足时返回 needs-confirmation，不编造竞品或指标', '阶段二画布主体是页面节点', '没有真实图片或 .drawio/.xml 文件时，只能标注低保真/Draw.io 待生成']
    },
    followUpRules: ['P0 缺口先追问', '用户说继续时沿 10 节点链路推进', '进入下游阶段时复用总流程 6 大阶段'],
    outputTypes: ['高级 UX 10 节点分析 Markdown', '页面交互框架与说明 Markdown', 'Draw.io 主流程图', 'Draw.io 状态图', '低保真线框图图片', '总流程画布'],
    outputFormat: '高级 UX 需求分析：先按原始需求分析、设计问题定义、用户与场景、假设与验证、设计机会、整体交互链路、三套设计方案、异常流补充、推荐方案建议、设计优先级与分阶段计划生成 Markdown 并导入需求分析画布；再生成 [产品名]-页面交互框架与说明.md，包含页面总览、页面流转总览、页面框架、文本布局图、交互规则、异常状态、全局交互规范；Draw.io 主流程图/状态图作为文件产物展示，低保真线框图图片绑定页面节点。',
    qualityChecks: ['advanced-ux-chain', 'confidence-labels', 'fact-inference-risk-separation', 'needs-confirmation', 'page-interaction-doc-planning', 'visual-artifact-status', 'total-flow-compatible'],
    exampleInput: '帮我深度分析一个 AI 创作工具的 UX 需求，并继续进入总流程。',
    exampleOutput: '按原始需求分析、设计问题定义、用户与场景、假设与验证、设计机会、整体交互链路、三套设计方案、异常流补充、推荐方案建议、设计优先级与分阶段计划输出，并生成可进入交互低保的总流程画布。'
  })
}

export function createSystemSkills() {
  return [
    createAdvancedUxRequirementAnalysisSkill()
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
