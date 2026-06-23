import { projectScopedContext } from './projectWorkspace.js'

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

export function createSystemSkills() {
  return [
    normalizeSkill({
      id: 'smart-recommendation-skill',
      name: '智能推荐 Skill',
      description: '系统内置默认 design-scheme-ux / UX 决策链路，把需求、文档和项目上下文转成用户行为、功能层级、页面形态、路径返回、状态错误、弹窗提示生命周期和交付画布。',
      category: '需求理解',
      source: 'system',
      applicableScenarios: ['用户没有手动切换 Skill', '需要系统自动组织分析框架', '需要把需求转成可刷新画布', '需要判断弹窗/页面/抽屉/新页签等承载形式', '需要产品、UX、前端、后端共同评审'],
      nonApplicableScenarios: ['用户已经明确选择某个专用 Skill 并要求按该框架输出'],
      requiredInputs: ['用户原始需求', '项目知识', '上传文档', '当前画布上下文'],
      knowledgeScopes: ['design-scheme-ux 方法论', '项目背景', '需求文档', '知识库', '竞品资料', '历史画布'],
      steps: [
        '读取用户输入、项目知识和上传文档',
        '分析用户行为：用户是谁、当前想完成什么、第一眼想看到什么、哪些信息不需要出现',
        '判断功能层级：主要功能、同级功能、次要功能、三级功能和最低等级不展示内容',
        '做页面形态决策：页面、二级页面、弹窗、抽屉、内联区域、新页签、Toast、Banner 或状态页',
        '补齐路径与返回状态：入口、跳转、返回点、筛选/搜索/分页/滚动/选中项/草稿保留规则',
        '补齐状态和错误反馈：加载、空状态、处理中、成功、部分成功、失败、权限、超时、未保存和恢复动作',
        '定义弹窗与提示生命周期：点击外部是否关闭、Esc/关闭按钮规则、Toast 停留时长、Loading 超时处理',
        '规划区域摆放和重叠检查：主工作区、页头、左右面板、行内、卡片、全局区域、视觉/语义/路径重叠',
        '输出完整画布节点、前后端分工、接口契约、UX 验收清单和交付链路',
        'Agent 补充确认后合并原画布并刷新完整画布'
      ],
      followUpRules: ['关键信息缺失时返回确认卡', '用户确认补充后必须触发画布刷新', '不得只回复收到或仅给自然语言建议'],
      outputFormat: '智能推荐画布：用户行为结论、功能层级表、页面/弹窗/抽屉/新页签形态决策、路径跳转与返回状态、状态与错误反馈、弹窗与提示生命周期、区域摆放与重叠检查、前端接管、后端接管、接口契约、UX 验收清单。',
      qualityChecks: ['ux-framework', 'surface-decision', 'overlay-lifecycle', 'route-return-state', 'canvas-refresh', 'frontend-backend-handoff', 'api-contract', 'error-states'],
      exampleInput: '做一个登录注册弹窗',
      exampleOutput: '识别为登录注册弹窗需求，使用智能推荐 Skill 生成用户行为结论、弹窗形态决策、关闭/提交/错误生命周期、接口契约和前后端接管事项。'
    }),
    createDefaultGeneralSkill(),
    normalizeSkill({
      id: 'product-interaction-design-review-skill',
      name: '交互skill',
      description: '通用型产品与交互设计评审 Skill，从业务目标、用户任务、信息架构、交互流程、异常边界、合规数据安全和交付协作六个维度检查方案，适合需求评审、原型自检、设计方案补漏和前后端交付对齐。',
      category: '交互设计',
      source: 'system',
      applicableScenarios: ['产品设计评审', '交互方案评审', '原型自检', '设计方案补漏', '异常场景梳理', '前后端交付对齐'],
      nonApplicableScenarios: ['只需要视觉风格润色', '只需要生成代码且不需要产品交互判断'],
      requiredInputs: ['业务目标', '目标用户', '核心任务流', '页面或原型', '约束条件'],
      knowledgeScopes: ['项目背景', '需求文档', '竞品资料', '设计方案', '知识库', '历史画布'],
      steps: [
        '确认业务目标、用户分层、痛点、竞品边界和迭代约束',
        '梳理主任务、次任务、边缘任务、新手任务和用户认知负荷',
        '检查信息架构、导航体系、搜索筛选收藏和跨页面连续性',
        '评审输入、AI处理、编辑、预览、导出、分发的全流程交互闭环',
        '补齐加载、空状态、失败、权限、付费、超时、删除和恢复等异常边界',
        '明确产品、UI/交互、前端、后端、测试和运营的交付分工与验收清单'
      ],
      followUpRules: ['缺少业务目标或目标用户时先追问', '发现 P0/P1 风险时先给修复建议再展开细节'],
      outputFormat: '产品交互评审报告：结论、关键问题、补齐方案、前后端/设计/测试分工、验收清单。',
      qualityChecks: ['business-goal', 'user-task-flow', 'information-architecture', 'interaction-closure', 'error-boundaries', 'handoff-checklist'],
      exampleInput: '帮我检查这个设计方案有没有漏场景',
      exampleOutput: '按业务、用户、信息架构、交互流程、异常边界和交付协作六个维度输出 P0/P1/P2 问题、补齐方案和验收清单。'
    }),
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
      id: 'eight-module-fuzzy-architecture',
      name: '8模块模糊架构',
      description: '把模糊产品想法拆成 8 个归档模块：需求理解、合理假设、目标用户、JTBD、主路径、功能范围、待确认问题和页面结构。',
      category: '需求理解',
      source: 'system',
      applicableScenarios: ['模糊产品想法', '早期需求归档', 'MVP 范围拆解', '页面结构初稿', '需要先假设再确认'],
      nonApplicableScenarios: ['已有完整 PRD 且只需要视觉设计', '只需要代码实现', '不允许做任何推断的合规场景'],
      requiredInputs: ['用户原始需求', '表层诉求', '已知角色或场景'],
      knowledgeScopes: ['项目背景', '需求文档', '用户角色', '业务边界', '合规约束'],
      steps: [
        '需求理解',
        '合理假设（均可推翻修改）',
        '目标用户',
        '核心 JTBD',
        '主路径草案',
        'P0/P1 功能范围',
        '待确认问题',
        '初版页面结构'
      ],
      followUpRules: ['只问会影响方向或范围的问题', '所有假设都标记为可推翻修改'],
      outputFormat: '模糊需求拆解-8模块归档版：需求理解、合理假设、目标用户、核心JTBD、主路径草案、P0/P1功能范围、待确认问题、初版页面结构。',
      qualityChecks: ['必须保留原始需求', '必须列出角色/终端/场景/付费/边界/合规缺口', 'P0 必须能支撑最小上线', '必须列出本期禁区'],
      exampleInput: '我想做一个帮小店老板管理会员和活动的小程序。',
      exampleOutput: '按 8 个模块输出需求理解、可推翻假设、核心用户、JTBD、首次/复用路径、P0/P1/P2/禁区、待确认问题和游客/登录/二级页面结构。'
    }),
    normalizeSkill({
      id: 'five-stage-client-c-consensus-breakdown',
      name: '5阶甲方C端共识拆解方案',
      description: '面向甲方沟通，把 C 端模糊需求拆成共情复盘、可控共识、人群价值、最小闭环交付和双向确认。',
      category: '产品方案',
      source: 'system',
      applicableScenarios: ['甲方 C 端需求', '客户共识对齐', '消费端小程序或网站方案', '交付边界确认', '最小闭环拆解'],
      nonApplicableScenarios: ['纯内部 B 端后台', '只做视觉风格稿', '甲方已确认完整范围且只需排期'],
      requiredInputs: ['甲方原话', 'C端用户场景', '业务目标或转化目标'],
      knowledgeScopes: ['客户需求', '行业共识', 'C端用户场景', '交付边界', '合规约束'],
      steps: [
        '需求共情复盘',
        '可控共识预设（全部可修改）',
        '人群&核心价值',
        '最小闭环交付',
        '双向共识确认'
      ],
      followUpRules: ['先复刻甲方原话再翻译意图', '必须区分必确认项和可选微调项'],
      outputFormat: '5阶甲方C端共识拆解方案：需求共情复盘、可控共识预设、人群&核心价值、最小闭环交付、双向共识确认。',
      qualityChecks: ['必须包含本期绝不承接', '必须给出页面极简拓扑', '必须区分必做/备选/延后', '必须列出不改无法落地的确认项'],
      exampleInput: '甲方想做一个面向宝妈的本地亲子活动小程序，先把方案理一下。',
      exampleOutput: '按 5 阶输出原话复刻、底层意图、临时限定、本期不承接、人群场景、最小闭环、页面拓扑、必确认项和可选微调项。'
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
