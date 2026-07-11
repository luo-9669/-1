const REQUIRED_FIELDS = {
  'auth-page': [
    'intent',
    'sections',
    'frontendHandoff',
    'backendHandoff',
    'apiContract',
    'html',
    'preview',
    'qualityReport'
  ],
  'smart-canvas': [
    'intent',
    'qualityReport'
  ],
  'product-interaction-review': [
    'intent',
    'sections',
    'frontendHandoff',
    'backendHandoff',
    'apiContract',
    'qualityReport'
  ]
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.keys(value).length > 0
  return Boolean(value)
}

function validateAuthPageShape(output = {}) {
  const issues = []
  if (output.intent !== 'auth-page') issues.push('intent must be auth-page')
  if (!String(output.html || '').includes('<')) issues.push('html must contain markup')
  const hasLoginEndpoint = (output.apiContract || []).some((endpoint) => endpoint.path === '/api/auth/login')
  if (!hasLoginEndpoint) issues.push('apiContract must include /api/auth/login')
  return issues
}

function validateSmartCanvasShape(output = {}) {
  const issues = []
  if (typeof output.intent !== 'string' || !output.intent.trim()) issues.push('intent must be a non-empty string')
  const hasCanvasNodes = Array.isArray(output.canvas?.nodes) && output.canvas.nodes.length > 0
  const hasGroupNodes = Array.isArray(output.groups) && output.groups.some((group) => Array.isArray(group.nodes) && group.nodes.length > 0)
  const hasOutline = Array.isArray(output.outline) && output.outline.length > 0
  const hasTotalFlowStageNodes = Object.values(output.totalDesignFlow?.stageCanvases || {})
    .some((canvas) => Array.isArray(canvas?.nodes) && canvas.nodes.length > 0)
  if (!hasCanvasNodes && !hasGroupNodes && !hasOutline && !hasTotalFlowStageNodes) {
    issues.push('canvas.nodes, groups.nodes, outline or totalDesignFlow.stageCanvases.nodes must not be empty')
  }
  const hasLoginEndpoint = (output.apiContract || []).some((endpoint) => endpoint.path === '/api/auth/login')
  if (output.intent === 'auth-modal' && !hasLoginEndpoint) issues.push('auth-modal apiContract must include /api/auth/login')
  return issues
}

export function validateSkillOutput(schemaId = '', output = {}) {
  const required = REQUIRED_FIELDS[schemaId] || []
  const missing = required.filter((field) => !hasValue(output[field]))
  const issues = schemaId === 'auth-page' && !missing.length
    ? validateAuthPageShape(output)
    : schemaId === 'smart-canvas' && !missing.length
      ? validateSmartCanvasShape(output)
      : []
  return {
    ok: missing.length === 0 && issues.length === 0,
    schemaId,
    missing,
    issues
  }
}
