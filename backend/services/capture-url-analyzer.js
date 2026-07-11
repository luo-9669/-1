function normalizeAuthMode(authMode = 'public') {
  return ['public', 'browser', 'cookie'].includes(authMode) ? authMode : 'public'
}

function inferPageClass(pathname = '', search = '') {
  const value = `${pathname}${search}`.toLowerCase()
  if (/(login|signin|signup|auth|oauth|passport)/.test(value)) return 'login-page'
  if (/\/(app|dashboard|admin|workspace|console)(\/|$)/.test(value)) return 'saas-dashboard'
  return 'public-page'
}

export function analyzeCaptureUrl(input = {}) {
  const parsed = new URL(String(input.url || '').trim())
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
