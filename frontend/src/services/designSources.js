function clientRandomId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function firstPage(captureResult = {}) {
  return Array.isArray(captureResult.pages) && captureResult.pages.length ? captureResult.pages[0] : {}
}

export function designSourceFromCaptureResult(captureResult = {}, { projectId = '', origin = 'url' } = {}) {
  const page = firstPage(captureResult)
  const raw = captureResult.raw || {}
  const createdAt = raw.capturedAt || new Date().toISOString()
  const sourceUrl = captureResult.url || page.url || ''
  const title = captureResult.title || page.title || sourceUrl || '未命名网页快照'
  const layoutNodes = Array.isArray(captureResult.layoutNodes) ? captureResult.layoutNodes : []
  const components = Array.isArray(captureResult.components) ? captureResult.components : []
  const interactions = captureResult.interactions || captureResult.websnap?.interactions || { nodes: [] }
  const styles = captureResult.websnap?.styles || { tokens: captureResult.designTokens?.tokens || [], rules: captureResult.designTokens?.rules || [] }

  return {
    id: clientRandomId(),
    projectId,
    type: 'web-snapshot',
    origin,
    title,
    sourceUrl,
    coverImage: captureResult.screenshot || page.screenshot || '',
    createdAt,
    updatedAt: createdAt,
    status: captureResult.status || 'completed',
    summary: {
      pages: captureResult.pages?.length || 0,
      layoutNodes: layoutNodes.length || raw.layoutNodeCount || 0,
      components: components.length,
      assets: captureResult.assets?.length || 0,
      interactions: Array.isArray(interactions.nodes) ? interactions.nodes.length : 0,
      hasScreenshot: Boolean(captureResult.screenshot || page.screenshot)
    },
    pages: (captureResult.pages || []).map((item, index) => ({
      id: item.id || `page-${index + 1}`,
      title: item.title || title,
      url: item.url || sourceUrl,
      viewport: item.viewport || captureResult.viewport || '',
      screenshot: item.screenshot || ''
    })),
    tokens: captureResult.designTokens || {},
    componentLibrary: captureResult.websnap?.componentLibrary || { source: 'web-snapshot', components },
    interactions,
    styles,
    rawRef: {
      taskId: captureResult.taskId || '',
      captureKind: raw.captureKind || raw.snapshotPackage || 'internal-web-snapshot',
      authMode: raw.authMode || 'public',
      transport: raw.transport || '',
      source: raw.source || ''
    }
  }
}

export function upsertDesignSource(sources = [], source = {}) {
  const sameSource = (item) =>
    item.projectId === source.projectId &&
    item.type === source.type &&
    item.sourceUrl === source.sourceUrl &&
    item.origin === source.origin

  return [
    source,
    ...sources.filter((item) => !sameSource(item))
  ]
}

export function designSourcesForProject(sources = [], projectId = '') {
  return sources
    .filter((source) => source?.projectId === projectId)
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
}
