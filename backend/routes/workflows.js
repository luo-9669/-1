import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import {
  acceptRunStep,
  appendRunMessage,
  appendRunMessageStream,
  cancelRunMessage,
  confirmRunAgentProposal,
  completeRunStep,
  createRun,
  createWorkflowRunnerStore,
  editRunCanvasNode,
  generateRunCanvasNodeArtifact,
  generateRunStep,
  regenerateRunStep
} from '../services/workflow-runner.js'
import { createImageProviderFromModelSettings, normalizeModelProviderError } from '../services/llm-provider.js'
import { buildCanvasVersion } from '../services/agent-proposal-service.js'
import { buildAdvancedUxWebEvidencePack } from '../services/web-evidence-search.js'
import { addModelCallLog, getModelSettingsRaw } from '../services/workspace-store.js'
import { storageRoot } from '../server/server-config.mjs'

export { createWorkflowRunnerStore }

const DEFAULT_GENERATED_IMAGE_DIR = join(storageRoot, 'workspace', 'generated-images')
const DEFAULT_MATERIAL_PREVIEW_DIR = join(storageRoot, 'workspace', 'material-previews')

function safeFileSegment(value = '') {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'image'
}

function parseImageDataUrl(imageDataUrl = '') {
  const match = String(imageDataUrl || '').match(/^data:image\/([a-z0-9.+-]+);base64,([\s\S]+)$/i)
  if (!match) return null
  const format = match[1].toLowerCase()
  const extension = format === 'jpeg' || format === 'jpg' ? 'jpg' : format === 'webp' ? 'webp' : 'png'
  return {
    extension,
    contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
    buffer: Buffer.from(match[2], 'base64')
  }
}

function generatedImageDir(options = {}) {
  return options.generatedImageDir || process.env.WORKFLOW_GENERATED_IMAGE_DIR || DEFAULT_GENERATED_IMAGE_DIR
}

function materialPreviewDir(options = {}) {
  return options.materialPreviewDir || process.env.WORKSPACE_MATERIAL_PREVIEW_DIR || DEFAULT_MATERIAL_PREVIEW_DIR
}

function shouldPersistGeneratedImages(options = {}) {
  return Boolean(options.persistGeneratedImages || options.generatedImageDir || process.env.WORKFLOW_GENERATED_IMAGE_DIR)
}

function imageContentTypeForFileName(fileName = '') {
  const extension = String(fileName || '').split('.').pop()?.toLowerCase()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'gif') return 'image/gif'
  return 'image/png'
}

function workspaceImageReferenceFilePath(url = '', options = {}) {
  const source = String(url || '').trim()
  const materialMatch = source.match(/^\/api\/workspace\/material-previews\/([^/?#]+)(?:[?#].*)?$/)
  if (materialMatch) {
    const fileName = decodeURIComponent(materialMatch[1])
    if (fileName && basename(fileName) === fileName) return join(materialPreviewDir(options), fileName)
  }
  const generatedMatch = source.match(/^\/api\/workspace\/generated-images\/([^/?#]+)(?:[?#].*)?$/)
  if (generatedMatch) {
    const fileName = decodeURIComponent(generatedMatch[1])
    if (fileName && basename(fileName) === fileName) return join(generatedImageDir(options), fileName)
  }
  return ''
}

async function resolveWorkspaceImageReference(url = '', page = {}, options = {}) {
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(String(url || ''))) {
    return { imageDataUrl: url, sourceUrl: url, title: page.title || '' }
  }
  const filePath = workspaceImageReferenceFilePath(url, options)
  if (!filePath) return null
  const body = await readFile(filePath)
  if (!body.length) return null
  const contentType = imageContentTypeForFileName(filePath)
  return {
    imageDataUrl: `data:${contentType};base64,${body.toString('base64')}`,
    sourceUrl: url,
    title: page.title || ''
  }
}

async function persistGeneratedImageDataUrl(result = {}, options = {}) {
  if (!shouldPersistGeneratedImages(options)) return result
  const artifact = result.artifact || result.node?.artifact || {}
  const imageDataUrl = artifact.imageDataUrl || artifact.dataUrl || result.node?.visualPreview?.imageDataUrl || ''
  const parsed = parseImageDataUrl(imageDataUrl)
  if (!parsed || !result.run?.id || !result.node?.id) return result
  const directory = generatedImageDir(options)
  await mkdir(directory, { recursive: true })
  const fileName = [
    safeFileSegment(result.run.id),
    safeFileSegment(result.node.id),
    Date.now(),
    randomUUID().slice(0, 8)
  ].join('-') + `.${parsed.extension}`
  const localImagePath = join(directory, fileName)
  await writeFile(localImagePath, parsed.buffer)
  const imageUrl = `/api/workspace/generated-images/${encodeURIComponent(fileName)}`
  const patchNode = (node = {}) => {
    if (node?.id !== result.node.id) return node
    return {
      ...node,
      artifact: node.artifact
        ? {
            ...node.artifact,
            imageUrl,
            localImagePath,
            localImageContentType: parsed.contentType
          }
        : node.artifact,
      visualPreview: node.visualPreview
        ? {
            ...node.visualPreview,
            imageUrl,
            localImagePath,
            localImageContentType: parsed.contentType
          }
        : node.visualPreview
    }
  }
  const patchCanvas = (canvas = {}) => Array.isArray(canvas.nodes)
    ? { ...canvas, nodes: canvas.nodes.map(patchNode) }
    : canvas
  const patchAnalysis = (analysis = {}) => {
    const totalFlow = analysis.totalDesignFlow || null
    return {
      ...analysis,
      canvas: patchCanvas(analysis.canvas || {}),
      totalDesignFlow: totalFlow
        ? {
            ...totalFlow,
            stageCanvases: totalFlow.stageCanvases
              ? Object.fromEntries(Object.entries(totalFlow.stageCanvases).map(([stageId, canvas]) => [stageId, patchCanvas(canvas)]))
              : totalFlow.stageCanvases
          }
        : totalFlow
    }
  }
  const nextAnalysis = patchAnalysis(result.analysis || result.run.documentAnalysis || {})
  const nextRun = {
    ...result.run,
    documentAnalysis: patchAnalysis(result.run.documentAnalysis || nextAnalysis)
  }
  const nextNode = patchNode(result.node || {})
  const nextArtifact = {
    ...(result.artifact || {}),
    imageUrl,
    localImagePath,
    localImageContentType: parsed.contentType
  }
  return {
    ...result,
    run: nextRun,
    analysis: nextAnalysis,
    node: nextNode,
    artifact: nextArtifact
  }
}

async function readGeneratedImage(payload = {}, options = {}) {
  const fileName = basename(String(payload.fileName || ''))
  if (!fileName || fileName !== payload.fileName || !/^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp)$/i.test(fileName)) {
    const error = new Error('图片文件名无效')
    error.code = 'INVALID_GENERATED_IMAGE_NAME'
    throw error
  }
  const extension = fileName.split('.').pop().toLowerCase()
  const contentType = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'webp' ? 'image/webp' : 'image/png'
  return {
    contentType,
    body: await readFile(join(generatedImageDir(options), fileName))
  }
}

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

function resolveImageProvider(store = {}, options = {}) {
  if (options.imageProvider) return options.imageProvider
  if (!Array.isArray(store?.settings)) return null
  const settings = getModelSettingsRaw(store)
  return createImageProviderFromModelSettings(settings, options.fetchImpl)
}

function resolveAgentTimeoutMs(store = {}, options = {}, payload = {}) {
  if (payload.timeoutMs === 0 || options.timeoutMs === 0) return 0
  const configuredTimeoutMs = Number(options.timeoutMs || getModelSettingsRaw(store)?.timeoutMs || 0)
  if (configuredTimeoutMs > 0) return configuredTimeoutMs
  const chatTimeoutMs = Number(options.messageTimeoutMs || process.env.WORKFLOW_AGENT_MESSAGE_TIMEOUT_MS || 360000)
  const timeoutMs = chatTimeoutMs
  return timeoutMs > 0 ? timeoutMs : undefined
}

async function withWorkflowAgentWebEvidence(payload = {}, options = {}) {
  if (payload.webSearchEnabled === false || payload.context?.webSearchEnabled === false) return payload
  const input = payload.message?.content || payload.content || payload.context?.message || ''
  if (!String(input || '').trim()) return payload
  const evidencePack = await buildAdvancedUxWebEvidencePack({
    input,
    webSearchEnabled: true
  }, {
    fetchImpl: options.fetchImpl || globalThis.fetch,
    limit: 4,
    timeoutMs: 12000
  })
  const webItems = Array.isArray(evidencePack.sources)
    ? evidencePack.sources.map((item) => ({
        title: item.title || '联网检索结果',
        snippet: item.snippet || '',
        sourceTitle: item.title || '',
        sourceUrl: item.url || '',
        sourceType: 'web-search',
        matchReason: `联网检索：${item.query || evidencePack.query || input}`,
        verification: { status: 'web-evidence', reason: '来自本轮后端受控联网检索' },
        evidence: item.url ? [{ title: item.title || '', url: item.url }] : []
      }))
    : []
  return {
    ...payload,
    retrievedKnowledge: [
      ...(Array.isArray(payload.retrievedKnowledge) ? payload.retrievedKnowledge : []),
      ...webItems
    ],
    context: {
      ...(payload.context || {}),
      webSearchEnabled: true,
      webEvidencePack: evidencePack,
      knowledgeRetrievalError: payload.context?.knowledgeRetrievalError || (['failed', 'empty'].includes(evidencePack.status)
        ? (evidencePack.uncertainties || []).join('；')
        : '')
    }
  }
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
    const enrichedPayload = await withWorkflowAgentWebEvidence(payload, options)
    const result = await appendRunMessage(
      runnerStore,
      {
        ...enrichedPayload,
        runId: enrichedPayload.runId || enrichedPayload.id
      },
      {
        agentProvider: await resolveAgentProvider(options),
        fallback: options.fallback,
        timeoutMs: resolveAgentTimeoutMs(store, options, payload)
      }
    )
    await recordWorkflowAgentModelCall(store, enrichedPayload, result, startedAt)
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
      const enrichedPayload = await withWorkflowAgentWebEvidence(payload, options)
      const result = await appendRunMessageStream(
        runnerStore,
        {
          ...enrichedPayload,
          runId: enrichedPayload.runId || enrichedPayload.id
        },
        {
          agentProvider: await resolveAgentProvider(options),
          fallback: options.fallback,
          timeoutMs: resolveAgentTimeoutMs(store, options, payload)
        },
        (event, data) => pushEvent(event, data)
      )
      await recordWorkflowAgentModelCall(store, enrichedPayload, result, startedAt)
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
          recoveryActions: ['重试'],
          provider: normalized.provider,
          model: normalized.model,
          apiSurface: normalized.apiSurface,
          ...(normalized.status ? { status: normalized.status } : {}),
          ...(normalized.timeoutMs ? { timeoutMs: normalized.timeoutMs } : {})
        }
      }
      await recordWorkflowAgentModelCall(store, payload, { error: errorResult.error }, startedAt, 'failed')
      pushEvent('trace', { key: 'answer', label: '回答/提案', status: 'failed', text: normalized.message || '模型生成失败' })
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
        agentProvider: await resolveAgentProvider(options),
        timeoutMs: payload.timeoutMs ?? options.timeoutMs
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
          agentProvider: await resolveAgentProvider(options),
          timeoutMs: payload.timeoutMs ?? options.timeoutMs
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

  async function editCanvasNode(payload = {}) {
    mirrorWorkspaceRuns(store, runnerStore)
    const result = await editRunCanvasNode(runnerStore, {
      ...payload,
      runId: payload.runId || payload.id,
      nodeId: payload.nodeId
    }, {
      agentProvider: await resolveAgentProvider(options)
    })
    await persistWorkspaceRun(store, result.run)
    return result
  }

  async function generateCanvasNodeArtifact(payload = {}) {
    mirrorWorkspaceRuns(store, runnerStore)
    const generatedResult = await generateRunCanvasNodeArtifact(runnerStore, {
      ...payload,
      runId: payload.runId || payload.id,
      nodeId: payload.nodeId
    }, {
      agentProvider: await resolveAgentProvider(options),
      imageProvider: resolveImageProvider(store, options),
      timeoutMs: payload.timeoutMs ?? options.timeoutMs,
      resolveImageReference: (url, page) => resolveWorkspaceImageReference(url, page, options)
    })
    const result = await persistGeneratedImageDataUrl(generatedResult, options)
    await persistWorkspaceRun(store, result.run)
    return result
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
    'POST /api/workflows/runs/:runId/canvas-nodes/:nodeId/edit': editCanvasNode,
    'POST /api/workflows/runs/:runId/canvas-nodes/:nodeId/generate-artifact': generateCanvasNodeArtifact,
    'GET /api/workspace/generated-images/:fileName': (payload) => readGeneratedImage(payload, options),
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
    'POST /api/workspace/workflow-runs/:id/canvas-nodes/:nodeId/edit': editCanvasNode,
    'POST /api/workspace/workflow-runs/:id/canvas-nodes/:nodeId/generate-artifact': generateCanvasNodeArtifact,
    'POST /api/workspace/workflow-runs/:id/complete-step': complete
  }
}
