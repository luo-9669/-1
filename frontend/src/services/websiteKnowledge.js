function clientRandomId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const FEATURE_WORDS = ['knowledge base', 'website import', 'collaboration', 'automation', 'api']
const CTA_WORDS = ['start', 'try', 'contact', 'sales', 'free', 'sign up', 'book', 'demo']
const DEFAULT_ROLE_SCOPES = ['product', 'ux', 'development', 'ai-retrieval']

function stripTags(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function normalizeUrl(url = '') {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.search = ''
    return parsed.href
  } catch {
    return url
  }
}

function absoluteUrl(value = '', base = '') {
  try {
    return new URL(value, base).href
  } catch {
    return value
  }
}

function uniqueBy(items, keyFn) {
  const seen = new Set()
  return items.filter((item) => {
    const key = keyFn(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function extractTitle(html = '', fallback = '') {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return decodeHtml(stripTags(match?.[1] || fallback || '未命名网站'))
}

function extractDescription(html = '') {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i)
  return decodeHtml(match?.[1] || '')
}

function extractHeadings(html = '') {
  return Array.from(html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)).map((match) => ({
    level: Number(match[1]),
    text: decodeHtml(stripTags(match[2]))
  })).filter((heading) => heading.text)
}

function extractLinks(html = '', sourceUrl = '') {
  const links = Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)).map((match) => {
    const href = match[1].match(/\bhref=["']([^"']+)["']/i)?.[1] || ''
    const label = decodeHtml(stripTags(match[2]))
    return {
      label,
      href: normalizeUrl(absoluteUrl(href, sourceUrl))
    }
  }).filter((link) => link.href && link.label)
  return uniqueBy(links, (link) => link.href)
}

function splitSections(html = '') {
  const headingBlocks = Array.from(html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>([\s\S]*?)(?=<h[1-6]\b|$)/gi))
    .map((match) => {
      const heading = decodeHtml(stripTags(match[2]))
      const body = decodeHtml(stripTags(match[3]))
      return {
        heading,
        text: [heading, body].filter(Boolean).join(' ')
      }
    })
    .filter((block) => block.text.length > 20)
  if (headingBlocks.length) return headingBlocks
  const blockMatches = Array.from(html.matchAll(/<(section|article|main|div)[^>]*>([\s\S]*?)<\/\1>/gi))
  const blocks = blockMatches.map((match) => ({
    heading: '',
    text: decodeHtml(stripTags(match[2]))
  })).filter((block) => block.text.length > 30)
  if (blocks.length) return blocks
  const text = decodeHtml(stripTags(html))
  if (!text) return []
  const parts = text.match(/.{1,520}(?:\s|$)/g) || [text]
  return parts.map((part, index) => ({
    heading: index === 0 ? '页面概览' : `页面内容 ${index + 1}`,
    text: part.trim()
  })).filter((block) => block.text)
}

function detectPageType(text = '') {
  const lower = text.toLowerCase()
  if (/pricing|\$\d+|free plan|pro plan/.test(lower)) return 'pricing'
  if (/faq|help|docs|support/.test(lower)) return 'help-center'
  return 'product-website'
}

function detectSignals(text = '', headings = []) {
  const lower = text.toLowerCase()
  const pricing = []
  const faq = []
  const features = FEATURE_WORDS.filter((word) => lower.includes(word))
  Array.from(text.matchAll(/[^.。!?]*(?:\$\d+|free|pro plan|starter plan)[^.。!?]*/gi))
    .forEach((match) => pricing.push(match[0].trim()))
  headings.forEach((heading) => {
    if (/faq|\?/.test(heading.text.toLowerCase())) faq.push(heading.text)
  })
  return {
    features,
    pricing: uniqueBy(pricing.filter(Boolean), (item) => item),
    faq: uniqueBy(faq, (item) => item)
  }
}

function roleScopesForCategory(category = '') {
  return DEFAULT_ROLE_SCOPES
}

function chunkRoleScopes(chunk = {}) {
  const text = `${chunk.heading || ''} ${chunk.text || ''}`.toLowerCase()
  const scopes = new Set(['ai-retrieval'])
  if (/pricing|price|plan|free|套餐|定价/.test(text)) scopes.add('product')
  if (/flow|page|cta|help|docs|faq|页面|流程|按钮|帮助/.test(text)) scopes.add('ux')
  if (/api|integration|code|developer|webhook|接口|开发/.test(text)) scopes.add('development')
  if (scopes.size === 1) DEFAULT_ROLE_SCOPES.forEach((scope) => scopes.add(scope))
  return [...scopes]
}

function buildKnowledgeChunks(parsed) {
  return parsed.chunks.map((chunk, index) => ({
    id: chunk.id || `chunk-${index + 1}`,
    heading: chunk.heading,
    text: chunk.text,
    roleScopes: chunkRoleScopes(chunk),
    sourceUrl: parsed.sourceUrl,
    evidence: {
      url: parsed.sourceUrl,
      title: parsed.title,
      capturedAt: parsed.capturedAt
    }
  }))
}

function buildRelations(parsed) {
  return [
    { type: 'source-page', target: parsed.sourceUrl, label: parsed.title },
    ...parsed.links.slice(0, 12).map((link) => ({
      type: parsed.ctas.some((cta) => cta.href === link.href) ? 'cta-link' : 'page-link',
      target: link.href,
      label: link.label
    }))
  ]
}

export function parseWebsiteHtml(payload = {}, options = {}) {
  const sourceUrl = normalizeUrl(payload.url || '')
  const html = payload.html || ''
  const title = extractTitle(html, sourceUrl)
  const description = extractDescription(html)
  const headings = extractHeadings(html)
  const links = extractLinks(html, sourceUrl)
  const ctas = links.filter((link) => CTA_WORDS.some((word) => `${link.label} ${link.href}`.toLowerCase().includes(word)))
  const sections = splitSections(html)
  const chunks = sections.map((section, index) => ({
    id: `chunk-${index + 1}`,
    heading: section.heading || headings[index]?.text || headings[0]?.text || title,
    text: section.text
  }))
  const evidenceText = decodeHtml(stripTags(html))
  const pageType = detectPageType(`${title} ${description} ${evidenceText}`)
  const signals = detectSignals(`${title} ${description} ${evidenceText}`, headings)
  return {
    sourceUrl,
    importType: payload.importType || pageType,
    title,
    description,
    pageType,
    headings,
    links,
    ctas,
    chunks,
    signals,
    evidenceText,
    capturedAt: options.capturedAt || new Date().toISOString()
  }
}

export function buildWebsiteKnowledgeImport(payload = {}, options = {}) {
  const parsed = parseWebsiteHtml(payload, options)
  const evidence = [{ url: parsed.sourceUrl, title: parsed.title, capturedAt: parsed.capturedAt }]
  const chunks = buildKnowledgeChunks(parsed)
  const relations = buildRelations(parsed)
  const base = {
    projectId: payload.projectId || '',
    sourceType: 'website',
    sourceUrl: parsed.sourceUrl,
    status: '已解析',
    meta: `${payload.importType || parsed.importType} · 网站导入`,
    evidence,
    owner: payload.owner || '知识库管理员',
    verification: {
      status: 'unverified',
      reason: '自动解析结果，需由项目负责人确认后标记可信'
    },
    tags: uniqueBy([payload.importType || parsed.importType, parsed.pageType, ...parsed.signals.features].filter(Boolean), (item) => item),
    relations
  }
  const items = [
    {
      ...base,
      id: clientRandomId(),
      title: parsed.title,
      category: 'product-fact',
      roleScopes: roleScopesForCategory('product-fact'),
      chunks,
      content: parsed.description || parsed.evidenceText.slice(0, 240),
      parsed,
      entities: { features: parsed.signals.features }
    },
    ...parsed.chunks.map((chunk) => ({
      ...base,
      id: clientRandomId(),
      title: chunk.heading,
      category: 'knowledge-chunk',
      roleScopes: roleScopesForCategory('knowledge-chunk'),
      chunks: chunks.filter((item) => item.id === chunk.id),
      content: chunk.text,
      parsed: { chunk },
      entities: { features: parsed.signals.features }
    }))
  ]
  if (parsed.signals.pricing.length) {
    items.push({
      ...base,
      id: clientRandomId(),
      title: '价格信息',
      category: 'pricing',
      roleScopes: roleScopesForCategory('pricing'),
      chunks: chunks.filter((chunk) => chunk.roleScopes.includes('product')),
      content: parsed.signals.pricing.join('\n'),
      parsed: { pricing: parsed.signals.pricing },
      entities: { features: parsed.signals.features }
    })
  }
  return {
    summary: {
      projectId: payload.projectId || '',
      pageCount: 1,
      importType: payload.importType || parsed.importType
    },
    items
  }
}

export function buildWebsiteKnowledgeBatchImport(payload = {}, options = {}) {
  const pages = Array.isArray(payload.pages) && payload.pages.length
    ? payload.pages
    : [{ url: payload.url, html: payload.html }]
  const imports = pages.map((page) => buildWebsiteKnowledgeImport({
    ...payload,
    ...page,
    projectId: payload.projectId,
    importType: payload.importType
  }, options))
  return {
    summary: {
      projectId: payload.projectId || '',
      pageCount: pages.length,
      importType: payload.importType || imports[0]?.summary?.importType || 'project-website',
      scope: payload.scope || 'single'
    },
    items: imports.flatMap((item) => item.items || [])
  }
}

export function websiteBlueprintDocumentFromImport(imported = {}, payload = {}) {
  const items = Array.isArray(imported.items) ? imported.items : []
  const parsedPages = items
    .map((item) => item.parsed)
    .filter((parsed) => parsed?.sourceUrl && parsed?.title)
  const primary = parsedPages[0] || items.find((item) => item.parsed)?.parsed || {}
  const pageLines = parsedPages.map((page) => [
    `页面：${page.title}`,
    page.description ? `定位：${page.description}` : '',
    page.sourceUrl ? `URL：${page.sourceUrl}` : '',
    page.headings?.length ? `页面结构：${page.headings.map((heading) => heading.text).join(' / ')}` : '',
    page.ctas?.length ? `CTA：${page.ctas.map((cta) => cta.label).join(' / ')}` : '',
    page.signals?.features?.length ? `功能信号：${page.signals.features.join(' / ')}` : '',
    page.chunks?.length ? `正文片段：${page.chunks.map((chunk) => `${chunk.heading}: ${chunk.text}`).join('\n')}` : ''
  ].filter(Boolean).join('\n'))
  const fallbackLines = items.slice(0, 8).map((item) => [
    `知识：${item.title}`,
    item.content
  ].filter(Boolean).join('\n'))
  const title = primary.title || items[0]?.title || payload.url || '项目网站'
  return {
    name: `${title} 网站解析.md`,
    type: 'text/markdown',
    text: [
      `# ${title}`,
      primary.description || '',
      `来源 URL：${primary.sourceUrl || payload.url || ''}`,
      pageLines.length ? pageLines.join('\n\n') : fallbackLines.join('\n\n')
    ].filter(Boolean).join('\n\n')
  }
}
