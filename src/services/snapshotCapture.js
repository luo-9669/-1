export const SNAPSHOT_AUTH_MODES = [
  {
    value: 'public',
    label: '公开页面',
    title: '公开页面采集',
    description: '适合官网、落地页、公开文档等不需要登录的页面。'
  },
  {
    value: 'browser',
    label: '授权浏览器',
    title: '浏览器授权采集',
    description: '平台打开隔离浏览器，由用户登录目标网站，登录态只绑定当前项目和域名。'
  },
  {
    value: 'cookie',
    label: '导入 Cookie',
    title: 'Cookie / Session 导入',
    description: '高级模式，用户提供登录态，系统加密后仅用于当前项目的指定域名采集。'
  }
]

export function normalizeSnapshotAuthMode(mode = 'public') {
  if (mode === 'none') return 'public'
  if (mode === 'session') return 'browser'
  return SNAPSHOT_AUTH_MODES.some((item) => item.value === mode) ? mode : 'public'
}

export function snapshotAuthModeMeta(mode = 'public') {
  const normalized = normalizeSnapshotAuthMode(mode)
  return SNAPSHOT_AUTH_MODES.find((item) => item.value === normalized) || SNAPSHOT_AUTH_MODES[0]
}

export function buildSnapshotCaptureRequest({
  projectId = '',
  url = '',
  scope = 'single',
  authMode = 'public',
  sessionId = '',
  cookieText = ''
} = {}) {
  const normalizedAuthMode = normalizeSnapshotAuthMode(authMode)
  const request = {
    projectId,
    url: String(url || '').trim(),
    scope,
    authMode: normalizedAuthMode,
    captureKind: 'internal-web-snapshot',
    output: {
      packageFormat: 'internal-web-snapshot',
      includeDom: true,
      includeStyles: true,
      includeComponents: true,
      includeInteractions: true,
      includeScreenshots: true
    }
  }

  if (normalizedAuthMode === 'browser') {
    request.authSession = {
      type: 'browser-session',
      sessionId,
      projectScoped: true
    }
  }

  if (normalizedAuthMode === 'cookie') {
    request.authSession = {
      type: 'cookie-import',
      cookieText,
      projectScoped: true
    }
  }

  return request
}

export function snapshotCaptureStatusMessage(mode = 'public') {
  const meta = snapshotAuthModeMeta(mode)
  if (meta.value === 'browser') {
    return '正在使用当前项目的授权浏览器登录态生成内部网页快照...'
  }
  if (meta.value === 'cookie') {
    return '正在使用当前项目导入的 Cookie 生成内部网页快照...'
  }
  return '正在打开公开页面并生成内部网页快照...'
}
