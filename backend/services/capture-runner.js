import { randomUUID } from 'node:crypto'

function normalizeAuthMode(authMode = '') {
  if (authMode === 'none') return 'public'
  if (authMode === 'session') return 'browser'
  return ['public', 'browser', 'cookie'].includes(authMode) ? authMode : 'public'
}

function hostnameFromUrl(url = '') {
  try {
    return new URL(url).hostname
  } catch {
    return '目标网站'
  }
}

function defaultDesignRules() {
  return {
    colors: {
      primary: '#222529',
      canvas: '#ffffff',
      ink: '#222529',
      border: '#e8eaec',
      shell: '#f6f7f9',
      accentCyan: '#69e1f5'
    },
    layout: { spacing: [8, 12, 16, 20, 24, 32] }
  }
}

export function createCaptureRunner(options = {}) {
  const uuid = options.uuid || randomUUID
  const now = options.now || Date.now
  const designRules = options.designRules || defaultDesignRules()
  const decodeEntities = options.decodeEntities || ((value) => String(value || ''))
  const pickMeta = options.pickMeta || (() => '')
  const extractTextBlocks = options.extractTextBlocks || (() => [])
  const extractImages = options.extractImages || (() => [])
  const extractLinks = options.extractLinks || (() => [])
  const captureTarget = options.captureTarget || (async () => {
    throw new Error('Capture target is not configured')
  })
  const fallbackCaptureTarget = options.fallbackCaptureTarget || null

  async function makeCaptureResult(payload = {}) {
    const startedAt = now()
    const url = payload.url || 'https://example.com'
    const authMode = normalizeAuthMode(payload.authMode)
    const hostname = hostnameFromUrl(url)

    let fetched = null
    let fetchError = ''
    try {
      fetched = await captureTarget({ ...payload, url, authMode })
    } catch (error) {
      fetchError = error.name === 'AbortError' ? '目标网页请求超时' : error.message
      if (fallbackCaptureTarget) {
        try {
          fetched = await fallbackCaptureTarget({ ...payload, url, authMode })
          fetchError = ''
        } catch (fallbackError) {
          fetchError = `${fetchError}; fallback: ${fallbackError.message}`
        }
      }
    }

    const html = fetched?.html || ''
    const title = decodeEntities(
      fetched?.snapshot?.title
        || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim()
        || pickMeta(html, 'og:title')
        || `${hostname} 页面采集结果`
    )
    const description = fetched?.snapshot?.description || pickMeta(html, 'description') || pickMeta(html, 'og:description') || ''
    const textBlocks = fetched?.snapshot?.textBlocks?.length ? fetched.snapshot.textBlocks : extractTextBlocks(html)
    const images = fetched?.snapshot?.images?.length ? fetched.snapshot.images : extractImages(html, fetched?.finalUrl || url)
    const links = fetched?.snapshot?.links?.length ? fetched.snapshot.links : extractLinks(html, fetched?.finalUrl || url)
    const layoutNodes = fetched?.snapshot?.layoutNodes || []
    const designTree = fetched?.snapshot?.designTree || null
    const hasDomLayout = layoutNodes.length > 0
    const singleFileHtml = fetched?.singleFileHtml || ''
    const staticHtml = fetched?.staticHtml || ''
    const domSnapshot = fetched?.domSnapshot || null

    const completedAt = now()
    const durationMs = Math.max(0, completedAt - startedAt)
    const estimatedSeconds = Math.max(8, Math.min(90, Math.ceil((durationMs || 12000) / 1000) + 6))
    const timing = {
      startedAt: new Date(startedAt).toISOString(),
      completedAt: new Date(completedAt).toISOString(),
      durationMs,
      estimatedSeconds,
      source: 'backend-current-run'
    }

    return {
      taskId: uuid(),
      url,
      title,
      description,
      status: fetched?.ok ? 'completed' : 'partial',
      timing,
      pages: [
        {
          url,
          title,
          viewport: '1440x900',
          screenshot: fetched?.screenshotDataUrl || null,
          summary: fetched?.ok
            ? `已真实请求目标网页，提取 ${textBlocks.length} 条文本、${images.length} 个图片资源、${links.length} 个链接、${layoutNodes.length} 个可还原 DOM 节点，并完成 ${singleFileHtml ? 'SingleFile' : 'SingleFile 尝试'} 与 ${domSnapshot ? 'DOMSnapshot' : 'DOMSnapshot 尝试'}。`
            : `目标网页未能完整抓取：${fetchError || `HTTP ${fetched?.statusCode || 'unknown'}`}`
        }
      ],
      components: [
        { name: title, type: 'page-title', confidence: 0.9 },
        ...textBlocks.slice(0, 8).map((block) => ({ name: block.text, type: block.tag, confidence: 0.72 }))
      ],
      assets: images,
      links,
      textBlocks,
      apiCalls: [],
      designTokens: {
        primary: designRules.colors.primary,
        background: designRules.colors.canvas,
        surface: designRules.colors.canvas,
        text: designRules.colors.ink,
        border: designRules.colors.border,
        colors: [
          designRules.colors.primary,
          designRules.colors.ink,
          designRules.colors.shell,
          designRules.colors.canvas,
          designRules.colors.accentCyan
        ],
        fonts: ['PingFang SC', 'Microsoft YaHei', 'Arial'],
        radius: [6, 8, 12, 16, 999],
        spacing: designRules.layout.spacing
      },
      raw: {
        scope: payload.scope,
        authMode,
        templateId: payload.relay?.templateId || '',
        relayMatchReason: payload.relay?.matchReason || '',
        captureKind: payload.captureKind || 'internal-web-snapshot',
        snapshotPackage: 'internal-web-snapshot',
        requestedOutput: payload.output || null,
        captureMode: hasDomLayout ? 'screenshot-with-dom-data' : 'screenshot-only',
        capturedAt: new Date(completedAt).toISOString(),
        startedAt: timing.startedAt,
        completedAt: timing.completedAt,
        fetched: Boolean(fetched),
        fetchStatus: fetched?.statusCode || null,
        transport: fetched?.transport || null,
        fetchError,
        hasDomLayout,
        layoutNodeCount: layoutNodes.length,
        designTreeCaptured: Boolean(designTree),
        screenshotCaptured: Boolean(fetched?.screenshotDataUrl),
        singleFileCaptured: Boolean(singleFileHtml),
        singleFileLength: singleFileHtml.length,
        singleFileError: fetched?.singleFileError || '',
        staticHtmlCaptured: Boolean(staticHtml),
        staticHtmlLength: staticHtml.length,
        domSnapshotCaptured: Boolean(domSnapshot),
        domSnapshotDocumentCount: Array.isArray(domSnapshot?.documents) ? domSnapshot.documents.length : 0,
        domSnapshotError: fetched?.domSnapshotError || '',
        durationMs,
        estimatedSeconds
      },
      screenshot: fetched?.screenshotDataUrl || null,
      viewport: fetched?.snapshot?.viewport || { width: 1440, height: 900 },
      layoutNodes,
      designTree,
      singleFileHtml,
      staticHtml,
      domSnapshot,
      pageBackground: fetched?.snapshot?.pageBackground || '#ffffff'
    }
  }

  return { makeCaptureResult }
}
