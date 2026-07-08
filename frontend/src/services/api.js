const envDefaults = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  aiBaseUrl: import.meta.env.VITE_AI_API_BASE_URL || '',
  captureBaseUrl: import.meta.env.VITE_CAPTURE_API_BASE_URL || '',
  knowledgeBaseUrl: import.meta.env.VITE_KNOWLEDGE_API_BASE_URL || '',
  searchBaseUrl: import.meta.env.VITE_SEARCH_API_BASE_URL || '',
  competitorBaseUrl: import.meta.env.VITE_COMPETITOR_API_BASE_URL || ''
}

export function defaultApiConfig() {
  return { ...envDefaults }
}

export function isConfigured(value) {
  return typeof value === 'string'
}

function joinUrl(baseUrl, path) {
  if (!baseUrl) return path
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

async function request(baseUrl, path, options = {}) {
  if (!isConfigured(baseUrl)) {
    return {
      ok: false,
      status: 'unconfigured',
      message: '接口未配置',
      data: null
    }
  }

  const timeoutMs = options.timeoutMs || 15000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(joinUrl(baseUrl, path), {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      signal: controller.signal,
      ...options
    })
    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      return {
        ok: false,
        status: 'failed',
        message: data?.message || `请求失败：${response.status}`,
        data
      }
    }

    return { ok: true, status: 'success', message: '请求成功', data }
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      message: error.name === 'AbortError' ? '请求超时，请稍后重试或上传网页快照包' : error.message || '网络请求失败',
      data: null
    }
  } finally {
    clearTimeout(timer)
  }
}

function parseSseEvents(text = '') {
  return String(text || '')
    .split(/\n\n+/)
    .map((block) => {
      const event = { type: 'message', data: null }
      block.split('\n').forEach((line) => {
        if (line.startsWith('event:')) event.type = line.slice(6).trim()
        if (line.startsWith('data:')) {
          const raw = line.slice(5).trim()
          try {
            event.data = raw ? JSON.parse(raw) : null
          } catch {
            event.data = raw
          }
        }
      })
      return event
    })
    .filter((event) => event.data !== null)
}

function consumeSseEvents(text = '', onEvent) {
  let done = null
  parseSseEvents(text).forEach((event) => {
    onEvent?.(event)
    if (event.type === 'done') done = event.data
  })
  return done
}

async function requestSse(baseUrl, path, options = {}) {
  if (!isConfigured(baseUrl) || typeof fetch !== 'function') {
    return { ok: false, status: 'unavailable', message: '流式接口不可用', data: null }
  }
  const timeoutMs = options.timeoutMs || 90000
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const abortFromOuterSignal = () => controller.abort()
  options.signal?.addEventListener?.('abort', abortFromOuterSignal, { once: true })
  try {
    // External abort is bridged from signal: options.signal into the timeout-aware controller.
    const response = await fetch(joinUrl(baseUrl, path), {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...(options.headers || {})
      },
      body: options.body,
      signal: controller.signal
    })
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok || !contentType.includes('text/event-stream')) {
      return { ok: false, status: 'fallback', message: '流式接口不可用', data: null }
    }
    let done = null
    const reader = response.body?.getReader?.()
    if (reader) {
      const decoder = new TextDecoder()
      let buffer = ''
      let cancelled = false
      const cancelReader = () => {
        cancelled = true
        Promise.resolve(reader.cancel?.()).catch(() => {})
      }
      options.signal?.addEventListener?.('abort', cancelReader, { once: true })
      const flushSseBuffer = (nextChunk = '', force = false) => {
        buffer += nextChunk
        const parts = buffer.split(/\n\n+/)
        buffer = force ? '' : (parts.pop() || '')
        const ready = force ? parts : parts.slice(0)
        ready.forEach((part) => {
          const eventDone = consumeSseEvents(part, options.onEvent)
          if (eventDone) done = eventDone
        })
      }
      try {
        while (true) {
          if (cancelled || controller.signal.aborted) break
          const { value, done: streamDone } = await reader.read()
          if (cancelled || controller.signal.aborted) break
          if (streamDone) break
          flushSseBuffer(decoder.decode(value, { stream: true }))
        }
        if (cancelled || options.signal?.aborted) return { ok: false, status: 'cancelled', message: '流式请求已停止', data: { cancelled: true } }
        if (controller.signal.aborted) {
          return timedOut
            ? { ok: false, status: 'failed', message: 'Agent 生成超时，请稍后重试或缩短问题后再试', data: { timeout: true, timeoutMs } }
            : { ok: false, status: 'cancelled', message: '流式请求已停止', data: { cancelled: true } }
        }
        flushSseBuffer(decoder.decode(), true)
      } finally {
        options.signal?.removeEventListener?.('abort', cancelReader)
      }
    } else {
      done = consumeSseEvents(await response.text(), options.onEvent)
    }
    if (done?.error) {
      return {
        ok: false,
        status: 'failed',
        message: done.error.message || '流式请求失败',
        data: done
      }
    }
    return { ok: true, status: 'success', message: '请求成功', data: done }
  } catch (error) {
    if (error.name === 'AbortError') {
      return timedOut
        ? { ok: false, status: 'failed', message: 'Agent 生成超时，请稍后重试或缩短问题后再试', data: { timeout: true, timeoutMs } }
        : { ok: false, status: 'cancelled', message: '流式请求已停止', data: { cancelled: true } }
    }
    return { ok: false, status: 'failed', message: error.message || '流式请求失败', data: null }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener?.('abort', abortFromOuterSignal)
  }
}

export const api = {
  workspace: {
    load(config) {
      return request(config.apiBaseUrl, '/api/workspace')
    },
    saveContext(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/context', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      })
    },
    createProject(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/projects', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    createAsset(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/assets', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    createRun(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/runs', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    saveSkill(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/skills', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    updateSkill(config, id, payload) {
      return request(config.apiBaseUrl, `/api/workspace/skills/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
    },
    createMaterial(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/materials', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    createGeneratedKnowledge(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/generated-knowledge', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    listGeneratedKnowledge(config, payload = {}) {
      return request(config.apiBaseUrl, withQuery('/api/workspace/generated-knowledge', payload))
    },
    importWebsiteMaterials(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/materials/import-website', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 30000
      })
    },
    importBlueprintMaterials(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/materials/import-blueprint', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 30000
      })
    },
    importDocumentMaterials(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/materials/import-documents', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 30000
      })
    },
    searchMaterials(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/materials/search', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    governMaterials(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/materials/governance', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    exportRolePackage(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/materials/export-role-package', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    getModelSettings(config) {
      return request(config.apiBaseUrl, '/api/workspace/model-settings')
    },
    saveModelSettings(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/model-settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
    },
    testModelSettings(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/model-settings/test', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 30000
      })
    },
    runModelSampleAnalysis(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/model-settings/sample-analysis', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 30000
      })
    },
    getSkillOrchestrationSettings(config) {
      return request(config.apiBaseUrl, '/api/workspace/skill-orchestration-settings')
    },
    saveSkillOrchestrationSettings(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/skill-orchestration-settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
    },
    repairAnalysis(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/analysis/repair', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 30000
      })
    },
    listModelCallLogs(config, payload = {}) {
      const query = new URLSearchParams()
      Object.entries(payload || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, value)
      })
      return request(config.apiBaseUrl, `/api/workspace/model-call-logs?${query.toString()}`)
    },
    listParseJobs(config, payload) {
      const query = new URLSearchParams()
      Object.entries(payload || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, value)
      })
      return request(config.apiBaseUrl, `/api/workspace/parse-jobs?${query.toString()}`)
    },
    listMaterials(config, payload = {}) {
      const query = new URLSearchParams()
      Object.entries(payload || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, value)
      })
      return request(config.apiBaseUrl, `/api/workspace/materials?${query.toString()}`)
    },
    updateMaterial(config, id, payload) {
      return request(config.apiBaseUrl, `/api/workspace/materials/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      })
    },
    deleteMaterial(config, id) {
      return request(config.apiBaseUrl, `/api/workspace/materials/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      })
    },
    createRestoredPage(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/restored-pages', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    getRestoredPage(config, id) {
      return request(config.apiBaseUrl, `/api/workspace/restored-pages/${encodeURIComponent(id)}`)
    },
    previewRestoredPage(config, id) {
      return request(config.apiBaseUrl, `/api/workspace/restored-pages/${encodeURIComponent(id)}/preview`)
    },
    frameRestoredPage(config, id) {
      return `${config.apiBaseUrl || ''}/api/workspace/restored-pages/${encodeURIComponent(id)}/frame`
    },
    sourceRestoredPage(config, id) {
      return request(config.apiBaseUrl, `/api/workspace/restored-pages/${encodeURIComponent(id)}/source`)
    },
    createWorkflowRun(config, payload) {
      return request(config.apiBaseUrl, '/api/workspace/workflow-runs', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    getWorkflowRun(config, runId) {
      return request(config.apiBaseUrl, `/api/workspace/workflow-runs/${encodeURIComponent(runId)}`)
    },
    generateWorkflowStep(config, runId, payload) {
      return request(config.apiBaseUrl, `/api/workspace/workflow-runs/${encodeURIComponent(runId)}/generate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    regenerateWorkflowStep(config, runId, payload) {
      return request(config.apiBaseUrl, `/api/workspace/workflow-runs/${encodeURIComponent(runId)}/regenerate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    acceptWorkflowStep(config, runId, payload) {
      return request(config.apiBaseUrl, `/api/workspace/workflow-runs/${encodeURIComponent(runId)}/accept`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    completeWorkflowStep(config, runId, payload = {}) {
      return request(config.apiBaseUrl, `/api/workspace/workflow-runs/${encodeURIComponent(runId)}/complete-step`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  },
  uploads: {
    documents(config, payload) {
      return request(config.apiBaseUrl, '/api/uploads/documents', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    analyzeDocuments(config, payload, options = {}) {
      return request(config.apiBaseUrl, '/api/uploads/documents/analyze', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: options.timeoutMs || 210000
      })
    },
    analyzeDocumentsStream(config, payload, options = {}) {
      return requestSse(config.apiBaseUrl, '/api/uploads/documents/analyze/stream', {
        method: 'POST',
        body: JSON.stringify(payload),
        onEvent: options.onEvent,
        signal: options.signal,
        timeoutMs: options.timeoutMs || 210000
      })
    }
  },
  capture: {
    createBrowserSession(config, payload) {
      return request(config.captureBaseUrl || config.apiBaseUrl, '/api/browser-sessions/create', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 15000
      })
    },
    closeBrowserSession(config, payload) {
      return request(config.captureBaseUrl || config.apiBaseUrl, '/api/browser-sessions/close', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 15000
      })
    },
    previewBrowserSession(config, payload) {
      return request(config.captureBaseUrl || config.apiBaseUrl, '/api/browser-sessions/preview', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 20000
      })
    },
    browserSessionAction(config, payload) {
      return request(config.captureBaseUrl || config.apiBaseUrl, '/api/browser-sessions/action', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 20000
      })
    },
    start(config, payload) {
      return request(config.captureBaseUrl || config.apiBaseUrl, '/api/capture/start', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 90000
      })
    },
    generatePage(config, payload) {
      return request(config.aiBaseUrl || config.captureBaseUrl || config.apiBaseUrl, '/api/capture/generate-page', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 180000
      })
    },
    generatePageStream(config, payload, options = {}) {
      return requestSse(config.aiBaseUrl || config.captureBaseUrl || config.apiBaseUrl, '/api/capture/generate-page/stream', {
        method: 'POST',
        body: JSON.stringify(payload),
        onEvent: options.onEvent,
        signal: options.signal,
        timeoutMs: options.timeoutMs || 210000
      })
    },
    result(config, taskId) {
      return request(config.captureBaseUrl || config.apiBaseUrl, `/api/capture/tasks/${taskId}/result`)
    }
  },
  generation: {
    imageToHtml(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/generate/image-to-html', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 90000
      })
    },
    imageToHtmlStream(config, payload, options = {}) {
      return requestSse(config.aiBaseUrl || config.apiBaseUrl, '/api/generate/image-to-html/stream', {
        method: 'POST',
        body: JSON.stringify(payload),
        onEvent: options.onEvent,
        signal: options.signal,
        timeoutMs: options.timeoutMs || 210000
      })
    },
    vueVite(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/generate/vue-vite', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    reactVite(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/generate/react-vite', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    regenerate(config, taskId, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, `/api/generate/tasks/${taskId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  },
  style: {
    transform(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/style/transform', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  },
  knowledge: {
    fromCode(config, payload) {
      return request(config.knowledgeBaseUrl || config.apiBaseUrl, '/api/knowledge/from-code', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    fromWebsite(config, payload) {
      return request(config.knowledgeBaseUrl || config.apiBaseUrl, '/api/knowledge/from-website', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    searchWeb(config, payload) {
      return request(config.searchBaseUrl || config.knowledgeBaseUrl, '/api/knowledge/search-web', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  },
  requirements: {
    generatePrd(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/requirements/generate-prd', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  },
  uploads: {
    documents(config, payload) {
      return request(config.apiBaseUrl, '/api/uploads/documents', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    analyzeDocuments(config, payload, options = {}) {
      return request(config.apiBaseUrl, '/api/uploads/documents/analyze', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: options.timeoutMs || 210000
      })
    },
    analyzeDocumentsStream(config, payload, options = {}) {
      return requestSse(config.apiBaseUrl, '/api/uploads/documents/analyze/stream', {
        method: 'POST',
        body: JSON.stringify(payload),
        onEvent: options.onEvent,
        signal: options.signal,
        timeoutMs: options.timeoutMs || 210000
      })
    }
  },
  workflows: {
    createRun(config, payload) {
      return request(config.apiBaseUrl, '/api/workflows/runs', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    generateStep(config, runId, stepId, payload) {
      return request(config.apiBaseUrl, `/api/workflows/runs/${runId}/steps/${stepId}/generate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    regenerateStep(config, runId, stepId, payload) {
      return request(config.apiBaseUrl, `/api/workflows/runs/${runId}/steps/${stepId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    acceptStep(config, runId, stepId, payload) {
      return request(config.apiBaseUrl, `/api/workflows/runs/${runId}/steps/${stepId}/accept`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    appendMessage(config, runId, stepId, payload) {
      return request(config.apiBaseUrl, `/api/workspace/workflow-runs/${encodeURIComponent(runId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ ...payload, stepId })
      })
    },
    async appendMessageStream(config, runId, stepId, payload, options = {}) {
      const streamed = await requestSse(config.apiBaseUrl, `/api/workspace/workflow-runs/${encodeURIComponent(runId)}/messages/stream`, {
        method: 'POST',
        body: JSON.stringify({ ...payload, stepId }),
        onEvent: options.onEvent,
        signal: options.signal,
        timeoutMs: options.timeoutMs || 210000
      })
      if (streamed.status === 'cancelled') return streamed
      if (streamed.data?.timeout) return streamed
      if (streamed.ok) return streamed
      return api.workflows.appendMessage(config, runId, stepId, payload)
    },
    cancelMessage(config, runId, payload = {}) {
      return request(config.apiBaseUrl, `/api/workspace/workflow-runs/${encodeURIComponent(runId)}/messages/cancel`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    async confirmProposalStream(config, runId, proposalId, payload = {}, options = {}) {
      const streamed = await requestSse(config.apiBaseUrl, `/api/workspace/workflow-runs/${encodeURIComponent(runId)}/agent-proposals/${encodeURIComponent(proposalId)}/confirm/stream`, {
        method: 'POST',
        body: JSON.stringify(payload),
        onEvent: options.onEvent,
        signal: options.signal,
        timeoutMs: options.timeoutMs || 210000
      })
      if (streamed.status === 'cancelled') return streamed
      if (streamed.status === 'failed') return streamed
      if (streamed.ok) return streamed
      return api.workflows.confirmProposal(config, runId, proposalId, payload, options)
    },
    confirmProposal(config, runId, proposalId, payload = {}, options = {}) {
      return request(config.apiBaseUrl, `/api/workspace/workflow-runs/${encodeURIComponent(runId)}/agent-proposals/${encodeURIComponent(proposalId)}/confirm`, {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: options.timeoutMs || 90000
      })
    },
    saveConfirmedProposal(config, runId, proposalId, payload = {}, options = {}) {
      return request(config.apiBaseUrl, `/api/workspace/workflow-runs/${encodeURIComponent(runId)}/agent-proposals/${encodeURIComponent(proposalId)}/confirm/save`, {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: options.timeoutMs || 30000
      })
    },
    editWorkflowCanvasNode(config, runId, nodeId, payload = {}, options = {}) {
      return request(config.apiBaseUrl, `/api/workspace/workflow-runs/${encodeURIComponent(runId)}/canvas-nodes/${encodeURIComponent(nodeId)}/edit`, {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: options.timeoutMs || 90000
      })
    },
    completeRun(config, runId, payload = {}) {
      return request(config.apiBaseUrl, `/api/workflows/runs/${runId}/complete`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  },
  competitors: {
    check(config, id, payload) {
      return request(config.competitorBaseUrl || config.apiBaseUrl, `/api/competitors/${id}/check`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  },
  pm: {
    question(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/pm/question', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    generatePrd(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/pm/generate-prd', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  },
  ux: {
    question(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/ux/question', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    generateOptions(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/ux/generate-options', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    generateVue(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/ux/generate-vue-preview', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  },
  skills: {
    diagnose(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/skills/diagnose', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    execute(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/skills/execute', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    importDraft(config, payload) {
      return request(config.aiBaseUrl || config.apiBaseUrl, '/api/skills/import-draft', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  },
  settings: {
    test(baseUrl) {
      return request(baseUrl, '/api/health')
    }
  }
}
