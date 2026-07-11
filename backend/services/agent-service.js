import { buildAgentContext } from './agent-context-builder.js'
import { createDeterministicAgentProvider, normalizeModelProviderError } from './llm-provider.js'
import { buildAgentProposal } from './agent-proposal-service.js'
import { renderPageLayoutArtifactFromText } from './page-layout-artifact-renderer.js'

function normalizeUsage(usage = {}) {
  return {
    inputTokens: usage.inputTokens || 0,
    outputTokens: usage.outputTokens || 0,
    totalTokens: usage.totalTokens || 0
  }
}

function stringifyAgentDisplayValue(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value || '').trim()
  }
}

function extractAgentJsonObjectText(source = '') {
  const text = String(source || '').trim()
  const start = text.indexOf('{')
  if (start < 0) return ''
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = inString
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return ''
}

export function normalizeAgentReplyContent(content = '') {
  const source = stringifyAgentDisplayValue(content)
  if (!source) return source
  const jsonSource = /^[{\[]/.test(source) ? source : extractAgentJsonObjectText(source)
  if (!jsonSource) return source
  try {
    const parsed = JSON.parse(jsonSource)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return source
    const displayKeys = ['displayContent', 'reply', 'content', 'markdown', 'text', 'answer', 'message']
    for (const key of displayKeys) {
      const value = stringifyAgentDisplayValue(parsed[key])
      if (value) return value
    }
  } catch {
    return source
  }
  return source
}

function fallbackError(error, context = {}, provider = {}) {
  const normalized = normalizeModelProviderError(error, {
    provider: error?.provider || provider?.name || 'openai-compatible',
    model: error?.model || context.model,
    apiSurface: error?.apiSurface
  })
  return {
    code: normalized.code,
    message: normalized.message,
    recoveryActions: ['重试'],
    provider: normalized.provider,
    model: normalized.model,
    apiSurface: normalized.apiSurface,
    ...(normalized.status ? { status: normalized.status } : {}),
    ...(normalized.timeoutMs ? { timeoutMs: normalized.timeoutMs } : {})
  }
}

function providerUnavailableError(context = {}, provider = {}) {
  const error = new Error('Agent 对话必须调用大模型，当前没有可用的大模型 Provider。')
  error.code = 'LLM_PROVIDER_UNAVAILABLE'
  error.provider = provider?.name || 'deterministic'
  error.model = context.model
  error.recoveryActions = ['配置可用大模型', '切换模型 Provider 后重试']
  return error
}

function modelFailureContent(error = {}) {
  return '生成失败，请重试。'
}

function failedAgentReply(context = {}, provider = {}, error = {}) {
  const normalized = fallbackError(error, context, provider)
  const usage = normalizeUsage()
  const providerName = normalized.provider || provider?.name || 'unknown'
  const actionResult = {
    type: context.actionType,
    nodeId: context.scopeId,
    nodeTitle: context.node?.title || context.step?.title || '当前环节',
    model: context.model,
    referenceCount: context.references?.length || 0,
    generatedAt: context.now
  }
  const evidenceMeta = buildAgentEvidenceMeta(context, { actionResult, proposal: null, error: normalized })
  const assistantMessage = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: modelFailureContent(normalized),
    createdAt: context.now,
    trace: context.mode === 'dialogue-chat'
      ? []
      : buildAgentTraceItems(context, { actionResult, proposal: null, error: normalized, evidencePack: evidenceMeta.evidencePack }),
    meta: {
      provider: providerName,
      model: normalized.model || context.model,
      usage,
      actionType: actionResult.type || context.actionType,
      ...evidenceMeta,
      answerEvaluation: buildAgentAnswerEvaluation(modelFailureContent(normalized), context, {
        actionResult,
        proposal: null,
        error: normalized,
        evidencePack: evidenceMeta.evidencePack
      }),
      error: normalized,
      status: 'failed'
    }
  }
  return {
    assistantMessage,
    proposal: null,
    actionResult,
    usage,
    provider: providerName,
    model: assistantMessage.meta.model,
    error: normalized,
    raw: null
  }
}

async function deterministicFallbackAgentReply(context = {}, error = {}) {
  // 路由启用 deterministic fallback 时，展示 provider 归一到兜底结果，同时保留原模型错误便于排查。
  const normalized = fallbackError(error, context, {
    name: error?.provider || 'openai-compatible'
  })
  const fallbackProvider = createDeterministicAgentProvider()
  const fallbackResult = await fallbackProvider.generate(context)
  const content = renderPageLayoutArtifactFromText(normalizeAgentReplyContent(fallbackResult.content))
  const usage = normalizeUsage(fallbackResult.usage)
  const providerName = fallbackResult.provider || fallbackProvider.name
  const actionResult = fallbackResult.actionResult || {
    type: context.actionType,
    nodeId: context.scopeId,
    nodeTitle: context.node?.title || context.step?.title || '当前环节',
    model: context.model,
    referenceCount: context.references?.length || 0,
    generatedAt: context.now
  }
  const evidenceMeta = buildAgentEvidenceMeta(context, { actionResult, proposal: null, error: normalized })
  const assistantMessage = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content,
    createdAt: context.now,
    trace: context.mode === 'dialogue-chat'
      ? []
      : buildAgentTraceItems(context, { actionResult, proposal: null, error: normalized, evidencePack: evidenceMeta.evidencePack }),
    meta: {
      provider: providerName,
      model: fallbackResult.model || normalized.model || context.model,
      usage,
      actionType: actionResult.type || context.actionType,
      ...evidenceMeta,
      answerEvaluation: buildAgentAnswerEvaluation(content, context, {
        actionResult,
        proposal: null,
        error: normalized,
        evidencePack: evidenceMeta.evidencePack
      }),
      error: normalized,
      status: 'fallback'
    }
  }
  return {
    assistantMessage,
    proposal: null,
    actionResult,
    usage,
    provider: providerName,
    model: assistantMessage.meta.model,
    error: normalized,
    raw: fallbackResult.raw || null
  }
}

function compactTraceText(value = '', fallback = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text || fallback
}

function traceIntentSummary(context = {}) {
  const message = compactTraceText(context.message?.content, '当前输入')
  const nodeTitle = compactTraceText(context.node?.title || context.step?.title, '当前画布节点')
  if (/修正|重写|改|调整|失败|报错|继续流转/.test(message)) {
    return `已识别：用户希望处理「${nodeTitle}」的节点修正或失败恢复问题。`
  }
  if (/确认|入画布|保存/.test(message)) {
    return `已识别：用户希望确认「${nodeTitle}」的提案并写入画布。`
  }
  return `已识别：用户正在围绕「${nodeTitle}」补充需求或提问。`
}

function tracePlanSummary(context = {}) {
  const hasKnowledge = Array.isArray(context.retrievedKnowledge) && context.retrievedKnowledge.length > 0
  const nodeTitle = compactTraceText(context.node?.title || context.step?.title, '当前画布节点')
  return hasKnowledge
    ? `已规划：结合项目知识、当前画布和「${nodeTitle}」上下文生成可决策回复。`
    : `已规划：基于当前画布和「${nodeTitle}」上下文生成可决策回复。`
}

function traceAnswerSummary(actionResult = {}, proposal = null, error = null) {
  if (error) return '回答生成失败，请重试。'
  if (proposal?.id) return `已生成提案：${compactTraceText(proposal.title || proposal.summary, '可确认入画布的建议')}`
  return `已生成回复：${compactTraceText(actionResult.type, '可继续处理当前问题')}`
}

function traceEvidenceSummary(context = {}, proposal = null) {
  const knowledgeCount = Array.isArray(context.retrievedKnowledge) ? context.retrievedKnowledge.length : 0
  const sourceCount = Array.isArray(proposal?.contextSources) ? proposal.contextSources.length : 0
  if (knowledgeCount || sourceCount) {
    return `已整理依据：${knowledgeCount ? `${knowledgeCount} 条项目知识` : ''}${knowledgeCount && sourceCount ? '、' : ''}${sourceCount ? `${sourceCount} 条提案上下文` : ''}。`
  }
  return '暂无外部引用依据，已基于当前画布上下文回答。'
}

function compactAuditText(value = '', maxLength = 220) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function lookupStatus(count = 0, error = '') {
  if (error) return 'failed'
  return Number(count || 0) > 0 ? 'done' : 'skipped'
}

function lookupCount(value = null) {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return Object.keys(value).length
  return value ? 1 : 0
}

const AGENT_DATA_TOOL_REGISTRY = [
  {
    key: 'current-node',
    label: '当前节点',
    permission: 'run-context',
    source: 'workflow-run',
    inputSchema: { type: 'object', required: ['scopeId'], properties: { scopeId: 'string' } },
    outputSchema: { type: 'object', properties: { id: 'string', title: 'string', summary: 'string', content: 'array' } }
  },
  {
    key: 'canvas-context',
    label: '画布上下文',
    permission: 'run-context',
    source: 'workflow-run',
    inputSchema: { type: 'object', required: ['runId'], properties: { runId: 'string', stageId: 'string' } },
    outputSchema: { type: 'array', items: 'canvas-node' }
  },
  {
    key: 'uploaded-references',
    label: '上传资料',
    permission: 'request-scoped',
    source: 'request-payload',
    inputSchema: { type: 'object', required: ['stepId'], properties: { stepId: 'string' } },
    outputSchema: { type: 'array', items: 'reference-document' }
  },
  {
    key: 'retrieved-knowledge',
    label: '项目知识',
    permission: 'project-scope-only',
    source: 'project-knowledge',
    inputSchema: { type: 'object', required: ['projectId', 'demandScope'], properties: { projectId: 'string', demandScope: 'project' } },
    outputSchema: { type: 'array', items: 'knowledge-chunk' }
  },
  {
    key: 'conversation-history',
    label: '最近对话',
    permission: 'run-context',
    source: 'agent-session',
    inputSchema: { type: 'object', required: ['scopeId'], properties: { scopeId: 'string' } },
    outputSchema: { type: 'array', items: 'chat-message' }
  },
  {
    key: 'pending-proposals',
    label: '已有提案',
    permission: 'run-context',
    source: 'agent-proposals',
    inputSchema: { type: 'object', required: ['scopeId'], properties: { scopeId: 'string' } },
    outputSchema: { type: 'array', items: 'agent-proposal' }
  }
]

export function buildAgentDataToolRegistry() {
  return AGENT_DATA_TOOL_REGISTRY.map((tool) => ({
    ...tool,
    inputSchema: { ...(tool.inputSchema || {}) },
    outputSchema: { ...(tool.outputSchema || {}) }
  }))
}

function dataToolByKey(key = '') {
  return AGENT_DATA_TOOL_REGISTRY.find((tool) => tool.key === key) || {
    key,
    label: key || '数据工具',
    permission: 'run-context',
    source: 'unknown',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'unknown' }
  }
}

function dataLookupRecord(key = '', status = 'skipped', count = 0, summary = '', input = {}) {
  const tool = dataToolByKey(key)
  return {
    key,
    toolKey: tool.key,
    label: tool.label,
    status,
    count,
    summary,
    permission: tool.permission,
    source: tool.source,
    inputSchema: { ...(tool.inputSchema || {}) },
    outputSchema: { ...(tool.outputSchema || {}) },
    input
  }
}

export function buildAgentContextSummary(context = {}) {
  const totalFlow = context.totalFlow || {}
  return {
    mode: context.mode || 'workflow-agent',
    actionType: context.actionType || '',
    scopeId: context.scopeId || context.node?.id || '',
    nodeTitle: context.node?.title || context.currentNode?.title || context.step?.title || '',
    currentStage: totalFlow.currentStage?.name || totalFlow.currentStage?.id || '',
    activeSlice: totalFlow.activeSlice?.title || totalFlow.activeSlice?.id || '',
    referenceCount: Array.isArray(context.references) ? context.references.length : 0,
    retrievedKnowledgeCount: Array.isArray(context.retrievedKnowledge) ? context.retrievedKnowledge.length : 0,
    historyCount: Array.isArray(context.history) ? context.history.length : 0,
    generatedAt: context.now || ''
  }
}

export function buildAgentDataLookups(context = {}) {
  const node = context.currentNode || context.node || null
  const canvasNodes = context.fullCanvas?.nodes || context.totalFlow?.stageCanvas?.nodes || []
  const references = Array.isArray(context.references) ? context.references : []
  const retrievedKnowledge = Array.isArray(context.retrievedKnowledge) ? context.retrievedKnowledge : []
  const history = Array.isArray(context.history) ? context.history : []
  const pendingProposals = Array.isArray(context.pendingProposals) ? context.pendingProposals : []
  const knowledgeError = compactAuditText(context.knowledgeRetrievalError || '', 220)
  return [
    dataLookupRecord('current-node', lookupStatus(node?.id || node?.title ? 1 : 0), node?.id || node?.title ? 1 : 0, compactAuditText(node?.title || node?.summary || '当前节点上下文'), {
      scopeId: context.scopeId || node?.id || ''
    }),
    dataLookupRecord('canvas-context', lookupStatus(lookupCount(canvasNodes)), lookupCount(canvasNodes), canvasNodes.length ? `已读取 ${canvasNodes.length} 个画布节点` : '暂无可用画布节点', {
      runId: context.run?.id || '',
      stageId: context.totalFlow?.currentStage?.id || ''
    }),
    dataLookupRecord('uploaded-references', lookupStatus(references.length), references.length, references.length ? `已读取 ${references.length} 份上传资料` : '本轮未上传资料', {
      stepId: context.scopeId || ''
    }),
    dataLookupRecord('retrieved-knowledge', lookupStatus(retrievedKnowledge.length, knowledgeError), retrievedKnowledge.length, knowledgeError || (retrievedKnowledge.length ? `已召回 ${retrievedKnowledge.length} 条项目知识` : '未命中项目知识'), {
      projectId: context.run?.projectId || '',
      demandScope: context.run?.demandScope || ''
    }),
    dataLookupRecord('conversation-history', lookupStatus(history.length), history.length, history.length ? `已读取 ${history.length} 条最近对话` : '暂无最近对话', {
      scopeId: context.scopeId || ''
    }),
    dataLookupRecord('pending-proposals', lookupStatus(pendingProposals.length), pendingProposals.length, pendingProposals.length ? `已读取 ${pendingProposals.length} 个已有提案` : '暂无待处理提案', {
      scopeId: context.scopeId || ''
    })
  ]
}

function evidenceSource(type = '', title = '', snippet = '', extra = {}) {
  return {
    type,
    title: compactAuditText(title || type || '证据来源', 120),
    snippet: compactAuditText(snippet || '', 320),
    ...extra
  }
}

export function buildAgentEvidencePack(context = {}, state = {}) {
  const node = context.currentNode || context.node || {}
  const sources = []
  const facts = []
  const assumptions = []
  const uncertainties = []

  if (node?.title || node?.summary || (Array.isArray(node?.content) && node.content.length)) {
    sources.push(evidenceSource('current-node', node.title || node.id || '当前节点', node.summary || node.content?.join('；') || ''))
    facts.push(compactAuditText(`当前节点「${node.title || node.id || '未命名节点'}」：${node.summary || node.content?.join('；') || '暂无摘要'}`, 260))
  }

  const references = Array.isArray(context.references) ? context.references : []
  for (const reference of references.slice(0, 4)) {
    sources.push(evidenceSource('uploaded-reference', reference.name || reference.id || '上传资料', reference.text || reference.content || reference.kind || '', {
      id: reference.id || '',
      kind: reference.kind || reference.type || 'document'
    }))
    facts.push(compactAuditText(`上传资料「${reference.name || reference.id || '未命名资料'}」：${reference.text || reference.content || reference.kind || ''}`, 260))
  }

  const retrievedKnowledge = Array.isArray(context.retrievedKnowledge) ? context.retrievedKnowledge : []
  for (const item of retrievedKnowledge.slice(0, 4)) {
    sources.push(evidenceSource('retrieved-knowledge', item.title || item.sourceTitle || '项目知识', item.snippet || item.content || item.text || '', {
      projectId: item.projectId || '',
      projectName: item.projectName || '',
      sourceTitle: item.sourceTitle || '',
      sourceUrl: item.sourceUrl || '',
      matchReason: item.matchReason || item.verification?.reason || ''
    }))
    facts.push(compactAuditText(`项目知识「${item.title || item.sourceTitle || '未命名知识'}」：${item.snippet || item.content || item.text || ''}`, 260))
  }

  const proposalSources = Array.isArray(state.proposal?.contextSources) ? state.proposal.contextSources : []
  for (const source of proposalSources.slice(0, 3)) {
    const summary = compactAuditText(source.snippet || source.content || source.summary || '', 260)
    if (summary) facts.push(`提案依据「${compactAuditText(source.title || source.type || '上下文', 80)}」：${summary}`)
  }

  if (context.knowledgeRetrievalError) {
    uncertainties.push(`知识检索失败：${compactAuditText(context.knowledgeRetrievalError, 180)}`)
  }
  if (!retrievedKnowledge.length && !references.length) {
    assumptions.push('未命中外部资料时，回答主要基于当前画布、原始需求和最近对话。')
  }
  if (!facts.length) {
    uncertainties.push('当前缺少可引用的画布、资料或知识证据。')
  }

  const confidence = retrievedKnowledge.length && references.length
    ? 'high'
    : sources.length
    ? 'medium'
    : 'low'

  return {
    sources,
    facts: facts.filter(Boolean).slice(0, 10),
    assumptions: assumptions.filter(Boolean).slice(0, 6),
    uncertainties: uncertainties.filter(Boolean).slice(0, 6),
    confidence
  }
}

export function buildAgentEvidenceMeta(context = {}, state = {}) {
  return {
    contextSummary: buildAgentContextSummary(context),
    availableDataTools: buildAgentDataToolRegistry(),
    dataLookups: buildAgentDataLookups(context),
    evidencePack: buildAgentEvidencePack(context, state)
  }
}

function answerEvaluationCheck(key = '', label = '', status = 'passed', summary = '') {
  return { key, label, status, summary }
}

function answerEvaluationAction(key = '', label = '', action = 'quick-reply', reason = '') {
  return { key, label, action, reason }
}

function answerMentionsUncertainty(content = '') {
  return /假设|待确认|资料不足|需要确认|不确定|缺少|暂无|无法确认|证据不足|依据不足/.test(String(content || ''))
}

export function buildAgentAnswerEvaluation(content = '', context = {}, state = {}) {
  const evidencePack = state.evidencePack || buildAgentEvidencePack(context, state)
  const facts = Array.isArray(evidencePack.facts) ? evidencePack.facts : []
  const sources = Array.isArray(evidencePack.sources) ? evidencePack.sources : []
  const uncertainties = Array.isArray(evidencePack.uncertainties) ? evidencePack.uncertainties : []
  const hasExternalEvidence = (Array.isArray(context.references) && context.references.length > 0) ||
    (Array.isArray(context.retrievedKnowledge) && context.retrievedKnowledge.length > 0)
  const onlyThinCurrentContext = !hasExternalEvidence && sources.length <= 1 &&
    facts.length <= 1 && /暂无摘要|空节点|未命名节点/.test(facts.join('\n'))
  const text = String(content || '').trim()
  const checks = []
  const warnings = []
  const recommendedActions = []
  let score = 100

  if (state.error) {
    checks.push(answerEvaluationCheck('evidence-grounded', '证据支撑', 'failed', '回答生成失败，无法完成证据校验。'))
    checks.push(answerEvaluationCheck('answered-question', '回应问题', 'failed', '模型未产出可用回答。'))
    checks.push(answerEvaluationCheck('uncertainty-handled', '不确定性处理', 'warning', '失败状态需要用户重试或切换模型。'))
    return {
      status: 'needs-review',
      score: 0,
      checks,
      warnings: ['回答生成失败，未通过自动评估。'],
      recommendedActions: [
        answerEvaluationAction('regenerate-answer', '重新生成', 'retry', '回答生成失败。')
      ]
    }
  }

  if (sources.length || facts.length) {
    const status = evidencePack.confidence === 'low' || onlyThinCurrentContext ? 'warning' : 'passed'
    checks.push(answerEvaluationCheck(
      'evidence-grounded',
      '证据支撑',
      status,
      `已关联 ${sources.length} 个来源、${facts.length} 条事实，置信度 ${evidencePack.confidence || 'medium'}。`
    ))
    if (status === 'warning') {
      score -= 25
      warnings.push('当前证据置信度较低，建议补充依据后再确认结论。')
      recommendedActions.push(answerEvaluationAction('provide-evidence', '补充依据', 'quick-reply', '当前证据置信度较低。'))
    }
  } else {
    checks.push(answerEvaluationCheck('evidence-grounded', '证据支撑', 'warning', '未找到可引用的证据来源或事实。'))
    score -= 25
    warnings.push('当前回答缺少明确证据或依据，需要复核。')
    recommendedActions.push(answerEvaluationAction('provide-evidence', '补充依据', 'quick-reply', '当前回答缺少明确证据或依据。'))
  }

  if (text && !/^生成失败/.test(text)) {
    checks.push(answerEvaluationCheck('answered-question', '回应问题', 'passed', '回答包含可展示正文。'))
  } else {
    checks.push(answerEvaluationCheck('answered-question', '回应问题', 'failed', '回答正文为空或不可用。'))
    score -= 40
    warnings.push('回答正文不可用，需要重新生成。')
    recommendedActions.push(answerEvaluationAction('regenerate-answer', '重新生成', 'retry', '回答正文不可用。'))
  }

  if (!uncertainties.length || answerMentionsUncertainty(text)) {
    checks.push(answerEvaluationCheck(
      'uncertainty-handled',
      '不确定性处理',
      'passed',
      uncertainties.length ? '回答已提示资料不足或待确认边界。' : '当前证据包没有额外待确认项。'
    ))
  } else {
    checks.push(answerEvaluationCheck('uncertainty-handled', '不确定性处理', 'warning', '证据包存在待确认项，但回答未明确提示。'))
    score -= 25
    warnings.push('证据包存在待确认项，回答中需要标注假设或待确认。')
    recommendedActions.push(answerEvaluationAction('confirm-uncertainty', '确认待确认项', 'quick-reply', '证据包存在待确认项。'))
  }

  const boundedScore = Math.max(0, Math.min(100, score))
  return {
    status: boundedScore >= 80 ? 'passed' : 'needs-review',
    score: boundedScore,
    checks,
    warnings,
    recommendedActions: recommendedActions.filter((item, index, list) =>
      item.label && list.findIndex((candidate) => candidate.key === item.key) === index
    )
  }
}

function evidenceGroundingPrompt(evidenceMeta = {}) {
  const evidencePack = evidenceMeta.evidencePack || {}
  return [
    '证据约束：回答前必须先阅读“本轮证据包”。',
    '只能基于证据包、当前上下文和用户明确输入给出结论；证据不足时，把内容写为假设或待确认点。',
    'proposal.contextSources 必须优先引用证据包 sources；不要编造证据包之外的数据、项目知识、接口结果或用户没有提供的事实。',
    `可用数据工具：${JSON.stringify(evidenceMeta.availableDataTools || [], null, 2)}`,
    `本轮证据包：${JSON.stringify({
      contextSummary: evidenceMeta.contextSummary || {},
      dataLookups: evidenceMeta.dataLookups || [],
      evidencePack
    }, null, 2)}`
  ].join('\n')
}

export function withAgentEvidenceGrounding(context = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return context
  if (context.evidencePack && context.contextSummary && context.dataLookups) return context
  const evidenceMeta = buildAgentEvidenceMeta(context)
  const groundingPrompt = evidenceGroundingPrompt(evidenceMeta)
  return {
    ...context,
    ...evidenceMeta,
    systemPrompt: [context.systemPrompt, '证据约束：只能基于证据包和已给上下文回答；没有依据的内容必须标注为假设或待确认。']
      .filter(Boolean)
      .join('\n'),
    userPrompt: [context.userPrompt, groundingPrompt]
      .filter(Boolean)
      .join('\n\n')
  }
}

function traceEvidencePackSummary(evidencePack = null) {
  if (!evidencePack) return ''
  const sourceCount = Array.isArray(evidencePack.sources) ? evidencePack.sources.length : 0
  const factCount = Array.isArray(evidencePack.facts) ? evidencePack.facts.length : 0
  if (!sourceCount && !factCount) return ''
  return `已形成证据包：${sourceCount} 个来源、${factCount} 条事实，置信度 ${evidencePack.confidence || 'medium'}。`
}

function withAgentProviderTimeout(task, timeoutMs = 0, provider = {}, context = {}) {
  const delay = timeoutMs === 0 || context.timeoutMs === 0
    ? 0
    : Number(timeoutMs || provider?.timeoutMs || context.timeoutMs || 0)
  if (!delay || delay < 1) return task
  let timer = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('模型请求超时，请稍后重试')
      error.code = 'LLM_PROVIDER_TIMEOUT'
      error.provider = provider?.name || 'unknown'
      error.model = context.model
      error.timeoutMs = delay
      error.recoveryActions = ['重试', '调大 timeout', '切换模型']
      reject(error)
    }, delay)
  })
  return Promise.race([task, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

function agentPageLayoutArtifactMeta(context = {}) {
  const artifact = context.node?.pageLayoutArtifact
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) return null
  const asciiWireframe = String(artifact.asciiWireframe || artifact.rawText || '').trim()
  const modelDecision = String(artifact.modelDecision || '').trim()
  if (!asciiWireframe && !modelDecision) return null
  return {
    title: artifact.title || '页面骨架',
    ...(artifact.version ? { version: artifact.version } : {}),
    ...(modelDecision ? { modelDecision } : {}),
    ...(asciiWireframe ? { asciiWireframe } : {}),
    ...(artifact.interactionDetails ? { interactionDetails: artifact.interactionDetails } : {})
  }
}

export function buildAgentTraceItems(context = {}, state = {}) {
  const error = state.error || null
  const evidencePack = state.evidencePack || buildAgentEvidencePack(context, state)
  const evidenceStatus = (Array.isArray(evidencePack.sources) && evidencePack.sources.length) ||
    (Array.isArray(evidencePack.facts) && evidencePack.facts.length)
    ? 'done'
    : 'skipped'
  return [
    { key: 'intent', label: '需求识别', status: 'done', summary: traceIntentSummary(context) },
    { key: 'plan', label: '任务规划', status: 'done', summary: tracePlanSummary(context) },
    { key: 'answer', label: '回答/提案', status: error ? 'failed' : 'done', summary: traceAnswerSummary(state.actionResult, state.proposal, error) },
    { key: 'evidence', label: '引用依据', status: error ? 'skipped' : evidenceStatus, summary: error ? '生成失败，请重试。' : (traceEvidencePackSummary(evidencePack) || traceEvidenceSummary(context, state.proposal)) }
  ]
}

export async function generateAgentReply(payload = {}, provider = createDeterministicAgentProvider(), options = {}) {
  const context = withAgentEvidenceGrounding(buildAgentContext(payload))
  context.timeoutMs = options.timeoutMs
  let result
  try {
    if (!provider || provider.name === 'deterministic') {
      throw providerUnavailableError(context, provider)
    }
    result = await withAgentProviderTimeout(provider.generate(context), options.timeoutMs, provider, context)
  } catch (error) {
    if (options.fallback === 'deterministic') {
      return deterministicFallbackAgentReply(context, error)
    }
    return failedAgentReply(context, provider, error)
  }

  const content = renderPageLayoutArtifactFromText(normalizeAgentReplyContent(result.content))
  if (!content) return failedAgentReply(context, provider, new Error('模型没有返回内容'))
  const usage = normalizeUsage(result.usage)
  const providerName = result.provider || provider.name || 'unknown'
  const actionResult = result.actionResult || {
    type: context.actionType,
    nodeId: context.scopeId,
    nodeTitle: context.node.title
  }
  const error = result.error || null
  const evidenceMeta = buildAgentEvidenceMeta(context, { actionResult, proposal: null, error })
  const pageLayoutArtifact = agentPageLayoutArtifactMeta(context)
  const retrievedKnowledge = (context.retrievedKnowledge || []).slice(0, 4).map((item) => ({
    title: item.title,
    snippet: item.snippet,
    evidence: item.evidence,
    projectId: item.projectId,
    projectName: item.projectName,
    sourceTitle: item.sourceTitle,
    materialType: item.materialType,
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl,
    roleScopes: item.roleScopes,
    matchReason: item.matchReason || item.verification?.reason || '与当前问题关键词和角色范围匹配'
  }))
  const meta = {
    provider: providerName,
    model: result.model || context.model,
    usage,
    actionType: actionResult.type || context.actionType,
    ...evidenceMeta,
    ...(pageLayoutArtifact ? { pageLayoutArtifact } : {}),
    answerEvaluation: buildAgentAnswerEvaluation(content, context, {
      actionResult,
      proposal: null,
      error,
      evidencePack: evidenceMeta.evidencePack
    }),
    error
  }
  if (retrievedKnowledge.length) meta.retrievedKnowledge = retrievedKnowledge
  if (context.knowledgeRetrievalError) meta.knowledgeRetrievalError = context.knowledgeRetrievalError
  const assistantMessage = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content,
    createdAt: context.now,
    meta
  }
  if (context.mode === 'dialogue-chat') {
    assistantMessage.trace = []
    return {
      assistantMessage,
      proposal: null,
      actionResult,
      usage,
      provider: providerName,
      model: meta.model,
      error,
      raw: result.raw || null
    }
  }
  const explicitProposal = result.proposal || result.structuredProposal || result.raw?.proposal
  const shouldBuildWriteableProposal = Boolean(explicitProposal) ||
    ['canvas-action-advice', 'reanalysis'].includes(context.actionType)
  if (!shouldBuildWriteableProposal) {
    assistantMessage.trace = buildAgentTraceItems(context, {
      actionResult,
      proposal: null,
      error,
      evidencePack: assistantMessage.meta.evidencePack
    })
    return {
      assistantMessage,
      proposal: null,
      actionResult,
      usage,
      provider: providerName,
      model: meta.model,
      error,
      raw: result.raw || null
    }
  }
  const proposal = buildAgentProposal({
    assistantMessage,
    actionResult,
    proposal: explicitProposal,
    raw: result.raw
  }, context)
  assistantMessage.meta = {
    ...assistantMessage.meta,
    evidencePack: buildAgentEvidencePack(context, {
      actionResult,
      proposal,
      error
    }),
    proposalId: proposal.id,
    proposalSummary: {
      title: proposal.title,
      summary: proposal.summary,
      rationale: proposal.rationale || [],
      contextSources: proposal.contextSources || []
    }
  }
  assistantMessage.meta.answerEvaluation = buildAgentAnswerEvaluation(assistantMessage.content, context, {
    actionResult,
    proposal,
    error,
    evidencePack: assistantMessage.meta.evidencePack
  })
  assistantMessage.trace = buildAgentTraceItems(context, {
    actionResult,
    proposal,
    error,
    evidencePack: assistantMessage.meta.evidencePack
  })
  return {
    assistantMessage,
    proposal,
    actionResult,
    usage,
    provider: providerName,
    model: meta.model,
    error,
    raw: result.raw || null
  }
}
