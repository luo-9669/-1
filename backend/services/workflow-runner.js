import {
  acceptCurrentStep,
  completeCurrentStep,
  createWorkflowRun,
  generateStepDraft,
  getBuiltinWorkflows,
  getCurrentStep,
  regenerateStepDraft
} from '../../frontend/src/services/workflows.js'
import { buildWorkflowAgentQuickReplies, normalizeRequirementDissectionQuickReplies } from '../../frontend/src/services/workflowWorkbench.js'
import { buildAgentAnswerEvaluation, buildAgentEvidenceMeta, buildAgentEvidencePack, buildAgentTraceItems, generateAgentReply, withAgentEvidenceGrounding } from './agent-service.js'
import { buildAgentContext } from './agent-context-builder.js'
import { buildRequirementDissectionGuidanceArtifact } from './requirement-dissection-guidance.js'
import { buildActionResult, normalizeAgentModelText, normalizeModelProviderError } from './llm-provider.js'
import { buildAgentProposal, buildCanvasVersion, confirmAgentProposalOnRun } from './agent-proposal-service.js'
import { renderPageLayoutArtifactFromText } from './page-layout-artifact-renderer.js'

export function createWorkflowRunnerStore(seed = {}) {
  return {
    runs: [...(seed.runs || [])].map(normalizeRunRequirementDissectionGuidance),
    activeAgentRequests: new Map()
  }
}

function findWorkflow(workflowId = '') {
  return getBuiltinWorkflows().find((workflow) => workflow.id === workflowId) || getBuiltinWorkflows()[0]
}

function findRun(store, runId = '') {
  const run = store.runs.find((item) => item.id === runId)
  if (!run) throw new Error(`未找到工作流运行：${runId}`)
  return normalizeRunRequirementDissectionGuidance(run)
}

function normalizeTotalFlowRequirementDissectionGuidance(totalFlow = null) {
  if (!totalFlow || typeof totalFlow !== 'object' || Array.isArray(totalFlow)) return totalFlow
  const artifact = totalFlow.requirementDissectionArtifact && typeof totalFlow.requirementDissectionArtifact === 'object' && !Array.isArray(totalFlow.requirementDissectionArtifact)
    ? totalFlow.requirementDissectionArtifact
    : {}
  if (artifact.analysisGuidance) return totalFlow
  return {
    ...totalFlow,
    requirementDissectionArtifact: {
      ...artifact,
      analysisGuidance: buildRequirementDissectionGuidanceArtifact()
    }
  }
}

function normalizeAnalysisRequirementDissectionGuidance(analysis = null) {
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) return analysis
  if (!analysis.totalDesignFlow) return analysis
  const totalDesignFlow = normalizeTotalFlowRequirementDissectionGuidance(analysis.totalDesignFlow)
  return totalDesignFlow === analysis.totalDesignFlow ? analysis : { ...analysis, totalDesignFlow }
}

function normalizeRunRequirementDissectionGuidance(run = null) {
  if (!run || typeof run !== 'object' || Array.isArray(run)) return run
  const documentAnalysis = normalizeAnalysisRequirementDissectionGuidance(run.documentAnalysis)
  return documentAnalysis === run.documentAnalysis ? run : { ...run, documentAnalysis }
}

function fallbackStepFromPayload(run = {}, payload = {}) {
  const activeNode = payload.context?.activeNode && typeof payload.context.activeNode === 'object'
    ? payload.context.activeNode
    : {}
  const stepId = payload.stepId || run.currentStepId || activeNode.id || ''
  if (!stepId) return null
  return {
    id: stepId,
    title: activeNode.title || stepId,
    goal: activeNode.agentScope || activeNode.summary || run.title || run.input || '围绕当前分析画布继续对话。'
  }
}

function resolveCurrentStep(run = {}, payload = {}) {
  if (Array.isArray(run.steps) && run.steps.length) {
    return run.steps.find((step) => step.id === (payload.stepId || run.currentStepId)) || run.steps[0]
  }
  return fallbackStepFromPayload(run, payload)
}

function replaceRun(store, run) {
  const normalizedRun = normalizeRunRequirementDissectionGuidance(run)
  const index = store.runs.findIndex((item) => item.id === normalizedRun.id)
  if (index >= 0) store.runs.splice(index, 1, normalizedRun)
  else store.runs.unshift(normalizedRun)
  return normalizedRun
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

function isRequirementDissectionAgentScope(scopeId = '', activeNode = null, step = {}) {
  const values = [
    scopeId,
    activeNode?.id,
    activeNode?.stageId,
    activeNode?.title,
    step?.id,
    step?.title
  ].map((item) => String(item || '').trim())
  return values.some((item) => item === 'requirement-dissection' ||
    item === 'requirement-dissection-agent' ||
    item === '需求分析' ||
    item === '需求解剖')
}

function isStructuredAgentStreamContent(text = '') {
  const value = String(text || '').trim()
  if (!value) return false
  if (/^```(?:json)?\s*\{/i.test(value)) return true
  if (/^[{\[]/.test(value) && /"(content|message|answer|reply|proposal|structuredProposal|agentProposal|writeableContent|downstreamImpact|nodeId)"\s*:/.test(value)) return true
  return /"(proposal|structuredProposal|agentProposal|writeableContent|downstreamImpact)"\s*:/.test(value)
}

function isStructuredConfirmPatchContent(value = '') {
  // 确认入画布阶段只接受真正的 patch，普通模型回复要回退到 proposal 写入逻辑。
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Boolean(value.currentNode || value.downstreamNodes || value.reason)
  }
  const text = String(value || '').trim()
  if (!text) return false
  if (/^```(?:json)?\s*\{/i.test(text)) return true
  return /^[{\[]/.test(text) && /"(currentNode|downstreamNodes|reason)"\s*:/.test(text)
}

function extractConfirmModelPatch(generatedPatch = {}) {
  if (generatedPatch.patch) return generatedPatch.patch
  if (generatedPatch.canvasPatch) return generatedPatch.canvasPatch
  if (generatedPatch.raw?.patch) return generatedPatch.raw.patch
  if (isStructuredConfirmPatchContent(generatedPatch.content)) return generatedPatch.content
  if (isStructuredConfirmPatchContent(generatedPatch)) return generatedPatch
  return null
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

function emitAgentTrace(onEvent, patch = {}) {
  if (typeof onEvent !== 'function') return
  onEvent('trace', {
    key: patch.key,
    label: patch.label,
    status: patch.status,
    text: patch.text || patch.summary || '',
    ...(patch.summary ? { summary: patch.summary } : {})
  })
}

function modelFailureContent(error = {}) {
  return '生成失败，请重试。'
}

function failedStreamFeedback(input = {}, context = {}, provider = {}, error = {}) {
  const normalized = normalizeModelProviderError(error, {
    provider: error?.provider || provider?.name || 'stream-provider',
    model: error?.model || context.model || input.model,
    apiSurface: error?.apiSurface,
    timeoutMs: error?.timeoutMs || provider?.timeoutMs || context.timeoutMs
  })
  normalized.recoveryActions = ['重试']
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  const actionResult = buildActionResult(context)
  const evidenceMeta = buildAgentEvidenceMeta(context, { actionResult, proposal: null, error: normalized })
  return {
    assistantMessage: {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: modelFailureContent(normalized),
      createdAt: context.now || input.now,
      trace: context.mode === 'dialogue-chat'
        ? []
        : buildAgentTraceItems(context, { actionResult, proposal: null, error: normalized, evidencePack: evidenceMeta.evidencePack }),
      meta: {
        provider: normalized.provider || provider?.name || 'stream-provider',
        model: normalized.model || context.model || input.model,
        usage,
        actionType: context.actionType,
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
    },
    actionResult,
    usage,
    provider: normalized.provider || provider?.name || 'stream-provider',
    model: normalized.model || context.model || input.model,
    quickReplies: [],
    proposal: null,
    error: normalized
  }
}

function agentTracePatch(key, label, status, text = '') {
  return { key, label, status, text }
}

function stageAgentStreamPreview(context = {}) {
  const stageTitle = context.node?.title || '当前阶段'
  if (context.mode === 'dialogue-chat' && context.actionType === 'stage-agent-chat') {
    return `已接收，我会按「${stageTitle}」和当前画布上下文展开分析。下面会边生成边补全完整内容。\n\n`
  }
  if (context.mode === 'dialogue-chat') return ''
  return `已接收，正在结合「${stageTitle}」和当前画布上下文生成可写入建议。下面会边生成边补全内容。\n\n`
}

function displayLinesFromList(items = [], limit = 12) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return [item.label, item.title, item.text, item.summary, item.content].filter(Boolean).join('：')
      }
      return String(item || '')
    })
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit)
}

function displayLinesFromObjects(items = [], mapper = null, limit = 8) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return ''
      return mapper ? mapper(item) : ''
    })
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit)
}

function displayLayoutOptions(options = []) {
  return (Array.isArray(options) ? options : [])
    .filter((option) => option && typeof option === 'object' && !Array.isArray(option))
    .slice(0, 3)
    .flatMap((option, index) => {
      const label = option.label || `方案 ${index + 1}`
      const title = option.title || option.name || ''
      const summary = option.summary || option.description || ''
      const frameworkRows = displayLinesFromList(
        option.frameworkRows || option.sharedFramework || option.pageFramework || option.wireframeRows || [],
        8
      )
      const layout = frameworkRows.length
        ? frameworkRows
        : displayLinesFromList(option.layout || option.items || option.sections, 6)
      const lines = [`#### ${label}${title ? `：${title}` : ''}`]
      if (summary) lines.push(summary)
      if (option.layoutStrategy || option.arrangement) lines.push(`布局组织：${option.layoutStrategy || option.arrangement}`)
      if (option.bestFor || option.scenario) lines.push(`适用：${option.bestFor || option.scenario}`)
      if (layout.length) lines.push(...layout.map((item) => `- ${item}`))
      if (option.risk || option.tradeoff) lines.push(`取舍：${option.risk || option.tradeoff}`)
      return lines
    })
}

function proposalQuickReplies(proposal = null) {
  const options = Array.isArray(proposal?.writeableContent?.layoutOptions)
    ? proposal.writeableContent.layoutOptions
    : []
  if (proposal?.actionIntent !== 'page-layout-plan' || options.length < 3) return []
  return ['选 1 应用到画布', '选 2 应用到画布', '选 3 应用到画布', '不满意，重生成 3 个']
}

function answerEvaluationQuickReplies(answerEvaluation = null) {
  const actions = Array.isArray(answerEvaluation?.recommendedActions)
    ? answerEvaluation.recommendedActions
    : []
  return actions
    .map((item) => String(item?.label || '').trim())
    .filter(Boolean)
}

function selectedLayoutOption(proposal = {}, payload = {}) {
  const options = Array.isArray(proposal?.writeableContent?.layoutOptions)
    ? proposal.writeableContent.layoutOptions
    : []
  if (!options.length) return null
  if (payload.selectedLayoutOptionId) {
    const byId = options.find((option) => option?.id === payload.selectedLayoutOptionId)
    if (byId) return byId
  }
  if (payload.selectedLayoutOptionIndex) return options[Math.max(0, Number(payload.selectedLayoutOptionIndex) - 1)] || null
  return null
}

function proposalForSelectedLayoutOption(proposal = {}, payload = {}) {
  const option = selectedLayoutOption(proposal, payload)
  if (!option) return proposal
  const layoutItems = displayLinesFromList(
    option.frameworkRows || option.sharedFramework || option.pageFramework || option.wireframeRows || option.layout || option.items || option.sections,
    8
  )
  return {
    ...proposal,
    summary: `${option.label || ''} ${option.title || ''}：${option.summary || ''}`.replace(/\s+/g, ' ').trim(),
    writeableContent: {
      ...(proposal.writeableContent || {}),
      summary: option.writeableContent?.summary || `${option.label || '方案'}：${option.title || ''}。${option.summary || ''}`,
      items: [
        `${option.label || '方案'}：${option.title || ''}`,
        option.summary || '',
        option.layoutStrategy ? `布局组织：${option.layoutStrategy}` : '',
        option.bestFor ? `适用场景：${option.bestFor}` : '',
        ...layoutItems,
        option.risk ? `风险与取舍：${option.risk}` : ''
      ].filter(Boolean),
      acceptanceCriteria: option.writeableContent?.acceptanceCriteria || option.acceptanceCriteria || proposal.writeableContent?.acceptanceCriteria || []
    }
  }
}

function buildAgentProposalDisplayContent(shortContent = '', proposal = null) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return String(shortContent || '').trim()
  const lines = []
  const intro = String(shortContent || proposal.summary || '').trim()
  const title = String(proposal.title || '').trim()
  const writeableContent = proposal.writeableContent && typeof proposal.writeableContent === 'object' && !Array.isArray(proposal.writeableContent)
    ? proposal.writeableContent
    : {}
  if (intro) lines.push(intro)
  if (title) lines.push('', `## ${title}`)
  if (proposal.summary && proposal.summary !== intro) lines.push(String(proposal.summary).trim())
  if (writeableContent.summary) lines.push('', '### 可写入内容', String(writeableContent.summary).trim())
  const layoutOptions = displayLayoutOptions(writeableContent.layoutOptions || proposal.layoutOptions || [])
  if (layoutOptions.length) lines.push('', '### 3 套候选框架', ...layoutOptions)
  const writeableItems = displayLinesFromList(writeableContent.items, 16)
  if (writeableItems.length) lines.push('', ...writeableItems.map((item, index) => `${index + 1}. ${item}`))
  const acceptanceCriteria = displayLinesFromList(writeableContent.acceptanceCriteria, 10)
  if (acceptanceCriteria.length) lines.push('', '### 验收标准', ...acceptanceCriteria.map((item, index) => `${index + 1}. ${item}`))
  const rationale = displayLinesFromList(proposal.rationale, 8)
  if (rationale.length) lines.push('', '### 判断依据', ...rationale.map((item) => `- ${item}`))
  const contextSources = displayLinesFromObjects(proposal.contextSources, (item) => {
    const title = item.title || item.type || '上下文'
    const snippet = item.snippet || item.content || ''
    const reason = item.matchReason || ''
    return [title, snippet, reason ? `命中原因：${reason}` : ''].filter(Boolean).join('：')
  }, 6)
  if (contextSources.length) lines.push('', '### 引用依据', ...contextSources.map((item) => `- ${item}`))
  const downstreamImpact = displayLinesFromObjects(proposal.downstreamImpact, (item) => {
    const nodeId = item.nodeId || item.id || '后续节点'
    return `${nodeId}：${item.reason || '需要同步刷新口径。'}`
  }, 8)
  if (downstreamImpact.length) lines.push('', '### 后续影响', ...downstreamImpact.map((item) => `- ${item}`))
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function createRun(store, payload = {}) {
  const workflow = findWorkflow(payload.workflowId)
  const run = normalizeRunRequirementDissectionGuidance({
    ...createWorkflowRun(workflow, payload.input || ''),
    projectId: payload.projectId || '',
    model: payload.model || 'gpt-5.5',
    agentSessions: {},
    referenceFiles: {},
    demoArtifacts: {}
  })
  store.runs.unshift(run)
  return run
}

function normalizeRunMessageInput(store, payload = {}) {
  const run = findRun(store, payload.runId)
  const step = resolveCurrentStep(run, payload)
  const stepId = payload.stepId || step?.id || ''
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

function workflowAgentMessageRequestId(message = {}) {
  return String(message?.meta?.clientMessageId || message?.clientMessageId || '').trim()
}

function isPendingAgentAssistantMessage(message = {}) {
  return message?.role === 'assistant' && ['pending', 'retrieving', 'generating', 'merging-canvas'].includes(message?.meta?.status)
}

function compactAgentSessionForRequest(messages = [], userMessage = {}, assistantMessage = {}) {
  const requestId = workflowAgentMessageRequestId(assistantMessage) || workflowAgentMessageRequestId(userMessage)
  if (!requestId) return [...messages, userMessage, assistantMessage]
  const nextMessages = []
  let keptUser = false
  for (const message of messages) {
    if (workflowAgentMessageRequestId(message) !== requestId) {
      nextMessages.push(message)
      continue
    }
    if (message?.role === 'user') {
      if (!keptUser) {
        nextMessages.push(message)
        keptUser = true
      }
      continue
    }
    if (isPendingAgentAssistantMessage(message)) continue
    nextMessages.push(message)
  }
  if (!keptUser) nextMessages.push(userMessage)
  nextMessages.push(assistantMessage)
  return nextMessages
}

function persistRunAgentReply(store, input = {}, feedback = {}) {
  const proposal = feedback.proposal
    ? {
        ...feedback.proposal,
        canvasVersion: buildCanvasVersion(input.run?.documentAnalysis?.canvas || {})
      }
    : null
  const proposalDisplayContent = proposal
    ? buildAgentProposalDisplayContent(feedback.assistantMessage.content, proposal)
    : ''
  const assistantMessage = {
    ...feedback.assistantMessage,
    ...(proposalDisplayContent && proposalDisplayContent.length > String(feedback.assistantMessage.content || '').length
      ? { content: proposalDisplayContent }
      : {}),
    meta: {
      ...(feedback.assistantMessage.meta || {}),
      ...(proposal?.id ? { proposalId: proposal.id } : {}),
      ...(proposal?.id ? {
        proposalSummary: {
          title: proposal.title,
          summary: proposal.summary,
          actionIntent: proposal.actionIntent || '',
          writeableContent: proposal.writeableContent || null,
          layoutOptions: proposal.writeableContent?.layoutOptions || [],
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
  const safeStepId = input.step?.id || input.stepId || activeNode?.id || 'step'
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
  const proposalReplies = proposalQuickReplies(proposal)
  if (proposalReplies.length) {
    feedback.quickReplies = normalizeAgentQuickReplies([
      ...(Array.isArray(feedback.quickReplies) ? feedback.quickReplies : []),
      ...proposalReplies
    ])
  }
  const evaluationReplies = answerEvaluationQuickReplies(assistantMessage.meta?.answerEvaluation)
  if (evaluationReplies.length) {
    feedback.quickReplies = normalizeAgentQuickReplies([
      ...(Array.isArray(feedback.quickReplies) ? feedback.quickReplies : []),
      ...evaluationReplies
    ])
  }
  const modelQuickReplies = normalizeAgentQuickReplies(feedback.quickReplies)
  const fallbackQuickReplies = normalizeAgentQuickReplies(buildWorkflowAgentQuickReplies(input.run, {
    current: input.step || { id: safeStepId },
    activeNode,
    scopeId: input.stepId,
    draft: input.run.stepDraftOutputs?.[safeStepId] || '',
    output: input.run.stepOutputs?.[safeStepId] || '',
    actionResult: feedback.actionResult,
    assistantMessage,
    error: feedback.error
  }))
  const mergedQuickReplies = [
    ...modelQuickReplies,
    ...fallbackQuickReplies
  ]
  const quickReplies = isRequirementDissectionAgentScope(input.stepId, activeNode, input.step)
    ? normalizeRequirementDissectionQuickReplies(modelQuickReplies, 6)
    : normalizeAgentQuickReplies(mergedQuickReplies)
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
      [input.stepId]: compactAgentSessionForRequest(nextExistingMessages, input.userMessage, assistantMessage)
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

function cloneAgentPageLayoutArtifact(artifact = null) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) return null
  const asciiWireframe = String(artifact.asciiWireframe || artifact.rawText || '').trim()
  const modelDecision = String(artifact.modelDecision || '').trim()
  if (!asciiWireframe && !modelDecision) return null
  return {
    title: artifact.title || '页面骨架',
    ...(artifact.version ? { version: artifact.version } : {}),
    ...(modelDecision ? { modelDecision } : {}),
    ...(asciiWireframe ? { asciiWireframe } : {}),
    ...(artifact.interactionDetails ? { interactionDetails: artifact.interactionDetails } : {}),
    ...(Array.isArray(artifact.sections) ? { sections: artifact.sections } : {}),
    ...(artifact.layout && typeof artifact.layout === 'object' && !Array.isArray(artifact.layout) ? { layout: artifact.layout } : {}),
    ...(artifact.screenContract && typeof artifact.screenContract === 'object' && !Array.isArray(artifact.screenContract) ? { screenContract: artifact.screenContract } : {}),
    ...(Array.isArray(artifact.evidenceRefs) ? { evidenceRefs: artifact.evidenceRefs } : {})
  }
}

function agentPageLayoutArtifactForInput(input = {}, context = {}) {
  const candidateIds = [
    input.stepId,
    input.payload?.context?.activeNode?.id,
    input.payload?.context?.canvasAction?.nodeId,
    context.scopeId,
    context.node?.id
  ].map((item) => String(item || '').trim()).filter(Boolean)
  const canvases = input.run?.documentAnalysis?.totalDesignFlow?.stageCanvases || {}
  for (const canvas of Object.values(canvases)) {
    const nodes = Array.isArray(canvas?.nodes) ? canvas.nodes : []
    const node = nodes.find((item) => {
      const ids = [item?.id, item?.nodeId, item?.pageId, item?.sourcePageId].map((value) => String(value || '').trim())
      return ids.some((id) => id && candidateIds.includes(id))
    })
    const artifact = cloneAgentPageLayoutArtifact(node?.pageLayoutArtifact)
    if (artifact) return artifact
  }
  return cloneAgentPageLayoutArtifact(context.node?.pageLayoutArtifact)
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
  }, options.agentProvider, {
    fallback: options.fallback,
    timeoutMs: options.timeoutMs
  })
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
  const context = withAgentEvidenceGrounding(buildAgentContext({
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
  }))
  context.timeoutMs = options.timeoutMs
  if (context.mode === 'dialogue-chat') {
    let content = ''
    let finalChunk = {}
    const controller = new AbortController()
    const requestKey = activeAgentRequestKey({
      runId: payload.runId,
      stepId: input.stepId,
      clientMessageId: input.clientMessageId
    })
    if (requestKey) store.activeAgentRequests?.set(requestKey, controller)
    try {
      const preview = stageAgentStreamPreview(context)
      if (preview) onEvent?.('delta', { content: preview, preview: true })
      for await (const chunk of provider.stream(context, { signal: controller.signal })) {
        if (controller.signal.aborted) break
        if (chunk?.type === 'delta') {
          const delta = chunk.content || chunk.text || ''
          if (!delta) continue
          content += delta
          onEvent?.('delta', { content: delta })
        } else if (chunk?.type === 'status') {
          onEvent?.('status', { status: chunk.status || 'generating', label: chunk.label || '' })
        } else if (chunk?.type === 'final') {
          finalChunk = chunk
        }
      }
    } catch (error) {
      const feedback = failedStreamFeedback(input, context, provider, error)
      onEvent?.('delta', { content: feedback.assistantMessage.content })
      return persistRunAgentReply(store, input, feedback)
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
    const normalizedStream = normalizeAgentModelText(content)
    const rawStreamContent = String(content || '').trim()
    const normalizedFinal = normalizeAgentModelText(finalChunk.content || '')
    const finalContent = String(normalizedFinal.content || finalChunk.content || '').trim()
    const readableStreamContent = isStructuredAgentStreamContent(rawStreamContent)
      ? String(normalizedStream.content || '').trim()
      : rawStreamContent
    const assistantContent = renderPageLayoutArtifactFromText(readableStreamContent || finalContent || normalizedStream.content || '')
    if (!assistantContent) {
      const feedback = failedStreamFeedback(input, context, provider, new Error('模型没有返回内容'))
      onEvent?.('delta', { content: feedback.assistantMessage.content })
      return persistRunAgentReply(store, input, feedback)
    }
    const actionResult = finalChunk.actionResult || buildActionResult(context)
    const pageLayoutArtifact = agentPageLayoutArtifactForInput(input, context)
    const evidenceMeta = buildAgentEvidenceMeta(context, {
      actionResult,
      proposal: null,
      error: finalChunk.error || null
    })
    const assistantMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: assistantContent,
      createdAt: context.now,
      trace: [],
      meta: {
        provider: finalChunk.provider || provider.name || 'stream-provider',
        model: finalChunk.model || context.model,
        usage,
        actionType: context.actionType,
        ...evidenceMeta,
        ...(pageLayoutArtifact ? { pageLayoutArtifact } : {}),
        answerEvaluation: buildAgentAnswerEvaluation(assistantContent, context, {
          actionResult,
          proposal: null,
          error: finalChunk.error || null,
          evidencePack: evidenceMeta.evidencePack
        }),
        error: finalChunk.error || null,
        ...(readableStreamContent && readableStreamContent === rawStreamContent ? { rawModelContentPreserved: true } : {}),
        ...(finalContent && finalContent !== assistantContent ? { modelParsedContent: finalContent } : {})
      }
    }
    return persistRunAgentReply(store, input, {
      assistantMessage,
      actionResult,
      usage,
      provider: finalChunk.provider || provider.name || 'stream-provider',
      model: finalChunk.model || context.model,
      quickReplies: finalChunk.quickReplies || (normalizedFinal.quickReplies?.length ? normalizedFinal.quickReplies : normalizedStream.quickReplies),
      proposal: null,
      error: finalChunk.error || null
    })
  }
  emitAgentTrace(onEvent, agentTracePatch('intent', '需求识别', 'running', '正在识别问题类型...'))
  emitAgentTrace(onEvent, agentTracePatch('intent', '需求识别', 'done', '已识别当前问题和画布节点。'))
  emitAgentTrace(onEvent, agentTracePatch('plan', '任务规划', 'running', '正在规划画布上下文和提案路径...'))
  let content = ''
  let visibleContent = ''
  let lastExtractedLength = 0
  let finalChunk = {}
  const controller = new AbortController()
  const requestKey = activeAgentRequestKey({
    runId: payload.runId,
    stepId: input.stepId,
    clientMessageId: input.clientMessageId
  })
  if (requestKey) store.activeAgentRequests?.set(requestKey, controller)
  try {
    const preview = stageAgentStreamPreview(context)
    if (preview) onEvent?.('delta', { content: preview, preview: true })
    emitAgentTrace(onEvent, agentTracePatch('answer', '回答/提案', 'running', '正在生成可决策回复...'))
    for await (const chunk of provider.stream(context, { signal: controller.signal })) {
      if (controller.signal.aborted) {
        break
      }
      if (chunk?.type === 'delta') {
        const delta = chunk.content || chunk.text || ''
        if (!delta) continue
        content += delta
        const readable = extractStructuredAgentStreamReadableContent(content)
        if (readable && readable.length > lastExtractedLength) {
          const readableDelta = readable.slice(lastExtractedLength)
          lastExtractedLength = readable.length
          visibleContent = readable
          onEvent?.('delta', { content: readableDelta })
        } else if (!readable && !isStructuredAgentStreamContent(content) && !isPotentialStructuredAgentStreamPrefix(content)) {
          visibleContent += delta
          onEvent?.('delta', { content: delta })
        }
      } else if (chunk?.type === 'status') {
        onEvent?.('status', { status: chunk.status || 'generating', label: chunk.label || '' })
      } else if (chunk?.type === 'final') {
        finalChunk = chunk
      }
    }
  } catch (error) {
    const feedback = failedStreamFeedback(input, context, provider, error)
    onEvent?.('delta', { content: feedback.assistantMessage.content })
    for (const item of feedback.assistantMessage.trace || []) {
      emitAgentTrace(onEvent, {
        key: item.key,
        label: item.label,
        status: item.status,
        text: item.summary,
        summary: item.summary
      })
    }
    return persistRunAgentReply(store, input, feedback)
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
  const actionResult = finalChunk.actionResult || buildActionResult(context)
  const pageLayoutArtifact = agentPageLayoutArtifactForInput(input, context)
  const evidenceMeta = buildAgentEvidenceMeta(context, {
    actionResult,
    proposal: null,
    error: finalChunk.error || null
  })
  const meta = {
    provider: finalChunk.provider || provider.name || 'stream-provider',
    model: finalChunk.model || context.model,
    usage,
    actionType: context.actionType,
    ...evidenceMeta,
    ...(pageLayoutArtifact ? { pageLayoutArtifact } : {}),
    error: finalChunk.error || null
  }
  if (retrievedKnowledge.length) meta.retrievedKnowledge = retrievedKnowledge
  if (context.knowledgeRetrievalError) meta.knowledgeRetrievalError = context.knowledgeRetrievalError
  const normalizedStream = normalizeAgentModelText(content)
  const normalizedFinal = normalizeAgentModelText(finalChunk.content || '')
  const rawStreamContent = String(content || '').trim()
  const parsedShortContent = normalizedFinal.content || normalizedStream.content || visibleContent || ''
  const sourceProposal = finalChunk.proposal || finalChunk.structuredProposal || finalChunk.raw?.proposal || normalizedFinal.proposal || normalizedStream.proposal
  const proposalIntroContent = isStructuredAgentStreamContent(rawStreamContent)
    ? parsedShortContent
    : (parsedShortContent || rawStreamContent)
  const expandedProposalContent = buildAgentProposalDisplayContent(proposalIntroContent, sourceProposal)
  const assistantContent = renderPageLayoutArtifactFromText(expandedProposalContent || parsedShortContent || rawStreamContent || '')
  if (!assistantContent) {
    const feedback = failedStreamFeedback(input, context, provider, new Error('模型没有返回内容'))
    onEvent?.('delta', { content: feedback.assistantMessage.content })
    return persistRunAgentReply(store, input, feedback)
  }
  if (parsedShortContent && parsedShortContent !== assistantContent) meta.modelParsedContent = parsedShortContent
  if (rawStreamContent) meta.rawModelContentPreserved = true
  if (sourceProposal && expandedProposalContent && expandedProposalContent !== (rawStreamContent || parsedShortContent)) meta.proposalExpandedForDisplay = true
  meta.answerEvaluation = buildAgentAnswerEvaluation(assistantContent, context, {
    actionResult,
    proposal: null,
    error: finalChunk.error || null,
    evidencePack: meta.evidencePack
  })
  const assistantMessage = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: assistantContent,
    createdAt: context.now,
    meta
  }
  if (context.mode === 'dialogue-chat') {
    assistantMessage.trace = []
    return persistRunAgentReply(store, input, {
      assistantMessage,
      actionResult,
      usage,
      provider: finalChunk.provider || provider.name || 'stream-provider',
      model: finalChunk.model || context.model,
      quickReplies: finalChunk.quickReplies || (normalizedFinal.quickReplies?.length ? normalizedFinal.quickReplies : normalizedStream.quickReplies),
      proposal: null,
      error: finalChunk.error || null
    })
  }
  const proposal = buildAgentProposal({
    assistantMessage,
    actionResult,
    proposal: sourceProposal,
    raw: finalChunk.raw || (normalizedStream.proposal ? { streamedContent: content } : null)
  }, context)
  assistantMessage.meta.evidencePack = buildAgentEvidencePack(context, {
    actionResult,
    proposal,
    error: finalChunk.error || null
  })
  assistantMessage.meta.answerEvaluation = buildAgentAnswerEvaluation(assistantMessage.content, context, {
    actionResult,
    proposal,
    error: finalChunk.error || null,
    evidencePack: assistantMessage.meta.evidencePack
  })
  assistantMessage.trace = buildAgentTraceItems(context, {
    actionResult,
    proposal,
    error: finalChunk.error || null,
    evidencePack: assistantMessage.meta.evidencePack
  })
  for (const item of assistantMessage.trace) {
    emitAgentTrace(onEvent, {
      key: item.key,
      label: item.label,
      status: item.status,
      text: item.summary,
      summary: item.summary
    })
  }
  return persistRunAgentReply(store, input, {
    assistantMessage,
    actionResult,
    usage,
    provider: finalChunk.provider || provider.name || 'stream-provider',
    model: finalChunk.model || context.model,
    quickReplies: finalChunk.quickReplies || (normalizedFinal.quickReplies?.length ? normalizedFinal.quickReplies : normalizedStream.quickReplies),
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
  const selectedProposal = proposalForSelectedLayoutOption(proposal, payload)
  let modelPatch = null
  const provider = options.agentProvider
  if (proposal?.id && provider && typeof provider.generate === 'function') {
    try {
      const confirmContext = buildConfirmAgentContext(run, selectedProposal, payload, payload.model || run.model)
      confirmContext.timeoutMs = payload.timeoutMs ?? options.timeoutMs
      const generatedPatch = await provider.generate(confirmContext)
      modelPatch = extractConfirmModelPatch(generatedPatch)
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

function escapeArtifactHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function artifactScriptString(value = '') {
  return JSON.stringify(String(value || '')).replace(/<\//g, '<\\/')
}

function canvasNodeTextItems(node = {}) {
  return (Array.isArray(node.content) ? node.content : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 8)
}

function stageCanvasNodes(run = {}, stageId = '') {
  const nodes = run.documentAnalysis?.totalDesignFlow?.stageCanvases?.[stageId]?.nodes
  return Array.isArray(nodes) ? nodes : []
}

function normalizeArtifactLookupText(value = '') {
  return String(value || '')
    .replace(/\s*HTML\s*$/i, '')
    .replace(/\s*UI视觉\s*$/i, '')
    .replace(/\s*高保真\s*$/i, '')
    .trim()
    .toLowerCase()
}

function htmlSourcePageId(node = {}) {
  const sourcePageId = String(node.sourcePageId || node.pageId || '').trim()
  if (sourcePageId) return sourcePageId
  const id = String(node.id || '').trim()
  if (id.startsWith('html-page-')) return id.slice('html-page-'.length)
  return ''
}

function findHtmlStageSourceNode(run = {}, htmlNode = {}, stageId = '') {
  const nodes = stageCanvasNodes(run, stageId)
  if (!nodes.length) return null
  const sourcePageId = htmlSourcePageId(htmlNode)
  if (sourcePageId) {
    const byId = nodes.find((node) =>
      node?.id === sourcePageId ||
      node?.sourcePageId === sourcePageId ||
      node?.pageId === sourcePageId ||
      `ui-${node?.id}` === sourcePageId ||
      `html-page-${node?.id}` === htmlNode.id
    )
    if (byId) return byId
  }
  const htmlTitle = normalizeArtifactLookupText(htmlNode.title || htmlNode.codePreview?.previewTitle || '')
  if (!htmlTitle) return null
  return nodes.find((node) => normalizeArtifactLookupText(node?.title || node?.visualBrief?.pageTitle || '') === htmlTitle) || null
}

function compactArtifactItems(items = [], limit = 8) {
  return (Array.isArray(items) ? items : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit)
}

function compactWireframeItems(wireframe = '', limit = 8) {
  return String(wireframe || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s+|>\-•·*#\d.、]+/, '').trim())
    .filter((line) => line && !/^[┌┐└┘├┤┬┴┼─│]+$/.test(line))
    .slice(0, limit)
}

function uniqueArtifactItems(items = [], limit = 8) {
  const seen = new Set()
  const result = []
  for (const item of items) {
    const text = String(item || '').trim()
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    result.push(text)
    if (result.length >= limit) break
  }
  return result
}

function htmlCanvasArtifactContext(node = {}, run = {}) {
  const interactionNode = findHtmlStageSourceNode(run, node, 'interaction-lofi')
  const visualNode = findHtmlStageSourceNode(run, node, 'ui-visual')
  const layoutArtifact = interactionNode?.pageLayoutArtifact || null
  const interactionSpec = interactionNode?.interactionSpecArtifact || null
  const visualBrief = visualNode?.visualBrief && typeof visualNode.visualBrief === 'object' ? visualNode.visualBrief : {}
  const visualPreview = visualNode?.visualPreview && typeof visualNode.visualPreview === 'object' ? visualNode.visualPreview : {}
  const sections = Array.isArray(layoutArtifact?.sections) ? layoutArtifact.sections : []
  const wireframe = String(layoutArtifact?.asciiWireframe || layoutArtifact?.rawText || '').trim()
  const wireframeItems = compactWireframeItems(wireframe, 8)
  const sectionItems = sections.flatMap((section) => {
    const title = String(section?.title || '').trim()
    const items = compactArtifactItems(section?.items, 4)
    return [title, ...items].filter(Boolean)
  })
  const stateItems = compactArtifactItems(interactionSpec?.states || interactionSpec?.stateCoverage || [], 6)
  const gestureItems = compactArtifactItems(interactionSpec?.gestures || interactionSpec?.gestureNotes || [], 6)
  const componentItems = compactArtifactItems(visualBrief.componentChecklist || visualBrief.components || [], 8)
  const fallbackItems = canvasNodeTextItems(node)
  return {
    pageTitle: interactionNode?.title || visualBrief.pageTitle || node.title || '页面预览',
    summary: interactionNode?.summary || node.summary || run.input || '根据当前总流程画布生成的 HTML 预览。',
    wireframe,
    interactionDetails: String(layoutArtifact?.interactionDetails || layoutArtifact?.modelDecision || '').trim(),
    layoutItems: uniqueArtifactItems([...wireframeItems, ...sectionItems], 8),
    stateItems,
    gestureItems,
    componentItems,
    visualFocus: String(visualBrief.layoutFocus || visualBrief.goal || '').trim(),
    visualPrompt: String(visualPreview.imagePrompt || visualBrief.imagePrompt || '').trim(),
    fallbackItems
  }
}

function buildHtmlCanvasArtifact(node = {}, run = {}) {
  const context = htmlCanvasArtifactContext(node, run)
  const title = node.title || `${context.pageTitle} HTML`
  const layoutItems = context.layoutItems.length ? context.layoutItems : context.fallbackItems
  const primaryModules = layoutItems.length ? layoutItems : ['核心信息区', '内容列表', '主操作区']
  const visualComponents = context.componentItems.length ? context.componentItems : primaryModules.slice(0, 6)
  const moduleCards = primaryModules.slice(0, 6).map((item, index) =>
    `<article class="app-card module-card"><b>${escapeArtifactHtml(item)}</b><span>${escapeArtifactHtml(visualComponents[index % visualComponents.length] || '页面组件')}</span></article>`
  ).join('')
  const serviceItems = visualComponents.slice(0, 8).map((item, index) =>
    `<button type="button" class="service-entry" data-html-demo-action="component-${index}"><span>${escapeArtifactHtml(item.slice(0, 2) || '模')}</span><b>${escapeArtifactHtml(item)}</b></button>`
  ).join('')
  const gestureItems = context.gestureItems.length ? context.gestureItems : ['点击主操作后更新页面状态']
  const gestureHtml = gestureItems.slice(0, 3).map((item) => `<li>${escapeArtifactHtml(item)}</li>`).join('')
  const visualFocus = context.visualFocus || '移动端页面层级清晰，主操作突出。'
  const defaultState = context.stateItems[0] || '默认态'
  const loadingState = context.stateItems.find((item) => /加载|loading/i.test(item)) || '加载态'
  const emptyState = context.stateItems.find((item) => /空|empty/i.test(item)) || '空状态'
  const failedState = context.stateItems.find((item) => /失败|错误|重试|fail|error/i.test(item)) || '失败重试态'
  const stateHtml = [
    { label: defaultState, action: 'toggle-default' },
    { label: loadingState, action: 'toggle-loading' },
    { label: emptyState, action: 'toggle-empty' },
    { label: failedState, action: 'toggle-failed' }
  ].map((item) => `<button type="button" data-html-demo-action="${item.action}">${escapeArtifactHtml(item.label)}</button>`).join('')
  const successState = gestureItems.find((item) => /点击|加购|提交|确认|主操作/.test(item)) || gestureItems[0] || '主操作已执行'
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeArtifactHtml(title)}</title>
  ${context.visualPrompt ? `<meta name="workflow-visual-prompt" content="${escapeArtifactHtml(context.visualPrompt)}" />` : ''}
  <style>
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #eef1f5; color: #171a1f; }
    button { font: inherit; }
    .mobile-screen { width: min(100%, 390px); min-height: 100vh; margin: 0 auto; background: #f7f8fa; overflow: hidden; }
    .app-hero { position: relative; padding: 16px 18px 22px; overflow: hidden; background: linear-gradient(135deg, #fff1d8 0%, #ffe1b8 52%, #fff7ec 100%); }
    .app-hero::after { content: ""; position: absolute; right: -72px; top: -84px; width: 220px; height: 220px; border-radius: 999px; background: rgba(255,255,255,.42); }
    .status-bar, .nav-row, .profile-row, .asset-strip, .section-head { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .status-bar { font-size: 13px; font-weight: 800; color: #20242b; }
    .status-bar span:first-child { padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,.72); }
    .nav-row { margin-top: 12px; }
    .nav-row button { width: 32px; height: 32px; border: 0; border-radius: 999px; background: rgba(255,255,255,.54); color: #1e232b; }
    .nav-row h1 { margin: 0; font-size: 18px; line-height: 1.2; }
    .profile-row { margin-top: 24px; align-items: center; }
    .avatar { width: 64px; height: 64px; border-radius: 999px; border: 4px solid rgba(255,255,255,.9); background: linear-gradient(135deg, #d7f5f0, #f7c8c5); display: grid; place-items: center; color: #222; font-size: 28px; font-weight: 900; box-shadow: 0 10px 24px rgba(85,55,15,.12); }
    .profile-copy { flex: 1; min-width: 0; display: grid; gap: 6px; }
    .profile-copy strong { font-size: 20px; line-height: 1.2; }
    .profile-copy small { color: #6d5b3b; font-size: 12px; }
    .vip-card { min-width: 112px; border: 0; border-radius: 12px; padding: 12px; background: linear-gradient(135deg, #292521, #111); color: #ffdca2; font-weight: 800; box-shadow: 0 12px 28px rgba(40,24,8,.22); }
    .asset-strip { margin: -18px 16px 0; padding: 14px 0; border-radius: 14px; background: #fff; box-shadow: 0 10px 28px rgba(26,33,44,.08); }
    .asset-strip article { flex: 1; display: grid; justify-items: center; gap: 4px; border-right: 1px solid #eef0f3; }
    .asset-strip article:last-child { border-right: 0; }
    .asset-strip b { font-size: 17px; }
    .asset-strip span { color: #7a818c; font-size: 12px; }
    .content { padding: 14px 16px 24px; display: grid; gap: 12px; }
    .app-card { border-radius: 16px; background: #fff; padding: 16px; box-shadow: 0 8px 24px rgba(26,33,44,.06); }
    .section-head { margin-bottom: 14px; }
    .section-head strong { font-size: 17px; }
    .section-head span { color: #9aa1ab; font-size: 12px; }
    .module-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .module-card { box-shadow: none; border: 1px solid #edf0f4; display: grid; gap: 6px; min-height: 78px; }
    .module-card b { font-size: 14px; }
    .module-card span { color: #7a818c; font-size: 12px; line-height: 1.45; }
    .service-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .service-entry { min-width: 0; border: 0; background: transparent; color: #394150; display: grid; justify-items: center; gap: 8px; cursor: pointer; }
    .service-entry span { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; color: #fff; font-size: 12px; font-weight: 900; background: linear-gradient(135deg, #ff9f43, #7d8cff); }
    .service-entry b { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
    .state-panel { display: grid; gap: 12px; }
    .state-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .state-actions button { border: 1px solid #f0d6ae; border-radius: 999px; background: #fff7eb; color: #9a5b11; padding: 7px 10px; font-size: 12px; font-weight: 800; }
    .demo-state { border-radius: 12px; background: #f4f7fb; padding: 12px; color: #303743; font-size: 13px; font-weight: 800; }
    .gesture-list { margin: 0; padding-left: 18px; color: #68717d; font-size: 12px; line-height: 1.7; }
    .primary-action { width: 100%; height: 44px; border: 0; border-radius: 999px; background: #111827; color: #fff; font-weight: 900; }
  </style>
</head>
<body>
  <main class="mobile-screen" data-html-preview="mobile-page" data-visual-focus="${escapeArtifactHtml(visualFocus)}">
    <section class="app-hero">
      <div class="status-bar"><span>47:10</span><span>5G 100%</span></div>
      <div class="nav-row">
        <button type="button" aria-label="返回">‹</button>
        <h1>${escapeArtifactHtml(context.pageTitle || title)}</h1>
        <button type="button" aria-label="更多">•••</button>
      </div>
      <div class="profile-row">
        <div class="avatar">${escapeArtifactHtml((context.pageTitle || title).slice(0, 1))}</div>
        <div class="profile-copy">
          <strong>${escapeArtifactHtml(context.pageTitle || title)}</strong>
          <small>${escapeArtifactHtml(context.summary)}</small>
        </div>
        <button type="button" class="vip-card" data-html-demo-action="primary-action">会员中心</button>
      </div>
    </section>
    <section class="asset-strip" aria-label="关键指标">
      <article><b>¥ 168.00</b><span>余额</span></article>
      <article><b>2360</b><span>积分</span></article>
      <article><b>6</b><span>优惠券</span></article>
    </section>
    <section class="content">
      <article class="app-card">
        <div class="section-head"><strong>核心模块</strong><span>更多 ›</span></div>
        <div class="module-grid">${moduleCards}</div>
      </article>
      <article class="app-card">
        <div class="section-head"><strong>服务入口</strong><span>${escapeArtifactHtml(visualFocus)}</span></div>
        <div class="service-grid">${serviceItems}</div>
      </article>
      <article class="app-card state-panel">
        <div class="section-head"><strong>交互状态</strong><span>可点击演示</span></div>
        <div class="state-actions">${stateHtml}</div>
        <ul class="gesture-list">${gestureHtml}</ul>
        <div class="demo-state" data-state-target="demo-state">当前：${escapeArtifactHtml(defaultState)}</div>
        <button type="button" class="primary-action" data-html-demo-action="primary-action">主操作</button>
      </article>
    </section>
  </main>
  <script>
    (() => {
      const stateTarget = document.querySelector('[data-state-target="demo-state"]')
      const states = {
        default: ${artifactScriptString(`当前：${defaultState}`)},
        loading: ${artifactScriptString(`当前：${loadingState}`)},
        empty: ${artifactScriptString(`当前：${emptyState}`)},
        failed: ${artifactScriptString(`当前：${failedState}`)},
        success: ${artifactScriptString(`已触发：${successState}`)}
      }
      const setState = (text) => {
        if (stateTarget) stateTarget.textContent = text || states.default
      }
      document.querySelectorAll('[data-html-demo-action]').forEach((button) => {
        button.addEventListener('click', () => {
          const action = button.getAttribute('data-html-demo-action')
          if (action === 'toggle-loading') setState(states.loading)
          else if (action === 'toggle-empty') setState(states.empty)
          else if (action === 'toggle-failed') setState(states.failed)
          else setState(states.success)
        })
      })
    })()
  </script>
</body>
</html>`
}

function buildVueCanvasAppFile(node = {}, run = {}) {
  const title = node.title || 'Vue 页面'
  const items = canvasNodeTextItems(node)
  return `<template>
  <main class="workflow-page">
    <h1>${escapeArtifactHtml(title)}</h1>
    <p>${escapeArtifactHtml(node.summary || run.input || '根据当前总流程画布生成的 Vue 页面。')}</p>
    <section class="workflow-list">
      <article v-for="item in items" :key="item">{{ item }}</article>
    </section>
    <button type="button">主操作</button>
  </main>
</template>

<script setup>
const items = ${JSON.stringify(items.length ? items : ['等待补充页面内容、状态和交互说明。'], null, 2)}
</script>

<style scoped>
.workflow-page { min-height: 100vh; max-width: 420px; margin: 0 auto; padding: 24px; background: #fff; color: #111827; }
.workflow-page h1 { margin: 0 0 10px; font-size: 24px; }
.workflow-page p { color: #4b5563; line-height: 1.7; }
.workflow-list { display: grid; gap: 10px; margin: 18px 0; }
.workflow-list article { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; background: #f9fafb; }
button { width: 100%; height: 44px; border: 0; border-radius: 10px; background: #111827; color: #fff; font-weight: 800; }
</style>`
}

function buildVueCanvasArtifact(node = {}, run = {}) {
  const appFile = buildVueCanvasAppFile(node, run)
  const title = node.title || 'Vue 页面'
  const packageJson = {
    scripts: {
      dev: 'vite --host 0.0.0.0',
      build: 'vite build',
      preview: 'vite preview --host 0.0.0.0'
    },
    dependencies: {
      '@vitejs/plugin-vue': '^5.2.4',
      vite: '^5.4.19',
      vue: '^3.5.17'
    },
    devDependencies: {}
  }
  return {
    code: appFile,
    files: [
      {
        path: 'package.json',
        language: 'json',
        content: JSON.stringify({
          name: 'workflow-generated-vue-page',
          version: '0.1.0',
          private: true,
          type: 'module',
          ...packageJson
        }, null, 2)
      },
      {
        path: 'index.html',
        language: 'html',
        content: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeArtifactHtml(title)}</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>`
      },
      {
        path: 'src/main.js',
        language: 'javascript',
        content: `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
`
      },
      {
        path: 'src/App.vue',
        language: 'vue',
        content: appFile
      },
      {
        path: 'README.md',
        language: 'markdown',
        content: `# ${title}

这是根据总流程画布节点生成的 Vue 工程包。

## 运行

\`\`\`bash
npm install
npm run dev
\`\`\`
`
      }
    ]
  }
}

function compactPromptText(value = '', limit = 1800) {
  const text = String(value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n...`
}

function pageIdFromVisualNode(node = {}) {
  const sourcePageId = String(node.sourcePageId || node.pageId || '').trim()
  if (sourcePageId) return sourcePageId
  const id = String(node.id || '').trim()
  if (id.startsWith('ui-')) return id.slice(3)
  return ''
}

function normalizeVisualPageTitle(title = '') {
  return String(title || '')
    .replace(/\s*UI视觉\s*$/i, '')
    .replace(/\s*高保真\s*$/i, '')
    .trim()
}

function findInteractionLofiSourceNode(run = {}, visualNode = {}) {
  const interactionNodes = run.documentAnalysis?.totalDesignFlow?.stageCanvases?.['interaction-lofi']?.nodes || []
  if (!Array.isArray(interactionNodes) || !interactionNodes.length) return null
  const sourcePageId = pageIdFromVisualNode(visualNode)
  if (sourcePageId) {
    const byId = interactionNodes.find((node) =>
      node?.id === sourcePageId ||
      node?.sourcePageId === sourcePageId ||
      node?.pageId === sourcePageId ||
      `ui-${node?.id}` === visualNode.id
    )
    if (byId) return byId
  }
  const visualTitle = normalizeVisualPageTitle(visualNode.title || visualNode.visualBrief?.pageTitle || '')
  if (!visualTitle) return null
  return interactionNodes.find((node) => normalizeVisualPageTitle(node?.title || '') === visualTitle) || null
}

function normalizeVisualAspectRatio(node = {}, payload = {}) {
  const candidates = [
    payload.targetAspectRatio,
    payload.aspectRatio,
    payload.generationAction?.aspectRatio,
    node.visualPreview?.targetAspectRatio,
    node.visualPreview?.aspectRatio,
    node.visualPreview?.screenRatio,
    node.visualBrief?.targetAspectRatio,
    node.visualBrief?.aspectRatio,
    node.artifact?.targetAspectRatio,
    node.artifact?.aspectRatio,
    node.artifact?.screenRatio
  ]
  for (const candidate of candidates) {
    const value = String(candidate || '').trim()
    if (!value) continue
    const normalized = value.replace(/\s+/g, '').replace(/[：:xX]/g, ':')
    if (/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(normalized)) return normalized
  }
  return ''
}

function normalizeVisualTargetImageSize(node = {}, payload = {}, run = {}) {
  const explicit = payload.targetImageSize && typeof payload.targetImageSize === 'object' && !Array.isArray(payload.targetImageSize)
    ? payload.targetImageSize
    : null
  const explicitWidth = Number(explicit?.width)
  if (Number.isFinite(explicitWidth) && explicitWidth > 0) {
    return { width: Math.round(explicitWidth) }
  }
  const text = [
    node?.title,
    node?.summary,
    node?.visualBrief?.pageTitle,
    node?.visualBrief?.goal,
    node?.visualPreview?.imagePrompt,
    run?.input,
    run?.workflowName
  ].map((item) => String(item || '')).join(' ')
  if (/web|网页|后台|管理端|PC|桌面|dashboard|admin/i.test(text) && !/小程序|移动端|手机|app|mobile/i.test(text)) {
    return { width: 1920 }
  }
  return { width: 375 }
}

function visualTargetAspectRatio(node = {}, payload = {}, run = {}) {
  const explicit = normalizeVisualAspectRatio(node, payload)
  if (explicit) return explicit
  const size = normalizeVisualTargetImageSize(node, payload, run)
  return size.width === 1920 ? '1920:1080' : '375:812'
}

function visualTargetWidthPrompt(targetImageSize = null) {
  const width = Number(targetImageSize?.width)
  return Number.isFinite(width) && width > 0
    ? `目标图片宽度：${Math.round(width)}px，高度按内容比例自适应`
    : ''
}

function normalizeProjectVisualContext(payload = {}, run = {}) {
  if (run.demandScope !== 'project') return null
  const context = payload.projectVisualContext && typeof payload.projectVisualContext === 'object' && !Array.isArray(payload.projectVisualContext)
    ? payload.projectVisualContext
    : null
  if (!context) return null
  const pages = Array.isArray(context.pages)
    ? context.pages
      .slice(0, 6)
      .map((page, index) => ({
        title: String(page?.title || page?.pageTitle || `项目参考页面 ${index + 1}`).trim(),
        screenshotUrl: String(page?.screenshotUrl || page?.imageUrl || page?.imageDataUrl || '').trim(),
        viewport: page?.viewport && typeof page.viewport === 'object' ? page.viewport : null,
        visualRect: page?.visualRect && typeof page.visualRect === 'object' ? page.visualRect : null,
        components: Array.isArray(page?.components) ? page.components.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8) : []
      }))
      .filter((page) => page.title || page.screenshotUrl || page.components.length)
    : []
  const notes = Array.isArray(context.notes)
    ? context.notes.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8)
    : []
  if (!pages.length && !notes.length) return null
  return {
    source: String(context.source || 'project-knowledge').trim(),
    pages,
    notes
  }
}

function projectVisualContextPrompt(context = null) {
  if (!context) return ''
  const pageLines = (Array.isArray(context.pages) ? context.pages : [])
    .map((page, index) => {
      const viewport = page.viewport?.width && page.viewport?.height ? `视口 ${page.viewport.width}x${page.viewport.height}` : ''
      const components = page.components?.length ? `组件/风格：${page.components.join('、')}` : ''
      const screenshot = page.screenshotUrl ? `截图：${page.screenshotUrl}` : ''
      return [`${index + 1}. ${page.title || '项目参考页面'}`, viewport, components, screenshot].filter(Boolean).join('；')
    })
    .filter(Boolean)
  const notes = Array.isArray(context.notes) && context.notes.length ? `视觉规则：${context.notes.join('；')}` : ''
  return [
    '项目知识库视觉参考：',
    ...pageLines,
    notes,
    '使用这些页面作为品牌、组件密度、圆角、色彩、图片风格和层级关系的视觉参考；不要照抄无关业务内容。'
  ].filter(Boolean).join('\n')
}

function isImageDataUrl(value = '') {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value || ''))
}

async function resolveProjectVisualReferenceImages(context = null, options = {}) {
  const pages = Array.isArray(context?.pages) ? context.pages : []
  const seen = new Set()
  const references = []
  for (const page of pages) {
    const sourceUrl = String(page?.screenshotUrl || page?.imageUrl || page?.imageDataUrl || '').trim()
    if (!sourceUrl || seen.has(sourceUrl)) continue
    seen.add(sourceUrl)
    let resolved = null
    if (isImageDataUrl(sourceUrl)) {
      resolved = { imageDataUrl: sourceUrl, sourceUrl }
    } else if (typeof options.resolveImageReference === 'function') {
      resolved = await options.resolveImageReference(sourceUrl, page)
    }
    if (!resolved?.imageDataUrl) continue
    references.push({
      title: resolved.title || page.title || '项目知识库参考图',
      sourceUrl: resolved.sourceUrl || sourceUrl,
      imageDataUrl: resolved.imageDataUrl,
      viewport: page.viewport || null,
      visualRect: page.visualRect || null
    })
    if (references.length >= 4) break
  }
  return references
}

function visualPromptFromUpstreamArtifacts(node = {}, run = {}, payload = {}) {
  const basePrompt = node.visualPreview?.imagePrompt || node.visualBrief?.imagePrompt || `为「${node.title || '当前页面'}」生成高保真 UI 视觉稿。`
  const sourceNode = findInteractionLofiSourceNode(run, node)
  const artifact = sourceNode?.pageLayoutArtifact || null
  const aspectRatio = visualTargetAspectRatio(node, payload, run)
  const targetImageSize = normalizeVisualTargetImageSize(node, payload, run)
  const projectVisualContext = normalizeProjectVisualContext(payload, run)
  const projectVisualPrompt = projectVisualContextPrompt(projectVisualContext)
  if (!artifact) {
    return [
      basePrompt,
      aspectRatio ? `目标图片比例：${aspectRatio}` : '',
      visualTargetWidthPrompt(targetImageSize),
      projectVisualPrompt
    ].filter(Boolean).join('\n\n')
  }
  const wireframe = compactPromptText(artifact.asciiWireframe || artifact.rawText || '', 1800)
  const screenContract = artifact.screenContract && typeof artifact.screenContract === 'object'
    ? compactPromptText(JSON.stringify(artifact.screenContract, null, 2), 2200)
    : ''
  const sections = Array.isArray(artifact.sections)
    ? artifact.sections
      .slice(0, 8)
      .map((section) => {
        const items = Array.isArray(section?.items) ? section.items.join('；') : ''
        return [section?.title, items].filter(Boolean).join('：')
      })
      .filter(Boolean)
    : []
  const interactionDetails = compactPromptText([
    artifact.interactionDetails,
    artifact.modelDecision,
    sections.join('\n')
  ].filter(Boolean).join('\n'), 900)
  return [
    basePrompt,
    '',
    '必须严格基于上一阶段交互低保/页面骨架生成，不要自由改版，不要把页面改成无关餐馆/外卖首页。',
    '保留页面结构、固定区、滚动区、底部操作区和主按钮的位置关系；只做视觉高保真化。',
    '',
    `页面：${sourceNode.title || node.title || '当前页面'}`,
    sourceNode.summary ? `页面摘要：${sourceNode.summary}` : '',
    aspectRatio ? `目标图片比例：${aspectRatio}` : '',
    visualTargetWidthPrompt(targetImageSize),
    projectVisualPrompt,
    '',
    wireframe ? `上一阶段交互低保 ASCII 框架：\n${wireframe}` : '',
    screenContract ? `Screen Contract（页面契约，优先级高于视觉自由发挥）：\n${screenContract}` : '',
    interactionDetails ? `交互与布局说明：\n${interactionDetails}` : '',
    '',
    '高保真要求：真实产品 UI 截图质感；线框中出现的导航、列表、卡片、悬浮入口、底部 Tab、主按钮和固定/滚动区域必须保留。'
  ].filter(Boolean).join('\n')
}

async function buildVisualCanvasArtifact(node = {}, payload = {}, run = {}, options = {}) {
  const now = new Date().toISOString()
  const prompt = visualPromptFromUpstreamArtifacts(node, run, payload)
  const aspectRatio = visualTargetAspectRatio(node, payload, run)
  const targetImageSize = normalizeVisualTargetImageSize(node, payload, run)
  const projectVisualContext = normalizeProjectVisualContext(payload, run)
  const referenceImages = await resolveProjectVisualReferenceImages(projectVisualContext, options)
  const provider = options.imageProvider
  // UI visual cards are placeholders until an image provider generates an
  // artifact. Keep configuration failures as node status instead of inventing a
  // fake high-fidelity image.
  if (!provider || typeof provider.generate !== 'function') {
    return {
      kind: 'visual',
      generatedAt: now,
      imageStatus: 'configuration-required',
      imagePrompt: prompt,
      aspectRatio,
      targetImageSize,
      projectVisualContext,
      referenceImages: referenceImages.map(({ imageDataUrl, ...item }) => item),
      configurationMessage: '图片生成模型未配置：请配置可用的 gpt-image-2 / 图片生成服务后再生成高保真图。',
      visualPreview: {
        ...(node.visualPreview || {}),
        imageStatus: 'configuration-required',
        imagePrompt: prompt,
        aspectRatio,
        targetImageSize,
        referenceImageCount: referenceImages.length,
        configurationMessage: '图片生成模型未配置：请配置可用的 gpt-image-2 / 图片生成服务后再生成高保真图。',
        figmaReady: true
      }
    }
  }
  const targetGenerator = payload.targetGenerator || payload.generationAction?.targetGenerator || node.targetGenerator || 'gpt-image-2'
  let result = null
  try {
    result = await provider.generate({
      prompt,
      node,
      run,
      targetGenerator,
      timeoutMs: payload.timeoutMs ?? options.timeoutMs,
      aspectRatio,
      targetImageSize,
      projectVisualContext: projectVisualContext || { pages: [], notes: [] },
      referenceImages
    })
  } catch (error) {
    const normalized = normalizeModelProviderError(error, {
      provider: provider.name || 'image-provider',
      model: targetGenerator,
      apiSurface: referenceImages.length ? 'images.edits' : 'images.generations'
    })
    const message = normalized.message || '图片生成服务调用失败。'
    return {
      kind: 'visual',
      generatedAt: now,
      imageStatus: 'failed',
      imagePrompt: prompt,
      aspectRatio,
      targetImageSize,
      projectVisualContext,
      referenceImages: referenceImages.map(({ imageDataUrl, ...item }) => item),
      errorCode: normalized.code || 'IMAGE_PROVIDER_FAILED',
      configurationMessage: message,
      visualPreview: {
        ...(node.visualPreview || {}),
        imageStatus: 'failed',
        imagePrompt: prompt,
        aspectRatio,
        targetImageSize,
        referenceImageCount: referenceImages.length,
        errorCode: normalized.code || 'IMAGE_PROVIDER_FAILED',
        configurationMessage: message,
        figmaReady: true
      }
    }
  }
  const imageDataUrl = result?.imageDataUrl || result?.dataUrl || result?.url || result?.imageUrl || ''
  if (!imageDataUrl) {
    return {
      kind: 'visual',
      generatedAt: now,
      imageStatus: 'failed',
      imagePrompt: prompt,
      aspectRatio,
      targetImageSize,
      projectVisualContext,
      referenceImages: referenceImages.map(({ imageDataUrl, ...item }) => item),
      configurationMessage: result?.message || '图片生成服务没有返回可展示图片。',
      visualPreview: {
        ...(node.visualPreview || {}),
        imageStatus: 'failed',
        imagePrompt: prompt,
        aspectRatio,
        targetImageSize,
        referenceImageCount: referenceImages.length,
        configurationMessage: result?.message || '图片生成服务没有返回可展示图片。',
        figmaReady: true
      }
    }
  }
  return {
    kind: 'visual',
    generatedAt: now,
    imageStatus: 'generated',
    imagePrompt: prompt,
    aspectRatio,
    targetImageSize,
    projectVisualContext,
    referenceImages: referenceImages.map(({ imageDataUrl, ...item }) => item),
    imageDataUrl,
    provider: result?.provider || provider.name || 'image-provider',
    model: result?.model || payload.targetGenerator || node.targetGenerator || 'gpt-image-2',
    revisedPrompt: result?.revisedPrompt || '',
    configurationMessage: '',
    errorCode: '',
    visualPreview: {
      ...(node.visualPreview || {}),
      imageStatus: 'generated',
      imagePrompt: result?.revisedPrompt || prompt,
      aspectRatio,
      targetImageSize,
      referenceImageCount: referenceImages.length,
      imageDataUrl,
      provider: result?.provider || provider.name || 'image-provider',
      model: result?.model || payload.targetGenerator || node.targetGenerator || 'gpt-image-2',
      configurationMessage: '',
      errorCode: '',
      figmaReady: true
    }
  }
}

async function buildCanvasNodeArtifact(node = {}, payload = {}, run = {}, options = {}) {
  const target = String(payload.targetGenerator || payload.generationAction?.targetGenerator || node.targetGenerator || '').trim()
  const now = new Date().toISOString()
  if (target === 'vue') {
    const vueArtifact = buildVueCanvasArtifact(node, run)
    return {
      kind: 'vue',
      generatedAt: now,
      code: vueArtifact.code,
      files: vueArtifact.files,
      codePreview: {
        previewTitle: 'Vue 运行预览',
        previewSummary: '已根据当前画布节点生成 Vue 工程文件包，当前预览 src/App.vue。',
        codeLanguage: 'vue',
        filePath: 'src/App.vue',
        files: vueArtifact.files.map((file) => ({ path: file.path, language: file.language })),
        code: vueArtifact.code
      }
    }
  }
  if (target === 'html') {
    const code = buildHtmlCanvasArtifact(node, run)
    return {
      kind: 'html',
      generatedAt: now,
      html: code,
      codePreview: {
        previewTitle: 'HTML 运行预览',
        previewSummary: '已根据当前画布节点生成可打开的 HTML 预览。',
        codeLanguage: 'html',
        code
      }
    }
  }
  return buildVisualCanvasArtifact(node, payload, run, options)
}

async function patchGeneratedArtifactOnNode(node = {}, payload = {}, run = {}, options = {}) {
  const artifact = await buildCanvasNodeArtifact(node, payload, run, options)
  const actionId = payload.generationAction?.id || payload.generationAction?.label || ''
  const nextActions = Array.isArray(node.generationActions)
    ? node.generationActions.map((action) => {
        const currentId = action?.id || action?.label || action
        if (actionId && currentId !== actionId) return action
        return {
          ...(typeof action === 'object' ? action : { label: String(action || '') }),
          status: 'generated',
          generatedAt: artifact.generatedAt
        }
      })
    : node.generationActions
  const nextArtifactStatus = artifact.imageStatus === 'configuration-required'
    ? 'pending'
    : artifact.imageStatus === 'failed'
      ? 'failed'
      : 'generated'
  return {
    ...node,
    artifactStatus: nextArtifactStatus,
    artifact,
    generationActions: nextActions,
    contentStatusLabel: nextArtifactStatus === 'generated' ? '已生成' : nextArtifactStatus === 'failed' ? '生成失败' : '待配置',
    ...(artifact.codePreview ? { codePreview: artifact.codePreview } : {}),
    ...(artifact.visualPreview ? { visualPreview: artifact.visualPreview } : {})
  }
}

function patchCanvasNodeById(canvas = {}, nodeId = '', patcher = (node) => node) {
  if (!Array.isArray(canvas.nodes)) return canvas
  return {
    ...canvas,
    nodes: canvas.nodes.map((node) => node?.id === nodeId ? patcher(node) : node)
  }
}

function findStageCanvasNodeById(totalFlow = {}, nodeId = '') {
  const stageCanvases = totalFlow?.stageCanvases || {}
  for (const [stageId, stageCanvas] of Object.entries(stageCanvases)) {
    const node = Array.isArray(stageCanvas?.nodes)
      ? stageCanvas.nodes.find((item) => item?.id === nodeId)
      : null
    if (node) return { node, stageId, canvas: stageCanvas }
  }
  return null
}

function findAnalysisCanvasNodeById(analysis = {}, nodeId = '') {
  const canvas = analysis.canvas || {}
  const node = Array.isArray(canvas.nodes)
    ? canvas.nodes.find((item) => item?.id === nodeId)
    : null
  return node ? { node, canvas } : null
}

function findGeneratedCanvasNode(analysis = {}, nodeId = '') {
  return findStageCanvasNodeById(analysis.totalDesignFlow || {}, nodeId)?.node ||
    findAnalysisCanvasNodeById(analysis, nodeId)?.node ||
    null
}

export async function generateRunCanvasNodeArtifact(store, payload = {}, options = {}) {
  const run = findRun(store, payload.runId)
  const analysis = run.documentAnalysis || {}
  const canvas = analysis.canvas || {}
  const stageNodeMatch = findStageCanvasNodeById(analysis.totalDesignFlow || {}, payload.nodeId)
  const canvasNodeMatch = findAnalysisCanvasNodeById(analysis, payload.nodeId)
  const node = stageNodeMatch?.node || canvasNodeMatch?.node
  if (!node) throw new Error(`未找到画布节点：${payload.nodeId}`)
  const patchedNode = await patchGeneratedArtifactOnNode(node, payload, run, options)
  const patcher = (targetNode) => targetNode?.id === payload.nodeId ? { ...targetNode, ...patchedNode } : targetNode
  const nextCanvas = patchCanvasNodeById(canvas, payload.nodeId, patcher)
  const currentTotalFlow = analysis.totalDesignFlow || null
  // Generated artifacts must be patched back into totalDesignFlow.stageCanvases
  // so the stage canvas, fullscreen detail, and history all stay on one source.
  const nextStageCanvases = currentTotalFlow?.stageCanvases
    ? Object.fromEntries(Object.entries(currentTotalFlow.stageCanvases).map(([stageId, stageCanvas]) => [stageId, patchCanvasNodeById(stageCanvas, payload.nodeId, patcher)]))
    : undefined
  const nextAnalysis = {
    ...analysis,
    status: 'artifact-generated',
    canvas: nextCanvas,
    totalDesignFlow: currentTotalFlow
      ? {
          ...currentTotalFlow,
          stageCanvases: nextStageCanvases
        }
      : currentTotalFlow
  }
  const nextRun = {
    ...run,
    documentAnalysis: nextAnalysis,
    projectBlueprint: nextAnalysis.blueprint || run.projectBlueprint,
    updatedAt: new Date().toISOString()
  }
  replaceRun(store, nextRun)
  const updatedNode = findGeneratedCanvasNode(nextAnalysis, payload.nodeId)
  return {
    run: nextRun,
    analysis: nextAnalysis,
    node: updatedNode,
    artifact: updatedNode?.artifact || null
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
