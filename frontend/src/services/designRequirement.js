export const DESIGN_REQUIREMENT_TEMPLATE = [
  { key: 'backgroundGoal', title: '背景目标', hint: '请补充项目背景、业务目标和确认范围。' },
  { key: 'applicableScenario', title: '适用场景', hint: '请补充适用业务场景、边界和不适用范围。' },
  { key: 'userRoles', title: '用户角色', hint: '请补充目标用户、角色分工和使用前提。' },
  { key: 'businessFlow', title: '业务流程', hint: '请补充主流程、分支流程和跳转关系。' },
  { key: 'pageFeatureList', title: '页面/功能清单', hint: '请补充页面、模块、操作和优先级。' },
  { key: 'permissionRules', title: '权限规则', hint: '请补充角色权限、数据范围和操作限制。' },
  { key: 'exceptionScenarios', title: '异常场景', hint: '请补充失败、空状态、超时、撤销和恢复规则。' },
  { key: 'dataFields', title: '数据字段', hint: '请补充字段、类型、校验、来源和默认值。' },
  { key: 'frontendBackendBoundary', title: '前后端边界', hint: '请补充前端负责、后端负责、接口契约和联调点。' },
  { key: 'acceptanceCriteria', title: '验收标准', hint: '请补充可测试的验收口径和通过条件。' }
]

export const DESIGN_REQUIREMENT_SECTION_KEYS = DESIGN_REQUIREMENT_TEMPLATE.map((section) => section.key)

const SLOT_ALIASES = {
  backgroundGoal: ['背景目标', '业务背景', '项目目标', '目标'],
  applicableScenario: ['适用场景', '使用场景', '场景'],
  userRoles: ['用户角色', '目标用户', '目标人群', '角色'],
  businessFlow: ['业务流程', '流程', '交互路径'],
  pageFeatureList: ['页面/功能清单', '页面清单', '功能清单', '页面结构'],
  permissionRules: ['权限规则', '权限', '角色权限'],
  exceptionScenarios: ['异常场景', '异常', '边界状态', '失败场景'],
  dataFields: ['数据字段', '字段', '表单', '表单校验'],
  frontendBackendBoundary: ['前后端边界', '接口', '接口契约', '前后端交接'],
  acceptanceCriteria: ['验收标准', '验收', '测试标准']
}

const STATUS_LABELS = {
  extracted: '已提取',
  'ai-inferred': 'AI 推断',
  inferred: 'AI 推断',
  pending: '待补充',
  confirmed: '人工确认',
  manual: '人工填写',
  'not-applicable': '不适用'
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function compactText(...parts) {
  return parts
    .flatMap((part) => Array.isArray(part) ? part : [part])
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map((part) => typeof part === 'string' ? part : JSON.stringify(part))
    .join('\n')
}

function nowIso() {
  return new Date().toISOString()
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function slotMatches(section, material = {}) {
  const aliases = SLOT_ALIASES[section.key] || [section.title]
  const slots = [
    ...asArray(material.knowledgeSlots || material.slots || material.designSlots),
    ...asArray(material.manualComplements).map((item) => item.slot || item.title || item.key),
    ...asArray(material.reusableBlocks).map((item) => item.slot || item.title || item.key)
  ].filter(Boolean)
  if (slots.some((slot) => aliases.includes(slot) || slot === section.key)) return true
  const haystack = compactText(material.title, material.meta, material.category, material.notes, material.content)
  return aliases.some((alias) => haystack.includes(alias))
}

function sourceStatus(material = {}) {
  return STATUS_LABELS[material.extractionStatus] ||
    STATUS_LABELS[material.status] ||
    (material.manualComplements?.length ? '人工填写' : material.sourceUrl ? '已提取' : 'AI 推断')
}

function knowledgeText(material = {}) {
  return compactText(material.content, material.notes, material.summary, material.meta).slice(0, 360)
}

function blueprintContentFor(section = {}, blueprint = {}) {
  const profile = blueprint.profile || {}
  if (section.key === 'backgroundGoal') {
    return compactText(profile.primaryGoal, profile.positioning, blueprint.summary)
  }
  if (section.key === 'applicableScenario') {
    return compactText(profile.applicableScenario, profile.scene, profile.sourceSummary)
  }
  if (section.key === 'userRoles') {
    return compactText(profile.targetUsers, profile.userRoles, blueprint.targetUsers)
  }
  if (section.key === 'businessFlow') {
    return asArray(blueprint.flows || blueprint.paths || blueprint.interactionTree?.children)
      .map((flow) => compactText(flow.title || flow.name || flow.label, flow.goal, flow.summary, flow.steps))
      .join('\n')
  }
  if (section.key === 'pageFeatureList') {
    return asArray(blueprint.pages || blueprint.demoScreens)
      .map((page) => `- ${page.title || page.name || page.pageName || '未命名页面'}：${page.goal || page.description || page.summary || '待补充页面目标'}`)
      .join('\n')
  }
  if (section.key === 'exceptionScenarios') {
    return compactText(blueprint.interactionSkillV3?.emptyStates, blueprint.interactionSkillV3?.errorStates)
  }
  if (section.key === 'dataFields') {
    return compactText(blueprint.dataFields, blueprint.forms, blueprint.formRules)
  }
  if (section.key === 'frontendBackendBoundary') {
    return compactText(blueprint.apiContracts, blueprint.frontendBackendBoundary, blueprint.integrationNotes)
  }
  if (section.key === 'acceptanceCriteria') {
    return asArray(blueprint.acceptance || blueprint.interactionSpec?.acceptanceChecks)
      .map((item) => typeof item === 'string' ? `- ${item}` : `- ${item.title || item.label || '验收项'}：${item.description || item.content || ''}`)
      .join('\n')
  }
  return ''
}

function buildSection(section, blueprint = {}, knowledge = []) {
  const matchedKnowledge = asArray(knowledge).filter((material) => slotMatches(section, material))
  const blueprintText = blueprintContentFor(section, blueprint)
  const knowledgeLines = matchedKnowledge
    .map((material) => `- ${material.title || '未命名知识'}（${sourceStatus(material)}）：${knowledgeText(material)}`)
    .filter((line) => line.trim())
  const body = compactText(
    blueprintText,
    knowledgeLines.length ? ['知识库补全：', ...knowledgeLines].join('\n') : ''
  ).trim()
  const status = body ? (matchedKnowledge.length ? '已补全' : '已提取') : '待补充'
  return {
    ...section,
    status,
    sourceCount: matchedKnowledge.length,
    content: body || `待补充：请补充${section.title}。${section.hint}`,
    knowledgeRefs: matchedKnowledge.map((material) => ({
      id: material.id || '',
      title: material.title || '未命名知识',
      status: sourceStatus(material),
      sourceType: material.sourceType || material.category || 'knowledge'
    }))
  }
}

export function buildDesignRequirementDocument({
  projectId = '',
  blueprint = {},
  knowledge = [],
  title = '',
  notes = ''
} = {}) {
  const sections = DESIGN_REQUIREMENT_TEMPLATE.map((section) => buildSection(section, blueprint, knowledge))
  const createdAt = nowIso()
  const resolvedTitle = title || `${blueprint.title || blueprint.profile?.productName || '页面蓝图'} · 设计需求`
  const content = [
    `# ${resolvedTitle}`,
    notes ? `> ${notes}` : '',
    '',
    ...sections.flatMap((section) => [
      `## ${section.title}`,
      `状态：${section.status}${section.sourceCount ? ` · 知识引用 ${section.sourceCount} 条` : ''}`,
      '',
      section.content,
      ''
    ])
  ].filter((line) => line !== undefined).join('\n')
  return {
    id: `design-req-${randomId()}`,
    projectId,
    type: 'requirements',
    title: resolvedTitle,
    meta: '设计需求 · 结构化模板',
    source: 'design',
    sourceType: 'design',
    status: '待评审',
    knowledgeStatus: 'pending',
    createdAt,
    uploadedAt: createdAt,
    notes,
    content,
    templateVersion: 'design-requirement-v1',
    sections,
    knowledgeRefs: sections.flatMap((section) => section.knowledgeRefs.map((ref) => ({
      ...ref,
      sectionKey: section.key,
      sectionTitle: section.title
    })))
  }
}

function hasRawSource(item = {}) {
  return Boolean(item.sourceUrl || item.url || item.sourceMaterialId || item.sourceType === 'website')
}

function hasAnalysisResult(item = {}) {
  return Boolean(item.parsedArtifacts || item.blueprint || item.structure || item.markdown || item.analysis || item.category?.startsWith?.('blueprint'))
}

function reusableBlockCount(item = {}) {
  return asArray(item.reusableBlocks).length + asArray(item.knowledgeSlots || item.slots || item.designSlots).length
}

export function buildKnowledgeGovernanceSummary(materials = []) {
  const list = asArray(materials)
  const slotCoverage = new Set()
  const statusCounts = {}
  list.forEach((item) => {
    const status = sourceStatus(item)
    statusCounts[status] = (statusCounts[status] || 0) + 1
    DESIGN_REQUIREMENT_TEMPLATE.forEach((section) => {
      if (slotMatches(section, item)) slotCoverage.add(section.title)
    })
  })
  const missingSlots = DESIGN_REQUIREMENT_TEMPLATE
    .map((section) => section.title)
    .filter((title) => !slotCoverage.has(title))
  const reusableCount = list.reduce((sum, item) => sum + reusableBlockCount(item), 0)
  return {
    layers: {
      rawSources: {
        label: '原始来源',
        count: list.filter(hasRawSource).length,
        description: 'URL、导入文件、页面截图和原文用于追溯。'
      },
      analysisResults: {
        label: '分析结果',
        count: list.filter(hasAnalysisResult).length,
        description: '结构树、流程图、Markdown、字段和接口线索。'
      },
      manualComplements: {
        label: '人工补全',
        count: list.reduce((sum, item) => sum + asArray(item.manualComplements).length, 0),
        description: '权限、异常、验收等 URL 中没有的确认项。'
      },
      reusableBlocks: {
        label: '可复用知识块',
        count: reusableCount,
        description: '可直接引用到设计需求栏目。'
      }
    },
    slotCoverage: Array.from(slotCoverage),
    missingSlots,
    statusCounts,
    completionRate: Math.round(((DESIGN_REQUIREMENT_TEMPLATE.length - missingSlots.length) / DESIGN_REQUIREMENT_TEMPLATE.length) * 100)
  }
}
