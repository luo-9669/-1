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
    'sections',
    'frontendHandoff',
    'backendHandoff',
    'apiContract',
    'canvas',
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
  const allowedIntents = ['auth-modal', 'auth-page', 'page-generation', 'interaction-design', 'requirement-analysis']
  if (!allowedIntents.includes(output.intent)) issues.push('intent must be a supported smart canvas intent')
  if (!Array.isArray(output.canvas?.nodes) || output.canvas.nodes.length === 0) issues.push('canvas.nodes must not be empty')
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
