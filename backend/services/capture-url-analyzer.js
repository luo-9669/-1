function normalizeAuthMode(authMode = 'public') {
  return ['public', 'browser', 'cookie'].includes(authMode) ? authMode : 'public'
}

function invalidCaptureUrlError() {
  const error = new Error('请输入有效的 HTTP 或 HTTPS 网页 URL')
  error.code = 'CAPTURE_URL_INVALID'
  return error
}

function inferPageClass(pathname = '', search = '') {
  const value = `${pathname}${search}`.toLowerCase()
  if (/(login|signin|signup|auth|oauth|passport)/.test(value)) return 'login-page'
  if (/\/(app|dashboard|admin|workspace|console)(\/|$)/.test(value)) return 'saas-dashboard'
  return 'public-page'
}

function parseCaptureUrl(rawUrl = '') {
  const normalized = String(rawUrl || '').trim()
  if (!normalized) throw invalidCaptureUrlError()
  let parsed
  try {
    parsed = new URL(normalized)
  } catch {
    throw invalidCaptureUrlError()
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw invalidCaptureUrlError()
  }
  return parsed
}

export function analyzeCaptureUrl(input = {}) {
  const parsed = parseCaptureUrl(input.url)
  const pageClass = inferPageClass(parsed.pathname, parsed.search)
  const requiresAuth = pageClass !== 'public-page'
  return {
    normalizedUrl: parsed.href,
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    query: parsed.search,
    authMode: normalizeAuthMode(input.authMode),
    traits: {
      pageClass,
      loginSignals: pageClass === 'login-page' ? ['auth-path'] : [],
      dynamicSignals: pageClass === 'saas-dashboard' ? ['app-shell-route'] : []
    },
    authHints: {
      requiresAuth,
      preferredAuthMode: requiresAuth ? 'browser' : 'public'
    }
  }
}

export { parseCaptureUrl }
