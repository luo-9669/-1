function normalizeAuthMode(authMode = 'public') {
  return ['public', 'browser', 'cookie'].includes(authMode) ? authMode : 'public'
}

export function compileCaptureTask(input = {}) {
  const payload = input.payload || {}
  const analysis = input.analysis || {}
  const templateMatch = input.templateMatch || {}
  const template = templateMatch.template || {}
  const authMode = normalizeAuthMode(payload.authMode || analysis.authMode)

  return {
    taskType: 'web-capture',
    projectId: payload.projectId || 'default',
    templateId: templateMatch.templateId || 'generic-public-page',
    source: { url: analysis.normalizedUrl || String(payload.url || '').trim() },
    auth: {
      mode: authMode,
      sessionId: authMode === 'browser' ? payload.sessionId || '' : '',
      cookieText: authMode === 'cookie' ? payload.cookieText || '' : ''
    },
    execution: {
      waitUntil: template.navigation?.waitUntil || 'networkidle',
      timeoutMs: template.navigation?.timeoutMs || 15000,
      extraWaitMs: template.navigation?.extraWaitMs || 0,
      scrollMode: template.pageStrategy?.scrollMode || 'full-page',
      maxScrollSteps: template.pageStrategy?.maxScrollSteps || 4,
      includeIframes: Boolean(template.pageStrategy?.includeIframes)
    },
    artifacts: {
      screenshot: Boolean(template.artifacts?.screenshot),
      singleFile: Boolean(template.artifacts?.singleFile),
      domSnapshot: Boolean(template.artifacts?.domSnapshot),
      networkLogs: Boolean(template.artifacts?.networkLogs)
    },
    diagnosticsPolicy: {
      classifyLoginPage: true,
      classifyBotBlock: true,
      classifyEmptyDom: true
    },
    relay: {
      matchReason: templateMatch.matchReason || '',
      pageClass: analysis.traits?.pageClass || 'public-page',
      requiresAuth: Boolean(analysis.authHints?.requiresAuth)
    }
  }
}
