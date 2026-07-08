export const AUTO_SKILL_ID = 'auto'
export const SMART_RECOMMENDATION_SKILL_ID = 'smart-recommendation-skill'

const SKILL_LABELS = {
  auto: '智能推荐 Skill',
  'smart-recommendation-skill': '智能推荐 Skill',
  'demand-four-step': '需求拆解四步法',
  'demand-card-flow': '需求拆解卡片流',
  'eight-module-fuzzy-architecture': '8模块模糊架构',
  'five-stage-client-c-consensus-breakdown': '5阶甲方C端共识拆解方案',
  'product-interaction-design-review-skill': '交互skill',
  'user-journey-map-flow': '用户旅程地图',
  'interaction-design-workflow': '交互方案生成',
  'podcastor-product-flow': 'Podcastor 产品体验流',
  'auth-page-generation': '登录注册页面生成'
}

function normalizeSkillId(skillId = '', fallback = 'demand-four-step') {
  return String(skillId || '').trim() || fallback
}

export function skillLabel(skillId = '') {
  const normalized = normalizeSkillId(skillId)
  return SKILL_LABELS[normalized] || normalized || '默认分析流程'
}

export function detectRequirementIntent(input = '') {
  const text = String(input || '')
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
  if (/(podcastor|播客|podcast)/i.test(text)) return 'podcastor-product'
  return 'requirement-analysis'
}

function skillMatchesIntent(skillId = '', intent = '') {
  if (skillId === AUTO_SKILL_ID) return false
  if (intent === 'auth-modal') return [
    SMART_RECOMMENDATION_SKILL_ID,
    'interaction-design-workflow',
    'product-interaction-design-review-skill'
  ].includes(skillId)
  if (intent === 'auth-page') return [
    'auth-page-generation',
    'interaction-design-workflow',
    'product-interaction-design-review-skill'
  ].includes(skillId)
  if (intent === 'page-generation') return ['interaction-design-workflow', 'product-interaction-design-review-skill'].includes(skillId)
  if (intent === 'journey-map') return skillId === 'user-journey-map-flow'
  if (intent === 'interaction-design') return ['interaction-design-workflow', 'product-interaction-design-review-skill'].includes(skillId)
  if (intent === 'podcastor-product') return skillId === 'podcastor-product-flow'
  return [
    'demand-four-step',
    'demand-card-flow',
    'eight-module-fuzzy-architecture',
    'five-stage-client-c-consensus-breakdown',
    'interaction-design-workflow',
    'product-interaction-design-review-skill'
  ].includes(skillId)
}

function routingReason({ requestedSkillId, resolvedSkillId, intent, matchedIntent }) {
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
  const hasExplicitSkill = typeof rawSkillId === 'string' && rawSkillId.trim() !== ''
  const requestedSkillId = normalizeSkillId(rawSkillId, AUTO_SKILL_ID)
  const hasSelectionMode = typeof payload.skillSelectionMode === 'string'
  const skillSelectionMode = payload.skillSelectionMode === 'auto' || requestedSkillId === AUTO_SKILL_ID ? 'auto' : 'manual'
  const input = [
    payload.input || '',
    ...(payload.documents || []).map((doc) => `${doc.name || ''}\n${doc.text || doc.content || doc.reason || ''}`)
  ].join('\n\n')
  const detectedIntent = detectRequirementIntent(input)
  const matchedIntent = skillMatchesIntent(requestedSkillId, detectedIntent)
  const shouldAutoResolve = skillSelectionMode === 'auto' || (!hasSelectionMode && !hasExplicitSkill)
  const resolvedSkillId = shouldAutoResolve
    ? SMART_RECOMMENDATION_SKILL_ID
    : requestedSkillId
  const displaySkillName = skillSelectionMode === 'auto' ? skillLabel(SMART_RECOMMENDATION_SKILL_ID) : skillLabel(resolvedSkillId)
  return {
    requestedSkillId,
    resolvedSkillId,
    skillSelectionMode,
    detectedIntent,
    requestedSkillName: skillLabel(requestedSkillId),
    resolvedSkillName: skillLabel(resolvedSkillId),
    displaySkillName,
    routingReason: routingReason({ requestedSkillId, resolvedSkillId, intent: detectedIntent, matchedIntent })
  }
}
