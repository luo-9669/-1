import JSZip from 'jszip'

function normalizePath(path = '') {
  return String(path).replace(/^\/+/, '').replace(/\\/g, '/')
}

async function readJson(zip, path, fallback = null) {
  const file = zip.file(normalizePath(path))
  if (!file) return fallback
  try {
    return JSON.parse(await file.async('text'))
  } catch {
    return fallback
  }
}

function mimeTypeFromPath(path = '') {
  const lower = normalizePath(path).toLowerCase()
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/png'
}

async function readImageDataUrl(zip, path) {
  const file = zip.file(normalizePath(path))
  if (!file) return ''
  const base64 = await file.async('base64')
  return `data:${mimeTypeFromPath(path)};base64,${base64}`
}

async function firstScreenshotDataUrl(zip, prefix = '') {
  const base = normalizePath(prefix).replace(/\/+$/, '')
  const at = (path) => (base ? `${base}/${path}` : path)
  const candidates = [
    at('screenshot.png'),
    at('screenshot.jpg'),
    at('screenshot.jpeg'),
    at('screenshot.webp'),
    at('screenshots/viewport.png'),
    at('screenshots/full-page.png'),
    at('screenshots/fullpage.png'),
    at('screenshots/screenshot.png'),
    at('assets/screenshot.png'),
    at('assets/viewport.png')
  ]
  for (const candidate of candidates) {
    const dataUrl = await readImageDataUrl(zip, candidate)
    if (dataUrl) return dataUrl
  }
  return ''
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') || ''
}

function sanitizeImportedValue(value) {
  const legacyAscii = ['hao', 'dazi'].join('')
  const legacyPackage = `${legacyAscii}-websnap`
  const legacyChinese = '\u597d\u642d\u5b50'
  if (Array.isArray(value)) return value.map(sanitizeImportedValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeImportedValue(item)]))
  }
  if (typeof value !== 'string') return value
  return value
    .replaceAll(legacyPackage, 'web-snapshot-import')
    .replaceAll(legacyAscii, 'web-snapshot')
    .replaceAll(legacyChinese, '网页解析')
}

function rectFromNode(node = {}) {
  const rect = node.rect || node.bbox || {}
  return {
    x: Number(firstValue(node.x, rect.x, 0)) || 0,
    y: Number(firstValue(node.y, rect.y, 0)) || 0,
    width: Number(firstValue(node.width, rect.width, rect.w, 0)) || 0,
    height: Number(firstValue(node.height, rect.height, rect.h, 0)) || 0
  }
}

function normalizeStyle(style = {}) {
  return {
    display: style.display,
    color: style.color,
    backgroundColor: firstValue(style.backgroundColor, style.background),
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    padding: style.padding,
    margin: style.margin,
    gap: style.gap,
    borderRadius: firstValue(style.borderRadius, style.radius),
    borderColor: style.borderColor,
    borderWidth: style.borderWidth,
    borderStyle: style.borderStyle || (style.borderWidth ? 'solid' : ''),
    boxShadow: style.boxShadow,
    opacity: style.opacity,
    overflow: style.overflow,
    objectFit: style.objectFit
  }
}

function inferNodeType(node = {}) {
  const tag = String(node.tag || '').toLowerCase()
  const role = String(node.role || '').toLowerCase()
  if (tag === 'img' || node.src) return 'image'
  if (['input', 'select', 'textarea'].includes(tag)) return 'control'
  if (['button', 'a'].includes(tag) || role === 'button' || role === 'link') return node.text ? 'text' : 'control'
  if (node.text && String(node.text).trim()) return 'text'
  return 'surface'
}

function normalizeLayoutNode(node = {}, index = 0) {
  const rect = rectFromNode(node)
  const type = inferNodeType(node)
  const tag = String(node.tag || (type === 'text' ? 'div' : 'section')).toLowerCase()
  return {
    id: node.id || `snapshot-node-${index}`,
    order: index,
    type,
    tag,
    text: type === 'text' ? String(node.text || '').trim().slice(0, 500) : '',
    src: node.src || node.source || '',
    alt: node.alt || '',
    href: node.href || '',
    placeholder: node.placeholder || node.text || '',
    selector: node.selector || '',
    className: node.className || '',
    x: Math.max(0, Math.round(rect.x)),
    y: Math.max(0, Math.round(rect.y)),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height)),
    zIndex: Number.parseInt(node.style?.zIndex, 10) || index,
    style: normalizeStyle(node.style || {})
  }
}

function normalizeAsset(node = {}) {
  if (!node.src && !node.source) return null
  return {
    type: 'image',
    name: node.alt || node.text || '页面图片',
    source: node.src || node.source
  }
}

function normalizeTextBlock(node = {}) {
  const text = String(node.text || '').trim()
  if (!text) return null
  return {
    tag: String(node.tag || 'div').toLowerCase(),
    text
  }
}

function pickPalette(styles = {}, fingerprints = {}) {
  const tokens = Array.isArray(styles.tokens) ? styles.tokens : []
  const colors = tokens
    .filter((token) => token.type === 'color' && token.value)
    .map((token) => token.value)
  const frequent = Array.isArray(fingerprints.style?.tokens?.colors)
    ? fingerprints.style.tokens.colors.map((item) => item.value).filter(Boolean)
    : []
  const unique = Array.from(new Set([...colors, ...frequent]))
  return {
    primary: unique[0] || '#246bfe',
    background: unique.find((color) => /255|248|247|246|245|244|243|242|241|240/.test(color)) || '#f6f8fb',
    surface: '#ffffff',
    text: unique.find((color) => /0, 0, 0|17, 24, 39|23, 32, 51/.test(color)) || '#172033',
    border: unique[3] || '#d9e0ea'
  }
}

function componentLibraryFromWebsnap(components = {}, fingerprints = {}) {
  const samples = Array.isArray(components.samples) ? components.samples : []
  const recipes = Array.isArray(components.recipes) ? components.recipes : []
  return {
    source: 'web-snapshot-import',
    components: samples.slice(0, 24).map((sample, index) => ({
      name: sample.kind || `Component${index + 1}`,
      type: sample.kind || 'component',
      selector: sample.selector,
      rect: sample.rect,
      style: sample.style,
      recipe: sample.recipe,
      htmlPreview: sample.htmlPreview
    })),
    recipes,
    fingerprints
  }
}

function pageFromWebsnapPayload(payload = {}, pagePath = '') {
  const manifest = payload.manifest || {}
  const snapshot = payload.snapshot || {}
  const layout = payload.layout || {}
  const components = payload.components || {}
  const styles = payload.styles || {}
  const fingerprints = payload.fingerprints || {}
  const nodes = Array.isArray(layout.nodes) ? layout.nodes.map(normalizeLayoutNode).filter((node) => node.width > 0 && node.height > 0) : []
  const semanticNodes = Array.isArray(snapshot.semanticNodes) ? snapshot.semanticNodes : []
  const textBlocks = semanticNodes.map(normalizeTextBlock).filter(Boolean)
  const imageAssets = [...nodes, ...semanticNodes].map(normalizeAsset).filter(Boolean)
  const links = semanticNodes
    .filter((node) => node.href)
    .map((node) => ({ text: node.text || node.href, href: node.href }))

  return {
    title: manifest.title || snapshot.title || '网页快照',
    url: manifest.url || snapshot.url || '',
    capturedAt: manifest.capturedAt || '',
    viewport: manifest.viewport || fingerprints.style?.viewport || { width: 1440, height: 900 },
    scroll: manifest.scroll || { x: 0, y: 0 },
    pagePath,
    layoutNodes: nodes,
    textBlocks,
    assets: imageAssets,
    links,
    components,
    styles,
    fingerprints,
    screenshot: payload.screenshot || '',
    pageHtml: payload.pageHtml || ''
  }
}

async function payloadFromPageFolder(zip, path) {
  const prefix = normalizePath(path).replace(/\/+$/, '')
  const manifest = await readJson(zip, `${prefix}/manifest.json`, null)
  const snapshot = await readJson(zip, `${prefix}/snapshot.json`, {})
  const layout = await readJson(zip, `${prefix}/layout.json`, { nodes: [] })
  const interactions = await readJson(zip, `${prefix}/interactions.json`, { nodes: [] })
  const cleanup = await readJson(zip, `${prefix}/cleanup.json`, { nodes: [] })
  const styles = await readJson(zip, `${prefix}/styles.json`, { tokens: [], rules: [] })
  const components = await readJson(zip, `${prefix}/components.json`, { samples: [] })
  const fingerprints = await readJson(zip, `${prefix}/fingerprints.json`, { style: {}, componentRecipes: [] })
  const interactionStates = await readJson(zip, `${prefix}/interaction-states.json`, { samples: [] })
  const fusionSlots = await readJson(zip, `${prefix}/fusion-slots.json`, { fusionSlots: [] })
  const pageHtml = zip.file(`${prefix}/page.html`) ? await zip.file(`${prefix}/page.html`).async('text') : ''
  const screenshot = await firstScreenshotDataUrl(zip, prefix)
  return {
    manifest: manifest || {},
    snapshot,
    layout,
    interactions,
    cleanup,
    styles,
    components,
    fingerprints,
    interactionStates,
    fusionSlots: fusionSlots.fusionSlots || [],
    screenshot,
    pageHtml
  }
}

export async function parseWebsnapFile(file) {
  const zipSource = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : file
  const zip = await JSZip.loadAsync(zipSource)
  const rootManifest = await readJson(zip, 'manifest.json', {})
  const pagesIndex = await readJson(zip, 'pages.json', null)
  const pageEntries = Array.isArray(pagesIndex?.pages)
    ? pagesIndex.pages
    : [{ id: 'page-1', path: '' }]
  const pages = []

  for (const entry of pageEntries) {
    const payload = entry.path
      ? await payloadFromPageFolder(zip, entry.path)
      : {
          manifest: rootManifest,
          snapshot: await readJson(zip, 'snapshot.json', {}),
          layout: await readJson(zip, 'layout.json', { nodes: [] }),
          interactions: await readJson(zip, 'interactions.json', { nodes: [] }),
          cleanup: await readJson(zip, 'cleanup.json', { nodes: [] }),
          styles: await readJson(zip, 'styles.json', { tokens: [], rules: [] }),
          components: await readJson(zip, 'components.json', { samples: [] }),
          fingerprints: await readJson(zip, 'fingerprints.json', { style: {}, componentRecipes: [] }),
          interactionStates: await readJson(zip, 'interaction-states.json', { samples: [] }),
          fusionSlots: (await readJson(zip, 'fusion-slots.json', { fusionSlots: [] })).fusionSlots || [],
          screenshot: await firstScreenshotDataUrl(zip),
          pageHtml: zip.file('page.html') ? await zip.file('page.html').async('text') : ''
        }
    pages.push(pageFromWebsnapPayload(payload, entry.path || ''))
  }

  const firstPage = pages[0] || pageFromWebsnapPayload({})
  const allNodes = pages.flatMap((page) => page.layoutNodes)
  const allTextBlocks = pages.flatMap((page) => page.textBlocks)
  const allAssets = pages.flatMap((page) => page.assets)
  const allLinks = pages.flatMap((page) => page.links)
  const allComponentSamples = pages.flatMap((page) => page.components?.samples || [])
  const firstStyles = firstPage.styles || {}
  const firstFingerprints = firstPage.fingerprints || {}
  const firstScreenshot = firstPage.screenshot || ''

  return sanitizeImportedValue({
    taskId: crypto.randomUUID(),
    url: rootManifest.url || firstPage.url,
    title: rootManifest.title || firstPage.title || file.name,
    description: `从 ${file.name} 导入的网页快照包。`,
    status: allNodes.length ? 'completed' : 'partial',
    pages: pages.map((page) => ({
      url: page.url,
      title: page.title,
      viewport: `${page.viewport.width || 1440}x${page.viewport.height || 900}`,
      screenshot: page.screenshot || null,
      summary: `快照导入：${page.layoutNodes.length} 个布局节点、${page.textBlocks.length} 条文本、${page.assets.length} 个资源。`
    })),
    components: allComponentSamples.slice(0, 24).map((sample, index) => ({
      name: sample.kind || sample.selector || `组件 ${index + 1}`,
      type: sample.kind || 'component',
      confidence: sample.recipe?.confidence || 0.78
    })),
    assets: allAssets,
    links: allLinks,
    textBlocks: allTextBlocks,
    apiCalls: [],
    designTokens: {
      ...pickPalette(firstStyles, firstFingerprints),
      styleFingerprint: firstFingerprints.style || {},
      rules: firstStyles.rules || [],
      tokens: firstStyles.tokens || []
    },
    raw: {
      source: 'web-snapshot-import',
      fileName: file.name,
      captureMode: 'imported-runtime-dom',
      capturedAt: rootManifest.capturedAt || new Date().toISOString(),
      transport: 'web-snapshot-import',
      hasDomLayout: allNodes.length > 0,
      layoutNodeCount: allNodes.length,
      screenshotCaptured: Boolean(firstScreenshot),
      pageCount: pages.length
    },
    screenshot: firstScreenshot || null,
    viewport: firstPage.viewport || { width: 1440, height: 900 },
    layoutNodes: allNodes,
    pageBackground: pickPalette(firstStyles, firstFingerprints).background,
    websnap: {
      manifest: rootManifest,
      pageCount: pages.length,
      pages: pages.map((page) => ({
        title: page.title,
        url: page.url,
        pagePath: page.pagePath,
        nodeCount: page.layoutNodes.length
      })),
      componentLibrary: componentLibraryFromWebsnap(firstPage.components, firstFingerprints),
      styles: firstStyles,
      fingerprints: firstFingerprints
    }
  })
}
