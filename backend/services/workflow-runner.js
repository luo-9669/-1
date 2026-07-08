import {
  acceptCurrentStep,
  completeCurrentStep,
  createWorkflowRun,
  generateStepDraft,
  getBuiltinWorkflows,
  getCurrentStep,
  regenerateStepDraft
} from '../../frontend/src/services/workflows.js'
import { buildWorkflowAgentQuickReplies } from '../../frontend/src/services/workflowWorkbench.js'
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

function readJsonStringValueAt(text = '', startIndex = 0) {
  let result = ''
  let escaping = false
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index]
    if (escaping) {
      if (char === 'n') result += '\n'
      else if (char === 'r') result += '\r'
      else if (char === 't') result += '\t'
      else result += char
      escaping = false
      continue
    }
    if (char === '\\') {
      escaping = true
      continue
    }
    if (char === '"') return result
    result += char
  }
  return result
}

function extractStructuredAgentStreamReadableContent(text = '') {
  const value = String(text || '').trim().replace(/^```(?:json)?\s*/i, '')
  if (!value) return ''
  const match = value.match(/"(content|message|answer)"\s*:\s*"/)
  if (!match) return ''
  return readJsonStringValueAt(value, (match.index || 0) + match[0].length)
}

function isPotentialStructuredAgentStreamPrefix(text = '') {
  const value = String(text || '').trim().replace(/^```(?:json)?\s*/i, '')
  if (!value) return false
  if (/^[{\[]\s*$/.test(value)) return true
  const objectPrefix = value.match(/^\{\s*"?(content|proposal|structuredProposal|agentProposal|writeableContent|downstreamImpact|nodeId)?$/)
  if (objectPrefix) return true
  const partialKey = value.match(/^\{\s*"?([A-Za-z]*)$/)?.[1] || ''
  if (!partialKey) return false
  return ['content', 'proposal', 'structuredProposal', 'agentProposal', 'writeableContent', 'downstreamImpact', 'nodeId']
    .some((key) => key.startsWith(partialKey))
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
  let pendingVisibleContent = ''
  let structuredVisibleContent = ''
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
        const structuredReadableContent = extractStructuredAgentStreamReadableContent(content)
        if (structuredReadableContent) {
          pendingVisibleContent = ''
          if (structuredReadableContent.length > structuredVisibleContent.length) {
            const readableDelta = structuredReadableContent.slice(structuredVisibleContent.length)
            structuredVisibleContent = structuredReadableContent
            visibleContent = structuredReadableContent
            onEvent?.('delta', { content: readableDelta })
          }
        } else if (isStructuredAgentStreamContent(content)) {
          pendingVisibleContent = ''
        } else if (pendingVisibleContent || isPotentialStructuredAgentStreamPrefix(content)) {
          pendingVisibleContent += delta
          if (isPotentialStructuredAgentStreamPrefix(content)) continue
          visibleContent += pendingVisibleContent
          onEvent?.('delta', { content: pendingVisibleContent })
          pendingVisibleContent = ''
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

function compactEditLine(value = '', max = 360) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function editContentLines(text = '') {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24)
}

function editDetailLines(text = '') {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 32)
}

function uniqueCanvasEditLines(values = [], limit = 24) {
  const seen = new Set()
  return (Array.isArray(values) ? values : [])
    .map((value) => compactEditLine(value, 360))
    .filter((value) => {
      if (!value || seen.has(value)) return false
      seen.add(value)
      return true
    })
    .slice(0, limit)
}

function parseCanvasEditPatch(rawPatch = {}) {
  if (!rawPatch) return null
  if (typeof rawPatch === 'string') {
    try {
      return JSON.parse(rawPatch)
    } catch {
      return null
    }
  }
  if (typeof rawPatch === 'object' && !Array.isArray(rawPatch)) return rawPatch
  return null
}

function normalizeCanvasEditModelPatch(rawPatch = {}, nodes = [], currentIndex = 0) {
  const parsed = parseCanvasEditPatch(rawPatch)
  if (!parsed) return null
  const currentNode = parsed.currentNode && typeof parsed.currentNode === 'object' && !Array.isArray(parsed.currentNode)
    ? parsed.currentNode
    : null
  const downstreamNodes = Array.isArray(parsed.downstreamNodes) ? parsed.downstreamNodes : []
  const invalidTarget = downstreamNodes.some((node) => {
    const nodeId = node?.nodeId || node?.id || ''
    const index = nodes.findIndex((item) => item.id === nodeId)
    return !nodeId || index < 0 || index <= currentIndex
  })
  if (invalidTarget || (!currentNode && !downstreamNodes.length)) return null
  return {
    currentNode: currentNode
      ? {
          summary: compactEditLine(currentNode.summary || '', 360),
          content: uniqueCanvasEditLines(currentNode.content || currentNode.items || [], 24)
        }
      : null,
    downstreamNodes: downstreamNodes
      .map((node) => ({
        nodeId: node.nodeId || node.id || '',
        summary: compactEditLine(node.summary || '', 360),
        content: uniqueCanvasEditLines(node.content || node.items || [], 24)
      }))
      .filter((node) => node.nodeId && (node.summary || node.content.length)),
    reason: compactEditLine(parsed.reason || '模型根据完整画布和用户编辑内容重写当前节点与后续节点。', 360)
  }
}

function applyCanvasEditModelPatch(nodes = [], currentIndex = 0, patch = {}) {
  if (!patch) return null
  const nextNodes = nodes.map((node) => ({ ...node }))
  const changedNodeIds = []
  if (patch.currentNode?.summary || patch.currentNode?.content?.length) {
    nextNodes[currentIndex] = {
      ...nextNodes[currentIndex],
      ...(patch.currentNode.summary ? { summary: patch.currentNode.summary } : {}),
      ...(patch.currentNode.content?.length ? { content: patch.currentNode.content } : {})
    }
    changedNodeIds.push(nextNodes[currentIndex].id)
  }
  for (const downstreamPatch of patch.downstreamNodes || []) {
    const index = nextNodes.findIndex((node) => node.id === downstreamPatch.nodeId)
    if (index <= currentIndex) continue
    nextNodes[index] = {
      ...nextNodes[index],
      ...(downstreamPatch.summary ? { summary: downstreamPatch.summary } : {}),
      ...(downstreamPatch.content?.length ? { content: downstreamPatch.content } : {})
    }
    changedNodeIds.push(nextNodes[index].id)
  }
  if (!changedNodeIds.length) return null
  return {
    nodes: nextNodes,
    changedNodeIds: Array.from(new Set(changedNodeIds)),
    reason: patch.reason
  }
}

function buildCanvasNodeEditModelContext(run = {}, payload = {}, nodes = [], currentIndex = 0, edits = {}) {
  const analysis = run.documentAnalysis || {}
  const currentNode = nodes[currentIndex] || {}
  const upstreamNodes = nodes.slice(0, currentIndex)
  const downstreamNodes = nodes.slice(currentIndex + 1)
  const canvasText = JSON.stringify(analysis.canvas || {}, null, 2)
  return {
    actionType: 'canvas-node-edit',
    runId: run.id,
    model: payload.model || run.model || analysis.generation?.model || 'gpt-5.5',
    input: run.input || analysis.input || '',
    fullCanvas: analysis.canvas || {},
    currentNode,
    upstreamNodes,
    downstreamNodes,
    editedSummary: edits.summary,
    editedContent: edits.content,
    editedDetail: edits.details,
    systemPrompt: [
      '你是流程通的画布节点编辑 Agent。',
      '用户在全屏详情里手动编辑了当前节点。你必须基于原始需求、完整画布、当前节点、上游节点、后续节点和用户编辑内容生成 JSON patch。',
      '只能更新当前节点和它之后的节点，不能修改上游节点，不能返回 Markdown。',
      'JSON 结构：{"currentNode":{"summary":"","content":[]},"downstreamNodes":[{"nodeId":"","summary":"","content":[]}],"reason":""}。',
      'content 必须是字符串数组，内容要比用户输入更结构化、更可交付，并让后续节点与当前编辑保持一致。'
    ].join('\n'),
    userPrompt: [
      `原始需求：${run.input || analysis.input || ''}`,
      `当前节点：${currentNode.title || currentNode.id}`,
      `用户编辑摘要：${edits.summary}`,
      `用户编辑条目：\n${edits.content.join('\n')}`,
      `用户编辑详情：\n${edits.details.join('\n')}`,
      `完整画布：\n${canvasText}`,
      `上游节点：\n${JSON.stringify(upstreamNodes, null, 2)}`,
      `后续节点：\n${JSON.stringify(downstreamNodes, null, 2)}`,
      '请返回可直接应用的 JSON patch。'
    ].join('\n\n')
  }
}

function canvasNodeEditDiffs(beforeNodes = [], afterNodes = [], changedNodeIds = []) {
  const changed = new Set(changedNodeIds)
  return afterNodes
    .filter((node) => changed.has(node.id))
    .map((afterNode) => {
      const beforeNode = beforeNodes.find((node) => node.id === afterNode.id) || {}
      return {
        nodeId: afterNode.id,
        title: afterNode.title || beforeNode.title || afterNode.id,
        before: {
          summary: beforeNode.summary || '',
          contentCount: Array.isArray(beforeNode.content) ? beforeNode.content.length : 0
        },
        after: {
          summary: afterNode.summary || '',
          contentCount: Array.isArray(afterNode.content) ? afterNode.content.length : 0
        }
      }
    })
}

function buildCanvasNodeEditVersion(analysis = {}, previousVersions = [], appliedPatch = {}) {
  const now = new Date().toISOString()
  return {
    id: `version-canvas-edit-${Date.now()}`,
    label: `手动编辑 ${previousVersions.length + 1}`,
    source: 'canvas-node-edit',
    createdAt: now,
    snapshot: {
      canvas: analysis.canvas,
      blueprint: analysis.blueprint || null,
      qualityGate: analysis.qualityGate || null
    },
    appliedPatch,
    qualityScore: analysis.qualityGate?.score
  }
}

export async function editRunCanvasNode(store, payload = {}, options = {}) {
  const run = findRun(store, payload.runId)
  const analysis = run.documentAnalysis || {}
  const canvas = analysis.canvas || {}
  const nodes = Array.isArray(canvas.nodes) ? canvas.nodes : []
  if (!nodes.length) throw new Error('当前运行没有可编辑的画布节点')
  const currentIndex = nodes.findIndex((node) => node?.id === payload.nodeId)
  if (currentIndex < 0) throw new Error(`未找到画布节点：${payload.nodeId}`)
  const currentNode = nodes[currentIndex]
  const summary = compactEditLine(payload.editedSummary || currentNode.summary || '')
  const content = editContentLines(payload.editedContentText || '')
  const details = editDetailLines(payload.editedDetailText || '')
  const provider = options.agentProvider
  const now = new Date().toISOString()
  const editSection = details.length
    ? {
        title: '用户编辑补充',
        meta: `保存于 ${now}`,
        items: details
      }
    : null
  let modelResult = null
  if (provider && typeof provider.generate === 'function') {
    try {
      const context = buildCanvasNodeEditModelContext(run, payload, nodes, currentIndex, { summary, content, details })
      const generatedPatch = await provider.generate(context)
      const normalizedPatch = normalizeCanvasEditModelPatch(
        generatedPatch.patch || generatedPatch.canvasPatch || generatedPatch.content || generatedPatch.raw?.patch || generatedPatch,
        nodes,
        currentIndex
      )
      const appliedModelPatch = applyCanvasEditModelPatch(nodes, currentIndex, normalizedPatch)
      if (appliedModelPatch) {
        modelResult = {
          ...appliedModelPatch,
          provider: generatedPatch.provider || provider.name || '',
          model: generatedPatch.model || context.model,
          usage: generatedPatch.usage || null
        }
      }
    } catch {
      modelResult = null
    }
  }
  const fallbackNodes = nodes.map((node, index) => {
    if (index < currentIndex) return node
    if (index === currentIndex) {
      return {
        ...node,
        summary: summary || node.summary || '',
        content: content.length ? content : (Array.isArray(node.content) ? node.content : []),
        detailSections: [
          ...(Array.isArray(node.detailSections) ? node.detailSections : []),
          ...(editSection ? [editSection] : [])
        ]
      }
    }
    const syncLine = `上游 ${currentNode.id} 已手动编辑：${summary || '当前节点内容已更新'}，本节点需要按最新结论同步校准。`
    return {
      ...node,
      summary: node.summary || '已根据上游编辑同步校准',
      content: [
        syncLine,
        ...(Array.isArray(node.content) ? node.content : [])
      ].slice(0, 24)
    }
  })
  const nextNodes = modelResult?.nodes || fallbackNodes
  const changedNodeIds = modelResult?.changedNodeIds || nodes.slice(currentIndex).map((node) => node.id).filter(Boolean)
  const appliedPatch = {
    currentNodeId: currentNode.id,
    changedNodeIds,
    reason: modelResult?.reason || `用户在全屏详情中编辑「${currentNode.title || currentNode.id}」，后端已同步标记当前及后续节点刷新。`,
    nodeDiffs: canvasNodeEditDiffs(nodes, nextNodes, changedNodeIds),
    audit: {
      source: 'canvas-node-edit',
      nodeId: currentNode.id,
      model: modelResult?.model || run.model || payload.model || '',
      provider: modelResult?.provider || '',
      usage: modelResult?.usage || null,
      editedAt: now
    }
  }
  const previousVersions = Array.isArray(analysis.versions) ? analysis.versions : []
  const nextAnalysis = {
    ...analysis,
    status: 'repaired',
    canvas: {
      ...canvas,
      nodes: nextNodes,
      edges: Array.isArray(canvas.edges) ? canvas.edges : [],
      orderedTabs: Array.isArray(canvas.orderedTabs) ? canvas.orderedTabs : []
    }
  }
  nextAnalysis.versions = [
    buildCanvasNodeEditVersion(nextAnalysis, previousVersions, appliedPatch),
    ...previousVersions
  ].slice(0, 12)
  const nextRun = {
    ...run,
    documentAnalysis: nextAnalysis,
    projectBlueprint: nextAnalysis.blueprint || run.projectBlueprint,
    updatedAt: now
  }
  replaceRun(store, nextRun)
  return {
    run: nextRun,
    analysis: nextAnalysis,
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
