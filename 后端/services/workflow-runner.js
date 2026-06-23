import {
  acceptCurrentStep,
  completeCurrentStep,
  createWorkflowRun,
  generateStepDraft,
  getBuiltinWorkflows,
  getCurrentStep,
  regenerateStepDraft
} from '../../src/services/workflows.js'
import { buildWorkflowAgentQuickReplies } from '../../src/services/workflowWorkbench.js'
import { generateAgentReply } from './agent-service.js'
import { buildAgentContext } from './agent-context-builder.js'
import { buildActionResult, normalizeAgentModelText } from './llm-provider.js'
import { buildAgentProposal, buildCanvasVersion, confirmAgentProposalOnRun } from './agent-proposal-service.js'

export function createWorkflowRunnerStore(seed = {}) {
  return {
    runs: [...(seed.runs || [])],
    activeAgentRequests: new Map()
  }
}

function findWorkflow(workflowId = '') {
  return getBuiltinWorkflows().find((workflow) => workflow.id === workflowId) || getBuiltinWorkflows()[0]
}

function findRun(store, runId = '') {
  const run = store.runs.find((item) => item.id === runId)
  if (!run) throw new Error(`未找到工作流运行：${runId}`)
  return run
}

function replaceRun(store, run) {
  const index = store.runs.findIndex((item) => item.id === run.id)
  if (index >= 0) store.runs.splice(index, 1, run)
  else store.runs.unshift(run)
  return run
}

function activeAgentRequestKey({ runId = '', stepId = '', clientMessageId = '' } = {}) {
  return [runId, stepId, clientMessageId].filter(Boolean).join(':')
}

function normalizeAgentQuickReplies(replies = []) {
  const seen = new Set()
  return (Array.isArray(replies) ? replies : [])
    .map((reply) => String(reply || '').trim())
    .filter((reply) => {
      if (!reply || seen.has(reply)) return false
      seen.add(reply)
      return true
    })
    .slice(0, 6)
}

function isStructuredAgentStreamContent(text = '') {
  const value = String(text || '').trim()
  if (!value) return false
  if (/^```(?:json)?\s*\{/i.test(value)) return true
  if (/^[{\[]/.test(value) && /"(content|proposal|structuredProposal|agentProposal|writeableContent|downstreamImpact|nodeId)"\s*:/.test(value)) return true
  return /"(proposal|structuredProposal|agentProposal|writeableContent|downstreamImpact)"\s*:/.test(value)
}

export function createRun(store, payload = {}) {
  const workflow = findWorkflow(payload.workflowId)
  const run = {
    ...createWorkflowRun(workflow, payload.input || ''),
    projectId: payload.projectId || '',
    model: payload.model || 'gpt-5.5',
    agentSessions: {},
    referenceFiles: {},
    demoArtifacts: {}
  }
  store.runs.unshift(run)
  return run
}

function normalizeRunMessageInput(store, payload = {}) {
  const run = findRun(store, payload.runId)
  const step = getCurrentStep(run)
  const stepId = payload.stepId || step.id
  const now = new Date().toISOString()
  const references = Array.isArray(payload.references) ? payload.references : ((run.referenceFiles || {})[stepId] || [])
  const messageMeta = {
    ...(payload.message?.meta || {})
  }
  const clientMessageId = payload.clientMessageId || payload.message?.clientMessageId || payload.message?.meta?.clientMessageId || ''
  const retryOfMessageId = payload.retryOfMessageId || payload.message?.retryOfMessageId || payload.message?.meta?.retryOfMessageId || ''
  const editOfMessageId = payload.editOfMessageId || payload.message?.editOfMessageId || payload.message?.meta?.editOfMessageId || ''
  const messageAction = payload.action || payload.message?.action || payload.message?.meta?.action || ''
  if (clientMessageId) messageMeta.clientMessageId = clientMessageId
  if (retryOfMessageId) messageMeta.retryOfMessageId = retryOfMessageId
  if (editOfMessageId) messageMeta.editOfMessageId = editOfMessageId
  if (messageAction) messageMeta.action = messageAction
  const userMessage = {
    id: payload.message?.id || `message-${Date.now()}`,
    role: payload.message?.role || 'user',
    content: payload.message?.content || '',
    createdAt: now,
    ...(Object.keys(messageMeta).length ? { meta: messageMeta } : {})
  }
  const model = payload.model || run.model || 'gpt-5.5'
  return {
    run,
    step,
    stepId,
    now,
    references,
    userMessage,
    model,
    clientMessageId,
    retryOfMessageId,
    editOfMessageId,
    messageAction
  }
}

function persistRunAgentReply(store, input = {}, feedback = {}) {
  const proposal = feedback.proposal
    ? {
        ...feedback.proposal,
        canvasVersion: buildCanvasVersion(input.run?.documentAnalysis?.canvas || {})
      }
    : null
  const assistantMessage = {
    ...feedback.assistantMessage,
    meta: {
      ...(feedback.assistantMessage.meta || {}),
      ...(proposal?.id ? { proposalId: proposal.id } : {}),
      ...(proposal?.id ? {
        proposalSummary: {
          title: proposal.title,
          summary: proposal.summary,
          actionIntent: proposal.actionIntent || '',
          writeableContent: proposal.writeableContent || null,
          downstreamImpact: Array.isArray(proposal.downstreamImpact) ? proposal.downstreamImpact : [],
          rationale: proposal.rationale || [],
          contextSources: proposal.contextSources || []
        }
      } : {}),
      ...(input.clientMessageId ? { clientMessageId: input.clientMessageId } : {}),
      ...(input.retryOfMessageId ? { retryOfMessageId: input.retryOfMessageId } : {}),
      ...(input.editOfMessageId ? { editOfMessageId: input.editOfMessageId } : {}),
      ...(input.messageAction ? { action: input.messageAction } : {})
    }
  }
  const activeNode = input.payload?.context?.activeNode || null
  const proposalNodeId = proposal?.nodeId || input.stepId
  const existingNodeProposals = (((input.run.agentProposals || {})[proposalNodeId]) || [])
  const supersededProposalIds = proposal?.id
    ? existingNodeProposals
        .filter((item) => item?.status === 'pending')
        .map((item) => item.id)
        .filter(Boolean)
    : []
  const nextNodeProposals = proposal?.id
    ? [
        ...existingNodeProposals.map((item) => item?.status === 'pending'
          ? {
              ...item,
              status: 'superseded',
              supersededByProposalId: proposal.id,
              supersededAt: input.now
            }
          : item),
        proposal
      ]
    : existingNodeProposals
  const existingMessages = ((input.run.agentSessions || {})[input.stepId] || [])
  const nextExistingMessages = supersededProposalIds.length
    ? existingMessages.map((message) => supersededProposalIds.includes(message?.meta?.proposalId)
      ? {
          ...message,
          meta: {
            ...(message.meta || {}),
            proposalStatus: 'superseded',
            supersededByProposalId: proposal.id,
            supersededAt: input.now,
            proposalSummary: message.meta?.proposalSummary
              ? {
                  ...message.meta.proposalSummary,
                  status: 'superseded'
                }
              : message.meta?.proposalSummary
          }
        }
      : message)
    : existingMessages
  const quickReplies = normalizeAgentQuickReplies(buildWorkflowAgentQuickReplies(input.run, {
    current: input.step,
    activeNode,
    scopeId: input.stepId,
    draft: input.run.stepDraftOutputs?.[input.step.id] || '',
    output: input.run.stepOutputs?.[input.step.id] || '',
    actionResult: feedback.actionResult,
    assistantMessage,
    error: feedback.error
  }))
  const next = {
    ...input.run,
    model: input.model,
    agentProposals: proposal?.id
      ? {
          ...(input.run.agentProposals || {}),
          [proposalNodeId]: nextNodeProposals
        }
      : (input.run.agentProposals || {}),
    agentSessions: {
      ...(input.run.agentSessions || {}),
      [input.stepId]: [
        ...nextExistingMessages,
        input.userMessage,
        assistantMessage
      ]
    },
    referenceFiles: {
      ...(input.run.referenceFiles || {}),
      [input.stepId]: input.references
    },
    agentQuickReplies: {
      ...(input.run.agentQuickReplies || {}),
      [input.stepId]: quickReplies
    },
    updatedAt: input.now
  }
  replaceRun(store, next)
  return {
    run: next,
    assistantMessage,
    actionResult: feedback.actionResult,
    usage: feedback.usage,
    provider: feedback.provider,
    model: feedback.model,
    proposal,
    quickReplies,
    error: feedback.error
  }
}

function retrievedKnowledgeMeta(context = {}) {
  return (context.retrievedKnowledge || []).slice(0, 4).map((item) => ({
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
}

export async function appendRunMessage(store, payload = {}, options = {}) {
  const input = {
    ...normalizeRunMessageInput(store, payload),
    payload
  }
  const feedback = await generateAgentReply({
    run: input.run,
    step: input.step,
    scopeId: input.stepId,
    model: input.model,
    message: input.userMessage,
    action: input.messageAction,
    references: input.references,
    retrievedKnowledge: payload.retrievedKnowledge || payload.context?.retrievedKnowledge || [],
    context: payload.context || {},
    now: input.now
  }, options.agentProvider, { fallback: options.fallback })
  return persistRunAgentReply(store, input, feedback)
}

export async function appendRunMessageStream(store, payload = {}, options = {}, onEvent) {
  const provider = options.agentProvider
  if (!provider || typeof provider.stream !== 'function') {
    return appendRunMessage(store, payload, options)
  }
  const input = {
    ...normalizeRunMessageInput(store, payload),
    payload
  }
  const context = buildAgentContext({
    run: input.run,
    step: input.step,
    scopeId: input.stepId,
    model: input.model,
    message: input.userMessage,
    action: input.messageAction,
    references: input.references,
    retrievedKnowledge: payload.retrievedKnowledge || payload.context?.retrievedKnowledge || [],
    context: payload.context || {},
    now: input.now
  })
  let content = ''
  let visibleContent = ''
  let structuredDeltaSent = false
  let finalChunk = {}
  const controller = new AbortController()
  const requestKey = activeAgentRequestKey({
    runId: payload.runId,
    stepId: input.stepId,
    clientMessageId: input.clientMessageId
  })
  if (requestKey) store.activeAgentRequests?.set(requestKey, controller)
  try {
    for await (const chunk of provider.stream(context, { signal: controller.signal })) {
      if (controller.signal.aborted) {
        break
      }
      if (chunk?.type === 'delta') {
        const delta = chunk.content || chunk.text || ''
        if (!delta) continue
        content += delta
        if (isStructuredAgentStreamContent(content)) {
          if (!structuredDeltaSent) {
            structuredDeltaSent = true
            onEvent?.('delta', { content: '正在整理结构化建议...' })
          }
        } else {
          visibleContent += delta
          onEvent?.('delta', { content: delta })
        }
      } else if (chunk?.type === 'final') {
        finalChunk = chunk
      }
    }
  } finally {
    if (requestKey) store.activeAgentRequests?.delete(requestKey)
  }
  if (controller.signal.aborted) {
    return {
      run: input.run,
      cancelled: true,
      aborted: true,
      clientMessageId: input.clientMessageId,
      stepId: input.stepId
    }
  }
  const usage = finalChunk.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  const retrievedKnowledge = retrievedKnowledgeMeta(context)
  const meta = {
    provider: finalChunk.provider || provider.name || 'stream-provider',
    model: finalChunk.model || context.model,
    usage,
    actionType: context.actionType,
    error: finalChunk.error || null
  }
  if (retrievedKnowledge.length) meta.retrievedKnowledge = retrievedKnowledge
  if (context.knowledgeRetrievalError) meta.knowledgeRetrievalError = context.knowledgeRetrievalError
  const normalizedStream = normalizeAgentModelText(content)
  const assistantContent = finalChunk.content || normalizedStream.content || visibleContent || content || '模型没有返回内容，请重试或切换模型。'
  const assistantMessage = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: assistantContent,
    createdAt: context.now,
    meta
  }
  const actionResult = finalChunk.actionResult || buildActionResult(context)
  const proposal = buildAgentProposal({
    assistantMessage,
    actionResult,
    proposal: finalChunk.proposal || finalChunk.structuredProposal || finalChunk.raw?.proposal || normalizedStream.proposal,
    raw: finalChunk.raw || (normalizedStream.proposal ? { streamedContent: content } : null)
  }, context)
  return persistRunAgentReply(store, input, {
    assistantMessage,
    actionResult,
    usage,
    provider: finalChunk.provider || provider.name || 'stream-provider',
    model: finalChunk.model || context.model,
    proposal,
    error: finalChunk.error || null
  })
}

function findAgentProposal(run = {}, proposalId = '', nodeId = '') {
  const byNode = run.agentProposals || {}
  const nodeIds = nodeId ? [nodeId] : Object.keys(byNode)
  for (const currentNodeId of nodeIds) {
    const proposals = Array.isArray(byNode[currentNodeId]) ? byNode[currentNodeId] : []
    const proposal = proposals.find((item) => item.id === proposalId)
    if (proposal) return proposal
  }
  for (const proposals of Object.values(byNode)) {
    if (!Array.isArray(proposals)) continue
    const proposal = proposals.find((item) => item.id === proposalId)
    if (proposal) return proposal
  }
  return null
}

function buildConfirmAgentContext(run = {}, proposal = {}, payload = {}, model = '') {
  const analysis = run.documentAnalysis || {}
  const canvas = analysis.canvas || {}
  const nodes = (Array.isArray(canvas.nodes) ? canvas.nodes : [])
    .filter((node) => node && typeof node === 'object' && !Array.isArray(node))
  const currentIndex = Math.max(0, nodes.findIndex((node) => node.id === (payload.nodeId || proposal.nodeId)))
  const currentNode = nodes[currentIndex] || nodes[0] || {}
  const upstreamNodes = currentIndex > 0 ? nodes.slice(0, currentIndex) : []
  const downstreamNodes = currentIndex >= 0 ? nodes.slice(currentIndex + 1) : []
  const now = new Date().toISOString()
  const proposalText = JSON.stringify(proposal, null, 2)
  const writeableContentText = JSON.stringify(proposal.writeableContent || {}, null, 2)
  const downstreamImpactText = JSON.stringify(proposal.downstreamImpact || [], null, 2)
  const canvasText = JSON.stringify({ nodes, edges: canvas.edges || [], orderedTabs: canvas.orderedTabs || [] }, null, 2)
  return {
    actionType: 'agent-proposal-confirm',
    scopeId: currentNode.id || proposal.nodeId || payload.nodeId || 'analysis',
    model: model || run.model || 'gpt-5.5',
    run,
    proposal,
    fullCanvas: { nodes, edges: canvas.edges || [], orderedTabs: canvas.orderedTabs || [] },
    currentNode,
    upstreamNodes,
    downstreamNodes,
    history: ((run.agentSessions || {})[currentNode.id || proposal.nodeId] || []).slice(-8),
    now,
    systemPrompt: [
      '你是流程通的画布重写 Agent。',
      '用户已明确点击确认入画布。你必须基于原始需求、完整画布、当前节点、后续节点、对话历史和已确认 proposal 生成 JSON patch。',
      '必须优先消化 proposal.writeableContent，把用户确认的内容写入 currentNode，并根据 proposal.downstreamImpact 重写后续节点。',
      '只返回 JSON，不要返回 Markdown。JSON 结构：{"currentNode":{"summary":"","content":[]},"downstreamNodes":[{"nodeId":"","summary":"","content":[]}],"reason":""}。',
      'content 必须是字符串数组；只能更新当前节点和它之后的节点。'
    ].join('\n'),
    userPrompt: [
      `原始需求：${run.input || analysis.input || ''}`,
      `当前节点：${currentNode.title || currentNode.id || proposal.nodeId}`,
      `动作意图：${proposal.actionIntent || payload.actionIntent || '未标注'}`,
      `确认写入内容：\n${writeableContentText}`,
      `下游刷新约束：\n${downstreamImpactText}`,
      `已确认 proposal：\n${proposalText}`,
      `完整画布：\n${canvasText}`,
      `上游节点：\n${JSON.stringify(upstreamNodes, null, 2)}`,
      `下游节点：\n${JSON.stringify(downstreamNodes, null, 2)}`,
      `最近对话：\n${JSON.stringify(((run.agentSessions || {})[currentNode.id || proposal.nodeId] || []).slice(-8), null, 2)}`,
      '请返回可直接应用的 JSON patch。'
    ].join('\n\n')
  }
}

function markAgentProposalStale(store, run = {}, proposal = {}, error = {}) {
  if (!proposal?.id) return
  const now = new Date().toISOString()
  const nextProposals = Object.fromEntries(Object.entries(run.agentProposals || {}).map(([key, proposals]) => [
    key,
    Array.isArray(proposals)
      ? proposals.map((item) => item.id === proposal.id
        ? {
            ...item,
            status: 'stale',
            staleAt: now,
            staleReason: error.staleReason || 'canvas-version-changed',
            currentCanvasVersion: error.currentCanvasVersion || ''
          }
        : item)
      : proposals
  ]))
  replaceRun(store, {
    ...run,
    agentProposals: nextProposals,
    updatedAt: now
  })
}

export async function confirmRunAgentProposal(store, payload = {}, options = {}) {
  const run = findRun(store, payload.runId)
  const proposal = findAgentProposal(run, payload.proposalId, payload.nodeId)
  let modelPatch = null
  const provider = options.agentProvider
  if (proposal?.id && provider && typeof provider.generate === 'function') {
    try {
      const confirmContext = buildConfirmAgentContext(run, proposal, payload, payload.model || run.model)
      const generatedPatch = await provider.generate(confirmContext)
      modelPatch = generatedPatch.patch || generatedPatch.canvasPatch || generatedPatch.content || generatedPatch.raw?.patch || null
    } catch {
      modelPatch = null
    }
  }
  let confirmation
  try {
    confirmation = confirmAgentProposalOnRun(run, proposal, {
      ...payload,
      modelPatch
    })
  } catch (error) {
    if (error?.code === 'AGENT_PROPOSAL_STALE') markAgentProposalStale(store, run, proposal, error)
    throw error
  }
  const { analysis, appliedPatch } = confirmation
  const now = new Date().toISOString()
  const nodeId = proposal.nodeId || payload.nodeId || appliedPatch.currentNodeId
  const nextProposals = Object.fromEntries(Object.entries(run.agentProposals || {}).map(([key, proposals]) => [
    key,
    Array.isArray(proposals)
      ? proposals.map((item) => item.id === proposal.id ? { ...item, status: 'confirmed', confirmedAt: now } : item)
      : proposals
  ]))
  const next = {
    ...run,
    documentAnalysis: analysis,
    projectBlueprint: analysis.blueprint || run.projectBlueprint,
    agentProposals: nextProposals,
    agentSessions: {
      ...(run.agentSessions || {}),
      [nodeId]: [
        ...((run.agentSessions || {})[nodeId] || []),
        {
          id: `assistant-confirm-${Date.now()}`,
          role: 'assistant',
          content: '已写入画布并刷新后续节点。',
          createdAt: now,
          meta: {
            status: 'success',
            action: 'confirm-canvas',
            proposalId: proposal.id,
            nodeId,
            appliedPatch
          }
        }
      ]
    },
    updatedAt: now
  }
  replaceRun(store, next)
  return {
    run: next,
    analysis,
    appliedPatch
  }
}

export function cancelRunMessage(store, payload = {}) {
  const run = findRun(store, payload.runId)
  const step = getCurrentStep(run)
  const stepId = payload.stepId || step.id
  const now = new Date().toISOString()
  const requestKey = activeAgentRequestKey({
    runId: payload.runId,
    stepId,
    clientMessageId: payload.clientMessageId || ''
  })
  const activeController = requestKey ? store.activeAgentRequests?.get(requestKey) : null
  if (activeController) {
    activeController.abort()
    store.activeAgentRequests?.delete(requestKey)
  }
  const next = {
    ...run,
    agentCancels: {
      ...(run.agentCancels || {}),
      [stepId]: {
        clientMessageId: payload.clientMessageId || '',
        cancelledAt: now
      }
    },
    updatedAt: now
  }
  replaceRun(store, next)
  return {
    run: next,
    cancelled: true,
    aborted: Boolean(activeController),
    clientMessageId: payload.clientMessageId || '',
    stepId
  }
}

export function generateRunStep(store, payload = {}) {
  const run = findRun(store, payload.runId)
  const step = getCurrentStep(run)
  if (payload.stepId && payload.stepId !== step.id) {
    throw new Error('只能生成当前步骤')
  }
  run.stepInputs[step.id] = {
    ...(run.stepInputs[step.id] || {}),
    ...(payload.input || payload.stepInputs || {})
  }
  const next = generateStepDraft(run)
  replaceRun(store, next)
  return {
    run: next,
    output: next.stepDraftOutputs[step.id] || ''
  }
}

export function regenerateRunStep(store, payload = {}) {
  const run = findRun(store, payload.runId)
  const step = getCurrentStep(run)
  if (payload.stepId && payload.stepId !== step.id) {
    throw new Error('只能重新生成当前步骤')
  }
  const next = regenerateStepDraft(run, payload.challenge || '请补充状态、异常和交付拆分。')
  replaceRun(store, next)
  return {
    run: next,
    output: next.stepDraftOutputs[step.id] || ''
  }
}

export function acceptRunStep(store, payload = {}) {
  const run = findRun(store, payload.runId)
  const step = getCurrentStep(run)
  if (payload.stepId && payload.stepId !== step.id) {
    throw new Error('只能采纳当前步骤')
  }
  const next = acceptCurrentStep(run, payload.content || run.stepDraftOutputs?.[step.id] || '')
  replaceRun(store, next)
  return { run: next }
}

export function completeRunStep(store, payload = {}) {
  const run = findRun(store, payload.runId)
  const step = getCurrentStep(run)
  const next = completeCurrentStep(run, run.stepOutputs?.[step.id] || run.stepDraftOutputs?.[step.id] || '')
  replaceRun(store, next)
  return { run: next }
}
