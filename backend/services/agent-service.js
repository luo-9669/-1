import { buildAgentContext } from './agent-context-builder.js'
import { createDeterministicAgentProvider, normalizeModelProviderError } from './llm-provider.js'
import { buildAgentProposal } from './agent-proposal-service.js'

function normalizeUsage(usage = {}) {
  return {
    inputTokens: usage.inputTokens || 0,
    outputTokens: usage.outputTokens || 0,
    totalTokens: usage.totalTokens || 0
  }
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
    recoveryActions: normalized.recoveryActions,
    provider: normalized.provider,
    model: normalized.model,
    apiSurface: normalized.apiSurface,
    ...(normalized.status ? { status: normalized.status } : {}),
    ...(normalized.timeoutMs ? { timeoutMs: normalized.timeoutMs } : {})
  }
}

export async function generateAgentReply(payload = {}, provider = createDeterministicAgentProvider(), options = {}) {
  const context = buildAgentContext(payload)
  let result
  try {
    result = await provider.generate(context)
  } catch (error) {
    if (options.fallback === 'none') throw error
    const fallbackProvider = createDeterministicAgentProvider()
    result = await fallbackProvider.generate(context)
    result.error = fallbackError(error, context, provider)
  }

  const content = result.content || '模型没有返回内容，请重试或切换模型。'
  const usage = normalizeUsage(result.usage)
  const providerName = result.provider || provider.name || 'unknown'
  const actionResult = result.actionResult || {
    type: context.actionType,
    nodeId: context.scopeId,
    nodeTitle: context.node.title
  }
  const error = result.error || null
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
  const proposal = buildAgentProposal({
    assistantMessage,
    actionResult,
    proposal: result.proposal || result.structuredProposal || result.raw?.proposal,
    raw: result.raw
  }, context)
  assistantMessage.meta = {
    ...assistantMessage.meta,
    proposalId: proposal.id,
    proposalSummary: {
      title: proposal.title,
      summary: proposal.summary,
      rationale: proposal.rationale || [],
      contextSources: proposal.contextSources || []
    }
  }
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
