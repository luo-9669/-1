import { analyzeRequirementDocumentsWithGeneration, parseUploadedDocuments } from '../services/document-parser.js'
import { createAgentProviderFromModelSettings } from '../services/llm-provider.js'
import { addModelCallLog, getModelSettingsRaw, skillOrchestrationSettingsView } from '../services/workspace-store.js'

export function uploadRoutes(options = {}) {
  const resolveAgentProvider = () => {
    if (options.store) {
      const settings = getModelSettingsRaw(options.store)
      if (settings.enabled) return createAgentProviderFromModelSettings(settings, options.fetchImpl)
    }
    return options.agentProvider || null
  }
  const resolveSkillOrchestration = () => {
    if (options.skillOrchestration) return options.skillOrchestration
    if (options.store) return skillOrchestrationSettingsView(options.store)
    return null
  }
  const analyzeDocuments = (payload = {}) => analyzeRequirementDocumentsWithGeneration({
    ...payload,
    documents: Array.isArray(payload.documents) ? payload.documents : payload.files || []
  }, {
    ...options,
    skillOrchestration: resolveSkillOrchestration(),
    agentProvider: resolveAgentProvider(),
    modelCallLog: options.store ? (log) => addModelCallLog(options.store, log) : options.modelCallLog
  })
  const sseEvent = (event, data = {}) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  const analyzeDocumentsStream = async (payload = {}, req = null, routeContext = {}) => {
    const events = []
    const push = (event, data = {}) => {
      const chunk = sseEvent(event, data)
      events.push(chunk)
      routeContext.writeEvent?.(chunk)
    }
    push('status', { status: 'parsing', label: '解析上传文档' })
    try {
      const result = await analyzeDocuments(payload)
      const canvas = result.canvas || {}
      const nodes = Array.isArray(canvas.nodes) ? canvas.nodes : []
      push('artifact', {
        type: 'workflow-canvas-meta',
        canvas: {
          ...canvas,
          nodes: [],
          edges: Array.isArray(canvas.edges) ? canvas.edges : [],
          orderedTabs: Array.isArray(canvas.orderedTabs) ? canvas.orderedTabs : []
        },
        total: nodes.length
      })
      nodes.forEach((node, index) => {
        push('artifact', {
          type: 'workflow-node',
          node: {
            ...node,
            loading: false
          },
          index,
          total: nodes.length
        })
      })
      push('artifact', {
        type: 'workflow-analysis',
        blueprint: result.blueprint || null,
        canvas,
        routing: result.routing || null
      })
      push('done', result)
    } catch (error) {
      const errorData = {
        message: error.message || '文档分析失败',
        code: error.code || 'DOCUMENT_ANALYSIS_STREAM_FAILED',
        recoveryActions: error.recoveryActions || ['重新分析文档', '检查模型配置']
      }
      push('error', errorData)
      push('done', { error: errorData })
    }
    return {
      contentType: 'text/event-stream; charset=utf-8',
      body: events.join('')
    }
  }

  return {
    'POST /api/uploads/documents': async (payload = {}) => {
      return parseUploadedDocuments({
        ...payload,
        documents: Array.isArray(payload.documents) ? payload.documents : payload.files || []
      })
    },
    'POST /api/uploads/documents/analyze': analyzeDocuments,
    'POST /api/uploads/documents/analyze/stream': analyzeDocumentsStream
  }
}
