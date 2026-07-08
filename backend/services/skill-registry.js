const SYSTEM_SKILLS = [
  {
    id: 'smart-recommendation-skill',
    name: '智能推荐 Skill',
    intentTypes: ['requirement-analysis', 'interaction-design', 'page-generation', 'auth-modal'],
    inputRequirements: ['input'],
    outputSchema: 'smart-canvas',
    promptTemplate: [
      '你是大厂级产品、UX 和研发分析编排助手。',
      '用户没有手动切换 Skill 时，智能推荐 Skill 必须使用 design-scheme-ux / UX 决策链路作为默认分析框架。',
      '必须先分析用户行为：用户是谁、当前想完成什么、第一眼想看到什么、哪些信息不需要出现或应降为最低等级。',
      '必须判断功能层级：主要功能、同级功能、次要功能、三级功能、最低等级不展示内容，并说明为什么这样排。',
      '必须做页面形态决策：页面、二级页面、弹窗、抽屉、内联区域、新页签、Toast、Banner、状态页分别什么时候用。',
      '必须说明路径与返回状态：入口、跳转、返回点、筛选/搜索/分页/滚动/选中项/草稿/生成结果如何保留。',
      '必须覆盖状态和错误反馈：加载、空状态、处理中、成功、部分成功、失败、权限、超时、未保存、无结果，错误要说明发生了什么、影响什么、如何恢复。',
      '必须定义弹窗与提示生命周期：点击外部是否关闭、Esc/关闭按钮规则、成功 Toast 2-3 秒、信息 Toast 3-4 秒、警告 Toast 4-6 秒、错误 Toast 至少 6 秒且关键错误不能 toast-only。',
      '必须规划区域摆放和重叠检查：主工作区、页头、左右面板、行内、卡片、全局区域，检查视觉、语义、交互、路径和注意力重叠。',
      '最后生成可落到画布的节点、前后端分工、接口契约和 UX 验收清单；用户手动切换 Skill 时，只把用户 Skill 作为框架约束，不替代模型内容生成。'
    ].join('\n'),
    qualityChecks: ['ux-framework', 'surface-decision', 'overlay-lifecycle', 'route-return-state', 'canvas-refresh', 'frontend-backend-handoff', 'api-contract', 'error-states'],
    fallbackSkillId: 'interaction-design-workflow'
  },
  {
    id: 'auth-page-generation',
    name: '登录注册页面生成',
    intentTypes: ['auth-page'],
    inputRequirements: ['input'],
    outputSchema: 'auth-page',
    promptTemplate: [
      '你是资深产品和前后端架构助手。',
      '根据用户输入生成登录注册页面方案，必须包含功能说明、接口契约、前后端分工、HTML 预览和质量检查。',
      '输出必须适合产品、UX、前端和后端直接评审。'
    ].join('\n'),
    qualityChecks: ['frontend-backend-handoff', 'api-contract', 'html-preview', 'error-states'],
    fallbackSkillId: 'interaction-design-workflow'
  },
  {
    id: 'demand-four-step',
    name: '需求拆解四步法',
    intentTypes: ['requirement-analysis'],
    inputRequirements: ['input'],
    outputSchema: 'requirement-analysis',
    promptTemplate: '按需求补全、结构化拆解、方案生成、质量校验四步分析需求。',
    qualityChecks: ['missing-information', 'acceptance-criteria'],
    fallbackSkillId: ''
  },
  {
    id: 'demand-card-flow',
    name: '需求拆解卡片流',
    intentTypes: ['requirement-analysis', 'interaction-design'],
    inputRequirements: ['input'],
    outputSchema: 'requirement-analysis',
    promptTemplate: [
      '你是大厂产品需求拆解助手。',
      '必须用卡片式工作流输出：需求理解、需求质疑、场景拆解、方案生成、交互转化、质量校验。',
      '每张卡片都要有结论、依据、风险、待确认项和下一步动作，避免直接给一个泛化方案。',
      '适合把模糊需求逐步拆成可质疑、可采纳、可沉淀的中间资产。'
    ].join('\n'),
    qualityChecks: ['card-progressive-flow', 'challenge-before-solution', 'scenario-coverage', 'acceptance-criteria'],
    fallbackSkillId: 'demand-four-step'
  },
  {
    id: 'eight-module-fuzzy-architecture',
    name: '8模块模糊架构',
    intentTypes: ['requirement-analysis', 'interaction-design'],
    inputRequirements: ['input'],
    outputSchema: 'requirement-analysis',
    promptTemplate: [
      '你是产品需求拆解助手。',
      '必须按“模糊需求拆解-8模块归档版”输出：需求理解、合理假设、目标用户、核心JTBD、主路径草案、P0/P1功能范围、待确认问题、初版页面结构。',
      '需求理解必须包含用户原始需求、表层诉求、缺失要素盘点：角色/终端/场景/付费/边界/合规。',
      '合理假设必须区分基础落地假设、体验增值假设、边界禁区假设，并说明均可推翻修改。',
      '功能范围必须区分 P0 必做上线、P1 二期迭代、P2 远期规划和本期禁区。',
      '输出要适合早期产品归档，不要假装所有信息都已确认。'
    ].join('\n'),
    qualityChecks: ['missing-information', 'reversible-assumptions', 'jtbd', 'mvp-scope', 'page-structure'],
    fallbackSkillId: 'demand-four-step'
  },
  {
    id: 'five-stage-client-c-consensus-breakdown',
    name: '5阶甲方C端共识拆解方案',
    intentTypes: ['requirement-analysis', 'interaction-design'],
    inputRequirements: ['input'],
    outputSchema: 'requirement-analysis',
    promptTemplate: [
      '你是甲方 C 端产品共识拆解助手。',
      '必须按“5阶甲方C端共识拆解方案”输出：需求共情复盘、可控共识预设、人群&核心价值、最小闭环交付、双向共识确认。',
      '需求共情复盘必须包含原话复刻、底层意图、信息缺口。',
      '可控共识预设必须包含通用行业共识、本次临时限定、本期绝不承接。',
      '最小闭环交付必须包含通用使用流程、交付分级、必做落地、备选优化、延后规划、页面极简拓扑。',
      '双向共识确认必须区分必确认项和可选微调项，适合拿给甲方对齐范围。'
    ].join('\n'),
    qualityChecks: ['client-consensus', 'scope-boundary', 'minimum-loop', 'c-end-value', 'confirmation-items'],
    fallbackSkillId: 'demand-four-step'
  },
  {
    id: 'product-interaction-design-review-skill',
    name: '交互skill',
    intentTypes: ['interaction-design', 'requirement-analysis', 'auth-page', 'auth-modal', 'page-generation'],
    inputRequirements: ['input'],
    outputSchema: 'product-interaction-review',
    promptTemplate: [
      '你是大厂产品和交互设计评审专家。',
      '这是评审和补漏 Skill，不是页面生成 Skill；即使用户输入“做一个登录注册功能”，也要从产品交互评审角度分析，不要回退成通用登录注册页面生成。',
      '必须从六个维度输出：业务目标、用户任务、信息架构、交互流程、异常边界、交付协作。',
      '业务目标要说明目标用户、核心痛点、竞品边界、迭代约束和成功标准。',
      '用户任务要区分主任务、次任务、边缘任务、新手路径和认知负荷。',
      '信息架构要检查导航、页面层级、搜索筛选收藏、跨页面连续性和数据对象关系。',
      '交互流程要检查输入、AI 处理或上传、编辑、预览、导出、分发的完整闭环。',
      '异常边界要补齐加载、空状态、失败、权限、付费、超时、删除、恢复和数据安全。',
      '交付协作要明确产品、UI/交互、前端、后端、测试、运营谁接管，谁给谁什么数据，以及验收清单。'
    ].join('\n'),
    qualityChecks: ['business-goal', 'user-task-flow', 'information-architecture', 'interaction-closure', 'error-boundaries', 'handoff-checklist'],
    fallbackSkillId: 'interaction-design-workflow'
  },
  {
    id: 'interaction-design-workflow',
    name: '交互方案生成',
    intentTypes: ['interaction-design', 'page-generation'],
    inputRequirements: ['input'],
    outputSchema: 'interaction-design',
    promptTemplate: '把需求转成页面结构、交互路径、状态异常和前后端交接。',
    qualityChecks: ['state-coverage', 'handoff'],
    fallbackSkillId: 'demand-four-step'
  },
  {
    id: 'user-journey-map-flow',
    name: '用户旅程地图',
    intentTypes: ['journey-map'],
    inputRequirements: ['input'],
    outputSchema: 'journey-map',
    promptTemplate: '围绕用户目标、阶段、触点、痛点和机会点生成用户旅程。',
    qualityChecks: ['journey-continuity'],
    fallbackSkillId: 'demand-four-step'
  },
  {
    id: 'podcastor-product-flow',
    name: 'Podcastor 产品体验流',
    intentTypes: ['podcastor-product'],
    inputRequirements: ['input', 'project'],
    outputSchema: 'product-blueprint',
    promptTemplate: '围绕 AI 播客工作站生成产品体验、核心编辑器和交付链路。',
    qualityChecks: ['project-context', 'delivery-flow'],
    fallbackSkillId: 'demand-four-step'
  }
]

export function listSkillDefinitions() {
  return SYSTEM_SKILLS.map((skill) => ({ ...skill }))
}

function normalizeSkillOverride(override = {}) {
  if (!override || typeof override !== 'object') return {}
  const normalized = {}
  if (typeof override.promptTemplate === 'string') normalized.promptTemplate = override.promptTemplate
  if (typeof override.outputSchema === 'string') normalized.outputSchema = override.outputSchema
  if (Array.isArray(override.qualityChecks)) {
    normalized.qualityChecks = override.qualityChecks.map((item) => String(item || '').trim()).filter(Boolean)
  }
  if (typeof override.fallbackSkillId === 'string') normalized.fallbackSkillId = override.fallbackSkillId
  return normalized
}

function orchestrationOverrides(settings = {}) {
  if (!settings || typeof settings !== 'object' || settings.enabled === false) return {}
  return settings.skillOverrides && typeof settings.skillOverrides === 'object' ? settings.skillOverrides : {}
}

function applySkillOverride(skill = {}, settings = {}) {
  const override = normalizeSkillOverride(orchestrationOverrides(settings)[skill.id])
  return {
    ...skill,
    ...override,
    orchestrationOverridden: Object.keys(override).length > 0
  }
}

export function getSkillDefinition(skillId = '', settings = {}) {
  const skill = SYSTEM_SKILLS.find((item) => item.id === skillId) || SYSTEM_SKILLS.find((item) => item.id === 'demand-four-step')
  return applySkillOverride({ ...skill }, settings)
}

export function findSkillByIntent(intent = '', settings = {}) {
  const skill = SYSTEM_SKILLS.find((item) => item.intentTypes.includes(intent))
  return skill ? applySkillOverride({ ...skill }, settings) : getSkillDefinition('demand-four-step', settings)
}
