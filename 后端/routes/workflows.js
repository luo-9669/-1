import {
  acceptRunStep,
  appendRunMessage,
  appendRunMessageStream,
  cancelRunMessage,
  confirmRunAgentProposal,
  completeRunStep,
  createRun,
  createWorkflowRunnerStore,
  generateRunStep,
  regenerateRunStep
} from '../services/workflow-runner.js'
import { normalizeModelProviderError } from '../services/llm-provider.js'
import { buildCanvasVersion } from '../services/agent-proposal-service.js'
import { addModelCallLog } from '../services/workspace-store.js'

export { createWorkflowRunnerStore }

function mirrorWorkspaceRuns(store, runnerStore) {
  if (!store?.workflowRuns) return
  runnerStore.runs.splice(0, runnerStore.runs.length, ...store.workflowRuns)
}

async function persistWorkspaceRun(store, run) {
  if (!store?.workflowRuns) return run
  const index = store.workflowRuns.findIndex((item) => item.id === run.id)
  if (index >= 0) store.workflowRuns.splice(index, 1, run)
  else store.workflowRuns.unshift(run)
  if (typeof store.persist === 'function') await store.persist()
  return run
}

function buildConfirmPersistFailure(error, result = {}) {
  return {
    message: `画布已生成但保存失败：${error?.message || '请重试保存'}`,
    code: 'AGENT_CONFIRM_PERSIST_FAILED',
    recoveryActions: ['重试保存', '重新生成建议'],
    ...(result?.run?.id ? { runId: result.run.id } : {}),
    ...(result?.run ? { run: result.run } : {}),
    ...(result?.analysis ? { analysis: result.analysis } : {}),
    ...(result?.appliedPatch ? { appliedPatch: result.appliedPatch } : {})
  }
}

async function persistConfirmedProposalResult(store, result = {}) {
  try {
    await persistWorkspaceRun(store, result.run)
  } catch (error) {
    throw buildConfirmPersistFailure(error, result)
  }
}

function latestAnalysisVersionId(analysis = {}) {
  return Array.isArray(analysis?.versions) ? analysis.versions[0]?.id || '' : ''
}

function sameConfirmedAnalysis(persistedAnalysis = {}, incomingAnalysis = {}) {
  const persistedVersionId = latestAnalysisVersionId(persistedAnalysis)
  const incomingVersionId = latestAnalysisVersionId(incomingAnalysis)
  if (persistedVersionId && incomingVersionId && persistedVersionId === incomingVersionId) return true
  const persistedCanvasVersion = buildCanvasVersion(persistedAnalysis?.canvas || {})
  const incomingCanvasVersion = buildCanvasVersion(incomingAnalysis?.canvas || {})
  return Boolean(persistedCanvasVersion && incomingCanvasVersion && persistedCanvasVersion === incomingCanvasVersion)
}

function findPersistedConfirmResult(store, result = {}) {
  const persistedRun = Array.isArray(store?.workflowRuns)
    ? store.workflowRuns.find((run) => run.id === result?.run?.id)
    : null
  if (!persistedRun) return null
  const incomingAnalysis = result.analysis || result.run?.documentAnalysis
  if (!sameConfirmedAnalysis(persistedRun.documentAnalysis, incomingAnalysis)) return null
  return {
    ...result,
    run: persistedRun,
    analysis: persistedRun.documentAnalysis || result.analysis,
    idempotent: true
  }
}

async function resolveAgentProvider(options = {}) {
  return typeof options.agentProvider === 'function'
    ? await options.agentProvider()
    : options.agentProvider
}

function sseEvent(event, data = {}) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function workflowAgentLogPayload(payload = {}, result = {}, startedAt = Date.now(), statusOverride = '') {
  const context = payload.context || {}
  const activeNode = context.activeNode || {}
  const canvasAction = context.canvasAction || {}
  const error = result.error || result.assistantMessage?.meta?.error || {}
  const status = statusOverride || (error?.message ? 'fallback' : 'success')
  return {
    skillId: 'workflow-agent',
    resolvedSkillId: 'workflow-agent',
    projectId: result.run?.projectId || payload.projectId || '',
    runId: result.run?.id || payload.runId || payload.id || '',
    stepId: payload.stepId || '',
    nodeId: canvasAction.nodeId || activeNode.id || payload.stepId || '',
    nodeTitle: activeNode.title || '',
    action: payload.action || payload.message?.action || payload.message?.meta?.action || '',
    actionIntent: canvasAction.actionIntent || '',
    actionLabel: canvasAction.actionLabel || canvasAction.action || '',
    entrySource: payload.entrySource || 'message',
    provider: result.provider || result.assistantMessage?.meta?.provider || '',
    model: result.model || result.assistantMessage?.meta?.model || payload.model || '',
    status,
    durationMs: Date.now() - startedAt,
    usage: result.usage || result.assistantMessage?.meta?.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    fallbackReason: status === 'fallback' ? (error?.message || result.fallbackReason || '') : '',
    errorCode: error?.code || '',
    errorMessage: error?.message || '',
    recoveryActions: error?.recoveryActions || []
  }
}

async function recordWorkflowAgentModelCall(store, payload = {}, result = {}, startedAt = Date.now(), statusOverride = '') {
  if (!store?.modelCallLogs) return
  try {
    await addModelCallLog(store, workflowAgentLogPayload(payload, result, startedAt, statusOverride))
  } catch {}
}

export function workflowRoutes(store = createWorkflowRunnerStore(), options = {}) {
  const runnerStore = store.runs ? store : createWorkflowRunnerStore({ runs: store.workflowRuns || [] })

  async function create(payload = {}) {
    mirrorWorkspaceRuns(store, runnerStore)
    const isPrebuiltRun = Boolean(payload.id && (
      (payload.workflowId && Array.isArray(payload.steps)) ||
      payload.documentAnalysis ||
      payload.projectBlueprint
    ))
    const run = isPrebuiltRun
      ? {
          ...payload,
          status: payload.status || 'running',
          updatedAt: new Date().toISOString()
        }
      : createRun(runnerStore, payload)
    if (isPrebuiltRun) {
      const index = runnerStore.runs.findIndex((item) => item.id === run.id)
      if (index >= 0) runnerStore.runs.splice(index, 1, run)
      else runnerStore.runs.unshift(run)
    }
    await persistWorkspaceRun(store, run)
    return { run }
  }

  async function generate(payload = {}) {
    mirrorWorkspaceRuns(store, runnerStore)
    const result = generateRunStep(runnerStore, {
      ...payload,
      runId: payload.runId || payload.id
    })
    await persistWorkspaceRun(store, result.run)
    return result
  }

  async function regenerate(payload = {}) {
    mirrorWorkspaceRuns(store, runnerStore)
    const result = regenerateRunStep(runnerStore, {
      ...payload,
      runId: payload.runId || payload.id
    })
    await persistWorkspaceRun(store, result.run)
    return result
  }

  async function accept(payload = {}) {
    mirrorWorkspaceRuns(store, runnerStore)
    const result = acceptRunStep(runnerStore, {
      ...payload,
      runId: payload.runId || payload.id,
      content: payload.content || payload.output
    })
    await persistWorkspaceRun(store, result.run)
    return result
  }

  async function message(payload = {}) {
    mirrorWorkspaceRuns(store, runnerStore)
    const startedAt = Date.now()
    const result = await appendRunMessage(
      runnerStore,
      {
        ...payload,
        runId: payload.runId || payload.id
      },
      {
        agentProvider: await resolveAgentProvider(options),
        fallback: options.fallback
      }
    )
    await recordWorkflowAgentModelCall(store, payload, result, startedAt)
    await persistWorkspaceRun(store, result.run)
    return result
  }

  async function messageStream(payload = {}, req = null, routeContext = {}) {
    const writeEvent = typeof routeContext.writeEvent === 'function' ? routeContext.writeEvent : null
    const events = []
    const pushEvent = (event, data = {}) => {
      const chunk = sseEvent(event, data)
      events.push(chunk)
      writeEvent?.(chunk)
    }
    pushEvent('status', { status: 'generating', label: '生成回复' })
    const startedAt = Date.now()
    try {
      mirrorWorkspaceRuns(store, runnerStore)
      const result = await appendRunMessageStream(
        runnerStore,
        {
          ...payload,
          runId: payload.runId || payload.id
        },
        {
          agentProvider: await resolveAgentProvider(options),
          fallback: options.fallback
        },
        (event, data) => pushEvent(event, data)
      )
      await recordWorkflowAgentModelCall(store, payload, result, startedAt)
      await persistWorkspaceRun(store, result.run)
      if (result.assistantMessage) {
        pushEvent('message', { assistantMessage: result.assistantMessage })
      }
      pushEvent('done', result)
    } catch (error) {
      const normalized = normalizeModelProviderError(error, {
        provider: error?.provider || options.provider || 'openai-compatible',
        model: error?.model,
        apiSurface: error?.apiSurface
      })
      const errorResult = {
        error: {
          message: normalized.message || 'Agent 流式生成失败',
          code: normalized.code || 'AGENT_STREAM_FAILED',
          recoveryActions: normalized.recoveryActions || ['重试', '检查配置'],
          provider: normalized.provider,
          model: normalized.model,
          apiSurface: normalized.apiSurface,
          ...(normalized.status ? { status: normalized.status } : {}),
          ...(normalized.timeoutMs ? { timeoutMs: normalized.timeoutMs } : {})
        }
      }
      await recordWorkflowAgentModelCall(store, payload, { error: errorResult.error }, startedAt, 'failed')
      pushEvent('error', errorResult.error)
      pushEvent('done', errorResult)
    }
    return {
      contentType: 'text/event-stream; charset=utf-8',
      body: events.join('')
    }
  }

  async function cancelMessage(payload = {}) {
    mirrorWorkspaceRuns(store, runnerStore)
    const result = cancelRunMessage(runnerStore, {
      ...payload,
      runId: payload.runId || payload.id
    })
    await persistWorkspaceRun(store, result.run)
    return result
  }

  async function confirmProposal(payload = {}) {
    mirrorWorkspaceRuns(store, runnerStore)
    const result = await confirmRunAgentProposal(
      runnerStore,
      {
        ...payload,
        runId: payload.runId || payload.id
      },
      {
        agentProvider: await resolveAgentProvider(options)
      }
    )
    await persistConfirmedProposalResult(store, result)
    return result
  }

  async function saveConfirmedProposal(payload = {}) {
    const result = {
      run: payload.run,
      analysis: payload.analysis || payload.run?.documentAnalysis || null,
      appliedPatch: payload.appliedPatch || null,
      idempotent: false
    }
    if (!result.run?.id) {
      const error = new Error('缺少可保存的确认结果')
      error.code = 'AGENT_CONFIRM_SAVE_MISSING_RESULT'
      error.recoveryActions = ['重新生成建议']
      throw error
    }
    if ((payload.runId || payload.id) && result.run.id !== (payload.runId || payload.id)) {
      const error = new Error('保存结果与当前运行不匹配')
      error.code = 'AGENT_CONFIRM_SAVE_RUN_MISMATCH'
      error.recoveryActions = ['重新生成建议']
      throw error
    }
    mirrorWorkspaceRuns(store, runnerStore)
    const persistedResult = findPersistedConfirmResult(store, result)
    if (persistedResult) return persistedResult
    await persistConfirmedProposalResult(store, result)
    return result
  }

  async function confirmProposalStream(payload = {}, req = null, routeContext = {}) {
    const writeEvent = typeof routeContext.writeEvent === 'function' ? routeContext.writeEvent : null
    const events = []
    const pushEvent = (event, data = {}) => {
      const chunk = sseEvent(event, data)
      events.push(chunk)
      writeEvent?.(chunk)
    }
    pushEvent('status', { step: 'validating-proposal', status: 'merging-canvas', label: '校验提案' })
    try {
      mirrorWorkspaceRuns(store, runnerStore)
      pushEvent('status', { step: 'rewriting-current', status: 'merging-canvas', label: '重写当前画布' })
      const result = await confirmRunAgentProposal(
        runnerStore,
        {
          ...payload,
          runId: payload.runId || payload.id
        },
        {
          agentProvider: await resolveAgentProvider(options)
        }
      )
      pushEvent('status', { step: 'refreshing-downstream', status: 'merging-canvas', label: '刷新后续画布' })
      pushEvent('status', { step: 'saving-version', status: 'merging-canvas', label: '保存版本' })
      await persistConfirmedProposalResult(store, result)
      pushEvent('done', result)
    } catch (error) {
      const errorResult = {
        error: {
          message: error?.message || '确认入画布失败',
          code: error?.code || 'AGENT_CONFIRM_CANVAS_FAILED',
          recoveryActions: error?.recoveryActions || ['重试确认'],
          ...(error?.run ? { run: error.run } : {}),
          ...(error?.analysis ? { analysis: error.analysis } : {}),
          ...(error?.appliedPatch ? { appliedPatch: error.appliedPatch } : {}),
          ...(error?.runId ? { runId: error.runId } : {}),
          ...(error?.proposalId ? { proposalId: error.proposalId } : {}),
          ...(error?.currentCanvasVersion ? { currentCanvasVersion: error.currentCanvasVersion } : {}),
          ...(error?.proposalCanvasVersion ? { proposalCanvasVersion: error.proposalCanvasVersion } : {}),
          ...(error?.staleReason ? { staleReason: error.staleReason } : {})
        }
      }
      pushEvent('error', errorResult.error)
      pushEvent('done', errorResult)
    }
    return {
      contentType: 'text/event-stream; charset=utf-8',
      body: events.join('')
    }
  }

  async function complete(payload = {}) {
    mirrorWorkspaceRuns(store, runnerStore)
    const result = completeRunStep(runnerStore, {
      ...payload,
      runId: payload.runId || payload.id
    })
    await persistWorkspaceRun(store, result.run)
    return result
  }

  return {
    'POST /api/workflows/runs': create,
    'POST /api/workflows/runs/:runId/steps/:stepId/generate': generate,
    'POST /api/workflows/runs/:runId/steps/:stepId/regenerate': regenerate,
    'POST /api/workflows/runs/:runId/steps/:stepId/accept': accept,
    'POST /api/workflows/runs/:runId/steps/:stepId/messages': message,
    'POST /api/workflows/runs/:runId/steps/:stepId/messages/stream': messageStream,
    'POST /api/workflows/runs/:runId/steps/:stepId/messages/cancel': cancelMessage,
    'POST /api/workflows/runs/:runId/agent-proposals/:proposalId/confirm': confirmProposal,
    'POST /api/workflows/runs/:runId/agent-proposals/:proposalId/confirm/save': saveConfirmedProposal,
    'POST /api/workflows/runs/:runId/agent-proposals/:proposalId/confirm/stream': confirmProposalStream,
    'POST /api/workflows/runs/:runId/complete': complete,
    'POST /api/workspace/workflow-runs': create,
    'POST /api/workspace/workflow-runs/:id/generate': generate,
    'POST /api/workspace/workflow-runs/:id/regenerate': regenerate,
    'POST /api/workspace/workflow-runs/:id/accept': accept,
    'POST /api/workspace/workflow-runs/:id/messages': message,
    'POST /api/workspace/workflow-runs/:id/messages/stream': messageStream,
    'POST /api/workspace/workflow-runs/:id/messages/cancel': cancelMessage,
    'POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm': confirmProposal,
    'POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm/save': saveConfirmedProposal,
    'POST /api/workspace/workflow-runs/:id/agent-proposals/:proposalId/confirm/stream': confirmProposalStream,
    'POST /api/workspace/workflow-runs/:id/complete-step': complete
  }
}
