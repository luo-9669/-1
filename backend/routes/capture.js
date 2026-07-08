function requiredHandler(handlers = {}, name = '') {
  if (typeof handlers[name] === 'function') return handlers[name]
  return async () => {
    const error = new Error(`Capture route handler is not configured: ${name}`)
    error.code = 'CAPTURE_HANDLER_NOT_CONFIGURED'
    throw error
  }
}

export function captureRoutes(handlers = {}) {
  const createBrowserSession = requiredHandler(handlers, 'createBrowserSession')
  const previewBrowserSession = requiredHandler(handlers, 'previewBrowserSession')
  const browserSessionAction = requiredHandler(handlers, 'browserSessionAction')
  const closeBrowserSession = requiredHandler(handlers, 'closeBrowserSession')
  const captureStart = requiredHandler(handlers, 'captureStart')
  const generatePage = requiredHandler(handlers, 'generatePage')
  const captureResult = requiredHandler(handlers, 'captureResult')
  const latestResult = requiredHandler(handlers, 'latestResult')
  const sseEvent = (event, data = {}) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  const streamRoute = async (payload = {}, req = null, routeContext = {}) => {
    const events = []
    const push = (event, data = {}) => {
      const chunk = sseEvent(event, data)
      events.push(chunk)
      routeContext.writeEvent?.(chunk)
    }
    push('status', { status: 'generating', label: '检查采集质量' })
    try {
      const result = await generatePage(payload)
      if (result.html) {
        push('artifact', {
          type: 'html',
          html: result.html,
          restoredPage: result.restoredPage || null,
          visualVerification: result.visualVerification || null
        })
      }
      push('done', result)
    } catch (error) {
      const errorData = {
        message: error.message || '页面生成失败',
        code: error.code || 'CAPTURE_GENERATE_STREAM_FAILED',
        recoveryActions: error.recoveryActions || ['重新生成页面', '重新采集网页快照']
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
    'POST /api/browser-sessions/create': async (payload = {}) => createBrowserSession(payload),
    'POST /api/browser-sessions/preview': async (payload = {}) => previewBrowserSession(payload),
    'POST /api/browser-sessions/action': async (payload = {}) => browserSessionAction(payload),
    'POST /api/browser-sessions/close': async (payload = {}) => closeBrowserSession(payload),
    'POST /api/capture/start': async (payload = {}) => captureStart(payload),
    'POST /api/capture/generate-page': async (payload = {}) => generatePage(payload),
    'POST /api/capture/generate-page/stream': streamRoute,
    'GET /api/capture/tasks/:taskId/result': async (payload = {}) => captureResult(payload),
    'GET /api/capture/tasks/latest/result': async (payload = {}) => latestResult(payload)
  }
}
