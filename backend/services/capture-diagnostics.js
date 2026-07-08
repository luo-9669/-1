function hasBlockedHtml(text = '') {
  return /405|异常访问|请求有异常行为|access denied|forbidden/i.test(String(text || ''))
}

function hasRestorableLayoutNodes(captureResult = {}, raw = {}) {
  if (Array.isArray(captureResult.layoutNodes) && captureResult.layoutNodes.length > 0) return true
  return Number(raw.layoutNodeCount || 0) > 0
}

function hasExpiredAuth(raw = {}) {
  if (/cookie|expired|401|403/i.test(raw.fetchError || '')) return true
  return raw.fetchStatus === 401 || raw.fetchStatus === 403
}

export function classifyCaptureDiagnostics(input = {}) {
  const compiledTask = input.compiledTask || {}
  const captureResult = input.captureResult || {}
  const raw = captureResult.raw || {}
  const diagnostics = []
  const recoveryActions = new Set()

  if (compiledTask.relay?.requiresAuth && compiledTask.auth?.mode === 'public') {
    diagnostics.push({ code: 'LOGIN_REQUIRED', message: '目标页面需要登录后采集。' })
    recoveryActions.add('打开授权浏览器')
    recoveryActions.add('重新导入 Cookie')
  }

  if (hasExpiredAuth(raw)) {
    diagnostics.push({ code: 'COOKIE_EXPIRED', message: '当前 Cookie 或登录态已失效。' })
    recoveryActions.add('重新导入 Cookie')
    recoveryActions.add('打开授权浏览器')
  }

  if (!captureResult.singleFileHtml && !captureResult.staticHtml && !hasRestorableLayoutNodes(captureResult, raw)) {
    diagnostics.push({ code: 'DOM_NOT_RESTORABLE', message: '当前页面没有可还原 DOM 数据。' })
    recoveryActions.add('上传网页快照包')
    recoveryActions.add('上传截图走图片转代码')
  }

  if (hasBlockedHtml(captureResult.singleFileHtml) || hasBlockedHtml(raw.fetchError)) {
    diagnostics.unshift({ code: 'ANTI_BOT_SUSPECTED', message: '当前页面疑似被风控或异常访问拦截。' })
    recoveryActions.add('打开授权浏览器')
    recoveryActions.add('重新导入 Cookie')
  }

  return {
    status: diagnostics.length ? 'blocked' : (captureResult.status || 'completed'),
    diagnostics,
    recoveryActions: [...recoveryActions]
  }
}
