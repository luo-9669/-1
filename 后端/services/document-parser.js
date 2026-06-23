import { buildBlueprintDemoHtml, buildProjectBlueprint } from '../../src/services/projectBlueprint.js'
import { getBuiltinWorkflows } from '../../src/services/workflows.js'
import { runSkillGeneration, runSkillGenerationSync } from './generation-runner.js'
import { orchestrateRequirementSkill, skillLabel } from './skill-orchestrator.js'
import { buildAnalysisQualityGate, buildAnalysisVersionSnapshot } from './analysis-quality.js'

function normalizeText(text = '') {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 12000)
}

function documentType(name = '', type = '') {
  const extension = String(name).split('.').pop()?.toLowerCase() || ''
  if (type.includes('markdown') || extension === 'md') return 'markdown'
  if (type.includes('text') || extension === 'txt') return 'text'
  if (extension === 'docx') return 'docx'
  if (extension === 'xlsx') return 'xlsx'
  if (extension === 'pdf') return 'pdf'
  return extension || 'file'
}

export function parseUploadedDocument(document = {}, index = 0) {
  const name = document.name || `document-${index + 1}`
  const kind = documentType(name, document.type || '')
  const text = normalizeText(document.text || document.content || '')

  if (!text) {
    return {
      id: document.id || `upload-${index + 1}`,
      name,
      type: kind,
      status: 'failed',
      text: '',
      reason: '文件内容为空或当前解析器无法读取正文',
      recoveryActions: ['重新上传', '换 DOCX/MD/TXT 格式', '手动粘贴文本']
    }
  }

  return {
    id: document.id || `upload-${index + 1}`,
    name,
    type: kind,
    status: 'parsed',
    text,
    summary: text.split(/\n+/).filter(Boolean).slice(0, 3).join('；').slice(0, 220),
    recoveryActions: []
  }
}

export function parseUploadedDocuments(payload = {}) {
  const documents = (payload.documents || []).map(parseUploadedDocument)
  const failed = documents.filter((item) => item.status === 'failed')
  return {
    projectId: payload.projectId || '',
    documents,
    summary: {
      total: documents.length,
      parsed: documents.length - failed.length,
      failed: failed.length,
      needsReview: failed.length
    }
  }
}

function flattenNavigationFromScreens(screens = []) {
  return screens.flatMap((screen) =>
    (screen.actions || []).map((action) => ({
      from: screen.title || screen.id,
      action: `点击「${action.label}」`,
      to: action.to,
      api: action.api || '',
      form: '页面跳转',
      guard: action.guard || '默认允许',
      fallback: action.fallback || '失败时停留当前页并提示原因'
    }))
  )
}

function architectureNodes(blueprint = {}) {
  const frameworkChildren = blueprint.framework?.children || []
  const pages = blueprint.demoScreens || []
  return [
    ...frameworkChildren.map((node) => ({
      id: node.id || node.title,
      title: node.title,
      type: 'module',
      description: node.description || '来自产品框架推断',
      priority: /首页|入口|编辑器|Home|Editor/i.test(node.title) ? 'P0' : 'P1'
    })),
    ...pages.map((page) => ({
      id: page.id,
      title: page.title,
      type: 'page',
      description: page.description || page.layout || '页面结构待细化',
      priority: page.id === 'home' || page.id === 'editor' ? 'P0' : 'P1'
    }))
  ]
}

function agentInteractionForNode(id, title, quickActions = []) {
  const presets = {
    analysis: {
      goal: '确认上传文档是否被正确理解，补齐来源、范围和解析失败原因。',
      suggestedQuestions: ['这份文档的核心需求是什么？', '哪些内容是确定的，哪些需要补充？', '解析失败或遗漏会影响哪些后续节点？'],
      quickReplies: ['补充资料', '重新分析', '查看来源'],
      inputPlaceholder: '只围绕文档解析提问，例如：这份文档真正要解决什么问题？',
      confirmationRule: '如来源不对，先重新上传、补充资料或重新分析。'
    },
    'product-analysis': {
      goal: '评审 What / Why / How、优先级和风险，判断产品方向是否成立。',
      suggestedQuestions: ['Why 这个机会成立吗？', 'P0/P1/P2 是否需要调整？', '最大风险和待确认问题是什么？'],
      quickReplies: ['调整优先级', '补充风险', '解释机会'],
      inputPlaceholder: '只围绕产品分析提问，例如：为什么这个主路径比功能列表更好？',
      confirmationRule: '确认产品判断后，再进入项目档案和结构树。'
    },
    profile: {
      goal: '确认项目基础信息，包括用户、人群、定位、目标和边界。',
      suggestedQuestions: ['目标用户还要怎么细分？', '产品定位是否准确？', '一期成功标准是什么？'],
      quickReplies: ['补充人群', '调整定位', '补成功标准'],
      inputPlaceholder: '只围绕项目档案提问，例如：目标用户和核心场景是否准确？',
      confirmationRule: '确认档案后，后续结构树和 Demo 都以此作为上下文。'
    },
    'structure-tree': {
      goal: '评审产品结构树和交互路径树，确认模块层级是否清楚。',
      suggestedQuestions: ['一级结构是否按用户任务组织？', '有没有页面归属不清？', '路径树是否能闭环？'],
      quickReplies: ['展开结构', '调整层级', '补路径'],
      inputPlaceholder: '只围绕结构树提问，例如：这个模块应该放在哪一级？',
      confirmationRule: '确认结构树后，再生成或刷新页面框架图。'
    },
    framework: {
      goal: '拆解模块、页面和能力边界，确认功能优先级。',
      suggestedQuestions: ['哪些模块必须是 P0？', '哪些能力应该后置？', '页面和模块怎么映射？'],
      quickReplies: ['拆模块', '调整优先级', '生成页面'],
      inputPlaceholder: '只围绕产品框架提问，例如：哪些功能应该从一期移到二期？',
      confirmationRule: '确认框架后，才能稳定进入路径树和页面框架图。'
    },
    outline: {
      goal: '对比原始大纲和新增需求，确认新增、修改、待确认项。',
      suggestedQuestions: ['新增需求哪些要进本期？', '修改项影响哪些页面？', '待确认问题谁来确认？'],
      quickReplies: ['解释变更', '补待确认', '重新对比'],
      inputPlaceholder: '只围绕大纲对比提问，例如：新增项里哪些必须进入首版？',
      confirmationRule: '确认变更后刷新框架和交互路径。'
    },
    flow: {
      goal: '检查用户点击路径、页面跳转、返回路径和断点恢复。',
      suggestedQuestions: ['点击哪里会跳到哪里？', '失败后停在哪里？', '返回应该回到哪个页面？'],
      quickReplies: ['补跳转', '检查断点', '补返回'],
      inputPlaceholder: '只围绕交互路径提问，例如：生成失败后用户下一步做什么？',
      confirmationRule: '确认路径后，再进入页面级交互说明。'
    },
    wireframes: {
      goal: '补齐每个页面的布局、控件、按钮、输入框和页面形态。',
      suggestedQuestions: ['这个页面长什么样？', '按钮和输入框放在哪里？', '这里应该是页面、弹窗、抽屉还是新页签？'],
      quickReplies: ['补控件', '补页面形态', '生成低保真'],
      inputPlaceholder: '只围绕页面框架图提问，例如：首页上传按钮应该放在哪？',
      confirmationRule: '确认框架图后，才能生成更可靠的 Demo。'
    },
    spec: {
      goal: '补齐页面状态、事件、异常、权限和返回恢复。',
      suggestedQuestions: ['每个状态是否都有下一步？', '异常提示在哪里展示？', '未保存返回怎么处理？'],
      quickReplies: ['补状态', '补异常', '补返回'],
      inputPlaceholder: '只围绕交互说明提问，例如：上传失败时应该保留哪些内容？',
      confirmationRule: '确认交互说明后，进入设计 MD 和 Demo 生成。'
    },
    'design-md': {
      goal: '确认可交付的设计 Markdown，面向产品、设计、研发和测试。',
      suggestedQuestions: ['这份 MD 是否能直接评审？', '还缺哪些章节？', '导出前要不要补前后端边界？'],
      quickReplies: ['补章节', '导出 MD', '补交付说明'],
      inputPlaceholder: '只围绕设计 MD 提问，例如：这份文档交给研发还缺什么？',
      confirmationRule: '导出前确认章节完整、路径清楚、状态异常可测试。'
    },
    demo: {
      goal: '验证低保真和可交互 Demo 是否能演示主路径。',
      suggestedQuestions: ['Demo 是否能点击完整路径？', '是否需要刷新另一种风格？', '异常状态能演示吗？'],
      quickReplies: ['生成低保真', '生成 HTML', '刷新 Demo'],
      inputPlaceholder: '只围绕 Demo 提问，例如：这个 Demo 还缺哪个交互？',
      confirmationRule: '确认 Demo 主路径后，才进入完整 HTML / Figma / Vue。'
    },
    html: {
      goal: '生成和评审完整 HTML，复用网页工厂的预览、源码和下载链路。',
      suggestedQuestions: ['HTML 是否能独立打开？', '源码结构是否清楚？', '哪些交互还要补？'],
      quickReplies: ['生成 HTML', '查看源码', '下载 HTML', '重新生成'],
      inputPlaceholder: '只围绕完整 HTML 提问，例如：这版 HTML 是否覆盖主路径？',
      confirmationRule: '确认 HTML 可打开、可点击、可演练状态后再进入 Figma/Vue。'
    },
    figma: {
      goal: '确认 Figma 设计稿生成条件、页面 Frame、状态变体和评审批注。',
      suggestedQuestions: ['哪些页面需要转 Figma？', '状态变体是否完整？', '组件如何沉淀？'],
      quickReplies: ['生成 Figma', '补状态变体', '同步组件', '设计评审'],
      inputPlaceholder: '只围绕 Figma 交付提问，例如：哪些节点应该成为组件？',
      confirmationRule: '确认设计稿结构后，再进入视觉细化或 Vue 生成。'
    },
    vue: {
      goal: '确认 Vue 导出范围、前端文件、后端接口契约和 Mock 数据。',
      suggestedQuestions: ['前端文件怎么拆？', '后端接口需要哪些字段？', 'Mock 数据和错误码怎么设计？'],
      quickReplies: ['导出 Vue', '拆前后端', '补接口契约', '下载源码'],
      inputPlaceholder: '只围绕 Vue 交付提问，例如：这个页面前后端文件怎么分？',
      confirmationRule: '导出前确认前端组件、后端接口、Mock 数据和异常状态。'
    },
    review: {
      goal: '做最终评审，确认蓝图、Demo、HTML、Figma/Vue 是否可交付。',
      suggestedQuestions: ['还有哪些评审风险？', '验收标准是否清楚？', '下一步应该先做什么？'],
      quickReplies: ['补验收', '导出 Markdown', '保存资产'],
      inputPlaceholder: '只围绕最终评审提问，例如：这套方案还有什么遗漏？',
      confirmationRule: '确认后保存资产，并作为下一轮迭代输入。'
    }
  }
  const fallback = {
    goal: `围绕「${title}」补充结论、依据、状态和下一步动作。`,
    suggestedQuestions: [`${title} 的核心结论是什么？`, `${title} 还缺哪些状态和异常？`, `${title} 确认后下一步做什么？`],
    quickReplies: ['补充细节', '重新生成'],
    inputPlaceholder: `只围绕「${title}」提问、补充资料或要求重新生成。`,
    confirmationRule: '确认后进入下一个画布环节。'
  }
  const preset = presets[id] || fallback
  return {
    ...preset,
    quickReplies: compactList([...(preset.quickReplies || []), ...quickActions], fallback.quickReplies)
      .filter((reply) => !/确认/.test(reply))
      .slice(0, 4)
  }
}

function canvasNode(id, title, summary, content, index, quickActions = [], detailSections = []) {
  return {
    id,
    title,
    summary,
    content,
    x: 80 + index * 360,
    y: index % 2 === 0 ? 140 : 360,
    width: id === 'analysis' ? 360 : 320,
    height: id === 'analysis' ? 240 : 220,
    agentScope: `当前只围绕「${title}」回答，不展开其它环节。`,
    quickActions: quickActions.filter((action) => !/确认/.test(action)).slice(0, 4),
    agentInteraction: agentInteractionForNode(id, title, quickActions),
    detailSections: normalizeDetailSections(detailSections, { title, summary, content, quickActions })
  }
}

function compactList(items = [], fallback = ['暂无数据，等待后端补充。']) {
  const list = (Array.isArray(items) ? items : [items])
    .flat()
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  return list.length ? list.slice(0, 6) : fallback
}

function detailSection(title, items = [], meta = '') {
  return {
    title,
    meta,
    items: compactList(items, ['暂无，需要 Agent 继续补充。'])
  }
}

function demoHtmlCanvasContent(html = '') {
  const normalized = String(html || '').trim()
  if (!normalized) {
    return [
      'index.html：等待后端生成完整 HTML Demo。',
      '生成后会包含可点击页面、状态演练和接口模拟脚本。'
    ]
  }
  const hasDoctype = /<!doctype html>/i.test(normalized)
  const hasDemoEngine = /data-demo-engine=/i.test(normalized)
  const scriptCount = (normalized.match(/<script\b/gi) || []).length
  const styleCount = (normalized.match(/<style\b/gi) || []).length
  return [
    `index.html：已生成 ${normalized.length} 字符的可交互 HTML 代码。`,
    hasDoctype ? '<!doctype html> 已包含完整 HTML 文档结构。' : '<html> 已包含 HTML 文档结构。',
    hasDemoEngine ? 'data-demo-engine="skill-v3"：包含 Demo 状态机和交互脚本。' : '包含基础 Demo 交互脚本。',
    `内联资源：${styleCount} 个 style，${scriptCount} 个 script，可直接预览或下载。`
  ]
}

function authPathGraph(isModal = false) {
  const entryLabel = isModal ? '打开登录弹窗' : '进入登录页'
  return {
    legend: [
      { type: 'start', label: '圆形：开始/结束' },
      { type: 'action', label: '矩形：页面或用户操作' },
      { type: 'decision', label: '菱形：判断分支' },
      { type: 'error', label: '三角形：异常/回退' }
    ],
    nodes: [
      { id: 'start', type: 'start', label: entryLabel },
      { id: 'input', type: 'action', label: '输入账号密码/验证码' },
      { id: 'submit', type: 'action', label: '点击确认并提交后端' },
      { id: 'check', type: 'decision', label: '账号密码是否正确' },
      { id: 'success', type: 'end', label: '进入下一步/回到来源页' },
      { id: 'error', type: 'error', label: '展示错误并退回输入' },
      { id: 'register', type: 'action', label: '切换注册/忘记密码' }
    ],
    edges: [
      { from: 'start', to: 'input', label: '开始' },
      { from: 'input', to: 'submit', label: '确认' },
      { from: 'submit', to: 'check', label: 'POST /api/auth/login' },
      { from: 'check', to: 'success', label: '正确/成功' },
      { from: 'check', to: 'error', label: '错误/失败' },
      { from: 'error', to: 'input', label: '返回上一步' },
      { from: 'input', to: 'register', label: '去注册/找回' },
      { from: 'register', to: 'input', label: '返回登录' }
    ]
  }
}

function normalizeDetailSections(sections = [], node = {}) {
  const normalized = (sections || [])
    .map((section) => detailSection(section.title, section.items, section.meta))
    .filter((section) => section.title)
  if (normalized.length >= 4) return normalized
  return [
    ...normalized,
    detailSection('当前结论', [node.summary, ...(node.content || []).slice(0, 2)]),
    detailSection('来源与依据', ['来自上传文档、项目资料、交互 Skill、机会验证和页面蓝图。']),
    detailSection('交互与状态', ['需明确页面形态、按钮、输入框、跳转、加载、失败、权限和返回。']),
    detailSection('下一步产物', node.quickActions || ['打开 Agent 继续追问', '保存蓝图'])
  ].slice(0, 6)
}

function screenDetailItems(screens = []) {
  return compactList((screens || []).map((screen) => {
    const components = (screen.wireframe?.components || []).slice(0, 4).map((item) => `${item.label}/${item.type}`).join('、')
    const actions = (screen.actions || []).map((action) => `${action.label} -> ${action.to}`).join('、') || '流程末端'
    return `${screen.title}：${screen.wireframe?.layout || screen.description}；控件 ${components || '待补充'}；跳转 ${actions}`
  }))
}

function pageSpecDetailItems(specPages = []) {
  return compactList((specPages || []).map((page) => {
    const stateNames = (page.states || []).slice(0, 6).map((state) => state.name).join('、')
    const exceptions = (page.exceptions || []).slice(0, 2).map((item) => item.trigger).join('、')
    return `${page.pageName}：状态 ${stateNames || '待补充'}；异常 ${exceptions || '待补充'}；返回 ${page.navigation?.back || '待定'}`
  }))
}

function nodeDeliveryDetails(kind = '', blueprint = {}) {
  const productName = blueprint.profile?.productName || blueprint.title || '当前项目'
  const commonEvidence = [
    `蓝图：${blueprint.title || productName}`,
    `页面数：${blueprint.demoScreens?.length || 0}`,
    `交互模式：${blueprint.interactionSkillV3?.demoSchema?.interactionModes?.join(' / ') || 'wizard / split / command'}`
  ]
  if (kind === 'html') {
    return [
      detailSection('当前结论', [`把可交互 Demo 升级为完整 HTML 交付件，沿用网页工厂的预览、源码、下载和版本刷新方式。`]),
      detailSection('网页工厂复用点', ['复用 HTML 预览 iframe、源码查看、下载 HTML、还原资产沉淀、重新生成版本。']),
      detailSection('页面与状态范围', screenDetailItems(blueprint.demoScreens)),
      detailSection('验收标准', ['HTML 能独立打开', '主路径可点击跳转', '覆盖空/错/权限/未保存返回', '失败时可以重新生成']),
      detailSection('输入依据', commonEvidence)
    ]
  }
  if (kind === 'figma') {
    return [
      detailSection('当前结论', ['在完整 HTML/低保真稳定后生成 Figma 文件，用于设计评审、视觉细化和组件沉淀。']),
      detailSection('Figma 结构', ['页面 Frame', '组件节点', '交互注释', '状态变体', '设计 Token 占位', '评审批注']),
      detailSection('转入条件', ['蓝图已保存', 'HTML Demo 主路径通过', '页面状态和异常恢复已补齐']),
      detailSection('导出后动作', ['设计师在 Figma 中继续细化', '可回流到 Vue 代码生成', '沉淀为项目设计资产']),
      detailSection('输入依据', commonEvidence)
    ]
  }
  return [
    detailSection('当前结论', ['确认 Demo/Figma 后导出 Vue 页面，并区分前端文件、后端接口、Mock 数据和部署说明。']),
    detailSection('前端文件', ['src/App.vue 或独立页面组件', 'src/components/* 组件', 'src/styles.css 样式', '路由/状态管理按项目规模拆分']),
    detailSection('后端/数据文件', ['后端接口契约', 'Mock JSON', '上传/分析/生成接口', '错误码和重试策略']),
    detailSection('网页工厂复用点', ['沿用源码面板、复制代码、下载源码包、视觉验收、HTML -> Vue 转换入口。']),
    detailSection('验收标准', ['Vue 页面可运行', '交互路径可点击', '状态/异常可演练', '前后端文件边界清楚'])
  ]
}

function skillV2CanvasContent(skill = {}) {
  const stages = (skill.agentStages || []).map((stage) => {
    const status = (stage.statusFlow || []).slice(0, 4).join(' → ')
    return `${stage.name || stage.id}：产出 ${stage.output || '待确认'}；状态 ${status}`
  })
  const pageGroups = (skill.pageGroups || []).slice(0, 2).map((group) => `${group.title}：${group.priority}，${group.reviewStatus}`)
  const quality = skill.qualityReport
    ? `质量检查：${skill.qualityReport.score} 分，${skill.qualityReport.issueCount || 0} 个待修复项`
    : ''
  return compactList([...stages, ...pageGroups, quality])
}

function skillV3CanvasContent(skill = {}) {
  const machines = (skill.stateMachines || []).slice(0, 3).map((machine) => {
    const errors = (machine.transitions || []).filter((item) => /error|failed|permission|unsaved/.test(`${item.to} ${item.event}`)).length
    return `${machine.pageId} 状态机：${machine.states?.length || 0} 个状态，${errors} 条异常/返回恢复`
  })
  const uiNodes = (skill.uiNodeTree || []).slice(0, 2).map((page) => {
    const controls = (page.nodes || []).slice(0, 3).map((node) => `${node.label}/${node.control}`).join('、')
    return `${page.title} UI 节点：${controls || '待补充'}`
  })
  const demo = skill.demoSchema
    ? `Demo Schema：${skill.demoSchema.styleVariants?.length || 0} 种风格，${skill.demoSchema.interactionModes?.length || 0} 种交互方式`
    : ''
  return compactList([...machines, ...uiNodes, demo])
}

function opportunityCanvasContent(validation = {}) {
  const safeValidation = validation || {}
  const opportunities = (safeValidation.topOpportunities || []).map((item) =>
    `${item.priority || 'P?'} ${item.title}：权重 ${item.weight || 0}，入口 ${item.surfaceDecision?.recommended || '待定'}`
  )
  const journeys = (safeValidation.journeyMaps || []).flatMap((journey) =>
    (journey.touchpoints || []).slice(0, 2).map((point) => `${journey.persona} / ${point.touchpoint}：${point.pain}`)
  )
  const repairs = (safeValidation.finalIterationPlan || []).map((item) => `迭代方案：${item.title} - ${item.scope}`)
  return compactList([...opportunities, ...journeys, ...repairs])
}

function endpointItems(contract = {}) {
  return compactList((contract.endpoints || []).map((endpoint) =>
    `${endpoint.method} ${endpoint.path}：${endpoint.description}；请求 ${endpoint.requestFields?.join('、') || '待补充'}；返回 ${endpoint.responseFields?.join('、') || '待补充'}`
  ))
}

function errorCodeItems(contract = {}) {
  return compactList((contract.errorCodes || []).map((item) =>
    `${item.code}：${item.message}；前端处理 ${item.frontendAction}`
  ))
}

function workflowMeta(payload = {}, routing = orchestrateRequirementSkill(payload)) {
  const manualSkillSelected = payload.skillSelectionMode === 'manual'
  return {
    demandScope: payload.demandScope === 'non-project' ? 'non-project' : 'project',
    requestedSkillId: routing.requestedSkillId,
    resolvedSkillId: routing.resolvedSkillId,
    skillSelectionMode: routing.skillSelectionMode || (routing.requestedSkillId === 'auto' ? 'auto' : 'manual'),
    manualSkillSelected,
    displaySkillName: routing.displaySkillName || routing.resolvedSkillName || skillLabel(routing.resolvedSkillId),
    detectedIntent: routing.detectedIntent,
    routingReason: routing.routingReason,
    requestedSkillName: routing.requestedSkillName,
    resolvedSkillName: routing.resolvedSkillName,
    skillId: routing.resolvedSkillId,
    skillName: routing.resolvedSkillName
  }
}

function toAuthModalBlueprint(blueprint = {}, input = '') {
  if (blueprint.intent !== 'auth-page') return blueprint
  const modalTitle = /登录注册/.test(`${input} ${blueprint.title || ''}`) ? '登录注册弹窗' : '认证弹窗'
  const nextBlueprint = {
    ...blueprint,
    intent: 'auth-modal',
    title: `${modalTitle}交互蓝图`,
    type: 'modal-blueprint',
    profile: {
      ...(blueprint.profile || {}),
      productName: modalTitle,
      positioning: '嵌入业务页面的登录注册弹窗',
      primaryGoal: '让用户在不离开当前页面的情况下完成登录、注册或找回密码，并由后端返回结构化认证结果驱动弹窗状态。'
    },
    outlineDiff: {
      ...(blueprint.outlineDiff || {}),
      changed: [
        ...((blueprint.outlineDiff?.changed || [])),
        '从独立页面收敛为弹窗 Modal 交互，提交后刷新当前画布和下游节点。'
      ],
      added: [
        ...((blueprint.outlineDiff?.added || [])),
        '弹窗打开/关闭',
        '遮罩点击和 Esc 关闭规则',
        '弹窗内登录注册切换',
        '确认补充后画布刷新'
      ]
    },
    handoff: {
      ...(blueprint.handoff || {}),
      recommendation: '推荐由后端接管认证与模型分析链路，前端只接管弹窗展示、表单状态和画布刷新 loading；这是更符合大厂分层协作的方案。',
      frontend: [
        '实现登录注册弹窗打开/关闭、遮罩/ESC 规则、登录注册切换、字段校验、loading 和错误展示。',
        '点击提交时把 account/password/verificationCode/agreeTerms/redirectUri 传给后端接口。',
        '点击“补充到画布”时进入刷新态，等待后端返回完整 analysis/canvas 后整体替换画布。'
      ],
      backend: [
        '认证接口负责账号、密码、验证码、限流、token、错误码和审计。',
        '分析接口负责把用户补充、原画布和 Skill 框架交给大模型重算，返回完整新画布。',
        '后端保存模型调用日志、校验 schema，失败时使用确定性 fallback。'
      ],
      dataFlow: [
        '前端弹窗收集表单',
        '前端 POST /api/auth/login 或 /api/auth/register',
        '后端认证并返回 token/user/errorCode/nextAction',
        '前端更新弹窗状态或关闭弹窗',
        '用户确认 Agent 补充',
        '前端 POST /api/workspace/analysis/repair type=agent-supplement',
        '后端合并原画布与补充内容并调用模型重算',
        '后端返回完整 analysis/canvas',
        '前端替换画布'
      ]
    }
  }
  nextBlueprint.framework = {
    ...(blueprint.framework || {}),
    title: modalTitle
  }
  nextBlueprint.demoScreens = (blueprint.demoScreens || []).map((screen) => ({
    ...screen,
    title: screen.id === 'login'
      ? '登录弹窗'
      : screen.id === 'register'
        ? '注册弹窗'
        : screen.title,
    description: String(screen.description || '').replace(/页/g, '弹窗'),
    wireframe: {
      ...(screen.wireframe || {}),
      layout: `Modal 居中弹窗：${screen.wireframe?.layout || '表单内容在弹窗内完成'}`
    }
  }))
  return nextBlueprint
}

function authCanvasPlan(blueprint = {}, analysis = {}) {
  const isModal = blueprint.intent === 'auth-modal'
  const specPages = blueprint.interactionSpec?.pageSpecs || []
  const contract = blueprint.backendContract || {}
  const handoff = blueprint.handoff || {}
  const documentItems = compactList((analysis.documents || []).map((doc) => `${doc.name}：${doc.summary || doc.text || doc.reason || doc.status}`), ['当前由输入需求直接生成，无上传文档。'])
  const profileItems = [
    `页面名称：${blueprint.profile?.productName || blueprint.title}`,
    `目标人群：${blueprint.profile?.targetUsers || ''}`,
    `核心目标：${blueprint.profile?.primaryGoal || ''}`,
    `核心场景：${(blueprint.profile?.coreScenarios || []).join(' / ')}`
  ]
  const validationItems = [
    '账号：支持手机号或邮箱，前端先做格式校验，后端做唯一性/存在性校验。',
    '密码：前端展示强度规则，后端最终校验并返回 WEAK_PASSWORD。',
    '验证码：发送、倒计时、过期、错误和限流都以后端结果为准。',
    '协议勾选：注册前必选，提交时传 agreeTerms。'
  ]
  const demoHtml = buildBlueprintDemoHtml(blueprint, {
    styleVariant: 'product',
    interactionMode: isModal ? 'command' : 'wizard',
    revision: 1
  })
  const nodes = [
    canvasNode('analysis', '文档分析结果', '识别到页面级认证需求，输出登录注册交付物。', [
      `解析文档：${analysis.summary?.parsed || 0}/${analysis.summary?.total || 0}`,
      `意图：${blueprint.intent || 'auth-page'}`,
      `页面：${blueprint.profile?.productName || blueprint.title}`,
      `摘要：${blueprint.profile?.sourceSummary || '暂无摘要'}`
    ], 0, ['重新分析', '补充资料'], [
      detailSection('当前结论', [isModal ? '这是登录注册弹窗需求，应按 Modal 交互、表单状态和后端认证接口生成。' : '这是登录注册页面需求，应按页面级认证流程生成，而不是按完整产品机会蓝图生成。']),
      detailSection('来源证据', documentItems),
      detailSection('识别结果', profileItems),
      detailSection('下一步动作', ['确认页面范围', '补充第三方登录/验证码渠道', '进入接口契约'])
    ]),
    canvasNode('page-report', isModal ? '弹窗需求报告' : '页面需求报告', '聚焦登录、注册、忘记密码和真实后端联调。', compactList(blueprint.productAnalysis?.sections?.flatMap((section) => section.items) || profileItems), 1, ['补目标用户', '补验收标准'], [
      ...((blueprint.productAnalysis?.sections || []).map((section) => detailSection(section.title, section.items))),
      detailSection(isModal ? '弹窗边界' : '页面边界', [isModal ? '只覆盖当前业务页面上的认证 Modal，不跳转独立登录页，不扩展到用户中心。' : '只覆盖认证入口，不扩展到完整业务系统首页、权限后台或用户中心。'])
    ]),
    canvasNode('page-profile', isModal ? '弹窗档案' : '页面档案', blueprint.profile?.positioning || '认证页面基础信息', profileItems, 2, ['调整定位', '补成功标准'], [
      detailSection('当前结论', profileItems),
      detailSection('待确认问题', blueprint.outlineDiff?.pending || []),
      detailSection('推荐方案', [handoff.recommendation || '前端负责体验，后端负责认证逻辑和数据返回。']),
      detailSection('成功标准', ['登录成功可进入系统', '注册成功可登录或完善资料', '错误码可被前端准确展示'])
    ]),
    canvasNode('page-structure', isModal ? '弹窗结构树' : '页面结构树', isModal ? '登录弹窗、注册弹窗、忘记密码弹窗和认证接口的结构。' : '登录页、注册页、忘记密码和认证接口的结构。', compactList(blueprint.structureTree?.lines || []), 3, ['展开结构', '补页面', '确认结构'], [
      detailSection('页面结构树', blueprint.structureTree?.lines || []),
      detailSection('页面清单', screenDetailItems(blueprint.demoScreens)),
      detailSection('模块边界', ['认证入口页面', '表单校验', '账号安全', '认证接口']),
      detailSection('下一步动作', ['确认页面数量', '确认是否需要第三方登录', '进入表单校验'])
    ]),
    canvasNode('form-validation', '表单与校验', '账号、密码、验证码、协议和按钮可用条件。', validationItems, 4, ['补字段规则', '补错误态', '补限流'], [
      detailSection('字段规则', validationItems),
      detailSection('页面状态', pageSpecDetailItems(specPages)),
      detailSection('错误码映射', errorCodeItems(contract)),
      detailSection('验收方式', ['空值不能提交', '格式错误靠近字段提示', '后端错误码能映射到字段或全局提示'])
    ]),
    canvasNode('flow', '交互路径树', '按钮点击后前端提交后端，后端返回结果再驱动前端状态。', compactList((blueprint.demoScreens || []).flatMap((screen) => (screen.actions || []).map((action) => `${screen.title} 点击 ${action.label} -> ${action.api || action.to}`))), 5, ['补跳转', '补返回', '补异常'], [
      detailSection('路径树', blueprint.structureTree?.interactionLines || []),
      detailSection('页面跳转', (blueprint.demoScreens || []).flatMap((screen) => (screen.actions || []).map((action) => `${screen.title} 点击 ${action.label} -> ${action.api || action.to}`))),
      detailSection('数据流', handoff.dataFlow || []),
      detailSection('断点恢复', ['接口失败保留输入', '验证码限流展示倒计时', 'token 过期回到登录页'])
    ]),
    canvasNode('wireframes', isModal ? '弹窗框架图' : '页面框架图', isModal ? '登录/注册/重置密码在 Modal 内的低保真布局和控件。' : '登录/注册/重置密码每页的低保真布局和控件。', compactList((blueprint.frameworkDiagrams?.pages || []).map((page) => `${page.title}：${(page.layoutLines || []).join(' ')}`)), 6, ['查看页面', '补控件', '生成低保真'], [
      ...((blueprint.frameworkDiagrams?.pages || []).slice(0, 4).map((page) => detailSection(page.title, [
        ...(page.layoutLines || []),
        ...(page.navigation || [])
      ], page.priority))),
      detailSection('评审重点', ['控件位置清楚', '按钮状态清楚', '错误提示不遮挡表单', '移动端不溢出'])
    ]),
    canvasNode('api-contract', '接口契约', '后端认证接口、请求字段、返回字段和错误码。', endpointItems(contract), 7, ['补接口字段', '补错误码', '生成 Mock'], [
      detailSection('接口列表', endpointItems(contract)),
      detailSection('错误码', errorCodeItems(contract)),
      detailSection('Mock 数据', ['login success：token/user/redirectUri', 'register success：registered/autoLogin/nextAction', 'send-code success：sent/cooldownSeconds', 'failure：errorCode/message/traceId']),
      detailSection('后端验收', ['密码不可明文存储', '验证码必须过期', '登录/发送验证码必须限流', '所有失败有标准错误码'])
    ]),
    canvasNode('handoff', '前后端交接', '明确谁接管开发、谁给谁数据。', compactList([
      `前端接管：${(handoff.frontend || []).join('；')}`,
      `后端接管：${(handoff.backend || []).join('；')}`,
      `数据流：${(handoff.dataFlow || []).join(' -> ')}`
    ]), 8, ['拆分任务', '补 Mock', '确认分工'], [
      detailSection('前端接管', handoff.frontend || []),
      detailSection('后端接管', handoff.backend || []),
      detailSection('谁给谁数据', handoff.dataFlow || []),
      detailSection('推荐原因', [handoff.recommendation || '领域逻辑后移到后端，前端保持展示和交互职责，更适合团队协作和后续扩展。'])
    ]),
    canvasNode('demo', '可交互 Demo', '后端已生成 index.html，可直接预览、复制或下载，认证结果按接口契约模拟。', demoHtmlCanvasContent(demoHtml), 9, ['生成 HTML', '生成 Mock', '刷新 Demo'], [
      detailSection('HTML 代码', [demoHtml], 'index.html'),
      detailSection('页面与跳转', screenDetailItems(blueprint.demoScreens)),
      detailSection('接口模拟', endpointItems(contract)),
      detailSection('异常演练', errorCodeItems(contract)),
      detailSection('下一步动作', ['预览 index.html', '不满意可刷新 Demo', '确认后进入前后端实现'])
    ]),
    canvasNode('review', '验收清单', '进入开发前必须确认的项目级验收点。', compactList(blueprint.reviewChecklist || []), 10, ['补验收', '导出 Markdown', '保存资产'], [
      detailSection('验收清单', blueprint.reviewChecklist || []),
      detailSection('联调验收', ['登录成功', '注册成功', '忘记密码成功', '错误码映射', '验证码限流', 'token 过期回登录']),
      detailSection('风险项', blueprint.outlineDiff?.pending || []),
      detailSection('下一步动作', ['前端按页面和状态实现', '后端按接口契约实现', '测试按错误码和主路径验收'])
    ])
  ]
  const flowNode = nodes.find((node) => node.id === 'flow')
  if (flowNode) {
    flowNode.pathGraph = authPathGraph(isModal)
  }
  return {
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({
      id: `${node.id}-${nodes[index + 1].id}`,
      from: node.id,
      to: nodes[index + 1].id,
      label: '下一环节'
    })),
    orderedTabs: nodes.map((node) => ({ key: node.id, label: node.title }))
  }
}

function projectInteractionCanvasPlan(blueprint = {}, analysis = {}) {
  const productName = blueprint.profile?.productName || blueprint.title || '当前项目'
  const skillName = analysis.skillName || '交互方案生成'
  const projectName = analysis.project?.name || productName
  const nodes = [
    canvasNode('analysis', '文档分析结果', `已按「${skillName}」分析 ${projectName}。`, [
      `需求类型：项目需求`,
      `绑定项目：${projectName}`,
      `Skill：${skillName}`,
      `解析文档：${analysis.summary?.parsed || 0}/${analysis.summary?.total || 0}`
    ], 0, ['确认范围', '补充资料', '重新分析'], [
      detailSection('当前结论', [`本次结果绑定到项目「${projectName}」，用于 UX、产品、研发继续协作。`]),
      detailSection('来源证据', (analysis.documents || []).map((doc) => `${doc.name}：${doc.summary || doc.text || doc.reason || doc.status}`)),
      detailSection('项目上下文', [`项目：${projectName}`, `目标用户：${blueprint.profile?.targetUsers || '待确认'}`, `Skill：${skillName}`]),
      detailSection('下一步动作', ['确认 UX 范围', '补核心对象', '进入信息架构'])
    ]),
    canvasNode('ux-diagnosis', 'UX 需求诊断', '明确用户目标、核心问题、业务背景和成功标准。', [
      `${productName} 的核心目标：${blueprint.profile?.primaryGoal || '待确认'}`,
      `目标用户：${blueprint.profile?.targetUsers || '待确认'}`,
      `核心场景：${(blueprint.profile?.coreScenarios || []).join(' / ') || '待补充'}`
    ], 1, ['补目标用户', '补成功标准', '确认诊断'], [
      detailSection('用户目标', blueprint.profile?.coreScenarios || []),
      detailSection('核心问题', blueprint.outlineDiff?.pending || []),
      detailSection('成功标准', ['路径能闭环', '状态可恢复', '研发可按交付拆任务']),
      detailSection('下一步动作', ['进入信息架构', '补业务约束'])
    ]),
    canvasNode('information-architecture', '信息架构', '拆分核心对象、页面层级、模块分组和权限入口。', [
      `${projectName} 信息架构：按核心对象、页面层级和权限入口组织。`,
      `核心对象：${(blueprint.framework?.children || []).map((node) => node.title).join(' / ') || '待补充'}`,
      '输出给 UX：导航结构、页面分组、对象关系和优先级。'
    ], 2, ['展开架构', '补核心对象', '确认 IA'], [
      detailSection('核心对象', (blueprint.framework?.children || []).map((node) => `${node.title}：${(node.children || []).map((child) => child.title).join(' / ')}`)),
      detailSection('页面层级', screenDetailItems(blueprint.demoScreens)),
      detailSection('UX 关注点', ['信息分组是否符合用户任务', '入口是否可发现', '权限边界是否清楚']),
      detailSection('下一步动作', ['进入任务流', '补页面清单'])
    ]),
    canvasNode('task-flow', '核心任务流', '梳理主路径、分支路径、回退路径和关键决策点。', compactList((blueprint.demoScreens || []).flatMap((screen) => (screen.actions || []).map((action) => `${screen.title} 点击 ${action.label} -> ${action.to}`))), 3, ['补主路径', '补异常流', '确认任务流'], [
      detailSection('主路径', (blueprint.interactionTree?.children || []).map((node) => `${node.title}：${(node.children || []).map((child) => child.title).join(' → ')}`)),
      detailSection('页面跳转', (blueprint.demoScreens || []).flatMap((screen) => (screen.actions || []).map((action) => `${screen.title} 点击 ${action.label} -> ${action.to}`))),
      detailSection('回退恢复', ['返回来源页', '失败保留输入', '权限不足可申请或切换账号']),
      detailSection('下一步动作', ['进入页面结构', '补关键状态'])
    ]),
    canvasNode('page-structure', '页面结构', '定义关键页面、模块、主次动作、输入输出和跳转关系。', screenDetailItems(blueprint.demoScreens), 4, ['补页面', '补控件', '确认结构'], [
      detailSection('页面清单', screenDetailItems(blueprint.demoScreens)),
      detailSection('页面框架', (blueprint.frameworkDiagrams?.pages || []).map((page) => `${page.title}：${(page.layoutLines || []).join(' ')}`)),
      detailSection('交付给 UX', ['页面目标', '模块顺序', '主次按钮', '反馈区域']),
      detailSection('下一步动作', ['补状态异常', '进入交付拆解'])
    ]),
    canvasNode('states', '状态与异常', '补充加载、空、错、权限、未保存和恢复策略。', pageSpecDetailItems(blueprint.interactionSpec?.pageSpecs || []), 5, ['补状态', '补异常', '补返回'], [
      detailSection('页面状态', pageSpecDetailItems(blueprint.interactionSpec?.pageSpecs || [])),
      detailSection('异常恢复', ['网络失败保留输入', '权限不足说明原因', '空状态给出下一步', '未保存离开前确认']),
      detailSection('测试关注点', ['每个主按钮有 loading', '每个错误有恢复动作', '返回路径可预测']),
      detailSection('下一步动作', ['进入前后端交接', '补验收'])
    ]),
    canvasNode('handoff', '前后端交接', '明确 UX、前端、后端、测试各自接管内容。', [
      'UX 接管：信息架构、任务流、页面结构、状态说明。',
      '前端接管：页面组件、表单状态、路由跳转、错误展示。',
      '后端接管：接口、数据模型、权限、错误码和审计。',
      '测试接管：主路径、异常流、权限和验收标准。'
    ], 6, ['拆分任务', '补接口', '确认交接'], [
      detailSection('UX 接管', ['信息架构', '任务流', '页面结构', '状态与异常说明']),
      detailSection('前端接管', ['页面组件', '交互状态', '路由跳转', '错误展示']),
      detailSection('后端接管', ['接口契约', '数据模型', '权限规则', '错误码']),
      detailSection('测试接管', ['主路径用例', '异常恢复', '权限校验', '验收清单'])
    ]),
    canvasNode('review', 'UX 验收清单', '用一致性、效率、可理解性、可恢复性和可测试性检查方案。', compactList(blueprint.reviewChecklist || []), 7, ['补验收', '导出文档', '保存资产'], [
      detailSection('验收清单', blueprint.reviewChecklist || []),
      detailSection('项目沉淀', ['保存到当前项目资产', '可继续生成低保真/HTML/Figma/Vue', '可打开 Agent 逐节点追问']),
      detailSection('风险项', blueprint.outlineDiff?.pending || []),
      detailSection('下一步动作', ['UX 评审', '研发估时', '进入交付资产'])
    ])
  ]
  return {
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({
      id: `${node.id}-${nodes[index + 1].id}`,
      from: node.id,
      to: nodes[index + 1].id,
      label: '下一环节'
    })),
    orderedTabs: nodes.map((node) => ({ key: node.id, label: node.title }))
  }
}

function nonProjectCanvasPlan(blueprint = {}, analysis = {}) {
  const sourceItems = compactList((analysis.documents || []).map((doc) => `${doc.name}：${doc.summary || doc.text || doc.reason || doc.status}`), ['来自当前输入文本，暂无上传文档。'])
  const summaryItems = [
    `调研/材料总结：${blueprint.profile?.sourceSummary || analysis.input || '暂无摘要'}`,
    `分析方法：${analysis.skillName || '默认分析流程'}`,
    '结论用途：辅助理解、判断和决策，不默认进入项目交付。'
  ]
  const nodes = [
    canvasNode('analysis', '文档分析结果', '识别为非项目需求，按报告型结构输出。', [
      `需求类型：非项目需求`,
      `Skill：${analysis.skillName || '默认分析流程'}`,
      `解析文档：${analysis.summary?.parsed || 0}/${analysis.summary?.total || 0}`
    ], 0, ['重新分析', '补充资料', '转为项目需求'], [
      detailSection('当前结论', ['本次不默认绑定项目资产，优先输出摘要、洞察、风险和建议。']),
      detailSection('来源证据', sourceItems),
      detailSection('使用方式', ['给用户理解材料', '辅助判断是否立项', '可一键转为项目需求']),
      detailSection('下一步动作', ['查看核心结论', '判断是否转项目'])
    ]),
    canvasNode('summary', '文档摘要', '提炼材料背景、核心内容和主要结论。', summaryItems, 1, ['补摘要', '压缩结论', '展开背景'], [
      detailSection('摘要', summaryItems),
      detailSection('材料范围', sourceItems),
      detailSection('适用对象', ['产品决策', 'UX 预研', '业务沟通', '立项前判断']),
      detailSection('下一步动作', ['查看关键发现', '补充材料'])
    ]),
    canvasNode('key-findings', '核心观点', '提取对决策有影响的信息、机会和约束。', [
      '发现：用户反馈集中在流程复杂、失败恢复和提示不清晰。',
      '机会：如果转项目，应优先验证主路径和高频失败点。',
      '约束：当前材料不足以直接拆开发任务，需要补业务目标和成功标准。'
    ], 2, ['补观点', '找证据', '归纳结论'], [
      detailSection('核心观点', ['流程复杂', '失败率高', '需要判断是否值得立项']),
      detailSection('证据来源', sourceItems),
      detailSection('决策价值', ['帮助判断是否进入项目流程', '帮助明确下一轮调研重点']),
      detailSection('下一步动作', ['查看风险', '生成建议'])
    ]),
    canvasNode('risks', '风险问题', '列出信息不足、判断偏差和后续验证风险。', [
      '缺少量化指标：失败率、影响用户数、业务损失未明确。',
      '缺少用户分层：不知道高频用户和低频用户痛点是否一致。',
      '缺少当前流程样例：无法直接判断页面和接口改造范围。'
    ], 3, ['补风险', '补追问', '确认问题'], [
      detailSection('风险清单', ['指标不足', '用户分层不足', '流程样例不足']),
      detailSection('需要追问', ['失败率是多少', '影响哪些用户', '是否已有业务目标']),
      detailSection('不建议直接做的事', ['不直接生成研发任务', '不直接生成接口契约', '不默认保存为项目资产']),
      detailSection('下一步动作', ['看建议', '补材料'])
    ]),
    canvasNode('recommendations', '建议方案', '给出继续调研、暂缓或转项目的建议。', [
      '建议先补充失败率、用户样本和当前流程截图。',
      '若问题影响核心转化或登录成功率，建议转为项目需求。',
      '若只是零散反馈，先沉淀到知识库并继续观察。'
    ], 4, ['补建议', '生成决策', '转项目'], [
      detailSection('建议', ['补量化指标', '补用户样本', '补当前流程截图']),
      detailSection('转项目条件', ['影响核心转化', '影响登录成功率', '有明确负责人和验收指标']),
      detailSection('暂不立项条件', ['样本少', '影响范围不清', '无明确成功标准']),
      detailSection('下一步动作', ['保存到知识库', '转为项目需求'])
    ]),
    canvasNode('sources', '引用来源', '保留文档、输入和知识库引用，方便追溯。', sourceItems, 5, ['查看来源', '补引用', '导出报告'], [
      detailSection('来源列表', sourceItems),
      detailSection('引用原则', ['区分事实和推断', '保留原文片段', '缺失信息显式标注']),
      detailSection('可保存位置', ['非项目知识库', '当前项目参考资料（可选）']),
      detailSection('下一步动作', ['导出摘要', '转项目'])
    ]),
    canvasNode('project-conversion', '是否建议转项目', '判断这份非项目分析是否值得立项。', [
      '建议转为项目需求：当问题有明确业务目标、影响范围、成功指标和负责人。',
      '转为项目后会重新生成项目蓝图、UX/PRD/研发交接和验收清单。',
      '当前建议：先补充量化指标，再决定是否立项。'
    ], 6, ['转为项目需求', '继续观察', '补充指标'], [
      detailSection('转项目门槛', ['业务目标明确', '影响范围清楚', '成功指标可衡量', '有负责人']),
      detailSection('转项目后产物', ['项目档案', '页面/模块结构', '交互路径', '前后端交接', '验收清单']),
      detailSection('当前建议', ['先补充量化指标和当前流程样例']),
      detailSection('下一步动作', ['选择项目并转入项目需求', '保存为非项目分析报告'])
    ])
  ]
  return {
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({
      id: `${node.id}-${nodes[index + 1].id}`,
      from: node.id,
      to: nodes[index + 1].id,
      label: '下一环节'
    })),
    orderedTabs: nodes.map((node) => ({ key: node.id, label: node.title }))
  }
}

function linearCanvas(nodes = []) {
  return {
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({
      id: `${node.id}-${nodes[index + 1].id}`,
      from: node.id,
      to: nodes[index + 1].id,
      label: '下一环节'
    })),
    orderedTabs: nodes.map((node) => ({ key: node.id, label: node.title }))
  }
}

function stripStepTitle(title = '') {
  return String(title || '')
    .replace(/^Step\s*\d+\s*[：:]\s*/i, '')
    .trim() || '未命名环节'
}

function workflowForSkill(skillId = '') {
  return getBuiltinWorkflows().find((workflow) => workflow.id === skillId) || null
}

function workflowStepsCanvasPlan(workflow = {}, blueprint = {}, analysis = {}) {
  const sourceItems = compactList((analysis.documents || []).map((doc) => `${doc.name}：${doc.summary || doc.text || doc.reason || doc.status}`), [analysis.input || '暂无输入'])
  const steps = Array.isArray(workflow.steps) ? workflow.steps : []
  if (!steps.length) return null
  return linearCanvas(steps.map((step, index) => {
    const title = stripStepTitle(step.title || step.outputTitle || step.id)
    const requiredFields = compactList(step.requiredFields || [], ['暂无必填字段'])
    return canvasNode(step.id || `step-${index + 1}`, title, step.goal || workflow.description || '按当前 Skill 步骤生成分析节点。', [
      `目标：${step.goal || workflow.description || '暂无目标说明'}`,
      `需要输入：${requiredFields.join('、')}`,
      `输出：${step.outputTitle || title}`,
      `来源：${analysis.input || blueprint.profile?.sourceSummary || '暂无输入'}`
    ], index, ['补充资料', '重新分析', '展开环节'], [
      detailSection('环节目标', [step.goal || workflow.description || '暂无目标说明']),
      detailSection('需要输入', requiredFields),
      detailSection('输出格式', [step.outputTitle || title]),
      detailSection('来源证据', sourceItems)
    ])
  }))
}

function eightModuleFuzzyArchitectureCanvasPlan(blueprint = {}, analysis = {}) {
  const sourceItems = compactList((analysis.documents || []).map((doc) => `${doc.name}：${doc.summary || doc.text || doc.reason || doc.status}`), [analysis.input || '暂无输入'])
  const baseSummary = blueprint.profile?.sourceSummary || analysis.input || '暂无摘要'
  const nodes = [
    canvasNode('requirement-understanding', '需求理解', '复盘原始需求、表层诉求和关键缺失要素。', [
      `用户原始需求：${analysis.input || '暂无输入'}`,
      '表层诉求：把模糊想法整理成可推进的产品需求初稿。',
      '缺失要素盘点：角色 / 终端 / 场景 / 付费 / 边界 / 合规'
    ], 0, ['补原话', '补缺口', '找边界'], [
      detailSection('用户原始需求', [analysis.input || '暂无输入']),
      detailSection('表层诉求', ['形成可讨论、可拆范围、可继续推进的产品方案。']),
      detailSection('缺失要素盘点', ['角色', '终端', '场景', '付费', '边界', '合规']),
      detailSection('来源证据', sourceItems)
    ]),
    canvasNode('reversible-assumptions', '合理假设', '所有假设都可推翻修改，用于先形成可落地初稿。', [
      '基础落地假设：先限定一个核心角色、一条主路径和一个主终端。',
      '体验增值假设：用模板、反馈和沉淀降低首次使用成本。',
      '边界禁区假设：复杂权限、支付结算、强合规和深度集成本期不默认承接。'
    ], 1, ['改假设', '补禁区', '补边界'], [
      detailSection('基础落地假设', ['先用一个核心角色、一个主终端、一条主路径完成 MVP 闭环。']),
      detailSection('体验增值假设', ['通过清晰入口、默认模板、过程反馈和结果沉淀降低首次使用成本。']),
      detailSection('边界禁区假设', ['复杂多角色权限', '重运营后台', '支付结算', '外部系统深度集成', '强合规审核']),
      detailSection('可修改说明', ['以上均为临时假设，可被甲方或项目事实推翻。'])
    ]),
    canvasNode('target-users', '目标用户', '明确先服务谁、不服务谁。', [
      '核心用户：最直接受当前痛点影响、会高频完成主任务的人。',
      '次要用户：协助、审核、运营或查看结果的人。',
      '排斥用户：需要重定制、流程差异极大或不符合本期场景的人。'
    ], 2, ['补人群', '拆角色', '排除用户'], [
      detailSection('核心用户', ['直接产生需求并完成主任务的用户。']),
      detailSection('次要用户', ['管理者', '协作者', '运营者', '查看者']),
      detailSection('排斥用户', ['重定制用户', '强合规用户', '非本期终端用户']),
      detailSection('判断依据', [baseSummary])
    ]),
    canvasNode('core-jtbd', '核心JTBD', '把需求转成用户要完成的任务和希望获得的感受。', [
      '功能型JTBD：快速完成核心任务，获得可保存、可复用、可交付的结果。',
      '情绪型JTBD：减少不确定、返工和沟通成本。'
    ], 3, ['补任务', '补情绪', '验证价值'], [
      detailSection('功能型JTBD', ['当用户遇到当前场景时，希望快速完成核心任务并获得可复用结果。']),
      detailSection('情绪型JTBD', ['感觉方案清楚', '边界可控', '下一步可执行']),
      detailSection('价值判断', ['P0 必须服务这个 JTBD，非核心功能后置。']),
      detailSection('待验证', ['用户是否愿意高频使用', '一次成功结果的定义是什么'])
    ]),
    canvasNode('main-path', '主路径草案', '拆新用户首次路径和老用户复用路径。', [
      '新用户首次路径：进入产品 -> 输入目标 -> 补齐信息 -> 生成/提交 -> 查看反馈 -> 保存或分享。',
      '老用户复用路径：进入历史/模板 -> 复用配置 -> 快速调整 -> 再次生成 -> 对比沉淀。'
    ], 4, ['补路径', '补复用', '补异常'], [
      detailSection('新用户首次路径', ['进入产品', '选择或输入目标', '补齐必要信息', '生成或提交核心结果', '查看反馈', '保存或分享']),
      detailSection('老用户复用路径', ['进入历史记录/模板', '复用上次配置', '快速调整', '再次生成/提交', '对比和沉淀结果']),
      detailSection('异常路径', ['信息不足', '生成失败', '无权限', '结果不满意']),
      detailSection('路径验收', ['用户能在 1 条主路径里完成闭环。'])
    ]),
    canvasNode('feature-scope', 'P0/P1功能范围', '把功能拆成上线必做、二期优化、远期规划和本期禁区。', [
      'P0必做上线：主入口、核心输入、结果页、基础状态反馈、历史记录。',
      'P1二期迭代：模板库、筛选搜索、协作评论、数据统计。',
      'P2远期规划：多角色权限、自动化策略、商业化增长。',
      '本期禁区：复杂财务结算、强审核后台、跨平台全量同步。'
    ], 5, ['调P0', '补P1', '划禁区'], [
      detailSection('P0必做上线', ['主入口', '核心表单/输入', '主流程提交或生成', '结果页', '基础状态反馈', '历史记录']),
      detailSection('P1二期迭代', ['模板库', '筛选搜索', '协作评论', '数据统计', '批量操作']),
      detailSection('P2远期规划', ['多角色权限', '自动化策略', '商业化增长', '第三方深度集成']),
      detailSection('本期禁区', ['复杂财务结算', '强审核后台', '大规模内容运营', '未确认合规责任的功能'])
    ]),
    canvasNode('confirmation-questions', '待确认问题', '只问会改变方向、范围或交付的问题。', [
      '1. 核心用户到底是谁，是否存在管理者/审核者/运营者分工？',
      '2. 首期优先终端是什么？',
      '3. 一次主任务完成后，什么结果算成功？',
      '4. 是否涉及支付、个人信息、内容审核或行业资质？',
      '5. 哪些功能明确不在本期交付范围内？'
    ], 6, ['补问题', '删低价值问题', '转确认单'], [
      detailSection('必问', ['核心用户', '首期终端', '成功标准', '合规边界', '本期禁区']),
      detailSection('问题筛选原则', ['答案会改变方向、范围或交付才保留。']),
      detailSection('建议问法', ['请甲方只确认会影响一期落地的内容。']),
      detailSection('下一步动作', ['确认后进入页面结构和 P0 拆分。'])
    ]),
    canvasNode('page-structure', '初版页面结构', '从范围翻译成游客端、登录用户和二级模块。', [
      '游客端页面：首页/介绍页、示例结果页、登录注册入口、价格或服务说明页。',
      '登录用户页面：工作台、创建/输入页、结果详情页、历史记录页、个人/设置页。',
      '二级功能模块：模板选择、状态反馈、结果编辑、分享导出、消息通知。'
    ], 7, ['补页面', '拆模块', '生成结构'], [
      detailSection('游客端页面', ['首页/介绍页', '示例结果页', '登录注册入口', '价格或服务说明页']),
      detailSection('登录用户页面', ['工作台', '创建/输入页', '结果详情页', '历史记录页', '个人/设置页']),
      detailSection('二级功能模块', ['模板选择', '状态反馈', '结果编辑', '分享导出', '消息通知', '帮助说明']),
      detailSection('交付建议', ['用这组页面进入低保真或 PRD 拆解。'])
    ])
  ]
  return linearCanvas(nodes)
}

function fiveStageClientConsensusCanvasPlan(blueprint = {}, analysis = {}) {
  const sourceItems = compactList((analysis.documents || []).map((doc) => `${doc.name}：${doc.summary || doc.text || doc.reason || doc.status}`), [analysis.input || '暂无输入'])
  const nodes = [
    canvasNode('empathy-recap', '需求共情复盘', '先复刻甲方原话，再翻译底层意图和信息缺口。', [
      `原话复刻：${analysis.input || '暂无原话'}`,
      '底层意图：把 C 端想法变成双方能理解、能确认、能估算的交付方向。',
      '信息缺口：人群、场景、转化、内容来源、支付售后、合规边界、验收标准。'
    ], 0, ['补原话', '补意图', '补缺口'], [
      detailSection('原话复刻', [analysis.input || '暂无原话']),
      detailSection('底层意图', ['希望先形成可对齐的 C 端交付方案，而不是直接进入开发。']),
      detailSection('信息缺口', ['目标人群', '使用场景', '核心转化', '内容/供应来源', '支付与售后', '合规边界']),
      detailSection('来源证据', sourceItems)
    ]),
    canvasNode('consensus-presets', '可控共识预设', '把行业共识、临时限定和本期不承接先讲清楚。', [
      '通用行业共识：C 端首期优先验证入口、完成成本、可信反馈和复用价值。',
      '本次临时限定：先限定一个核心人群、一个高频场景、一条最短闭环。',
      '本期绝不承接：未明确的复杂定制、深度集成、支付清结算、投放运营。'
    ], 1, ['改限定', '补禁区', '补共识'], [
      detailSection('通用行业共识', ['入口清楚', '门槛低', '反馈可信', '价值可复用']),
      detailSection('本次临时限定', ['一个核心人群', '一个高频场景', '一条最短闭环']),
      detailSection('本期绝不承接', ['复杂定制', '深度第三方集成', '支付清结算', '内容生产外包', '投放运营']),
      detailSection('可修改说明', ['全部共识预设均可被甲方确认后修改。'])
    ]),
    canvasNode('users-value', '人群&核心价值', '定义受用人群、场景和核心痛点。', [
      '受用人群+场景：在具体生活/消费/服务场景里，需要快速发现、判断、预约、购买或完成任务的 C 端用户。',
      '解决核心痛点：降低选择和行动成本，让用户更快获得可信结果。'
    ], 2, ['补人群', '补场景', '聚焦痛点'], [
      detailSection('受用人群+场景', ['C 端用户', '具体消费/生活/服务场景', '需要快速完成一次行动']),
      detailSection('解决核心痛点', ['选择成本高', '行动路径长', '可信反馈不足']),
      detailSection('甲方价值', ['验证需求是否成立', '明确一期范围', '减少返工沟通']),
      detailSection('待确认', ['是否有明确城市/行业/内容供应侧'])
    ]),
    canvasNode('minimum-loop', '最小闭环交付', '把交付拆成流程、分级和极简页面拓扑。', [
      '通用使用流程：进入入口 -> 浏览/输入需求 -> 查看推荐或详情 -> 执行动作 -> 获得反馈 -> 留存记录。',
      '必做落地：首页入口、核心列表/表单、详情/结果、主操作、成功失败状态。',
      '备选优化：筛选、收藏、分享、提醒、模板、运营位。',
      '延后规划：支付结算、会员体系、商家后台、复杂推荐。',
      '页面极简拓扑：首页/入口 -> 列表或创建页 -> 详情/结果页 -> 确认反馈页 -> 我的记录。'
    ], 3, ['调必做', '补拓扑', '拆交付'], [
      detailSection('通用使用流程', ['进入入口', '浏览/输入需求', '查看推荐或详情', '执行动作', '获得确认反馈', '留存记录或复用']),
      detailSection('交付分级', ['必做落地', '备选优化', '延后规划']),
      detailSection('页面极简拓扑', ['首页/入口', '列表或创建页', '详情/结果页', '确认反馈页', '我的记录']),
      detailSection('验收建议', ['用户能完成一次最短闭环，甲方能判断是否值得继续投入。'])
    ]),
    canvasNode('mutual-confirmation', '双向共识确认', '区分不改无法落地和可选微调。', [
      '必确认项（不改无法落地）：目标人群、首期场景、主操作、数据/内容来源、支付/售后边界、合规责任、验收标准。',
      '可选微调项（改动不影响核心）：文案语气、视觉风格、列表排序、运营推荐位、分享样式。'
    ], 4, ['补确认项', '转甲方确认', '拆微调'], [
      detailSection('必确认项（不改无法落地）', ['目标人群', '首期场景', '主操作', '数据/内容来源', '支付/售后边界', '合规责任', '上线验收标准']),
      detailSection('可选微调项（改动不影响核心）', ['文案语气', '视觉风格', '列表排序', '运营推荐位', '分享样式']),
      detailSection('沟通建议', ['先让甲方确认必确认项，再讨论可选微调。']),
      detailSection('下一步动作', ['确认后进入报价/排期/低保真。'])
    ])
  ]
  return linearCanvas(nodes)
}

function canvasPlan(blueprint = {}, analysis = {}) {
  if (blueprint.intent === 'auth-page' || blueprint.intent === 'auth-modal') return authCanvasPlan(blueprint, analysis)
  if (analysis.skillId === 'interaction-design-workflow') return projectInteractionCanvasPlan(blueprint, analysis)
  if (analysis.skillId === 'eight-module-fuzzy-architecture') return eightModuleFuzzyArchitectureCanvasPlan(blueprint, analysis)
  if (analysis.skillId === 'five-stage-client-c-consensus-breakdown') return fiveStageClientConsensusCanvasPlan(blueprint, analysis)
  const selectedWorkflow = analysis.manualSkillSelected ? workflowForSkill(analysis.skillId) : null
  const selectedWorkflowCanvas = selectedWorkflow ? workflowStepsCanvasPlan(selectedWorkflow, blueprint, analysis) : null
  if (selectedWorkflowCanvas) return selectedWorkflowCanvas
  if (analysis.demandScope === 'non-project') return nonProjectCanvasPlan(blueprint, analysis)
  const specPages = blueprint.interactionSpec?.pageSpecs || []
  const documentItems = compactList((analysis.documents || []).map((doc) => `${doc.name}：${doc.summary || doc.text || doc.reason || doc.status}`))
  const profileItems = [
    `产品名称：${blueprint.profile?.productName || ''}`,
    `目标人群：${blueprint.profile?.targetUsers || ''}`,
    `核心目标：${blueprint.profile?.primaryGoal || ''}`,
    `核心场景：${(blueprint.profile?.coreScenarios || []).join(' / ')}`
  ]
  const productAnalysisItems = compactList((blueprint.productAnalysis?.sections || []).map((section) =>
    `${section.title}：${(section.items || []).slice(0, 2).join('；')}`
  ))
  const structureTreeItems = compactList(blueprint.structureTree?.lines || [])
  const frameworkDiagramItems = compactList((blueprint.frameworkDiagrams?.pages || []).map((page) =>
    `${page.title}：${(page.layoutLines || []).join(' ')}`
  ))
  const nodes = [
    canvasNode('analysis', '文档分析结果', '上传文档后的第一份结构化理解。', [
      `解析文档：${analysis.summary?.parsed || 0}/${analysis.summary?.total || 0}`,
      `来源：${compactList((analysis.documents || []).map((doc) => `${doc.name}${doc.status ? `（${doc.status}）` : ''}`), ['未收到文档']).join('、')}`,
      `产品：${blueprint.profile?.productName || blueprint.title}`,
      `置信度：${blueprint.confidence || 'medium'}`,
      `摘要：${blueprint.profile?.sourceSummary || '暂无摘要'}`
    ], 0, ['重新分析', '补充资料', '保存结果'], [
      detailSection('当前结论', [`已解析 ${analysis.summary?.parsed || 0}/${analysis.summary?.total || 0} 份文档，初步识别为 ${blueprint.profile?.productName || blueprint.title}。`]),
      detailSection('来源证据', documentItems),
      detailSection('识别结果', profileItems),
      detailSection('待确认问题', blueprint.outlineDiff?.pending || []),
      detailSection('下一步动作', ['确认项目档案', '补充缺失资料', '保存蓝图或打开 Agent 追问'])
    ]),
    canvasNode('product-analysis', '产品分析报告', 'What / Why / How、优先级和风险。', productAnalysisItems, 1, ['解释机会', '调整优先级', '补风险'], [
      ...((blueprint.productAnalysis?.sections || []).map((section) => detailSection(section.title, section.items))),
      detailSection('下一步动作', ['确认产品本质', '收敛 P0/P1/P2', '进入结构树'])
    ]),
    canvasNode('profile', '项目档案', blueprint.profile?.positioning || '项目基础信息', [
      `产品名称：${blueprint.profile?.productName || ''}`,
      `目标人群：${blueprint.profile?.targetUsers || ''}`,
      `核心目标：${blueprint.profile?.primaryGoal || ''}`
    ], 2, ['补充人群', '调整定位', '确认档案'], [
      detailSection('当前结论', profileItems),
      detailSection('人群与场景', blueprint.profile?.coreScenarios || []),
      detailSection('边界与假设', blueprint.outlineDiff?.pending || []),
      detailSection('下一步动作', ['补充人群分层', '确认定位', '决定一期优先级'])
    ]),
    canvasNode('structure-tree', '产品结构树', '用树状层级展示页面、模块、控件和交互路径。', structureTreeItems, 3, ['展开结构', '对比路径', '导出树'], [
      detailSection('产品结构树', blueprint.structureTree?.lines || []),
      detailSection('交互路径树', blueprint.structureTree?.interactionLines || []),
      detailSection('结构评审重点', ['一级导航是否按用户任务组织', '页面和模块归属是否清楚', '主路径是否从入口串到交付']),
      detailSection('下一步动作', ['进入产品框架', '补齐页面层级', '生成框架图'])
    ]),
    canvasNode('framework', '产品框架', '模块、页面和能力结构。', compactList((blueprint.framework?.children || []).map((node) => `${node.title}：${(node.children || []).map((child) => child.title).join(' / ')}`)), 4, ['拆模块', '调整优先级', '生成页面'], [
      detailSection('当前结论', [`产品框架拆成 ${(blueprint.framework?.children || []).length} 个核心模块。`]),
      detailSection('模块结构', (blueprint.framework?.children || []).map((node) => `${node.title}：${(node.children || []).map((child) => child.title).join(' / ')}`)),
      detailSection('页面映射', screenDetailItems(blueprint.demoScreens)),
      detailSection('优先级建议', ['P0：入口、分析、主路径 Demo', 'P1：状态异常、资产沉淀', 'P2：高级导出和自动修复'])
    ]),
    canvasNode('outline', '大纲对比', '原有大纲、新增、修改和待确认。', [
      `新增：${(blueprint.outlineDiff?.added || []).join('、')}`,
      `修改：${(blueprint.outlineDiff?.changed || []).join('、')}`,
      `待确认：${(blueprint.outlineDiff?.pending || []).join('、')}`
    ], 5, ['解释变更', '补待确认', '重新对比'], [
      detailSection('新增内容', blueprint.outlineDiff?.added || []),
      detailSection('修改内容', blueprint.outlineDiff?.changed || []),
      detailSection('待确认问题', blueprint.outlineDiff?.pending || []),
      detailSection('评审方式', ['逐项确认是否进入本期', '有争议项交给 Agent 追问', '确认后刷新框架和 Demo'])
    ]),
    canvasNode('flow', '交互路径树', '用户点击路径和页面跳转。', compactList((blueprint.interactionTree?.children || []).map((node) => `${node.title}：${(node.children || []).map((child) => child.title).join(' → ')}`)), 6, ['补跳转', '检查断点', '生成流程'], [
      detailSection('当前结论', ['按用户主任务串联入口、确认、编辑、生成、保存和评审。']),
      detailSection('路径树', (blueprint.interactionTree?.children || []).map((node) => `${node.title}：${(node.children || []).map((child) => child.title).join(' → ')}`)),
      detailSection('页面跳转', (blueprint.demoScreens || []).flatMap((screen) => (screen.actions || []).map((action) => `${screen.title} 点击 ${action.label} -> ${action.to}`))),
      detailSection('断点检查', ['每个跳转有失败兜底', '返回路径明确', '未保存内容需要确认'])
    ]),
    canvasNode('wireframes', '页面框架图', '低保真说明每页长什么样、控件在哪、点哪里跳转。', frameworkDiagramItems, 7, ['查看页面', '补控件', '生成低保真'], [
      ...((blueprint.frameworkDiagrams?.pages || []).slice(0, 6).map((page) => detailSection(page.title, [
        ...(page.layoutLines || []),
        ...(page.navigation || [])
      ], page.priority))),
      detailSection('评审重点', ['框架图必须说明页面形态、输入区、上传区、主按钮、返回和异常反馈'])
    ]),
    canvasNode('spec', '交互说明', '页面形态、状态、事件、异常与返回。', compactList(specPages.map((page) => `${page.pageName}：${page.layout}；${page.states?.length || 0} 个状态，返回到 ${page.navigation?.back || '待定'}`)), 8, ['补状态', '补异常', '补返回'], [
      detailSection('页面规格', pageSpecDetailItems(specPages)),
      detailSection('控件与形态', screenDetailItems(blueprint.demoScreens)),
      detailSection('状态覆盖', ['初始态', '加载态', '成功态', '空状态', '错误态', '权限态', '未保存态']),
      detailSection('返回与恢复', ['返回到来源页和滚动位置', '失败保留输入', '支持重试/重新上传/打开 Agent'])
    ]),
    canvasNode('design-md', '设计 MD 文档', '可复制给产品、设计、研发评审的完整交互文档。', [
      `标题：${blueprint.profile?.productName || blueprint.title} 项目交互设计方案`,
      '包含：What/Why/How、结构树、框架图、状态异常、交付链路。',
      `长度：${String(blueprint.designMarkdown || '').length} 字符`
    ], 9, ['复制 MD', '导出 Markdown', '继续补充'], [
      detailSection('文档结构', ['项目档案', '产品结构树', '交互路径树', '页面框架图', '页面级交互说明', '状态与异常', '交付链路']),
      detailSection('核心摘要', productAnalysisItems),
      detailSection('适用对象', ['产品评审', '交互设计', 'UI 设计', '前端开发', '后端接口对齐', '测试用例编写']),
      detailSection('下一步动作', ['导出 Markdown', '生成低保真', '打开 Agent 逐节追问'])
    ]),
    canvasNode('skill-v2', 'Skill v2', '需求到低保真的产出链。', skillV2CanvasContent(blueprint.interactionSkillV2), 10, ['解释阶段', '补质量门禁', '生成低保真'], [
      detailSection('Agent 阶段', skillV2CanvasContent(blueprint.interactionSkillV2)),
      detailSection('需求组', (blueprint.interactionSkillV2?.requirementGroups || []).map((group) => `${group.title}：${group.priority}；${group.reviewPoints?.slice(0, 2).join(' / ')}`)),
      detailSection('方案组', (blueprint.interactionSkillV2?.solutionGroups || []).map((group) => `${group.title}：${(group.options || []).map((option) => `${option.label}.${option.title}`).join(' / ')}`)),
      detailSection('质量门禁', (blueprint.interactionSkillV2?.qualityReport?.checks || []).map((check) => `${check.label}：${check.passed ? '通过' : '待修复'}`))
    ]),
    canvasNode('skill-v3', 'Skill v3', '状态机、UI 节点树、Demo schema。', skillV3CanvasContent(blueprint.interactionSkillV3), 11, ['补状态机', '补 UI 节点', '生成 Demo'], [
      detailSection('状态机', skillV3CanvasContent(blueprint.interactionSkillV3)),
      detailSection('UI 节点树', (blueprint.interactionSkillV3?.uiNodeTree || []).map((page) => `${page.title}：${(page.nodes || []).slice(0, 4).map((node) => `${node.label}/${node.control}`).join('、')}`)),
      detailSection('Demo Schema', [`风格：${blueprint.interactionSkillV3?.demoSchema?.styleVariants?.join(' / ')}`, `交互：${blueprint.interactionSkillV3?.demoSchema?.interactionModes?.join(' / ')}`]),
      detailSection('QA 修复', (blueprint.interactionSkillV3?.qaProtocol?.repairLoop || []).map((step) => `${step.step}. ${step.action}`))
    ]),
    canvasNode('opportunity', '机会验证', '用户旅程、服务蓝图、优先级和三轮评审。', opportunityCanvasContent(blueprint.opportunityValidation), 12, ['评估权重', '找竞品参考', '三轮评审'], [
      detailSection('机会点', opportunityCanvasContent(blueprint.opportunityValidation)),
      detailSection('用户旅程', (blueprint.opportunityValidation?.journeyMaps || []).flatMap((journey) => (journey.touchpoints || []).map((point) => `${journey.persona} / ${point.touchpoint}：${point.pain}`))),
      detailSection('服务蓝图', (blueprint.opportunityValidation?.serviceBlueprints || []).map((item) => `${item.scenario}：${item.failurePoints?.join(' / ')}`)),
      detailSection('三轮评审', (blueprint.opportunityValidation?.threeRoundReview?.uxReviewPatch?.items || []).map((item) => `${item.owner || '评审'}：${item.action}`))
    ]),
    canvasNode('demo', '可交互 Demo', '低保真页面和可点击跳转。', compactList((blueprint.demoScreens || []).map((screen) => `${screen.title} → ${(screen.actions || []).map((action) => action.to).join(' / ') || '流程末端'}`)), 13, ['生成低保真', '生成 HTML', '刷新 Demo'], [
      detailSection('当前结论', ['可交互 Demo 用来验证页面形态、点击跳转、状态反馈和异常恢复，不只是静态图。']),
      detailSection('页面与跳转', screenDetailItems(blueprint.demoScreens)),
      detailSection('交互模式', [`风格：${blueprint.interactionSkillV3?.demoSchema?.styleVariants?.join(' / ') || 'studio / editorial / product'}`, `方式：${blueprint.interactionSkillV3?.demoSchema?.interactionModes?.join(' / ') || 'wizard / split / command'}`]),
      detailSection('状态和异常演练', (blueprint.interactionSkillV2?.demoScenarioMatrix || []).map((item) => `${item.label}：${item.trigger}；恢复 ${item.recovery}`)),
      detailSection('下一步动作', ['不满意可刷新 Demo', '满意后生成完整 HTML', 'HTML 通过后进入 Figma / Vue'])
    ]),
    canvasNode('html', '完整 HTML', '复用网页工厂的预览、源码、下载和版本刷新方式。', [
      '完整 HTML：由蓝图和 Demo Schema 生成可独立打开页面。',
      '网页工厂复用：预览 iframe、源码面板、下载 HTML、重新生成版本。',
      '验收：主路径可点击，状态/异常可演练。'
    ], 14, ['生成 HTML', '查看源码', '下载 HTML'], nodeDeliveryDetails('html', blueprint)),
    canvasNode('figma', 'Figma 文件', '把蓝图和 HTML 结果转为可评审设计文件。', [
      'Figma 设计稿：页面 Frame、组件节点、状态变体和交互注释。',
      '转入条件：HTML Demo 主路径通过，页面状态已补齐。',
      '沉淀：设计资产可继续转 Vue 或进入设计评审。'
    ], 15, ['生成 Figma', '同步组件', '设计评审'], nodeDeliveryDetails('figma', blueprint)),
    canvasNode('vue', 'Vue 页面', '确认 Demo/Figma 后导出前端 Vue 与后端接口契约。', [
      'Vue 导出：前端组件、页面样式、交互状态。',
      '后端边界：接口契约、Mock 数据、错误码、重试策略。',
      '复用网页工厂：源码查看、复制、下载源码包。'
    ], 16, ['导出 Vue', '拆分前后端', '下载源码'], nodeDeliveryDetails('vue', blueprint)),
    canvasNode('review', '评审清单', '进入交付前必须确认的问题。', compactList(blueprint.reviewChecklist || []), 17, ['补验收', '导出 Markdown', '保存资产'], [
      detailSection('评审清单', blueprint.reviewChecklist || []),
      detailSection('交付完整性', ['蓝图已确认', 'Demo 可点击', '完整 HTML 可打开', 'Figma/Vue 路径明确']),
      detailSection('风险项', blueprint.outlineDiff?.pending || []),
      detailSection('下一步动作', ['打开 Agent 补问题', '保存资产', '导出 Markdown / HTML / Vue'])
    ])
  ]
  return {
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({
      id: `${node.id}-${nodes[index + 1].id}`,
      from: node.id,
      to: nodes[index + 1].id,
      label: '下一环节'
    })),
    orderedTabs: nodes.map((node) => ({ key: node.id, label: node.title }))
  }
}

export function analyzeRequirementDocuments(payload = {}, options = {}) {
  const parsed = parseUploadedDocuments(payload)
  const project = payload.project || {}
  const routing = orchestrateRequirementSkill({
    ...payload,
    documents: parsed.documents
  })
  const meta = workflowMeta(payload, routing)
  const input = [
    payload.input || '',
    ...parsed.documents.map((doc) => `【${doc.name}】\n${doc.text || doc.reason || ''}`)
  ].filter(Boolean).join('\n\n')
  const baseBlueprint = buildProjectBlueprint({
    project,
    input,
    documents: parsed.documents.map((doc) => ({
      name: doc.name,
      status: doc.status,
      text: doc.text || ''
    }))
  })
  const routedBlueprint = meta.detectedIntent === 'auth-modal' ? toAuthModalBlueprint(baseBlueprint, input) : baseBlueprint
  const blueprint = {
    ...routedBlueprint,
    type: meta.demandScope === 'non-project' && !['auth-page', 'auth-modal'].includes(routedBlueprint.intent) ? 'analysis-report' : routedBlueprint.type,
    demandScope: meta.demandScope,
    skillSelectionMode: meta.skillSelectionMode,
    manualSkillSelected: meta.manualSkillSelected,
    displaySkillName: meta.displaySkillName,
    requestedSkillId: meta.requestedSkillId,
    requestedSkillName: meta.requestedSkillName,
    resolvedSkillId: meta.resolvedSkillId,
    resolvedSkillName: meta.resolvedSkillName,
    detectedIntent: meta.detectedIntent,
    routingReason: meta.routingReason,
    skillId: meta.skillId,
    skillName: meta.skillName
  }
  const shouldRunGeneration = ['auth-page-generation', 'smart-recommendation-skill'].includes(meta.resolvedSkillId)
  const generation = shouldRunGeneration
    ? runSkillGenerationSync({
      skillId: meta.resolvedSkillId,
      input,
      project,
      documents: parsed.documents,
      demandScope: meta.demandScope,
      skillOrchestration: options.skillOrchestration,
      routing: {
        requestedSkillId: meta.requestedSkillId,
        resolvedSkillId: meta.resolvedSkillId,
        detectedIntent: meta.detectedIntent,
        displaySkillName: meta.displaySkillName
      }
    })
    : null
  const analysis = {
    status: 'analyzed',
    demandScope: meta.demandScope,
    requestedSkillId: meta.requestedSkillId,
    requestedSkillName: meta.requestedSkillName,
    resolvedSkillId: meta.resolvedSkillId,
    resolvedSkillName: meta.resolvedSkillName,
    skillSelectionMode: meta.skillSelectionMode,
    manualSkillSelected: meta.manualSkillSelected,
    displaySkillName: meta.displaySkillName,
    detectedIntent: meta.detectedIntent,
    routingReason: meta.routingReason,
    routing: {
      requestedSkillId: meta.requestedSkillId,
      requestedSkillName: meta.requestedSkillName,
      resolvedSkillId: meta.resolvedSkillId,
      resolvedSkillName: meta.resolvedSkillName,
      skillSelectionMode: meta.skillSelectionMode,
      manualSkillSelected: meta.manualSkillSelected,
      displaySkillName: meta.displaySkillName,
      detectedIntent: meta.detectedIntent,
      routingReason: meta.routingReason
    },
    skillId: meta.skillId,
    skillName: meta.skillName,
    input: payload.input || '',
    project,
    projectId: payload.projectId || project.id || '',
    summary: parsed.summary,
    documents: parsed.documents,
    blueprint,
    generation,
    productAnalysis: blueprint.productAnalysis,
    structureTree: blueprint.structureTree,
    frameworkDiagrams: blueprint.frameworkDiagrams,
    designMarkdown: blueprint.designMarkdown,
    architecture: {
      title: `${blueprint.profile?.productName || blueprint.title} 初步架构`,
      nodes: architectureNodes(blueprint)
    },
    flowTree: blueprint.interactionTree,
    navigationPlan: flattenNavigationFromScreens(blueprint.demoScreens),
    nextActions: [
      { id: 'open-agent', label: '打开 Agent 追问 / 重新生成框架图' },
      { id: 'save-blueprint', label: '满意，保存蓝图资产' },
      { id: 'generate-demo', label: '继续生成低保真和可交互 Demo' }
    ]
  }
  analysis.canvas = canvasPlan(blueprint, analysis)
  analysis.qualityGate = buildAnalysisQualityGate(analysis)
  analysis.versions = [buildAnalysisVersionSnapshot(analysis, analysis.qualityGate)]
  analysis.blueprint = {
    ...analysis.blueprint,
    qualityGate: analysis.qualityGate,
    versions: analysis.versions
  }
  return analysis
}

export async function analyzeRequirementDocumentsWithGeneration(payload = {}, options = {}) {
  const analysis = analyzeRequirementDocuments(payload, options)
  const provider = options.agentProvider || payload.agentProvider
  if (!provider || !['auth-page-generation', 'smart-recommendation-skill'].includes(analysis.resolvedSkillId)) return analysis

  const input = [
    payload.input || '',
    ...(analysis.documents || []).map((doc) => `【${doc.name}】\n${doc.text || doc.reason || ''}`)
  ].filter(Boolean).join('\n\n')

  analysis.generation = await runSkillGeneration({
    skillId: analysis.resolvedSkillId,
    input,
    project: analysis.project,
    projectId: analysis.projectId,
    documents: analysis.documents,
    demandScope: analysis.demandScope,
    detectedIntent: analysis.detectedIntent,
    routingReason: analysis.routingReason,
    skillOrchestration: options.skillOrchestration,
    routing: {
      requestedSkillId: analysis.requestedSkillId,
      resolvedSkillId: analysis.resolvedSkillId,
      detectedIntent: analysis.detectedIntent,
      routingReason: analysis.routingReason,
      displaySkillName: analysis.displaySkillName,
      skillSelectionMode: analysis.skillSelectionMode
    },
    agentProvider: provider,
    model: payload.model || options.model,
    modelCallLog: options.modelCallLog || payload.modelCallLog
  })
  analysis.qualityGate = buildAnalysisQualityGate(analysis)
  analysis.versions = [buildAnalysisVersionSnapshot(analysis, analysis.qualityGate)]
  analysis.blueprint = {
    ...analysis.blueprint,
    qualityGate: analysis.qualityGate,
    versions: analysis.versions
  }
  return analysis
}
