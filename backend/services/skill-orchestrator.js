export const AUTO_SKILL_ID = 'auto'
export const SMART_RECOMMENDATION_SKILL_ID = 'smart-recommendation-skill'
export const NO_SKILL_ID = 'none'
export const ACTIVE_REQUIREMENT_SKILL_ID = 'advanced-ux-requirement-analysis'

const SKILL_LABELS = {
  auto: '智能推荐 Skill',
  none: '不选择 Skill',
  'ux-design-confirmation-skill': 'UX 设计确认 Skill',
  'dialogue-skill': '对话 Skill',
  'advanced-ux-requirement-analysis': '高级 UX 需求分析',
  'smart-recommendation-skill': '智能推荐 Skill',
  'competitor-monitor-skill': '竞品分析 Skill',
  'demand-four-step': '需求拆解四步法',
  'demand-card-flow': '需求拆解卡片流',
  'eight-module-fuzzy-architecture': '8模块模糊架构',
  'five-stage-client-c-consensus-breakdown': '5阶甲方C端共识拆解方案',
  'product-interaction-design-review-skill': '交互skill',
  'user-journey-map-flow': '用户旅程地图',
  'interaction-design-workflow': '交互方案生成',
  'podcastor-product-flow': 'AI 播客产品体验流',
  'auth-page-generation': '登录注册页面生成'
}

function normalizeSkillId(skillId = '', fallback = 'demand-four-step') {
  return String(skillId || '').trim() || fallback
}

export function skillLabel(skillId = '') {
  const normalized = normalizeSkillId(skillId)
  return SKILL_LABELS[normalized] || normalized || '默认分析流程'
}

function hasJoggBrollContext(text = '') {
  return /jogg/i.test(text) &&
    /(b-?roll|broll|高级编辑器|media\s*模块|my\s*media|stock|pexels|pixabay|ai\s*generate)/i.test(text)
}

function isHomePromptShortcutInput(text = '') {
  return /首页/.test(text) && /(快捷|提示词|prompt|chip|输入)/i.test(text)
}

function hasStrongLocalFeatureOptimizationContext(text = '') {
  return /(画面比例|selectedAspectRatio|targetAspectRatio|actualAspectRatio|cropBox|虚线画框|Photo to Host|Generate From Reference|Use your Photo|AI generate host|多比例素材|比例不匹配)/i.test(String(text || ''))
}

function isSelectedKnowledgeScopeDocument(doc = {}) {
  return doc?.sourceType === 'selected-knowledge-scope' ||
    /^框选功能/.test(String(doc?.name || '')) ||
    Boolean(doc?.selectedKnowledgeScope)
}

function hasProjectHomepageContext(input = '', documents = []) {
  const text = [
    input,
    ...(documents || []).map((doc) => `${doc?.name || ''}\n${doc?.text || doc?.content || doc?.reason || ''}`)
  ].join('\n\n')
  return (documents || []).some(isSelectedKnowledgeScopeDocument) ||
    /\bjogg\b|podcast|播客|AI Podcast Generator|Topic\/input composer/i.test(text)
}

export function detectRequirementIntent(input = '') {
  const text = String(input || '')
  if (hasJoggBrollContext(text)) return 'requirement-analysis'
  if (isHomePromptShortcutInput(text)) return 'requirement-analysis'
  if (hasStrongLocalFeatureOptimizationContext(text)) return 'requirement-analysis'
  if (/podcastor/i.test(text)) return 'podcastor-product'
  if (/(登录|登陆|注册|找回密码|忘记密码|验证码|认证|auth|sign\s*in|sign\s*up|login|register)/i.test(text) &&
    /(弹窗|弹层|浮层|对话框|modal|dialog|popup)/i.test(text)) {
    return 'auth-modal'
  }
  if (/(登录|登陆|注册|找回密码|忘记密码|验证码|认证|auth|sign\s*in|sign\s*up|login|register)/i.test(text) &&
    /(页面|界面|表单|html|css|js|前端|代码|vue|react|生成|做一个|写一个|开发)/i.test(text)) {
    return 'auth-page'
  }
  if (/(html|css|js|vue|react|页面|界面|代码|预览|demo)/i.test(text)) return 'page-generation'
  if (/(旅程|用户路径|journey)/i.test(text)) return 'journey-map'
  if (/(交互|低保真|线框图|页面结构|状态|异常)/i.test(text)) return 'interaction-design'
  return 'requirement-analysis'
}

function skillMatchesIntent(skillId = '', intent = '') {
  if (skillId === NO_SKILL_ID) return true
  if (skillId === AUTO_SKILL_ID) return false
  if (skillId === 'ux-design-confirmation-skill') return ['requirement-analysis', 'interaction-design', 'page-generation'].includes(intent)
  if (skillId === 'dialogue-skill') return ['requirement-analysis', 'interaction-design', 'page-generation'].includes(intent)
  if (skillId === 'advanced-ux-requirement-analysis') return ['requirement-analysis', 'interaction-design', 'page-generation'].includes(intent)
  if (skillId === 'competitor-monitor-skill') return ['requirement-analysis', 'interaction-design'].includes(intent)
  if (intent === 'auth-modal') return [
    SMART_RECOMMENDATION_SKILL_ID,
    'ux-design-confirmation-skill',
    'dialogue-skill',
    'interaction-design-workflow',
    'product-interaction-design-review-skill'
  ].includes(skillId)
  if (intent === 'auth-page') return [
    'auth-page-generation',
    'interaction-design-workflow',
    'product-interaction-design-review-skill'
  ].includes(skillId)
  if (intent === 'page-generation') return ['ux-design-confirmation-skill', 'dialogue-skill', 'advanced-ux-requirement-analysis', 'interaction-design-workflow', 'product-interaction-design-review-skill'].includes(skillId)
  if (intent === 'journey-map') return skillId === 'user-journey-map-flow'
  if (intent === 'interaction-design') return ['ux-design-confirmation-skill', 'dialogue-skill', 'advanced-ux-requirement-analysis', 'competitor-monitor-skill', 'interaction-design-workflow', 'product-interaction-design-review-skill'].includes(skillId)
  if (intent === 'podcastor-product') return skillId === 'podcastor-product-flow'
  return [
    'ux-design-confirmation-skill',
    'dialogue-skill',
    'advanced-ux-requirement-analysis',
    'competitor-monitor-skill',
    'demand-four-step',
    'demand-card-flow',
    'eight-module-fuzzy-architecture',
    'five-stage-client-c-consensus-breakdown',
    'interaction-design-workflow',
    'product-interaction-design-review-skill'
  ].includes(skillId)
}

function routingReason({ requestedSkillId, resolvedSkillId, intent, matchedIntent }) {
  if (requestedSkillId === NO_SKILL_ID) {
    return `用户选择「不选择 Skill」，后端不套固定 Skill，改由大模型根据文档自主判断「${intent}」并生成画布节点。`
  }
  if (requestedSkillId === AUTO_SKILL_ID) {
    return `智能推荐 Skill 已接管分析链路，识别到当前意图为「${intent}」，并使用内置 UX 画布框架生成内容。`
  }
  if (requestedSkillId !== resolvedSkillId) {
    if (intent === 'auth-page') return `用户输入是登录注册页面生成任务，强意图高于「${skillLabel(requestedSkillId)}」，已切换为「${skillLabel(resolvedSkillId)}」。`
    return `所选 Skill 与当前意图不完全匹配，已切换为「${skillLabel(resolvedSkillId)}」。`
  }
  if (!matchedIntent) {
    return `识别到当前意图偏向「${intent}」，但用户未选择智能推荐，已保留「${skillLabel(resolvedSkillId)}」。`
  }
  return `所选 Skill 与当前意图匹配，继续使用「${skillLabel(resolvedSkillId)}」。`
}

export function orchestrateRequirementSkill(payload = {}) {
  const rawSkillId = payload.skillId || payload.selectedWorkflowId
  const requestedSkillId = normalizeSkillId(rawSkillId, ACTIVE_REQUIREMENT_SKILL_ID)
  const skillSelectionMode = 'manual'
  const input = [
    payload.input || '',
    ...(payload.documents || []).map((doc) => `${doc.name || ''}\n${doc.text || doc.content || doc.reason || ''}`)
  ].join('\n\n')
  const detectedIntent = isHomePromptShortcutInput(payload.input || '') && hasProjectHomepageContext(payload.input || '', payload.documents || [])
    ? 'requirement-analysis'
    : detectRequirementIntent(input)
  const resolvedSkillId = ACTIVE_REQUIREMENT_SKILL_ID
  const displaySkillName = skillLabel(resolvedSkillId)
  return {
    requestedSkillId,
    resolvedSkillId,
    skillSelectionMode,
    detectedIntent,
    requestedSkillName: skillLabel(requestedSkillId),
    resolvedSkillName: skillLabel(resolvedSkillId),
    displaySkillName,
    routingReason: requestedSkillId === ACTIVE_REQUIREMENT_SKILL_ID
      ? `当前只启用「${displaySkillName}」，继续按最新高级 UX 10 步规范生成 Markdown 并导入画布。`
      : `当前已清空其它 Skill，原选择「${skillLabel(requestedSkillId)}」已切换为「${displaySkillName}」。`
  }
}
