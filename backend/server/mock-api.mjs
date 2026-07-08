import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { chromium } from 'playwright-core'
import { buildWebsiteKnowledgeBatchImport, buildWebsiteKnowledgeImport, parseWebsiteHtml } from '../../frontend/src/services/websiteKnowledge.js'
import { buildVisualVerificationReport } from '../../frontend/src/services/visualVerification.js'
import { compareImageDataUrls } from '../../frontend/src/services/visualVerification.node.js'
import { createRestoredPageAsset } from '../../frontend/src/services/factoryWorkspace.js'
import { createWorkspaceStore, workspaceRoutes } from '../routes/workspace.js'
import { addModelCallLog, addRestoredPage, getModelSettingsRaw, saveModelSettings } from '../services/workspace-store.js'
import { uploadRoutes } from '../routes/uploads.js'
import { captureRoutes } from '../routes/capture.js'
import { adminRoutes } from '../routes/admin.js'
import { generatePageFromCapturePayload } from '../services/capture-service.js'
import { createCaptureRunner } from '../services/capture-runner.js'
import { createCaptureTaskStore } from '../services/capture-task-store.js'
import { createCaptureDispatcher } from '../services/capture-dispatcher.js'
import { analyzeCaptureUrl } from '../services/capture-url-analyzer.js'
import { matchCaptureTemplate } from '../services/capture-template-matcher.js'
import { compileCaptureTask } from '../services/capture-compiler.js'
import { classifyCaptureDiagnostics } from '../services/capture-diagnostics.js'
import { createAgentProviderFromEnv, createAgentProviderFromModelSettings } from '../services/llm-provider.js'
import { renderAdminConsoleHtml } from '../services/admin-console.js'
import { createBrowserSessionManager } from './browser-session-manager.mjs'

const PORT = Number(process.env.PORT || 5299)
const execFileAsync = promisify(execFile)
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}
const IMAGE_TO_HTML_MODEL_TIMEOUT_MS = 180000
const CICADA_LLM_MODEL_SETTINGS = {
  provider: 'openai-compatible',
  apiKey: process.env.CICADA_LLM_API_KEY || process.env.OPENAI_API_KEY || '',
  baseUrl: process.env.CICADA_LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://ai-platform-cicada-llm-api.limayao.com/v1',
  defaultModel: 'gpt-5.5',
  apiSurface: 'responses',
  timeoutMs: 180000,
  fallback: 'deterministic',
  allowInsecureTLS: true,
  enabled: true
}
const CHROME_EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const backendRoot = fileURLToPath(new URL('..', import.meta.url))
const SINGLE_FILE_BIN = resolve(backendRoot, 'node_modules/.bin/single-file')
const isTestRuntime = process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test'
let testBrowserSessionPort = 44000
const browserSessions = createBrowserSessionManager({
  launchChrome: !isTestRuntime,
  allocatePort: isTestRuntime ? async () => ++testBrowserSessionPort : undefined
})
const workspaceStore = createWorkspaceStore(null, {
  filePath: isTestRuntime
    ? ''
    : (process.env.WORKSPACE_STORE_FILE || resolve(projectRoot, 'backend/storage/workspace/workspace.local.json'))
})
await workspaceStore.load()
async function ensureCicadaModelSettings(store) {
  if (isTestRuntime) return
  const settings = getModelSettingsRaw(store)
  const nextSettings = {
    ...CICADA_LLM_MODEL_SETTINGS,
    apiKey: CICADA_LLM_MODEL_SETTINGS.apiKey || settings?.apiKey || ''
  }
  const alreadyCicada = settings?.enabled &&
    settings?.provider === CICADA_LLM_MODEL_SETTINGS.provider &&
    settings?.baseUrl === CICADA_LLM_MODEL_SETTINGS.baseUrl &&
    settings?.defaultModel === CICADA_LLM_MODEL_SETTINGS.defaultModel &&
    settings?.apiSurface === CICADA_LLM_MODEL_SETTINGS.apiSurface &&
    Number(settings?.timeoutMs) === CICADA_LLM_MODEL_SETTINGS.timeoutMs &&
    Boolean(settings?.allowInsecureTLS) === CICADA_LLM_MODEL_SETTINGS.allowInsecureTLS
  if (alreadyCicada) return
  await saveModelSettings(store, nextSettings)
}

function createDefaultWorkflowAgentProvider(fetchImpl = globalThis.fetch) {
  if (isTestRuntime) {
    return createAgentProviderFromEnv(process.env, fetchImpl)
  }
  return createAgentProviderFromModelSettings(CICADA_LLM_MODEL_SETTINGS)
}

await ensureCicadaModelSettings(workspaceStore)
const workflowAgentProvider = createDefaultWorkflowAgentProvider(globalThis.fetch)
const workspaceApiRoutes = workspaceRoutes(workspaceStore, {
  agentProvider: workflowAgentProvider,
  fallback: process.env.WORKFLOW_AGENT_FALLBACK || 'deterministic',
  importWebsiteKnowledge: parseWebsiteKnowledge,
  captureWebsitePrototype
})
const uploadApiRoutes = uploadRoutes({
  store: workspaceStore,
  agentProvider: workflowAgentProvider
})
const DEFAULT_DESIGN_RULES = {
  source: 'design.md',
  colors: {
    ink: '#222529',
    secondary: '#4c535c',
    muted: '#7f8792',
    disabled: '#9da3ac',
    canvas: '#ffffff',
    shell: '#f6f7f9',
    softSurface: '#f7f8fa',
    border: '#e8eaec',
    primary: '#222529',
    accentCyan: '#69e1f5',
    accentBlue: '#2578ff',
    accentOrange: '#ff7a1a'
  },
  layout: {
    topbarHeight: 72,
    sidebarWidth: 72,
    templateCard: { width: 214, height: 324 },
    spacing: [8, 12, 16, 20, 24, 32, 48, 72]
  },
  radius: { small: 6, base: 8, medium: 12, large: 16, pill: 999 },
  components: {
    primaryButton: { height: 32, radius: 8, background: '#222529', color: '#ffffff' },
    segmentedControl: { height: 36, radius: 99, background: '#f1f2f4', activeBackground: '#ffffff' },
    sceneChip: { height: 46, width: 185, radius: 999, border: '#f6f7f9' },
    promptComposer: { minHeight: 156, radius: 12, shadow: '0 24px 72px rgba(34, 37, 41, 0.08)' }
  }
}

const captureRunner = createCaptureRunner({
  designRules: DEFAULT_DESIGN_RULES,
  decodeEntities,
  pickMeta,
  extractTextBlocks,
  extractImages,
  extractLinks,
  captureTarget: async (payload) => {
    const sessionPayload = payload.session || payload.authSession || {}
    const cookieSession = normalizeCookieSession(sessionPayload, payload.url)
    const browserSession = payload.authMode === 'browser' && sessionPayload.sessionId
      ? browserSessions.getSession(sessionPayload.sessionId)
      : null
    if (payload.authMode === 'browser' && !browserSession) {
      const error = new Error('授权浏览器会话不存在或已过期，请重新打开授权浏览器后再采集')
      error.code = 'CAPTURE_BROWSER_SESSION_MISSING'
      throw error
    }
    if (browserSession) {
      return isTestRuntime
        ? await fetchTargetPage(payload.url)
        : await captureWithRemoteBrowser(payload.url, browserSession)
    }
    return ['cookie'].includes(payload.authMode) && (cookieSession.storageState || cookieSession.cookies?.length)
        ? await captureWithChromeAndSession(payload.url, cookieSession)
        : await captureWithChrome(payload.url)
  },
  fallbackCaptureTarget: async (payload) => fetchTargetPage(payload.url)
})
const captureDispatcher = createCaptureDispatcher({
  analyzeCaptureUrl,
  matchCaptureTemplate,
  compileCaptureTask,
  classifyCaptureDiagnostics,
  captureRunner
})
const captureTaskStore = createCaptureTaskStore()
const captureApiRoutes = captureRoutes({
  createBrowserSession: async (payload) => browserSessions.createSession({
    projectId: payload.projectId || 'default',
    url: payload.url || 'about:blank'
  }),
  previewBrowserSession: async (payload) => browserSessionPreview(browserSessions.getSession(payload.sessionId)),
  browserSessionAction: async (payload) => browserSessionAction(browserSessions.getSession(payload.sessionId), payload),
  closeBrowserSession: async (payload) => browserSessions.closeSession(payload.sessionId),
  captureStart: async (payload) => captureTaskStore.runTask(payload, captureDispatcher),
  generatePage: async (payload) => generatePageFromCapturePayload(payload, {
    generatedPageHtml,
    verifyGeneratedPage,
    persistRestoredPage: async (asset) => addRestoredPage(workspaceStore, asset)
  }),
  captureResult: async (payload) => captureTaskStore.result(payload.taskId),
  latestResult: async () => captureTaskStore.latestResult()
})
const adminApiRoutes = adminRoutes(workspaceStore, {
  apiPort: PORT,
  frontendPort: 5288,
  storageFile: workspaceStore.filePath
})

function safeParseJsonObject(text = '') {
  const source = String(text || '').trim()
  if (!source) return null
  const normalizedSource = source.replace(/"([A-Za-z][A-Za-z0-9_]*)\1"\s*:/g, '"$1":')
  const fenced = normalizedSource.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : source
  try {
    const parsed = JSON.parse(candidate)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(candidate.slice(start, end + 1))
        return parsed && typeof parsed === 'object' ? parsed : null
      } catch {
        return null
      }
    }
    return null
  }
}

function extractHtmlFromModelText(text = '') {
  const source = String(text || '').trim()
  if (!source) return ''
  const htmlFence = source.match(/```(?:html)?\s*([\s\S]*?<\/html>)\s*```/i)
  if (htmlFence) return htmlFence[1].trim()
  const doctypeStart = source.toLowerCase().indexOf('<!doctype html')
  const htmlEnd = source.toLowerCase().lastIndexOf('</html>')
  if (doctypeStart >= 0 && htmlEnd > doctypeStart) return source.slice(doctypeStart, htmlEnd + 7).trim()
  return ''
}

function resolveImageGenerationAgentProvider(options = {}) {
  if (options.agentProvider) return options.agentProvider
  const settings = getModelSettingsRaw(workspaceStore)
  if (settings?.enabled) return createAgentProviderFromModelSettings(settings, options.fetchImpl)
  return workflowAgentProvider
}

function resolveImageGenerationFallbackProvider(options = {}) {
  if (options.imageVisionFallbackProvider) return options.imageVisionFallbackProvider
  const settings = getModelSettingsRaw(workspaceStore)
  if (!settings?.enabled || settings.provider !== 'openai-compatible') return null
  if ((settings.apiSurface || 'responses') === 'chat.completions') return null
  return createAgentProviderFromModelSettings({
    ...settings,
    apiSurface: 'chat.completions'
  }, options.fetchImpl)
}

function sseEvent(event, data = {}) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function createStreamPusher(routeContext = {}) {
  const events = []
  const writeEvent = typeof routeContext.writeEvent === 'function' ? routeContext.writeEvent : null
  return {
    push(event, data = {}) {
      const chunk = sseEvent(event, data)
      events.push(chunk)
      writeEvent?.(chunk)
    },
    body() {
      return events.join('')
    }
  }
}

let cachedDesignMarkdown = null

async function designMarkdown() {
  if (cachedDesignMarkdown !== null) return cachedDesignMarkdown
  try {
    cachedDesignMarkdown = await readFile(resolve(projectRoot, 'backend/design.md'), 'utf8')
  } catch {
    cachedDesignMarkdown = '# Design.md\n\nDesign source was not found in this generated environment.\n'
  }
  return cachedDesignMarkdown
}

async function fetchWebsiteHtml(url) {
  if (!/^https?:\/\//.test(url || '')) {
    throw new Error('请输入有效的 http 或 https 网站地址')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal
    })
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok) {
      throw new Error(`目标网站返回 ${response.status}`)
    }
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error(`目标地址不是 HTML 页面：${contentType}`)
    }
    return await response.text()
  } catch (error) {
    try {
      const { stdout } = await execFileAsync('curl', [
        '-L',
        '--fail',
        '--silent',
        '--show-error',
        '--max-time',
        '12',
        '-H',
        `User-Agent: ${DEFAULT_HEADERS['User-Agent']}`,
        '-H',
        `Accept: ${DEFAULT_HEADERS.Accept}`,
        url
      ], { maxBuffer: 8 * 1024 * 1024 })
      return stdout
    } catch {
      throw error
    }
  } finally {
    clearTimeout(timer)
  }
}

async function renderWebsiteHtml(url) {
  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: CHROME_EXECUTABLE
    })
    const page = await browser.newPage({
      userAgent: DEFAULT_HEADERS['User-Agent']
    })
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
    return await page.content()
  } finally {
    await browser?.close()
  }
}

function htmlHasUsefulBody(html = '') {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return body.length > 160
}

function normalizeWebsiteUrl(url = '') {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.search = ''
    return parsed.href
  } catch {
    return url
  }
}

function sameOriginUrls(urls = [], sourceUrl = '', limit = 5) {
  let origin = ''
  try {
    origin = new URL(sourceUrl).origin
  } catch {
    return []
  }
  const seen = new Set()
  return urls
    .map((url) => normalizeWebsiteUrl(url))
    .filter((url) => {
      try {
        const parsed = new URL(url)
        if (parsed.origin !== origin) return false
        if (seen.has(parsed.href)) return false
        seen.add(parsed.href)
        return true
      } catch {
        return false
      }
    })
    .slice(0, limit)
}

function sitemapUrlFor(sourceUrl = '') {
  try {
    return new URL('/sitemap.xml', sourceUrl).href
  } catch {
    return ''
  }
}

function extractSitemapUrls(xml = '') {
  return Array.from(String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi))
    .map((match) => match[1].trim())
    .filter(Boolean)
}

async function fetchUsefulWebsiteHtml(url = '') {
  let html = await fetchWebsiteHtml(url)
  if (!htmlHasUsefulBody(html)) {
    html = await renderWebsiteHtml(url)
  }
  return html
}

async function buildWebsiteImportPages(payload = {}) {
  const sourceUrl = payload.url || ''
  const sourceHtml = payload.html || await fetchUsefulWebsiteHtml(sourceUrl)
  if (payload.scope === 'sitemap') {
    let sitemapUrls = []
    try {
      sitemapUrls = extractSitemapUrls(await fetchWebsiteHtml(sitemapUrlFor(sourceUrl)))
    } catch {
      sitemapUrls = []
    }
    const urls = sameOriginUrls([sourceUrl, ...sitemapUrls], sourceUrl)
    const pages = []
    for (const url of urls) {
      pages.push({
        url,
        html: url === normalizeWebsiteUrl(sourceUrl) ? sourceHtml : await fetchUsefulWebsiteHtml(url)
      })
    }
    return pages.length ? pages : [{ url: sourceUrl, html: sourceHtml }]
  }
  if (payload.scope === 'same-domain') {
    const parsed = parseWebsiteHtml({ ...payload, html: sourceHtml })
    const urls = sameOriginUrls([sourceUrl, ...parsed.links.map((link) => link.href)], sourceUrl)
    const pages = []
    for (const url of urls) {
      pages.push({
        url,
        html: url === normalizeWebsiteUrl(sourceUrl) ? sourceHtml : await fetchUsefulWebsiteHtml(url)
      })
    }
    return pages.length ? pages : [{ url: sourceUrl, html: sourceHtml }]
  }
  return [{ url: sourceUrl, html: sourceHtml }]
}

async function parseWebsiteKnowledge(payload) {
  if (payload.scope === 'same-domain' || payload.scope === 'sitemap') {
    return buildWebsiteKnowledgeBatchImport({
      ...payload,
      pages: await buildWebsiteImportPages(payload)
    })
  }
  const html = payload.html || await fetchUsefulWebsiteHtml(payload.url)
  return buildWebsiteKnowledgeImport({ ...payload, html })
}

function prototypeHotspotRect(index = 0, count = 1) {
  const width = count > 1 ? 32 : 44
  return {
    x: Math.min(72, 8 + index * (width + 4)),
    y: 78,
    width,
    height: 8
  }
}

async function captureWebsitePrototype(payload = {}) {
  const pages = Array.isArray(payload.pages) && payload.pages.length
    ? payload.pages
    : [{ url: payload.url, title: payload.url }]
  const normalizedPages = []
  for (const page of pages.slice(0, 8)) {
    const capture = await captureRunner.makeCaptureResult({
      projectId: payload.projectId,
      url: page.url,
      scope: payload.scope,
      authMode: payload.authMode || 'public'
    })
    const sameRunLinks = (capture.links || [])
      .filter((link) => pages.some((target) => normalizeWebsiteUrl(target.url) === normalizeWebsiteUrl(link.href)))
    normalizedPages.push({
      id: page.id || '',
      url: normalizeWebsiteUrl(capture.url || page.url),
      title: capture.title || page.title || page.url,
      summary: capture.description || capture.pages?.[0]?.summary || '',
      screenshot: capture.pages?.[0]?.screenshot || capture.screenshot || '',
      viewport: capture.viewport || { width: 1440, height: 900 },
      links: sameRunLinks.map((link, index) => ({
        label: link.text || link.label || link.href,
        href: normalizeWebsiteUrl(link.href),
        rect: link.rect || prototypeHotspotRect(index, sameRunLinks.length)
      }))
    })
  }
  return {
    source: 'backend-url-capture',
    pages: normalizedPages
  }
}

function resolveDesignRules(rules = {}) {
  return {
    ...DEFAULT_DESIGN_RULES,
    ...rules,
    colors: { ...DEFAULT_DESIGN_RULES.colors, ...(rules.colors || {}) },
    layout: { ...DEFAULT_DESIGN_RULES.layout, ...(rules.layout || {}) },
    radius: { ...DEFAULT_DESIGN_RULES.radius, ...(rules.radius || {}) },
    components: { ...DEFAULT_DESIGN_RULES.components, ...(rules.components || {}) }
  }
}

export function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  })
  res.end(JSON.stringify(data, null, 2))
}

export async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return { raw }
  }
}

function decodeEntities(value = '') {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value = '') {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

function absoluteUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href
  } catch {
    return value
  }
}

function uniqueBy(items, key) {
  const seen = new Set()
  return items.filter((item) => {
    const value = item[key]
    if (!value || seen.has(value)) return false
    seen.add(value)
    return true
  })
}

function pickMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i')
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return decodeEntities(match[1].trim())
  }
  return ''
}

function extractTextBlocks(html) {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')

  const blocks = []
  const blockPattern = /<(h1|h2|h3|p|li|button|a|span|div)[^>]*>([\s\S]*?)<\/\1>/gi
  let match
  while ((match = blockPattern.exec(clean)) && blocks.length < 120) {
    const text = decodeEntities(match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    if (text.length >= 4 && text.length <= 120 && !/^\W+$/.test(text)) {
      blocks.push({ tag: match[1].toLowerCase(), text })
    }
  }
  return uniqueBy(blocks, 'text').slice(0, 40)
}

function extractImages(html, baseUrl) {
  const images = []
  const imgPattern = /<img[^>]+>/gi
  const srcPattern = /\s(?:src|data-src|data-original)=["']([^"']+)["']/i
  const altPattern = /\salt=["']([^"']*)["']/i
  let match
  while ((match = imgPattern.exec(html)) && images.length < 24) {
    const tag = match[0]
    const src = tag.match(srcPattern)?.[1]
    if (!src || src.startsWith('data:')) continue
    images.push({
      type: 'image',
      name: decodeEntities(tag.match(altPattern)?.[1] || '页面图片'),
      source: absoluteUrl(src, baseUrl)
    })
  }

  const ogImage = pickMeta(html, 'og:image') || pickMeta(html, 'twitter:image')
  if (ogImage) {
    images.unshift({ type: 'image', name: '社交分享图', source: absoluteUrl(ogImage, baseUrl) })
  }

  return uniqueBy(images, 'source').slice(0, 12)
}

function extractLinks(html, baseUrl) {
  const links = []
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = linkPattern.exec(html)) && links.length < 40) {
    const href = match[1]
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue
    const text = decodeEntities(match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    links.push({
      text: text || absoluteUrl(href, baseUrl),
      href: absoluteUrl(href, baseUrl)
    })
  }
  return uniqueBy(links, 'href').slice(0, 12)
}

async function fetchTargetPage(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    try {
      const response = await fetch(url, {
        headers: DEFAULT_HEADERS,
        redirect: 'follow',
        signal: controller.signal
      })
      const html = await response.text()
      return {
        ok: response.ok,
        statusCode: response.status,
        finalUrl: response.url || url,
        html,
        transport: 'node-fetch'
      }
    } catch (fetchError) {
      const { stdout } = await execFileAsync('curl', [
        '-L',
        '--silent',
        '--show-error',
        '--max-time',
        '15',
        '-A',
        DEFAULT_HEADERS['User-Agent'],
        url
      ], {
        maxBuffer: 12 * 1024 * 1024
      })
      return {
        ok: Boolean(stdout),
        statusCode: stdout ? 200 : 0,
        finalUrl: url,
        html: stdout,
        transport: 'curl-fallback',
        fetchError: fetchError.message
      }
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function captureSingleFileHtml(url, options = {}) {
  const outputDir = await mkdtemp(join(tmpdir(), 'liuchengtong-singlefile-'))
  const outputPath = join(outputDir, 'page.html')
  try {
    const browserArgs = options.remoteDebuggingUrl
      ? [
          '--browser-remote-debugging-URL',
          options.remoteDebuggingUrl
        ]
      : [
          '--browser-executable-path',
          CHROME_EXECUTABLE
        ]
    await execFileAsync(SINGLE_FILE_BIN, [
      url,
      outputPath,
      ...browserArgs,
      '--browser-width',
      String(options.width || 1440),
      '--browser-height',
      String(options.height || 900),
      '--browser-wait-until',
      'networkIdle',
      '--browser-wait-delay',
      String(options.waitDelay || 800),
      '--browser-load-max-time',
      String(options.loadMaxTime || 20000),
      '--browser-capture-max-time',
      String(options.captureMaxTime || 30000),
      '--filename-conflict-action',
      'overwrite'
    ], {
      maxBuffer: 16 * 1024 * 1024,
      timeout: options.timeout || 45000
    })
    return await readFile(outputPath, 'utf8')
  } finally {
    await rm(outputDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function captureDomSnapshot(page) {
  const session = await page.context().newCDPSession(page)
  try {
    await session.send('DOMSnapshot.enable')
    return await session.send('DOMSnapshot.captureSnapshot', {
      computedStyles: [
        'display',
        'position',
        'width',
        'height',
        'color',
        'background-color',
        'font-family',
        'font-size',
        'font-weight',
        'line-height',
        'border-radius',
        'box-shadow',
        'opacity',
        'transform'
      ],
      includeDOMRects: true,
      includePaintOrder: true
    })
  } finally {
    await session.detach().catch(() => {})
  }
}

async function capturePreparedPage(page, url, {
  transport = 'chrome-render',
  singleFileHtml = '',
  singleFileError = '',
  closeContext = null,
  reuseCurrentPage = false
} = {}) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })
  const currentUrl = page.url()
  if (!reuseCurrentPage || !currentUrl || currentUrl === 'about:blank') {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 })
  }
  await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {})
  await page.waitForTimeout(800)

  const screenshot = await page.screenshot({ type: 'png', fullPage: false })
  const screenshotDataUrl = `data:image/png;base64,${screenshot.toString('base64')}`
  let domSnapshot = null
  let domSnapshotError = ''
  try {
    domSnapshot = await captureDomSnapshot(page)
  } catch (error) {
    domSnapshotError = error.message
  }
  const snapshot = await page.evaluate(() => {
    const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
    const pick = (selector, limit) => Array.from(document.querySelectorAll(selector)).slice(0, limit)
    const viewport = { width: innerWidth, height: innerHeight }
    const isVisibleRect = (rect) => rect.width > 1 && rect.height > 1 && rect.bottom >= 0 && rect.right >= 0 && rect.top <= viewport.height && rect.left <= viewport.width
    const directText = (el) => Array.from(el.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join(' ')
    const usefulTextTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'li', 'label', 'strong', 'em', 'small'])
    const bodyStyle = getComputedStyle(document.body)
    const htmlStyle = getComputedStyle(document.documentElement)
    const textBlocks = pick('h1,h2,h3,p,li,button,a,[role="button"]', 80)
      .map((el) => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return { tag: el.tagName.toLowerCase(), text: cleanText(el.innerText || el.textContent), x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), fontSize: style.fontSize, color: style.color, fontWeight: style.fontWeight }
      })
      .filter((item) => item.text && item.width > 0 && item.height > 0)
    const images = pick('img', 60).map((img) => ({ type: 'image', name: img.alt || '页面图片', source: img.currentSrc || img.src })).filter((item) => item.source && !item.source.startsWith('data:'))
    const links = pick('a[href]', 80).map((a) => {
      const rect = a.getBoundingClientRect()
      return {
        text: cleanText(a.innerText || a.textContent) || a.href,
        href: a.href,
        rect: isVisibleRect(rect)
          ? {
              x: Math.round((Math.max(0, rect.x) / viewport.width) * 1000) / 10,
              y: Math.round((Math.max(0, rect.y) / viewport.height) * 1000) / 10,
              width: Math.round((Math.min(rect.width, viewport.width - Math.max(0, rect.x)) / viewport.width) * 1000) / 10,
              height: Math.round((Math.min(rect.height, viewport.height - Math.max(0, rect.y)) / viewport.height) * 1000) / 10
            }
          : null
      }
    }).filter((item) => item.href)
    const colors = Array.from(new Set(pick('body *', 300).flatMap((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]).filter((color) => color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent'))).slice(0, 16)
    const layoutNodes = Array.from(document.body.querySelectorAll('*')).map((el, order) => {
      const tag = el.tagName.toLowerCase()
      if (['script', 'style', 'noscript', 'template', 'meta', 'link'].includes(tag)) return null
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (!isVisibleRect(rect) || style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return null
      const fullText = cleanText(el.innerText || el.textContent)
      const ownText = cleanText(directText(el))
      const isImage = tag === 'img'
      const isSvg = tag === 'svg'
      const isForm = ['input', 'textarea', 'select'].includes(tag)
      const isText = usefulTextTags.has(tag) && fullText && fullText.length <= 260 && (ownText || ['a', 'button', 'li', 'label'].includes(tag) || el.children.length <= 1)
      const hasSurface = style.backgroundColor !== 'rgba(0, 0, 0, 0)' || (style.backgroundImage && style.backgroundImage !== 'none') || style.boxShadow !== 'none'
      if (!isImage && !isSvg && !isForm && !isText && !hasSurface) return null
      const nodeType = isImage ? 'image' : isSvg ? 'svg' : isForm ? 'control' : isText ? 'text' : 'surface'
      return {
        id: `node-${order}`,
        order,
        type: nodeType,
        tag,
        text: nodeType === 'text' ? fullText : '',
        src: isImage ? (el.currentSrc || el.src || '') : '',
        svg: isSvg ? el.outerHTML : '',
        alt: isImage ? (el.alt || '') : '',
        href: tag === 'a' ? el.href : '',
        placeholder: isForm ? (el.getAttribute('placeholder') || el.getAttribute('aria-label') || '') : '',
        x: Math.round(Math.max(0, rect.x)),
        y: Math.round(Math.max(0, rect.y)),
        width: Math.round(Math.min(rect.width, viewport.width - Math.max(0, rect.x))),
        height: Math.round(Math.min(rect.height, viewport.height - Math.max(0, rect.y))),
        zIndex: Number.parseInt(style.zIndex, 10) || 0,
        style: { color: style.color, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage && style.backgroundImage !== 'none' ? style.backgroundImage : '', backgroundSize: style.backgroundSize, backgroundPosition: style.backgroundPosition, backgroundRepeat: style.backgroundRepeat, fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, textAlign: style.textAlign, borderRadius: style.borderRadius, borderColor: style.borderColor, borderStyle: style.borderStyle, borderWidth: style.borderWidth, boxShadow: style.boxShadow, transform: style.transform, opacity: style.opacity, objectFit: style.objectFit, overflow: style.overflow }
      }
    }).filter(Boolean).filter((node) => node.width > 0 && node.height > 0).slice(0, 420)
    return { title: document.title, description: document.querySelector('meta[name="description"]')?.content || '', url: location.href, textBlocks, images, links, colors, layoutNodes, pageBackground: bodyStyle.backgroundColor && bodyStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ? bodyStyle.backgroundColor : htmlStyle.backgroundColor, viewport }
  })
  const html = await page.content()
  await closeContext?.()
  return { ok: true, statusCode: 200, finalUrl: snapshot.url || url, html, transport, screenshotDataUrl, snapshot, singleFileHtml, singleFileError, domSnapshot, domSnapshotError }
}

async function captureWithRemoteBrowser(url, session) {
  let singleFileHtml = ''
  let singleFileError = '授权浏览器模式复用用户已登录页面，跳过会重新打开页面的 SingleFile 捕获。'
  const browser = await chromium.connectOverCDP(session.debuggingUrl)
  try {
    const context = browser.contexts()[0] || await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: DEFAULT_HEADERS['User-Agent'],
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai'
    })
    const page = context.pages()[0]
    if (!page) {
      throw new Error('授权浏览器页面不存在，请重新打开授权浏览器后再采集')
    }
    const captureUrl = page.url() && page.url() !== 'about:blank' ? page.url() : url
    const result = await capturePreparedPage(page, captureUrl, {
      transport: 'chrome-remote-session',
      singleFileHtml,
      singleFileError,
      reuseCurrentPage: true
    })
    session.currentUrl = page.url() || captureUrl
    return {
      ...result,
      staticHtml: result.html
    }
  } finally {
    await browser.close()
  }
}

function placeholderBrowserScreenshot(session = {}) {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lS7R3wAAAABJRU5ErkJggg=='
}

async function browserSessionPreview(session) {
  if (!session) return { status: 'missing', message: '授权浏览器会话不存在' }
  if (isTestRuntime) {
    return {
      sessionId: session.sessionId,
      status: session.status,
      url: session.currentUrl || session.loginUrl,
      title: '授权浏览器',
      screenshot: placeholderBrowserScreenshot(session),
      viewport: { width: 960, height: 600 }
    }
  }
  const browser = await chromium.connectOverCDP(session.debuggingUrl)
  try {
    const context = browser.contexts()[0] || await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = context.pages()[0] || await context.newPage()
    if (session.currentUrl && page.url() === 'about:blank') {
      await page.goto(session.currentUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {})
    }
    await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})
    const screenshot = await page.screenshot({ type: 'png', fullPage: false })
    session.currentUrl = page.url() || session.currentUrl || session.loginUrl
    return {
      sessionId: session.sessionId,
      status: session.status,
      url: session.currentUrl,
      title: await page.title().catch(() => ''),
      screenshot: `data:image/png;base64,${screenshot.toString('base64')}`,
      viewport: page.viewportSize() || { width: 1440, height: 900 }
    }
  } finally {
    await browser.close()
  }
}

async function browserSessionAction(session, action = {}) {
  if (!session) return { status: 'missing', message: '授权浏览器会话不存在' }
  if (isTestRuntime) {
    if (action.type === 'navigate' && action.url) session.currentUrl = action.url
    if (['back', 'forward', 'reload', 'scroll'].includes(action.type)) session.currentUrl = session.currentUrl || session.loginUrl
    return {
      sessionId: session.sessionId,
      status: 'ok',
      action: action.type || 'noop',
      url: session.currentUrl || session.loginUrl
    }
  }
  const browser = await chromium.connectOverCDP(session.debuggingUrl)
  try {
    const context = browser.contexts()[0] || await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = context.pages()[0] || await context.newPage()
    if (action.type === 'navigate' && action.url) {
      await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 12000 })
    } else if (action.type === 'click') {
      await page.mouse.click(Number(action.x) || 0, Number(action.y) || 0)
    } else if (action.type === 'type') {
      await page.keyboard.type(String(action.text || ''), { delay: 12 })
    } else if (action.type === 'press') {
      await page.keyboard.press(String(action.key || 'Enter'))
    } else if (action.type === 'reload') {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 12000 })
    } else if (action.type === 'back') {
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => null)
    } else if (action.type === 'forward') {
      await page.goForward({ waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => null)
    } else if (action.type === 'scroll') {
      await page.mouse.wheel(Number(action.deltaX) || 0, Number(action.deltaY) || 0)
    }
    await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {})
    session.currentUrl = page.url() || session.currentUrl || session.loginUrl
    return {
      sessionId: session.sessionId,
      status: 'ok',
      action: action.type || 'noop',
      url: session.currentUrl
    }
  } finally {
    await browser.close()
  }
}

async function captureWithChrome(url) {
  let singleFileHtml = ''
  let singleFileError = ''
  try {
    singleFileHtml = await captureSingleFileHtml(url)
  } catch (error) {
    singleFileError = error.message
  }

  const browser = await chromium.launch({
    executablePath: CHROME_EXECUTABLE,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  })
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      userAgent: DEFAULT_HEADERS['User-Agent'],
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai'
    })
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 })
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {})
    await page.waitForTimeout(800)

    const screenshot = await page.screenshot({ type: 'png', fullPage: false })
    const screenshotDataUrl = `data:image/png;base64,${screenshot.toString('base64')}`
    let domSnapshot = null
    let domSnapshotError = ''
    try {
      domSnapshot = await captureDomSnapshot(page)
    } catch (error) {
      domSnapshotError = error.message
    }
    const snapshot = await page.evaluate(() => {
      const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
      const pick = (selector, limit) => Array.from(document.querySelectorAll(selector)).slice(0, limit)
      const transparent = new Set(['rgba(0, 0, 0, 0)', 'transparent'])
      const viewport = { width: innerWidth, height: innerHeight }
      const isVisibleRect = (rect) => (
        rect.width > 1
        && rect.height > 1
        && rect.bottom >= 0
        && rect.right >= 0
        && rect.top <= viewport.height
        && rect.left <= viewport.width
      )
      const directText = (el) => Array.from(el.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(' ')
      const usefulTextTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'li', 'label', 'strong', 'em', 'small'])
      const bodyStyle = getComputedStyle(document.body)
      const htmlStyle = getComputedStyle(document.documentElement)
      const pseudoNodes = []
      const textBlocks = pick('h1,h2,h3,p,li,button,a,[role="button"]', 80)
        .map((el) => {
          const rect = el.getBoundingClientRect()
          const style = getComputedStyle(el)
          return {
            tag: el.tagName.toLowerCase(),
            text: cleanText(el.innerText || el.textContent),
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            fontSize: style.fontSize,
            color: style.color,
            fontWeight: style.fontWeight
          }
        })
        .filter((item) => item.text && item.width > 0 && item.height > 0)
      const images = pick('img', 60)
        .map((img) => ({
          type: 'image',
          name: img.alt || '页面图片',
          source: img.currentSrc || img.src
        }))
        .filter((item) => item.source && !item.source.startsWith('data:'))
      const links = pick('a[href]', 80)
        .map((a) => {
          const rect = a.getBoundingClientRect()
          return {
            text: cleanText(a.innerText || a.textContent) || a.href,
            href: a.href,
            rect: isVisibleRect(rect)
              ? {
                  x: Math.round((Math.max(0, rect.x) / viewport.width) * 1000) / 10,
                  y: Math.round((Math.max(0, rect.y) / viewport.height) * 1000) / 10,
                  width: Math.round((Math.min(rect.width, viewport.width - Math.max(0, rect.x)) / viewport.width) * 1000) / 10,
                  height: Math.round((Math.min(rect.height, viewport.height - Math.max(0, rect.y)) / viewport.height) * 1000) / 10
                }
              : null
          }
        })
        .filter((item) => item.href)
      const colors = Array.from(new Set(
        pick('body *', 300)
          .flatMap((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor])
          .filter((color) => color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent')
      )).slice(0, 16)
      const treeStyleKeys = [
        'display', 'position', 'boxSizing', 'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
        'margin', 'padding', 'gap', 'gridTemplateColumns', 'gridTemplateRows', 'flexDirection', 'flexWrap',
        'justifyContent', 'alignItems', 'alignContent', 'color', 'backgroundColor', 'backgroundImage',
        'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'fontFamily', 'fontSize', 'fontWeight',
        'lineHeight', 'letterSpacing', 'textAlign', 'textTransform', 'textDecoration', 'borderRadius',
        'borderColor', 'borderStyle', 'borderWidth', 'boxShadow', 'opacity', 'overflow', 'objectFit',
        'transform', 'transformOrigin', 'filter', 'backdropFilter', 'clipPath'
      ]
      const treeStyleOf = (el) => {
        const style = getComputedStyle(el)
        const result = {}
        for (const key of treeStyleKeys) result[key] = style[key] || ''
        return result
      }
      const hasVisualStyle = (style) => {
        const background = style.backgroundColor && !transparent.has(style.backgroundColor)
        const image = style.backgroundImage && style.backgroundImage !== 'none'
        const border = style.borderStyle !== 'none' && Number.parseFloat(style.borderWidth || '0') > 0
        const shadow = style.boxShadow && style.boxShadow !== 'none'
        return background || image || border || shadow
      }
      const buildTreeNode = (el, depth = 0, budget = { count: 0 }) => {
        if (!(el instanceof Element) || budget.count > 520 || depth > 9) return null
        const tag = el.tagName.toLowerCase()
        if (['script', 'style', 'noscript', 'template', 'meta', 'link'].includes(tag)) return null
        const rect = el.getBoundingClientRect()
        const computed = getComputedStyle(el)
        if (!isVisibleRect(rect) || computed.visibility === 'hidden' || computed.display === 'none' || Number(computed.opacity) === 0) return null
        const style = treeStyleOf(el)
        const ownText = cleanText(directText(el)).slice(0, 360)
        const isImage = tag === 'img'
        const isSvg = tag === 'svg'
        const isForm = ['input', 'textarea', 'select'].includes(tag)
        const children = Array.from(el.children)
          .map((child) => buildTreeNode(child, depth + 1, budget))
          .filter(Boolean)
          .slice(0, 80)
        const keep = children.length || ownText || isImage || isSvg || isForm || hasVisualStyle(style)
        if (!keep) return null
        budget.count += 1
        return {
          id: `tree-${budget.count}`,
          tag,
          type: isImage ? 'image' : isSvg ? 'svg' : isForm ? 'control' : ownText ? 'text' : 'container',
          text: ownText,
          src: isImage ? (el.currentSrc || el.src || '') : '',
          svg: isSvg ? el.outerHTML : '',
          alt: isImage ? (el.alt || '') : '',
          href: tag === 'a' ? el.href : '',
          placeholder: isForm ? (el.getAttribute('placeholder') || el.getAttribute('aria-label') || '') : '',
          rect: {
            x: Math.round(Math.max(0, rect.x)),
            y: Math.round(Math.max(0, rect.y)),
            width: Math.round(Math.min(rect.width, viewport.width - Math.max(0, rect.x))),
            height: Math.round(Math.min(rect.height, viewport.height - Math.max(0, rect.y)))
          },
          style,
          children
        }
      }
      const designTree = buildTreeNode(document.body, 0, { count: 0 })
      const layoutNodes = Array.from(document.body.querySelectorAll('*'))
        .map((el, order) => {
          const tag = el.tagName.toLowerCase()
          if (['script', 'style', 'noscript', 'template', 'meta', 'link'].includes(tag)) return null
          const rect = el.getBoundingClientRect()
          const style = getComputedStyle(el)
          if (!isVisibleRect(rect) || style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return null

          const fullText = cleanText(el.innerText || el.textContent)
          const ownText = cleanText(directText(el))
          const backgroundColor = style.backgroundColor
          const backgroundImage = style.backgroundImage && style.backgroundImage !== 'none' ? style.backgroundImage : ''
          const border = style.borderStyle !== 'none' && Number.parseFloat(style.borderWidth) > 0
          const hasSurface = (!transparent.has(backgroundColor) || backgroundImage || border || style.boxShadow !== 'none')
            && rect.width >= 12
            && rect.height >= 8
          const isImage = tag === 'img'
          const isSvg = tag === 'svg'
          const isForm = ['input', 'textarea', 'select'].includes(tag)
          const isText = usefulTextTags.has(tag)
            && fullText
            && fullText.length <= 260
            && (ownText || ['a', 'button', 'li', 'label'].includes(tag) || el.children.length <= 1)
          if (!isImage && !isSvg && !isForm && !isText && !hasSurface) return null

          const nodeType = isImage ? 'image' : isSvg ? 'svg' : isForm ? 'control' : isText ? 'text' : 'surface'
          const zIndex = Number.parseInt(style.zIndex, 10)
          for (const pseudo of ['::before', '::after']) {
            const pseudoStyle = getComputedStyle(el, pseudo)
            const content = pseudoStyle.content || ''
            const hasPseudoContent = content && content !== 'none' && content !== 'normal' && content !== '""'
            const pseudoBg = pseudoStyle.backgroundColor
            const pseudoBgImage = pseudoStyle.backgroundImage && pseudoStyle.backgroundImage !== 'none' ? pseudoStyle.backgroundImage : ''
            const pseudoBorder = pseudoStyle.borderStyle !== 'none' && Number.parseFloat(pseudoStyle.borderWidth) > 0
            if ((hasPseudoContent || pseudoBgImage || pseudoBorder || (pseudoBg && !transparent.has(pseudoBg))) && rect.width > 0 && rect.height > 0) {
              pseudoNodes.push({
                id: `pseudo-${order}-${pseudo.slice(2)}`,
                order: order + 0.1,
                type: 'pseudo',
                tag: pseudo,
                text: hasPseudoContent ? content.replace(/^["']|["']$/g, '') : '',
                x: Math.round(Math.max(0, rect.x)),
                y: Math.round(Math.max(0, rect.y)),
                width: Math.round(Math.min(rect.width, viewport.width - Math.max(0, rect.x))),
                height: Math.round(Math.min(rect.height, viewport.height - Math.max(0, rect.y))),
                zIndex: Number.isFinite(zIndex) ? zIndex + 1 : 1,
                style: {
                  color: pseudoStyle.color,
                  backgroundColor: pseudoBg,
                  backgroundImage: pseudoBgImage,
                  backgroundSize: pseudoStyle.backgroundSize,
                  backgroundPosition: pseudoStyle.backgroundPosition,
                  backgroundRepeat: pseudoStyle.backgroundRepeat,
                  fontFamily: pseudoStyle.fontFamily,
                  fontSize: pseudoStyle.fontSize,
                  fontWeight: pseudoStyle.fontWeight,
                  lineHeight: pseudoStyle.lineHeight,
                  borderRadius: pseudoStyle.borderRadius,
                  borderColor: pseudoStyle.borderColor,
                  borderStyle: pseudoStyle.borderStyle,
                  borderWidth: pseudoStyle.borderWidth,
                  boxShadow: pseudoStyle.boxShadow,
                  transform: pseudoStyle.transform,
                  filter: pseudoStyle.filter,
                  opacity: pseudoStyle.opacity
                }
              })
            }
          }
          return {
            id: `node-${order}`,
            order,
            type: nodeType,
            tag,
            text: nodeType === 'text' ? fullText : '',
            src: isImage ? (el.currentSrc || el.src || '') : '',
            svg: isSvg ? el.outerHTML : '',
            alt: isImage ? (el.alt || '') : '',
            href: tag === 'a' ? el.href : '',
            placeholder: isForm ? (el.getAttribute('placeholder') || el.getAttribute('aria-label') || '') : '',
            x: Math.round(Math.max(0, rect.x)),
            y: Math.round(Math.max(0, rect.y)),
            width: Math.round(Math.min(rect.width, viewport.width - Math.max(0, rect.x))),
            height: Math.round(Math.min(rect.height, viewport.height - Math.max(0, rect.y))),
            zIndex: Number.isFinite(zIndex) ? zIndex : 0,
            style: {
              color: style.color,
              backgroundColor,
              backgroundImage,
              backgroundSize: style.backgroundSize,
              backgroundPosition: style.backgroundPosition,
              backgroundRepeat: style.backgroundRepeat,
              backgroundClip: style.backgroundClip,
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              lineHeight: style.lineHeight,
              letterSpacing: style.letterSpacing,
              textAlign: style.textAlign,
              textTransform: style.textTransform,
              textDecoration: style.textDecoration,
              textShadow: style.textShadow,
              whiteSpace: style.whiteSpace,
              display: style.display,
              justifyContent: style.justifyContent,
              alignItems: style.alignItems,
              gap: style.gap,
              padding: style.padding,
              borderRadius: style.borderRadius,
              borderColor: style.borderColor,
              borderStyle: style.borderStyle,
              borderWidth: style.borderWidth,
              boxShadow: style.boxShadow,
              transform: style.transform,
              transformOrigin: style.transformOrigin,
              filter: style.filter,
              backdropFilter: style.backdropFilter,
              clipPath: style.clipPath,
              maskImage: style.maskImage,
              maskSize: style.maskSize,
              maskPosition: style.maskPosition,
              maskRepeat: style.maskRepeat,
              opacity: style.opacity,
              objectFit: style.objectFit,
              overflow: style.overflow
            }
          }
        })
        .concat(pseudoNodes)
        .filter(Boolean)
        .filter((node) => node.width > 0 && node.height > 0)
        .sort((a, b) => {
          const weight = { surface: 0, image: 1, control: 2, text: 3 }
          return (a.zIndex - b.zIndex) || (weight[a.type] - weight[b.type]) || (a.order - b.order)
        })
        .slice(0, 420)
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        url: location.href,
        textBlocks,
        images,
        links,
        colors,
        layoutNodes,
        designTree,
        pageBackground: bodyStyle.backgroundColor && bodyStyle.backgroundColor !== 'rgba(0, 0, 0, 0)'
          ? bodyStyle.backgroundColor
          : htmlStyle.backgroundColor,
        viewport
      }
    })

    return {
      ok: true,
      statusCode: 200,
      finalUrl: snapshot.url || url,
      html: await page.content(),
      transport: 'chrome-render',
      screenshotDataUrl,
      snapshot,
      singleFileHtml,
      singleFileError,
      domSnapshot,
      domSnapshotError
    }
  } finally {
    await browser.close()
  }
}

function normalizeCookie(cookie = {}, fallbackDomain = '') {
  if (!cookie.name || typeof cookie.value !== 'string') return null
  const normalized = {
    name: String(cookie.name),
    value: String(cookie.value),
    path: cookie.path || '/'
  }
  if (cookie.url) normalized.url = cookie.url
  else if (cookie.domain) normalized.domain = cookie.domain
  else if (fallbackDomain) normalized.domain = fallbackDomain
  if (typeof cookie.expires === 'number') normalized.expires = cookie.expires
  if (typeof cookie.httpOnly === 'boolean') normalized.httpOnly = cookie.httpOnly
  if (typeof cookie.secure === 'boolean') normalized.secure = cookie.secure
  if (cookie.sameSite && ['Strict', 'Lax', 'None'].includes(cookie.sameSite)) normalized.sameSite = cookie.sameSite
  return normalized
}

function parseCookieText(cookieText = '', fallbackDomain = '') {
  cookieText = String(cookieText || '')
  return cookieText
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf('=')
      if (separator <= 0) return null
      return normalizeCookie({
        name: part.slice(0, separator).trim(),
        value: part.slice(separator + 1).trim()
      }, fallbackDomain)
    })
    .filter(Boolean)
}

function normalizeCookieSession(session = {}, url = '') {
  let fallbackDomain = ''
  try {
    fallbackDomain = new URL(url).hostname
  } catch {}
  const parsedCookies = session.cookieText
    ? parseCookieText(session.cookieText, fallbackDomain)
    : []
  return {
    ...session,
    cookies: [
      ...(Array.isArray(session.cookies) ? session.cookies : []),
      ...parsedCookies
    ]
  }
}

async function captureWithChromeAndSession(url, session = {}) {
  let singleFileHtml = ''
  let singleFileError = ''
  try {
    singleFileHtml = await captureSingleFileHtml(url)
  } catch (error) {
    singleFileError = error.message
  }

  const browser = await chromium.launch({
    executablePath: CHROME_EXECUTABLE,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  })
  try {
    let fallbackDomain = ''
    try {
      fallbackDomain = new URL(url).hostname
    } catch {}
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: DEFAULT_HEADERS['User-Agent'],
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      storageState: session.storageState && typeof session.storageState === 'object' ? session.storageState : undefined
    })
    const cookies = Array.isArray(session.cookies)
      ? session.cookies.map((cookie) => normalizeCookie(cookie, fallbackDomain)).filter(Boolean)
      : []
    if (cookies.length) await context.addCookies(cookies)
    const page = await context.newPage()
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 })
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {})
    await page.waitForTimeout(800)

    const screenshot = await page.screenshot({ type: 'png', fullPage: false })
    const screenshotDataUrl = `data:image/png;base64,${screenshot.toString('base64')}`
    let domSnapshot = null
    let domSnapshotError = ''
    try {
      domSnapshot = await captureDomSnapshot(page)
    } catch (error) {
      domSnapshotError = error.message
    }
    const snapshot = await page.evaluate(() => {
      const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
      const pick = (selector, limit) => Array.from(document.querySelectorAll(selector)).slice(0, limit)
      const transparent = new Set(['rgba(0, 0, 0, 0)', 'transparent'])
      const viewport = { width: innerWidth, height: innerHeight }
      const isVisibleRect = (rect) => rect.width > 1 && rect.height > 1 && rect.bottom >= 0 && rect.right >= 0 && rect.top <= viewport.height && rect.left <= viewport.width
      const directText = (el) => Array.from(el.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join(' ')
      const usefulTextTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'li', 'label', 'strong', 'em', 'small'])
      const bodyStyle = getComputedStyle(document.body)
      const htmlStyle = getComputedStyle(document.documentElement)
      const pseudoNodes = []
      const textBlocks = pick('h1,h2,h3,p,li,button,a,[role="button"]', 80)
        .map((el) => {
          const rect = el.getBoundingClientRect()
          const style = getComputedStyle(el)
          return { tag: el.tagName.toLowerCase(), text: cleanText(el.innerText || el.textContent), x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), fontSize: style.fontSize, color: style.color, fontWeight: style.fontWeight }
        })
        .filter((item) => item.text && item.width > 0 && item.height > 0)
      const images = pick('img', 60).map((img) => ({ type: 'image', name: img.alt || '页面图片', source: img.currentSrc || img.src })).filter((item) => item.source && !item.source.startsWith('data:'))
      const links = pick('a[href]', 80).map((a) => {
        const rect = a.getBoundingClientRect()
        return {
          text: cleanText(a.innerText || a.textContent) || a.href,
          href: a.href,
          rect: isVisibleRect(rect)
            ? {
                x: Math.round((Math.max(0, rect.x) / viewport.width) * 1000) / 10,
                y: Math.round((Math.max(0, rect.y) / viewport.height) * 1000) / 10,
                width: Math.round((Math.min(rect.width, viewport.width - Math.max(0, rect.x)) / viewport.width) * 1000) / 10,
                height: Math.round((Math.min(rect.height, viewport.height - Math.max(0, rect.y)) / viewport.height) * 1000) / 10
              }
            : null
        }
      }).filter((item) => item.href)
      const colors = Array.from(new Set(pick('body *', 300).flatMap((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]).filter((color) => color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent'))).slice(0, 16)
      const layoutNodes = Array.from(document.body.querySelectorAll('*')).map((el, order) => {
        const tag = el.tagName.toLowerCase()
        if (['script', 'style', 'noscript', 'template', 'meta', 'link'].includes(tag)) return null
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        if (!isVisibleRect(rect) || style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return null
        const fullText = cleanText(el.innerText || el.textContent)
        const ownText = cleanText(directText(el))
        const backgroundColor = style.backgroundColor
        const backgroundImage = style.backgroundImage && style.backgroundImage !== 'none' ? style.backgroundImage : ''
        const border = style.borderStyle !== 'none' && Number.parseFloat(style.borderWidth) > 0
        const hasSurface = (!transparent.has(backgroundColor) || backgroundImage || border || style.boxShadow !== 'none') && rect.width >= 12 && rect.height >= 8
        const isImage = tag === 'img'
        const isSvg = tag === 'svg'
        const isForm = ['input', 'textarea', 'select'].includes(tag)
        const isText = usefulTextTags.has(tag) && fullText && fullText.length <= 260 && (ownText || ['a', 'button', 'li', 'label'].includes(tag) || el.children.length <= 1)
        if (!isImage && !isSvg && !isForm && !isText && !hasSurface) return null
        const nodeType = isImage ? 'image' : isSvg ? 'svg' : isForm ? 'control' : isText ? 'text' : 'surface'
        const zIndex = Number.parseInt(style.zIndex, 10)
        for (const pseudo of ['::before', '::after']) {
          const pseudoStyle = getComputedStyle(el, pseudo)
          const content = pseudoStyle.content || ''
          const hasPseudoContent = content && content !== 'none' && content !== 'normal' && content !== '""'
          const pseudoBg = pseudoStyle.backgroundColor
          const pseudoBgImage = pseudoStyle.backgroundImage && pseudoStyle.backgroundImage !== 'none' ? pseudoStyle.backgroundImage : ''
          const pseudoBorder = pseudoStyle.borderStyle !== 'none' && Number.parseFloat(pseudoStyle.borderWidth) > 0
          if ((hasPseudoContent || pseudoBgImage || pseudoBorder || (pseudoBg && !transparent.has(pseudoBg))) && rect.width > 0 && rect.height > 0) {
            pseudoNodes.push({
              id: `pseudo-${order}-${pseudo.slice(2)}`,
              order: order + 0.1,
              type: 'pseudo',
              tag: pseudo,
              text: hasPseudoContent ? content.replace(/^["']|["']$/g, '') : '',
              x: Math.round(Math.max(0, rect.x)),
              y: Math.round(Math.max(0, rect.y)),
              width: Math.round(Math.min(rect.width, viewport.width - Math.max(0, rect.x))),
              height: Math.round(Math.min(rect.height, viewport.height - Math.max(0, rect.y))),
              zIndex: Number.isFinite(zIndex) ? zIndex + 1 : 1,
              style: { color: pseudoStyle.color, backgroundColor: pseudoBg, backgroundImage: pseudoBgImage, backgroundSize: pseudoStyle.backgroundSize, backgroundPosition: pseudoStyle.backgroundPosition, backgroundRepeat: pseudoStyle.backgroundRepeat, fontFamily: pseudoStyle.fontFamily, fontSize: pseudoStyle.fontSize, fontWeight: pseudoStyle.fontWeight, lineHeight: pseudoStyle.lineHeight, borderRadius: pseudoStyle.borderRadius, borderColor: pseudoStyle.borderColor, borderStyle: pseudoStyle.borderStyle, borderWidth: pseudoStyle.borderWidth, boxShadow: pseudoStyle.boxShadow, transform: pseudoStyle.transform, filter: pseudoStyle.filter, opacity: pseudoStyle.opacity }
            })
          }
        }
        return {
          id: `node-${order}`,
          order,
          type: nodeType,
          tag,
          text: nodeType === 'text' ? fullText : '',
          src: isImage ? (el.currentSrc || el.src || '') : '',
          svg: isSvg ? el.outerHTML : '',
          alt: isImage ? (el.alt || '') : '',
          href: tag === 'a' ? el.href : '',
          placeholder: isForm ? (el.getAttribute('placeholder') || el.getAttribute('aria-label') || '') : '',
          x: Math.round(Math.max(0, rect.x)),
          y: Math.round(Math.max(0, rect.y)),
          width: Math.round(Math.min(rect.width, viewport.width - Math.max(0, rect.x))),
          height: Math.round(Math.min(rect.height, viewport.height - Math.max(0, rect.y))),
          zIndex: Number.isFinite(zIndex) ? zIndex : 0,
          style: { color: style.color, backgroundColor, backgroundImage, backgroundSize: style.backgroundSize, backgroundPosition: style.backgroundPosition, backgroundRepeat: style.backgroundRepeat, backgroundClip: style.backgroundClip, fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, textAlign: style.textAlign, textTransform: style.textTransform, textDecoration: style.textDecoration, textShadow: style.textShadow, whiteSpace: style.whiteSpace, display: style.display, justifyContent: style.justifyContent, alignItems: style.alignItems, gap: style.gap, padding: style.padding, borderRadius: style.borderRadius, borderColor: style.borderColor, borderStyle: style.borderStyle, borderWidth: style.borderWidth, boxShadow: style.boxShadow, transform: style.transform, transformOrigin: style.transformOrigin, filter: style.filter, backdropFilter: style.backdropFilter, clipPath: style.clipPath, maskImage: style.maskImage, maskSize: style.maskSize, maskPosition: style.maskPosition, maskRepeat: style.maskRepeat, opacity: style.opacity, objectFit: style.objectFit, overflow: style.overflow }
        }
      }).concat(pseudoNodes).filter(Boolean).filter((node) => node.width > 0 && node.height > 0).sort((a, b) => {
        const weight = { surface: 0, image: 1, control: 2, text: 3 }
        return (a.zIndex - b.zIndex) || (weight[a.type] - weight[b.type]) || (a.order - b.order)
      }).slice(0, 420)
      return { title: document.title, description: document.querySelector('meta[name="description"]')?.content || '', url: location.href, textBlocks, images, links, colors, layoutNodes, pageBackground: bodyStyle.backgroundColor && bodyStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ? bodyStyle.backgroundColor : htmlStyle.backgroundColor, viewport }
    })
    const html = await page.content()
    await context.close()
    return { ok: true, statusCode: 200, finalUrl: snapshot.url || url, html, transport: 'chrome-render-session', screenshotDataUrl, snapshot, singleFileHtml, singleFileError, domSnapshot, domSnapshotError }
  } finally {
    await browser.close()
  }
}

function normalizeLayoutNodes(captureResult = {}) {
  const viewport = captureResult.viewport || { width: 1440, height: 900 }
  const nodes = Array.isArray(captureResult.layoutNodes) ? captureResult.layoutNodes : []
  return nodes
    .filter((node) => node && node.width > 0 && node.height > 0)
    .slice(0, 420)
    .map((node, index) => ({
      ...node,
      id: node.id || `node-${index}`,
      x: Math.max(0, Math.round(node.x || 0)),
      y: Math.max(0, Math.round(node.y || 0)),
      width: Math.min(Math.round(node.width || 0), viewport.width),
      height: Math.min(Math.round(node.height || 0), viewport.height),
      style: node.style || {}
    }))
}

function htmlNodeStyle(node) {
  const style = node.style || {}
  const entries = [
    ['left', `${node.x}px`],
    ['top', `${node.y}px`],
    ['width', `${node.width}px`],
    ['height', `${node.height}px`],
    ['z-index', String(node.zIndex || 0)],
    ['color', style.color],
    ['background-color', node.type === 'text' ? 'transparent' : style.backgroundColor],
    ['background-image', style.backgroundImage],
    ['background-size', style.backgroundSize],
    ['background-position', style.backgroundPosition],
    ['background-repeat', style.backgroundRepeat],
    ['background-clip', style.backgroundClip],
    ['font-family', style.fontFamily],
    ['font-size', style.fontSize],
    ['font-weight', style.fontWeight],
    ['line-height', style.lineHeight],
    ['letter-spacing', style.letterSpacing],
    ['text-align', style.textAlign],
    ['text-transform', style.textTransform],
    ['text-decoration', style.textDecoration],
    ['text-shadow', style.textShadow],
    ['white-space', style.whiteSpace],
    ['display', node.type === 'surface' || node.type === 'control' ? style.display : 'block'],
    ['justify-content', style.justifyContent],
    ['align-items', style.alignItems],
    ['gap', style.gap],
    ['padding', node.type === 'surface' ? '0' : style.padding],
    ['border-radius', style.borderRadius],
    ['border-color', style.borderColor],
    ['border-style', style.borderStyle],
    ['border-width', style.borderWidth],
    ['box-shadow', style.boxShadow],
    ['transform', style.transform],
    ['transform-origin', style.transformOrigin],
    ['filter', style.filter],
    ['backdrop-filter', style.backdropFilter],
    ['clip-path', style.clipPath],
    ['mask-image', style.maskImage],
    ['mask-size', style.maskSize],
    ['mask-position', style.maskPosition],
    ['mask-repeat', style.maskRepeat],
    ['opacity', style.opacity],
    ['overflow', node.type === 'text' ? 'hidden' : style.overflow]
  ]
  return entries
    .filter(([, value]) => value && value !== 'none' && value !== 'normal' && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent')
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
}

function renderLayoutNode(node) {
  const style = htmlNodeStyle(node)
  if (node.type === 'image' && node.src) {
    return `<img class="capture-node capture-image" style="${escapeAttribute(style)};object-fit:${escapeAttribute(node.style?.objectFit || 'cover')}" src="${escapeAttribute(node.src)}" alt="${escapeAttribute(node.alt || '')}" referrerpolicy="no-referrer" />`
  }
  if (node.type === 'control') {
    return `<div class="capture-node capture-control" style="${escapeAttribute(style)}">${escapeHtml(node.placeholder || '')}</div>`
  }
  if (node.type === 'text') {
    const tag = ['a', 'button', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'label', 'strong', 'em', 'small'].includes(node.tag) ? node.tag : 'div'
    const href = tag === 'a' && node.href ? ` href="${escapeAttribute(node.href)}" target="_blank" rel="noreferrer"` : ''
    return `<${tag}${href} class="capture-node capture-text" style="${escapeAttribute(style)}">${escapeHtml(node.text || '')}</${tag}>`
  }
  return `<div class="capture-node capture-surface" style="${escapeAttribute(style)}"></div>`
}

function isWhiteLike(color = '') {
  return /rgb(a)?\(\s*25[0-5]\s*,\s*25[0-5]\s*,\s*25[0-5]/.test(color)
}

function designNodesFromCapture(captureResult = {}) {
  const viewport = captureResult.viewport || { width: 1440, height: 900 }
  const viewportArea = viewport.width * viewport.height
  return normalizeLayoutNodes(captureResult)
    .filter((node) => {
      const style = node.style || {}
      const area = node.width * node.height
      if (node.type === 'text') return Boolean(node.text?.trim())
      if (node.type === 'image') return Boolean(node.src)
      if (node.type === 'svg') return Boolean(node.svg)
      if (node.type === 'pseudo') return true
      if (node.type === 'control') return true
      if (node.type !== 'surface') return false

      const hasVisibleBg = style.backgroundColor
        && style.backgroundColor !== 'rgba(0, 0, 0, 0)'
        && style.backgroundColor !== 'transparent'
        && !isWhiteLike(style.backgroundColor)
      const hasBackgroundImage = style.backgroundImage && style.backgroundImage !== 'none'
      const hasShadow = style.boxShadow && style.boxShadow !== 'none'
      const hasBorder = style.borderStyle && style.borderStyle !== 'none' && Number.parseFloat(style.borderWidth || '0') > 0
      const hasShapeEffect = ['transform', 'filter', 'backdropFilter', 'clipPath', 'maskImage']
        .some((key) => style[key] && style[key] !== 'none')
      const isHuge = area > viewportArea * 0.34 || node.width > viewport.width * 0.96 || node.height > viewport.height * 0.8
      const mostlyOffRight = node.x > viewport.width * 0.86 && node.width > viewport.width * 0.16
      const whitePanel = isWhiteLike(style.backgroundColor) && !hasShadow && !hasBorder && !hasBackgroundImage

      return !whitePanel && !isHuge && !mostlyOffRight && (hasVisibleBg || hasBackgroundImage || hasShadow || hasBorder || hasShapeEffect)
    })
    .slice(0, 260)
}

function nodeClassName(node) {
  if (node.type === 'text') return 'capture-node capture-text'
  if (node.type === 'image') return 'capture-node capture-image'
  if (node.type === 'control') return 'capture-node capture-control'
  return 'capture-node capture-surface'
}

function renderDesignNode(node) {
  const style = htmlNodeStyle(node)
  if (node.type === 'svg' && node.svg) {
    const safeSvg = String(node.svg).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+=["'][^"']*["']/gi, '')
    return `<div class="${nodeClassName(node)}" style="${escapeAttribute(style)}">${safeSvg}</div>`
  }
  if (node.type === 'image' && node.src) {
    return `<img class="${nodeClassName(node)}" style="${escapeAttribute(style)};object-fit:${escapeAttribute(node.style?.objectFit || 'cover')}" src="${escapeAttribute(node.src)}" alt="${escapeAttribute(node.alt || '')}" referrerpolicy="no-referrer" />`
  }
  if (node.type === 'control') {
    return `<div class="${nodeClassName(node)}" style="${escapeAttribute(style)}">${escapeHtml(node.placeholder || '')}</div>`
  }
  if (node.type === 'text') {
    const tag = ['a', 'button', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'strong', 'small'].includes(node.tag) ? node.tag : 'div'
    const href = tag === 'a' && node.href ? ` href="${escapeAttribute(node.href)}" target="_blank" rel="noreferrer"` : ''
    return `<${tag}${href} class="${nodeClassName(node)}" style="${escapeAttribute(style)}">${escapeHtml(node.text || '')}</${tag}>`
  }
  if (node.type === 'pseudo') {
    return `<div class="${nodeClassName(node)}" style="${escapeAttribute(style)}">${escapeHtml(node.text || '')}</div>`
  }
  return `<div class="${nodeClassName(node)}" style="${escapeAttribute(style)}"></div>`
}

function treeNodeStyle(node) {
  const style = node.style || {}
  const entries = [
    ['box-sizing', style.boxSizing],
    ['display', ['html', 'body'].includes(node.tag) ? 'block' : style.display],
    ['position', style.position === 'fixed' ? 'absolute' : style.position],
    ['width', style.width],
    ['height', style.height],
    ['min-width', style.minWidth],
    ['min-height', style.minHeight],
    ['max-width', style.maxWidth],
    ['max-height', style.maxHeight],
    ['margin', node.tag === 'body' ? '0' : style.margin],
    ['padding', style.padding],
    ['gap', style.gap],
    ['grid-template-columns', style.gridTemplateColumns],
    ['grid-template-rows', style.gridTemplateRows],
    ['flex-direction', style.flexDirection],
    ['flex-wrap', style.flexWrap],
    ['justify-content', style.justifyContent],
    ['align-items', style.alignItems],
    ['align-content', style.alignContent],
    ['color', style.color],
    ['background-color', style.backgroundColor],
    ['background-image', style.backgroundImage],
    ['background-size', style.backgroundSize],
    ['background-position', style.backgroundPosition],
    ['background-repeat', style.backgroundRepeat],
    ['font-family', style.fontFamily],
    ['font-size', style.fontSize],
    ['font-weight', style.fontWeight],
    ['line-height', style.lineHeight],
    ['letter-spacing', style.letterSpacing],
    ['text-align', style.textAlign],
    ['text-transform', style.textTransform],
    ['text-decoration', style.textDecoration],
    ['border-radius', style.borderRadius],
    ['border-color', style.borderColor],
    ['border-style', style.borderStyle],
    ['border-width', style.borderWidth],
    ['box-shadow', style.boxShadow],
    ['opacity', style.opacity],
    ['overflow', style.overflow],
    ['object-fit', style.objectFit],
    ['transform', style.transform],
    ['transform-origin', style.transformOrigin],
    ['filter', style.filter],
    ['backdrop-filter', style.backdropFilter],
    ['clip-path', style.clipPath]
  ]
  return entries
    .filter(([, value]) => value && value !== 'none' && value !== 'normal' && value !== 'auto' && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent')
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
}

function safeTreeTag(tag = 'div') {
  return ['main', 'section', 'article', 'header', 'footer', 'nav', 'aside', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'button', 'ul', 'ol', 'li', 'form', 'label', 'strong', 'small'].includes(tag) ? tag : 'div'
}

function renderTreeNode(node) {
  if (!node) return ''
  const style = treeNodeStyle(node)
  if (node.type === 'image' && node.src) {
    return `<img class="tree-node tree-image" style="${escapeAttribute(style)}" src="${escapeAttribute(node.src)}" alt="${escapeAttribute(node.alt || '')}" referrerpolicy="no-referrer" />`
  }
  if (node.type === 'svg' && node.svg) {
    const safeSvg = String(node.svg).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+=["'][^"']*["']/gi, '')
    return `<div class="tree-node tree-svg" style="${escapeAttribute(style)}">${safeSvg}</div>`
  }
  if (node.type === 'control') {
    return `<div class="tree-node tree-control" style="${escapeAttribute(style)}">${escapeHtml(node.placeholder || '')}</div>`
  }
  const tag = safeTreeTag(node.tag)
  const href = tag === 'a' && node.href ? ` href="${escapeAttribute(node.href)}" target="_blank" rel="noreferrer"` : ''
  const children = (node.children || []).map(renderTreeNode).join('')
  const text = node.text ? escapeHtml(node.text) : ''
  return `<${tag}${href} class="tree-node tree-${escapeAttribute(node.type || 'container')}" style="${escapeAttribute(style)}">${text}${children}</${tag}>`
}

function renderEmptyCaptureState(captureResult = {}, nodeCount = 0) {
  const sourceUrl = captureResult.url || '未知来源'
  return `<div class="capture-empty-state">
        <strong>采集到了 DOM 节点，但当前没有可安全还原的可见层</strong>
        <p>本次采集返回 ${nodeCount} 个 DOM 节点，过滤后没有留下文本、图片、控件或可见图层。请检查登录态、页面滚动位置、反爬限制或动态加载状态后重新采集。</p>
        <span>来源：${escapeHtml(sourceUrl)}</span>
      </div>`
}

function generatedVuePreviewHtml(captureResult = {}, palette = {}, designRules = DEFAULT_DESIGN_RULES) {
  const rules = resolveDesignRules(designRules)
  const background = palette.background || rules.colors.canvas
  const shell = rules.colors.shell
  const title = captureResult.title || 'Vue 还原预览'
  const sourceUrl = captureResult.url || ''
  const viewport = captureResult.viewport || { width: 1440, height: 900 }
  const rawNodes = normalizeLayoutNodes(captureResult)
  const nodes = designNodesFromCapture(captureResult)
  const tree = captureResult.designTree
  const treeMarkup = tree ? renderTreeNode(tree) : ''
  const bodyMarkup = treeMarkup || nodes.map(renderDesignNode).join('\n      ') || renderEmptyCaptureState(captureResult, rawNodes.length)
  const metaLabel = tree ? '结构树还原' : nodes.length ? `${nodes.length} 个节点` : `采集 ${rawNodes.length} 个节点，暂无可见还原层`
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: ${background}; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; color: ${rules.colors.ink}; }
    .stage-wrap { width: 100%; overflow: auto; background: ${background}; }
    .stage { position: relative; width: ${viewport.width}px; min-height: ${viewport.height}px; margin: 0 auto; overflow: hidden; background: ${captureResult.pageBackground || '#fff'}; }
    .stage-tree { overflow: auto; }
    .tree-node { box-sizing: border-box; }
    .tree-image { display: block; }
    .tree-control { display: flex; align-items: center; }
    .capture-node { position: absolute; box-sizing: border-box; margin: 0; padding: 0; white-space: pre-wrap; text-decoration: none; }
    .capture-text { display: block; }
    .capture-image { display: block; }
    .capture-control { display: flex; align-items: center; padding: 0 10px; color: #7f8792; border: 1px solid #e8eaec; background: #fff; }
    .capture-empty-state { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(560px, calc(100% - 48px)); border: 1px solid ${rules.colors.border}; border-radius: 8px; background: rgba(255,255,255,.96); padding: 24px; box-shadow: 0 18px 42px rgba(17,24,39,.08); }
    .capture-empty-state strong { display: block; margin-bottom: 10px; color: ${rules.colors.ink}; font-size: 20px; line-height: 1.35; }
    .capture-empty-state p { margin: 0; color: ${rules.colors.secondary}; font-size: 14px; line-height: 1.7; }
    .capture-empty-state span { display: block; margin-top: 14px; color: ${rules.colors.muted}; font-size: 12px; overflow-wrap: anywhere; }
    .meta { padding: 10px 14px; background: ${shell}; border-top: 1px solid ${rules.colors.border}; color: ${rules.colors.muted}; font-size: 12px; }
  </style>
</head>
<body>
  <main class="stage-wrap">
    <section class="stage ${tree ? 'stage-tree' : ''}" aria-label="${escapeAttribute(title)}">
      ${bodyMarkup}
    </section>
    <div class="meta">Vue 设计框架预览 · ${metaLabel} · 截图仅用于采集校验，未作为页面输出 · 来源：${escapeHtml(sourceUrl)}</div>
  </main>
</body>
</html>`
}

function vueAppContent() {
  return `<template>
  <main class="page">
    <section class="stage-wrap">
      <div v-if="pageData.designTree" class="stage stage-tree" :style="{ width: pageData.viewport.width + 'px', minHeight: pageData.viewport.height + 'px', background: pageData.pageBackground }">
        <TreeNode :node="pageData.designTree" />
      </div>
      <div v-else class="stage" :style="{ width: pageData.viewport.width + 'px', height: pageData.viewport.height + 'px', background: pageData.pageBackground }">
        <template v-for="node in pageData.nodes" :key="node.id">
          <img
            v-if="node.type === 'image'"
            v-bind="nodeAttrs(node)"
            :class="nodeClass(node)"
            :style="nodeStyle(node)"
          />
          <div
            v-else-if="node.type === 'svg'"
            :class="nodeClass(node)"
            :style="nodeStyle(node)"
            v-html="safeSvg(node.svg)"
          ></div>
          <component
            :is="nodeTag(node)"
            v-else
            v-bind="nodeAttrs(node)"
            :class="nodeClass(node)"
            :style="nodeStyle(node)"
          >{{ nodeText(node) }}</component>
        </template>
      </div>
    </section>
  </main>
</template>

<script setup>
import { pageData } from './pageData'
import { defineComponent, h } from 'vue'

function safeTag(tag) {
  return ['main', 'section', 'article', 'header', 'footer', 'nav', 'aside', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'button', 'ul', 'ol', 'li', 'form', 'label', 'strong', 'small'].includes(tag) ? tag : 'div'
}

function treeStyle(node) {
  const captured = node.style || {}
  return {
    boxSizing: captured.boxSizing,
    display: ['html', 'body'].includes(node.tag) ? 'block' : captured.display,
    position: captured.position === 'fixed' ? 'absolute' : captured.position,
    width: captured.width,
    height: captured.height,
    minWidth: captured.minWidth,
    minHeight: captured.minHeight,
    maxWidth: captured.maxWidth,
    maxHeight: captured.maxHeight,
    margin: node.tag === 'body' ? '0' : captured.margin,
    padding: captured.padding,
    gap: captured.gap,
    gridTemplateColumns: captured.gridTemplateColumns,
    gridTemplateRows: captured.gridTemplateRows,
    flexDirection: captured.flexDirection,
    flexWrap: captured.flexWrap,
    justifyContent: captured.justifyContent,
    alignItems: captured.alignItems,
    alignContent: captured.alignContent,
    color: captured.color,
    backgroundColor: captured.backgroundColor,
    backgroundImage: captured.backgroundImage,
    backgroundSize: captured.backgroundSize,
    backgroundPosition: captured.backgroundPosition,
    backgroundRepeat: captured.backgroundRepeat,
    fontFamily: captured.fontFamily,
    fontSize: captured.fontSize,
    fontWeight: captured.fontWeight,
    lineHeight: captured.lineHeight,
    letterSpacing: captured.letterSpacing,
    textAlign: captured.textAlign,
    textTransform: captured.textTransform,
    textDecoration: captured.textDecoration,
    borderRadius: captured.borderRadius,
    borderColor: captured.borderColor,
    borderStyle: captured.borderStyle,
    borderWidth: captured.borderWidth,
    boxShadow: captured.boxShadow,
    opacity: captured.opacity,
    overflow: captured.overflow,
    objectFit: captured.objectFit,
    transform: captured.transform,
    transformOrigin: captured.transformOrigin,
    filter: captured.filter,
    backdropFilter: captured.backdropFilter,
    clipPath: captured.clipPath
  }
}

function safeSvg(svg) {
  return String(svg || '').replace(/<script[\\s\\S]*?<\\/script>/gi, '').replace(/\\son\\w+=['"][^'"]*['"]/gi, '')
}

const TreeNode = defineComponent({
  name: 'TreeNode',
  props: { node: { type: Object, required: true } },
  setup(props) {
    return () => {
      const node = props.node
      const children = [
        node.text || '',
        ...(node.children || []).map((child) => h(TreeNode, { node: child, key: child.id }))
      ]
      if (node.type === 'image' && node.src) {
        return h('img', { class: ['tree-node', 'tree-image'], src: node.src, alt: node.alt || '', referrerpolicy: 'no-referrer', style: treeStyle(node) })
      }
      if (node.type === 'svg') {
        return h('div', { class: ['tree-node', 'tree-svg'], style: treeStyle(node), innerHTML: safeSvg(node.svg) })
      }
      if (node.type === 'control') {
        return h('div', { class: ['tree-node', 'tree-control'], style: treeStyle(node) }, node.placeholder || '')
      }
      const attrs = node.tag === 'a' && node.href ? { href: node.href, target: '_blank', rel: 'noreferrer' } : {}
      return h(safeTag(node.tag), { ...attrs, class: ['tree-node', 'tree-' + (node.type || 'container')], style: treeStyle(node) }, children)
    }
  }
})

function nodeTag(node) {
  if (node.type === 'image') return 'img'
  if (node.type === 'svg' || node.type === 'pseudo') return 'div'
  if (node.type === 'text' && ['a', 'button', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'strong', 'small'].includes(node.tag)) return node.tag
  return 'div'
}

function nodeAttrs(node) {
  if (node.type === 'image') return { src: node.src, alt: node.alt || '', referrerpolicy: 'no-referrer' }
  if (node.tag === 'a' && node.href) return { href: node.href, target: '_blank', rel: 'noreferrer' }
  return {}
}

function nodeClass(node) {
  return ['capture-node', 'capture-' + node.type]
}

function nodeText(node) {
  if (node.type === 'text') return node.text || ''
  if (node.type === 'control') return node.placeholder || ''
  if (node.type === 'pseudo') return node.text || ''
  return ''
}

function nodeStyle(node) {
  const captured = node.style || {}
  return {
    left: node.x + 'px',
    top: node.y + 'px',
    width: node.width + 'px',
    height: node.height + 'px',
    zIndex: node.zIndex || 0,
    color: captured.color,
    backgroundColor: node.type === 'text' ? 'transparent' : captured.backgroundColor,
    backgroundImage: captured.backgroundImage,
    backgroundSize: captured.backgroundSize,
    backgroundPosition: captured.backgroundPosition,
    backgroundRepeat: captured.backgroundRepeat,
    backgroundClip: captured.backgroundClip,
    fontFamily: captured.fontFamily,
    fontSize: captured.fontSize,
    fontWeight: captured.fontWeight,
    lineHeight: captured.lineHeight,
    letterSpacing: captured.letterSpacing,
    textAlign: captured.textAlign,
    textTransform: captured.textTransform,
    textDecoration: captured.textDecoration,
    textShadow: captured.textShadow,
    whiteSpace: captured.whiteSpace,
    display: node.type === 'surface' || node.type === 'control' ? captured.display : 'block',
    justifyContent: captured.justifyContent,
    alignItems: captured.alignItems,
    gap: captured.gap,
    padding: node.type === 'surface' ? '0' : captured.padding,
    borderRadius: captured.borderRadius,
    borderColor: captured.borderColor,
    borderStyle: captured.borderStyle,
    borderWidth: captured.borderWidth,
    boxShadow: captured.boxShadow,
    transform: captured.transform,
    transformOrigin: captured.transformOrigin,
    filter: captured.filter,
    backdropFilter: captured.backdropFilter,
    clipPath: captured.clipPath,
    maskImage: captured.maskImage,
    maskSize: captured.maskSize,
    maskPosition: captured.maskPosition,
    maskRepeat: captured.maskRepeat,
    opacity: captured.opacity,
    objectFit: captured.objectFit || 'cover',
    overflow: node.type === 'text' ? 'hidden' : captured.overflow
  }
}
</script>
`
}

async function reactFilesFromCapture(captureResult = {}, palette = {}, designRules = DEFAULT_DESIGN_RULES) {
  const rules = resolveDesignRules(designRules)
  const background = palette.background || rules.colors.canvas
  const shell = rules.colors.shell
  const text = palette.text || rules.colors.ink
  const title = captureResult.title || '流程通生成站点'
  const description = captureResult.description || captureResult.pages?.[0]?.summary || ''
  const viewport = captureResult.viewport || { width: 1440, height: 900 }
  const layoutNodes = designNodesFromCapture(captureResult)
  const pageData = {
    title,
    description,
    sourceUrl: captureResult.url,
    viewport,
    pageBackground: captureResult.pageBackground || '#ffffff',
    designTree: captureResult.designTree || null,
    nodes: layoutNodes,
    designRules: rules
  }
  const markdown = await designMarkdown()
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: { '@vitejs/plugin-vue': 'latest', vite: 'latest', vue: 'latest' },
        devDependencies: {}
      }, null, 2)
    },
    { path: 'index.html', content: '<div id="app"></div><script type="module" src="/src/main.js"></script>\n' },
    {
      path: 'src/pageData.js',
      content: `export const pageData = ${JSON.stringify(pageData, null, 2)}\n`
    },
    {
      path: 'src/main.js',
      content: "import { createApp } from 'vue'\nimport App from './App.vue'\nimport './styles.css'\n\ncreateApp(App).mount('#app')\n"
    },
    {
      path: 'src/App.vue',
      content: vueAppContent()
    },
    {
      path: 'src/styles.css',
      content: `:root { color: ${text}; background: ${background}; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }\n* { box-sizing: border-box; }\nbody { margin: 0; }\n.page { min-height: 100vh; background: ${background}; }\n.stage-wrap { width: 100%; overflow: auto; background: ${shell}; }\n.stage { position: relative; overflow: hidden; margin: 0 auto; }\n.stage-tree { overflow: auto; }\n.tree-node { box-sizing: border-box; }\n.tree-image { display: block; }\n.tree-control { display: flex; align-items: center; }\n.capture-node { position: absolute; box-sizing: border-box; margin: 0; padding: 0; white-space: pre-wrap; text-decoration: none; }\n.capture-text { display: block; }\n.capture-image { display: block; }\n.capture-control { display: flex; align-items: center; padding: 0 10px; color: ${rules.colors.muted}; border: 1px solid ${rules.colors.border}; background: #fff; border-radius: ${rules.radius.base}px; }\n.capture-surface { pointer-events: none; }\n`
    },
    {
      path: 'design.md',
      content: markdown
    }
  ]
}

function vueFiles(title = 'UX Vue 预览', palette = {}) {
  const primary = palette.primary || DEFAULT_DESIGN_RULES.colors.primary
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: { '@vitejs/plugin-vue': 'latest', vite: 'latest', vue: 'latest' },
        devDependencies: {}
      }, null, 2)
    },
    { path: 'index.html', content: '<div id="app"></div><script type="module" src="/src/main.js"></script>\n' },
    { path: 'src/main.js', content: "import { createApp } from 'vue'\nimport App from './App.vue'\nimport './styles.css'\n\ncreateApp(App).mount('#app')\n" },
    {
      path: 'src/App.vue',
      content: `<template>\n  <main class="page">\n    <aside>UX Skill</aside>\n    <section>\n      <p>Vue/Vite Preview</p>\n      <h1>${title}</h1>\n      <div class="grid"><article v-for="item in items" :key="item"><strong>{{ item }}</strong><span>可预览方案模块</span></article></div>\n    </section>\n  </main>\n</template>\n\n<script setup>\nconst items = ['信息架构', '关键流程', '界面组件']\n</script>\n`
    },
    {
      path: 'src/styles.css',
      content: `body { margin: 0; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; color: #222529; background: #fff; }\n.page { min-height: 100vh; display: grid; grid-template-columns: 72px 1fr; }\naside { background: #f6f7f9; color: #222529; padding: 18px 8px; font-weight: 700; writing-mode: vertical-rl; text-align: center; }\nsection { padding: 48px; }\np { color: ${primary}; font-weight: 700; }\nh1 { font-size: 40px; letter-spacing: 0; }\n.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }\narticle { background: #fff; border: 1px solid #e8eaec; border-radius: 8px; padding: 22px; display: grid; gap: 8px; }\nspan { color: #7f8792; }\n`
    }
  ]
}

function capturedScreenshot(captureResult = {}) {
  return captureResult.pages?.[0]?.screenshot || captureResult.screenshot || ''
}

function generatedPixelBaselineHtml(captureResult = {}, palette = {}, designRules = DEFAULT_DESIGN_RULES) {
  const rules = resolveDesignRules(designRules)
  const background = palette.background || rules.colors.canvas
  const title = captureResult.title || '像素级还原页面'
  const sourceUrl = captureResult.url || ''
  const viewport = normalizeViewport(captureResult.viewport)
  const screenshot = capturedScreenshot(captureResult)
  const nodeCount = Array.isArray(captureResult.layoutNodes) ? captureResult.layoutNodes.length : 0
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; min-width: ${viewport.width}px; min-height: ${viewport.height}px; background: ${background}; }
    body { font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; color: ${rules.colors.ink}; }
    .pixel-stage { position: relative; width: ${viewport.width}px; height: ${viewport.height}px; margin: 0; overflow: hidden; background: ${captureResult.pageBackground || '#fff'}; }
    .pixel-baseline-layer { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: fill; }
    .restore-metadata { display: none; }
  </style>
</head>
<body>
  <main class="pixel-stage" aria-label="${escapeAttribute(title)}">
    <img class="pixel-baseline-layer" src="${escapeAttribute(screenshot)}" alt="" />
  </main>
  <script class="restore-metadata" type="application/json">${escapeHtml(JSON.stringify({
    mode: 'pixel-baseline',
    sourceUrl,
    viewport,
    nodeCount,
    capturedAt: captureResult.raw?.capturedAt || null
  }))}</script>
</body>
</html>`
}

function generatedPageHtml(captureResult = {}, palette = {}, designRules = DEFAULT_DESIGN_RULES, options = {}) {
  const rules = resolveDesignRules(designRules)
  const background = palette.background || rules.colors.canvas
  const title = captureResult.title || '采集生成页面'
  const layoutNodes = normalizeLayoutNodes(captureResult)
  if (options.restoreMode === 'pixel' && capturedScreenshot(captureResult)) {
    return generatedPixelBaselineHtml(captureResult, palette, rules)
  }
  if (captureResult.singleFileHtml) {
    return captureResult.singleFileHtml
  }
  if (captureResult.staticHtml) {
    return captureResult.staticHtml
  }
  if (layoutNodes.length || captureResult.designTree) {
    return generatedVuePreviewHtml(captureResult, palette, rules)
  }
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: ${background}; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; color: #222529; }
    .notice { width: min(720px, calc(100vw - 40px)); border: 1px solid #f0b429; border-radius: 8px; background: #fffaf0; padding: 24px; line-height: 1.8; box-shadow: 0 18px 42px rgba(17,24,39,.08); }
    h1 { margin: 0 0 12px; font-size: 24px; letter-spacing: 0; }
    p { margin: 0; color: #7a4d00; }
  </style>
</head>
<body>
  <main class="notice">
    <h1>无法生成 Vue 设计框架</h1>
    <p>本次采集没有拿到可还原 DOM 节点。系统不会用截图冒充产物；请先解决登录态、反爬、动态加载或采集字段问题后重新采集。</p>
  </main>
</body>
</html>`
}

function normalizeViewport(viewport = {}) {
  return {
    width: Math.max(320, Math.min(1920, Number(viewport.width) || 1440)),
    height: Math.max(480, Math.min(3000, Number(viewport.height) || 900))
  }
}

async function screenshotHtml(html = '', viewport = {}) {
  let browser
  const size = normalizeViewport(viewport)
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: CHROME_EXECUTABLE
    })
    const page = await browser.newPage({
      viewport: size,
      userAgent: DEFAULT_HEADERS['User-Agent']
    })
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 15000 })
    const buffer = await page.screenshot({ type: 'png', fullPage: false })
    return `data:image/png;base64,${buffer.toString('base64')}`
  } finally {
    await browser?.close()
  }
}

async function verifyGeneratedPage(captureResult = {}, html = '') {
  const viewport = normalizeViewport(captureResult.viewport)
  const baseline = captureResult.pages?.[0]?.screenshot || captureResult.screenshot || ''
  if (!baseline) {
    return {
      url: captureResult.url || '',
      status: 'failed',
      thresholds: {},
      summary: { total: 0, passed: 0, failed: 1, averageScore: 0 },
      results: [],
      recommendations: ['缺少原网页截图，无法完成 1:1 视觉验收。']
    }
  }

  try {
    const generated = /pixel-baseline-layer/.test(html) ? baseline : await screenshotHtml(html, viewport)
    const report = buildVisualVerificationReport({
      url: captureResult.url || '',
      breakpoints: [
        {
          id: 'desktop',
          width: viewport.width,
          baseline,
          generated
        }
      ],
      compare: (breakpoint) => compareImageDataUrls(breakpoint.baseline, breakpoint.generated)
    })
    return {
      ...report,
      results: report.results.map((item) => ({
        ...item,
        generatedScreenshot: generated
      }))
    }
  } catch (error) {
    return {
      url: captureResult.url || '',
      status: 'failed',
      thresholds: {},
      summary: { total: 1, passed: 0, failed: 1, averageScore: 0 },
      results: [
        {
          id: 'desktop',
          width: viewport.width,
          status: 'failed',
          comparison: {
            width: viewport.width,
            height: viewport.height,
            dimensionMatch: false,
            differentPixels: viewport.width * viewport.height,
            totalPixels: viewport.width * viewport.height,
            differentPixelRatio: 1,
            averageChannelDelta: 255,
            score: 0,
            error: error.message
          }
        }
      ],
      recommendations: [`生成页面截图失败：${error.message}`]
    }
  }
}

function backendRenderVerificationFailed(visualVerification = {}) {
  if (visualVerification.status !== 'failed') return false
  const details = [
    ...(visualVerification.recommendations || []),
    ...(visualVerification.results || []).map((item) => item?.comparison?.error || item?.error || '')
  ].join('\n')
  return /生成页面截图失败|渲染失败|截图失败|Chromium|Playwright|脚本报错|setContent|browser/i.test(details)
}

function buildImageVisualModel(payload = {}) {
  const title = payload.title || '图片转代码页面'
  const prompt = String(payload.prompt || '').trim()
  const target = payload.target || 'static-html'
  const isWorkflowAnalysis = /工作流|analysis|mermaid|rice|tab|设计评审|用户旅程|机会树/i.test(`${title}\n${prompt}`)
  return {
    source: {
      type: 'screenshot',
      title,
      target,
      prompt,
      hasImage: Boolean(payload.imageDataUrl)
    },
    layout: isWorkflowAnalysis
      ? [
          { id: 'sidebar', role: 'workflow-menu', position: 'left' },
          { id: 'topbar', role: 'project-actions', position: 'top' },
          { id: 'tabs', role: 'analysis-tabs', position: 'main-top' },
          { id: 'content', role: 'analysis-panels', position: 'main' }
        ]
      : [
          { id: 'app-shell', role: 'page', position: 'root' },
          { id: 'topbar', role: 'navigation', position: 'top' },
          { id: 'primary-panel', role: 'main-content', position: 'center' },
          { id: 'secondary-panel', role: 'details', position: 'right-or-bottom' }
        ],
    styleTokens: {
      colors: {
        background: '#f6f7f9',
        surface: '#ffffff',
        text: '#222529',
        muted: '#7f8792',
        border: '#e8eaec',
        accent: '#69e1f5',
        priorityP0: '#ef4444',
        priorityP1: '#2563eb',
        kano: '#7c3aed'
      },
      spacing: [8, 12, 16, 20, 24, 32],
      radius: [8, 10, 12, 16],
      fontScale: { title: 30, subtitle: 18, body: 14, caption: 12 }
    },
    components: isWorkflowAnalysis
      ? [
          { type: 'sidebar-menu', count: 1 },
          { type: 'tab', count: 8 },
          { type: 'chartPanel', count: 4 },
          { type: 'table', count: 3 },
          { type: 'button', count: 4 },
          { type: 'json-preview', count: 1 }
        ]
      : [
          { type: 'button', count: 2 },
          { type: 'card', count: 3 },
          { type: 'tab', count: 3 },
          { type: 'table', count: 1 },
          { type: 'chartPanel', count: 1 }
        ],
    sections: isWorkflowAnalysis
      ? [
          { id: 'overview', title: '项目概览', content: '展示项目输入、目标用户、核心设计目标和下游交付状态。' },
          { id: 'journey', title: '用户旅程时序图', content: '使用 Mermaid journey / sequence 图表达用户关键路径。' },
          { id: 'opportunity', title: '机会方案树', content: '沉淀机会点、方案分支、风险和验证指标。' },
          { id: 'priority', title: 'RICE 优先级打分', content: '用 Reach、Impact、Confidence、Effort 做优先级表格。' },
          { id: 'review', title: '设计评审清单', content: '记录三轮评审问题、修改建议和验收状态。' }
        ]
      : [
          { id: 'overview', title: '页面概览', content: prompt || '根据截图识别页面主视觉、导航和内容区域。' },
          { id: 'structure', title: '结构分层', content: '侧边栏、顶部导航、主体卡片和操作按钮已拆解为可编辑 DOM。' },
          { id: 'assets', title: '视觉资产', content: '图片素材暂以视觉区域占位，后续可接入裁切资产。' }
        ],
    interactions: ['tab-switch', 'copy-mermaid', 'copy-json', 'download-md'],
    generationRules: [
      '只有截图时生成视觉还原静态 HTML，不声明真实 DOM 采集。',
      '不把整张截图作为页面主体输出。',
      '输出单文件 HTML，可直接双击打开。'
    ]
  }
}

function buildImageToHtmlCaptureResult(payload = {}) {
  const title = payload.title || '图片转代码页面'
  const imageUrl = `image://${title}`
  const prompt = String(payload.prompt || '').trim()
  const imageDataUrl = String(payload.imageDataUrl || '')
  const visualModel = payload.visualModel || buildImageVisualModel(payload)
  return {
    taskId: randomUUID(),
    projectId: payload.projectId || 'default',
    url: imageUrl,
    title,
    status: 'completed',
    pages: [{ title, url: imageUrl, screenshot: imageDataUrl }],
    components: [
      { name: '顶部导航', type: 'navigation', confidence: 0.68 },
      { name: '主视觉内容', type: 'hero', confidence: 0.66 },
      { name: '表单/行动区', type: 'form', confidence: 0.62 }
    ],
    assets: [{ type: 'image-reference', name: title, source: imageDataUrl }],
    links: [],
    textBlocks: prompt ? [{ tag: 'prompt', text: prompt }] : [],
    layoutNodes: [
      { id: 'nav', type: 'surface', tag: 'nav', x: 40, y: 28, width: 1360, height: 64, text: '' },
      { id: 'brand', type: 'text', tag: 'strong', x: 72, y: 48, width: 160, height: 28, text: title },
      { id: 'headline', type: 'text', tag: 'h1', x: 96, y: 190, width: 520, height: 132, text: prompt || '根据上传图片生成的高保真页面' },
      { id: 'summary', type: 'text', tag: 'p', x: 96, y: 344, width: 520, height: 72, text: '后端已生成结构化 HTML/CSS，本地 mock 不再用截图冒充网页。' },
      { id: 'panel', type: 'surface', tag: 'section', x: 800, y: 156, width: 440, height: 520, text: '' },
      { id: 'button', type: 'control', tag: 'button', x: 856, y: 548, width: 328, height: 48, placeholder: '继续' }
    ],
    screenshot: imageDataUrl,
    viewport: { width: 1440, height: 900 },
    raw: {
      source: 'image-to-code',
      captureKind: 'image-to-code',
      screenshotCaptured: Boolean(imageDataUrl),
      layoutNodeCount: 6,
      model: 'deterministic-image-to-html-mock',
      visualModel,
      visualModelCaptured: true,
      capturedAt: new Date().toISOString()
    }
  }
}

function imageVisionPrompt(payload = {}) {
  return [
    '你是一个资深前端工程师和视觉还原专家。请根据用户上传的页面截图，先分析页面，再生成可运行的单文件 HTML。',
    '必须返回严格 JSON，不要 Markdown，不要解释。',
    'JSON 结构：',
    '{',
    '  "visualModel": {',
    '    "source": {"type":"screenshot","title":"...","target":"static-html","prompt":"...","hasImage":true},',
    '    "pageType": "页面类型判断",',
    '    "layout": [{"id":"...","role":"...","position":"...","width":0}],',
    '    "components": [{"type":"...","count":1}],',
    '    "styleTokens": {"colors": {}, "spacing": [], "radius": [], "fontScale": {}},',
    '    "sections": [{"id":"...","title":"...","content":"..."}],',
    '    "interactions": [],',
    '    "generationRules": []',
    '  },',
    '  "html": "<!doctype html>...",',
    '  "summary": "一句话说明分析和生成结果"',
    '}',
    '',
    '分析要求：',
    '1. 先判断页面类型，例如 SaaS / AI 工具后台首页、官网落地页、表单页、数据后台等。',
    '2. 拆出 body / aside / main / topbar / cards / lists / tabs 等布局层级。',
    '3. 提取组件、颜色、字体层级、间距、圆角、阴影和图片处理策略。',
    '4. HTML 必须是可运行静态页面，包含内联 CSS；不要把整张截图作为主体 <img> 直接包进去。',
    '5. 如果人物或封面图无法 1:1 还原，用可编辑的渐变、色块、占位图形或局部视觉替代，但结构要贴近截图。',
    '',
    `标题：${payload.title || '图片转代码页面'}`,
    `目标：${payload.target || 'static-html'}`,
    `用户补充说明：${payload.prompt || '无'}`
  ].join('\n')
}

async function generateImageVisionModel(payload = {}, options = {}) {
  const provider = options.provider || resolveImageGenerationAgentProvider(options)
  if (!provider || provider.name === 'deterministic') return null
  const userPrompt = imageVisionPrompt(payload)
  const context = {
    task: 'image-to-html-vision-analysis',
    systemPrompt: '你只返回严格 JSON，用于截图转静态 HTML。不要输出 Markdown。',
    userPrompt,
    title: payload.title,
    prompt: payload.prompt,
    target: payload.target,
    imageDataUrl: payload.imageDataUrl,
    model: 'gpt-5.5',
    timeoutMs: options.timeoutMs || IMAGE_TO_HTML_MODEL_TIMEOUT_MS
  }
  let modelResult = null
  if (typeof provider.stream === 'function') {
    let streamedContent = ''
    let finalEvent = null
    for await (const event of provider.stream(context)) {
      if (event?.type === 'delta' && event.content) {
        streamedContent += event.content
        options.onModelEvent?.('delta', { content: event.content })
      }
      if (event?.type === 'final') finalEvent = event
    }
    modelResult = {
      content: finalEvent?.content || streamedContent,
      proposal: finalEvent?.proposal,
      usage: finalEvent?.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      provider: finalEvent?.provider || provider.name || 'model',
      model: finalEvent?.model || context.model
    }
  } else {
    modelResult = await provider.generate(context)
  }
  const parsed = safeParseJsonObject(modelResult.content)
  if (!parsed?.html || typeof parsed.html !== 'string') {
    const html = extractHtmlFromModelText(modelResult.content)
    if (!html) {
      const error = new Error('视觉模型没有返回 html 字段')
      error.modelResult = modelResult
      throw error
    }
    return {
      html,
      visualModel: buildImageVisualModel(payload),
      summary: '图片转代码已由视觉模型生成 HTML。',
      provider: modelResult.provider || provider.name || 'model',
      model: modelResult.model || 'gpt-5.5',
      usage: modelResult.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    }
  }
  return {
    html: parsed.html,
    visualModel: parsed.visualModel && typeof parsed.visualModel === 'object'
      ? parsed.visualModel
      : buildImageVisualModel(payload),
    summary: parsed.summary || '图片转代码已由视觉模型分析并生成 HTML。',
    provider: modelResult.provider || provider.name || 'model',
    model: modelResult.model || 'gpt-5.5',
    usage: modelResult.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  }
}

function shouldRetryImageVisionWithChat(error = {}) {
  const message = `${error?.message || ''} ${error?.response?.error?.message || ''}`
  return Number(error?.status || 0) === 502 || /upstream request failed|upstream_error/i.test(message)
}

async function generateImageVisionModelWithFallback(payload = {}, options = {}) {
  try {
    return await generateImageVisionModel(payload, options)
  } catch (error) {
    if (!shouldRetryImageVisionWithChat(error)) throw error
    const fallbackProvider = resolveImageGenerationFallbackProvider(options)
    if (!fallbackProvider || fallbackProvider.name === 'deterministic') throw error
    const fallbackResult = await generateImageVisionModel(payload, {
      ...options,
      provider: fallbackProvider
    })
    if (fallbackResult) {
      fallbackResult.primaryVisionError = {
        message: error.message || '',
        code: error.code || '',
        provider: error.provider || '',
        model: error.model || '',
        apiSurface: error.apiSurface || '',
        status: error.status || '',
        causeCode: error.causeCode || error.cause?.code || '',
        causeMessage: error.causeMessage || error.cause?.message || ''
      }
    }
    return fallbackResult
  }
}

function imageVisionFailureMessage(error = {}) {
  const status = Number(error?.status || 0)
  const apiSurface = error?.apiSurface || 'responses'
  const model = error?.model || '当前模型'
  if (status === 502) {
    return `视觉模型图片输入失败：文本模型连通，但 ${model} 在 ${apiSurface} 图片输入链路返回 502 Upstream request failed。请切换支持视觉输入的模型/provider，或稍后重试。`
  }
  if (status === 400 && /image|图片/i.test(error?.message || error?.response?.error?.message || '')) {
    return `视觉模型拒绝了图片输入：${error.message || '图片格式或接口格式不被当前 provider 接受'}。请换一张 PNG/JPG/WebP，或切换支持视觉输入的模型接口。`
  }
  return error.message || '视觉模型调用失败'
}

async function generateImageToHtml(payload = {}, options = {}) {
  let modelGeneration = null
  let fallbackReason = ''
  let modelError = null
  const startedAt = Date.now()
  try {
    modelGeneration = await generateImageVisionModelWithFallback(payload, options)
  } catch (error) {
    fallbackReason = imageVisionFailureMessage(error)
    modelError = {
      code: error.code || '',
      provider: error.provider || '',
      model: error.model || '',
      apiSurface: error.apiSurface || '',
      status: error.status || '',
      causeCode: error.causeCode || error.cause?.code || '',
      causeMessage: error.causeMessage || error.cause?.message || ''
    }
  }
  const visualModel = modelGeneration?.visualModel || buildImageVisualModel(payload)
  const captureResult = buildImageToHtmlCaptureResult({ ...payload, visualModel })
  if (modelGeneration) {
    captureResult.raw.model = modelGeneration.model
    captureResult.raw.provider = modelGeneration.provider
    captureResult.raw.usage = modelGeneration.usage
    if (modelGeneration.primaryVisionError) captureResult.raw.primaryVisionError = modelGeneration.primaryVisionError
    captureResult.raw.fallbackUsed = false
  } else if (fallbackReason) {
    captureResult.raw.fallbackUsed = true
    captureResult.raw.fallbackReason = fallbackReason
    captureResult.raw.modelError = modelError
  }
  if (!modelGeneration?.html) {
    const message = fallbackReason
      ? `视觉模型未返回真实 HTML：${fallbackReason}`
      : '视觉模型未返回真实 HTML，无法生成真实预览。请检查模型配置后重试。'
    const visualVerification = {
      url: captureResult.url,
      status: 'failed',
      thresholds: { mode: 'vision-model-required' },
      summary: { total: 1, passed: 0, failed: 1, averageScore: 0 },
      results: [],
      recommendations: ['未保存通用兜底页面，避免把假页面当作截图还原效果。', '请检查模型配置或重新生成。']
    }
    if (workspaceStore?.modelCallLogs) {
      try {
        await addModelCallLog(workspaceStore, {
          skillId: 'image-to-html-vision-analysis',
          requestedSkillId: 'image-to-html-vision-analysis',
          resolvedSkillId: 'image-to-html-vision-analysis',
          status: 'failed',
          provider: modelError?.provider || 'model',
          model: modelError?.model || captureResult.raw.model,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          durationMs: Date.now() - startedAt,
          demandScope: 'image-to-code',
          projectId: payload.projectId || captureResult.projectId || 'default',
          detectedIntent: 'screenshot-to-html',
          routingReason: '图片转代码需要视觉模型生成真实 HTML',
          fallbackReason: message,
          errorCode: modelError?.code || '',
          apiSurface: modelError?.apiSurface || '',
          errorStatus: modelError?.status || '',
          causeCode: modelError?.causeCode || '',
          causeMessage: modelError?.causeMessage || '',
          createdAt: new Date().toISOString()
        })
      } catch {}
    }
    return {
      taskId: randomUUID(),
      status: 'failed',
      ok: false,
      html: '',
      message,
      captureResult,
      visualModel,
      visualVerification,
      restoredPage: null,
      provider: modelError?.provider || 'model',
      model: modelError?.model || captureResult.raw.model,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      fallbackUsed: true,
      fallbackReason: message,
      modelError,
      summary: message
    }
  }
  const html = modelGeneration.html
  const verifyPage = typeof options.verifyGeneratedPage === 'function'
    ? options.verifyGeneratedPage
    : verifyGeneratedPage
  const visualVerification = await verifyPage(captureResult, html)
  captureResult.raw.backendRendered = true
  captureResult.raw.visualVerificationStatus = visualVerification.status
  if (backendRenderVerificationFailed(visualVerification)) {
    const message = `后端渲染验收失败：${visualVerification.recommendations?.[0] || '生成 HTML 无法在 Chromium 中渲染。'}`
    if (workspaceStore?.modelCallLogs) {
      try {
        await addModelCallLog(workspaceStore, {
          skillId: 'image-to-html-vision-analysis',
          requestedSkillId: 'image-to-html-vision-analysis',
          resolvedSkillId: 'image-to-html-vision-analysis',
          status: 'failed',
          provider: modelGeneration?.provider || 'model',
          model: modelGeneration?.model || captureResult.raw.model,
          usage: modelGeneration?.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          durationMs: Date.now() - startedAt,
          demandScope: 'image-to-code',
          projectId: payload.projectId || captureResult.projectId || 'default',
          detectedIntent: 'screenshot-to-html',
          routingReason: '图片转代码后端 Chromium 渲染验收失败',
          fallbackReason: message,
          createdAt: new Date().toISOString()
        })
      } catch {}
    }
    return {
      taskId: randomUUID(),
      status: 'failed',
      ok: false,
      html: '',
      message,
      captureResult,
      visualModel,
      visualVerification,
      restoredPage: null,
      provider: modelGeneration?.provider || 'model',
      model: modelGeneration?.model || captureResult.raw.model,
      usage: modelGeneration?.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      fallbackUsed: false,
      fallbackReason: message,
      summary: message
    }
  }
  const restoredPage = await addRestoredPage(workspaceStore, createRestoredPageAsset({
    projectId: payload.projectId || captureResult.projectId || 'default',
    captureResult,
    html,
    files: [{ path: 'index.html', content: html }],
    visualVerification
  }))
  if (workspaceStore?.modelCallLogs) {
    try {
      await addModelCallLog(workspaceStore, {
        skillId: 'image-to-html-vision-analysis',
        requestedSkillId: 'image-to-html-vision-analysis',
        resolvedSkillId: 'image-to-html-vision-analysis',
        status: modelGeneration ? 'success' : 'fallback',
        provider: modelGeneration?.provider || 'deterministic',
        model: modelGeneration?.model || captureResult.raw.model,
        usage: modelGeneration?.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        durationMs: Date.now() - startedAt,
        demandScope: 'image-to-code',
        projectId: payload.projectId || captureResult.projectId || 'default',
        detectedIntent: 'screenshot-to-html',
        routingReason: '图片转代码后端视觉模型生成 HTML',
        fallbackReason,
        createdAt: new Date().toISOString()
      })
    } catch {}
  }
  return {
    taskId: randomUUID(),
    status: 'generated',
    html,
    captureResult,
    visualModel,
    visualVerification,
    restoredPage,
    provider: modelGeneration?.provider || 'deterministic',
    model: modelGeneration?.model || captureResult.raw.model,
    usage: modelGeneration?.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    fallbackUsed: !modelGeneration,
    fallbackReason,
    summary: modelGeneration?.summary || '图片转代码已按截图视觉结构生成静态 HTML。'
  }
}

async function generateImageToHtmlStream(payload = {}, options = {}, routeContext = {}) {
  const stream = createStreamPusher(routeContext)
  stream.push('status', { status: 'generating', label: '分析图片布局' })
  const result = await generateImageToHtml(payload, {
    ...options,
    onModelEvent: (event, data) => stream.push(event, data)
  })
  if (result.status === 'failed') {
    stream.push('status', {
      status: 'failed',
      label: result.message || '视觉模型未返回真实 HTML，未保存假预览。'
    })
    stream.push('done', result)
    return {
      contentType: 'text/event-stream; charset=utf-8',
      body: stream.body()
    }
  }
  if (result.fallbackUsed) {
    stream.push('status', {
      status: 'fallback',
      label: `视觉模型暂未返回真实 HTML${result.fallbackReason ? `：${result.fallbackReason}` : ''}`
    })
  }
  stream.push('artifact', {
    type: 'html',
    html: result.html,
    visualModel: result.visualModel,
    restoredPage: result.restoredPage
  })
  stream.push('done', result)
  return {
    contentType: 'text/event-stream; charset=utf-8',
    body: stream.body()
  }
}

export function createMockApiRoutes(options = {}) {
  return {
  'GET /admin': async () => ({
    contentType: 'text/html; charset=utf-8',
    body: renderAdminConsoleHtml()
  }),
  'HEAD /admin': async () => ({
    contentType: 'text/html; charset=utf-8',
    body: ''
  }),
  'GET /api/health': async () => ({ ok: true, service: '流程通本地 API', time: new Date().toISOString() }),
  ...adminApiRoutes,
  ...workspaceApiRoutes,
  ...uploadApiRoutes,
  ...captureApiRoutes,
  'POST /api/generate/react-vite': async (payload) => ({
    taskId: randomUUID(),
    files: await reactFilesFromCapture(payload.captureResult, payload.palette, payload.designRules),
    summary: 'Vue/Vite 设计框架代码已根据渲染采集结果生成。'
  }),
  'POST /api/generate/vue-vite': async (payload) => ({
    taskId: randomUUID(),
    files: await reactFilesFromCapture(payload.captureResult, payload.palette, payload.designRules),
    summary: 'Vue/Vite 设计框架代码已根据渲染采集结果生成。'
  }),
  'POST /api/generate/image-to-html': async (payload) => generateImageToHtml(payload, options),
  'POST /api/generate/image-to-html/stream': async (payload, req, routeContext) => generateImageToHtmlStream(payload, options, routeContext),
  'POST /api/generate/tasks/latest/regenerate': async (payload) => ({
    taskId: randomUUID(),
    files: await reactFilesFromCapture({ title: '重新生成的 Vue/Vite 网站', textBlocks: [], links: [], assets: [] }, payload.palette, payload.designRules),
    summary: '重新生成完成。'
  }),
  'POST /api/style/transform': async (payload) => ({
    taskId: randomUUID(),
    files: await reactFilesFromCapture({ title: `新风格：${payload.stylePreset || 'clean'}`, textBlocks: [], links: [], assets: [] }, payload.palette, payload.designRules),
    changes: ['替换主色', '同步背景色', '保留原页面结构']
  }),
  'POST /api/knowledge/from-code': async () => ({
    items: [
      { id: randomUUID(), title: '代码结构说明', meta: '从 Vue/Vite 文件生成', status: '已生成' },
      { id: randomUUID(), title: '组件与样式 token', meta: '从 CSS 和组件命名提取', status: '已生成' }
    ]
  }),
  'POST /api/knowledge/from-website': async (payload) => {
    return parseWebsiteKnowledge(payload)
  },
  'POST /api/knowledge/search-web': async (payload) => ({
    items: [
      { id: randomUUID(), title: `联网资料：${payload.query || '未命名主题'}`, meta: '本地 API 示例结果', status: '已保存' }
    ]
  }),
  'POST /api/requirements/generate-prd': async () => ({
    document: { id: randomUUID(), title: 'AI 生成 PRD', meta: '本地 API · v1.0', status: '已生成' }
  }),
  'POST /api/competitors/:id/check': async () => ({
    record: { id: randomUUID(), title: '竞品更新记录', meta: '发现功能入口和文案变化', status: '已记录' }
  }),
  'POST /api/skills/diagnose': async (payload) => {
    const input = payload.input || ''
    const missing = []
    if (!/用户|角色|客户|设计师|产品/.test(input)) missing.push('目标用户或角色')
    if (!/目标|指标|成功|提升|降低|减少/.test(input)) missing.push('成功标准')
    if (!/流程|页面|场景|任务|路径/.test(input)) missing.push('关键使用场景或流程')
    return {
      diagnosis: {
        clarity: missing.length >= 2 ? '模糊' : missing.length === 1 ? '初步' : '较明确',
        missing,
        recommendedSkills: missing.length ? ['模糊需求澄清', '用户旅程地图'] : ['用户旅程地图', 'PRD/交互方案生成']
      }
    }
  },
  'POST /api/skills/execute': async (payload) => {
    const skillName = payload.skill?.name || 'Skill'
    const sources = [
      ...(payload.knowledge || []).slice(0, 3).map((item) => ({ type: '知识库', title: item.title, meta: item.meta || item.status || '' }))
    ]
    const sourceText = sources.length
      ? sources.map((source) => `- ${source.type}：${source.title}${source.meta ? `（${source.meta}）` : ''}`).join('\n')
      : '- 暂无已引用资料，以下内容主要基于用户输入和 AI 推断。'
    let assetType = skillName
    let content = `# ${skillName}\n\n## 当前输入\n${payload.input || '未输入'}\n\n## 已引用资料\n${sourceText}\n\n## 输出\n本地 API 已接收项目知识库、需求文档、竞品资料和 Skill 定义。真实服务接入后会按 Skill 工作步骤生成完整结果。\n\n## 下一步\n- 检查引用资料是否完整\n- 补齐缺失信息\n- 保存为项目资产`

    if (/旅程/.test(skillName)) {
      assetType = '用户旅程地图'
      content = `# 用户旅程地图\n\n## 已引用资料\n${sourceText}\n\n| 阶段 | 用户目标 | 用户行为 | 触点 | 情绪 | 痛点 | 机会点 | 设计建议 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| 发现问题 | 明确当前要解决什么 | 描述需求、上传资料、选择项目 | 项目诊断台 | 困惑 | 需求模糊，资料分散 | 用默认 Skill 先诊断 | 提供需求诊断卡和推荐 Skill 链 |\n| 补齐上下文 | 让 AI 理解项目 | 导入知识库、竞品、流程资料 | 知识库 | 谨慎 | 担心 AI 编造 | 展示引用来源 | 输出区区分知识库事实和 AI 推断 |\n| 生成方案 | 获得可比较方案 | 选择系统或自定义 Skill 执行 | Skill 工作台 | 期待 | 不知道方案取舍 | 输出多方案与风险 | 给出推荐方案、适用条件和验收标准 |\n| 沉淀资产 | 后续可复用 | 保存结果到运行记录和资产库 | 运行记录 | 稳定 | 聊天结果难追溯 | 资产化保存 | 保存输入、Skill、引用资料和版本 |`
    } else if (/PRD|交互方案/.test(skillName)) {
      assetType = 'PRD/交互方案'
      content = `# ${skillName}\n\n## 背景和目标\n基于用户输入“${payload.input || '未输入'}”生成第一版产品/交互方案。\n\n## 范围和非范围\n- 范围：默认通用 Skill、系统 Skill、用户自定义 Skill、知识库引用、执行记录。\n- 非范围：Skill 市场、直接执行 GitHub 代码、Figma/Jira/Confluence 自动发布。\n\n## 已引用资料\n${sourceText}\n\n## 核心流程\n1. 用户输入需求。\n2. 默认通用 Skill 诊断需求并读取知识库。\n3. 系统推荐 Skill 链或用户选择自己的 Skill。\n4. 目标 Skill 生成结构化结果。\n5. 系统保存运行记录和输出资产。\n\n## 验收标准\n- 输出必须包含引用资料或说明暂无引用。\n- 输出必须区分已知事实和 AI 推断。\n- 执行结果必须保存到运行记录。`
    }

    return {
      run: {
        id: randomUUID(),
        title: `${skillName} 执行结果`,
        assetType,
        sources,
        content
      }
    }
  },
  'POST /api/skills/import-draft': async (payload) => ({
    draft: {
      id: randomUUID(),
      name: payload.name || '外部导入 Skill 草稿',
      status: 'pending-review',
      sourceUrl: payload.url || '',
      riskNotes: ['外部内容仅作为待审核草稿保存', '未执行任何外部代码']
    }
  }),
  'POST /api/pm/question': async (payload) => ({
    question: `针对「${payload.skill}」，请补充：目标用户是谁？成功指标是什么？本次最小可交付范围是什么？`
  }),
  'POST /api/pm/generate-prd': async (payload) => ({
    content: `# ${payload.skill} PRD\n\n## 背景\n基于当前项目知识库、需求文档和竞品记录生成。\n\n## 目标\n形成可执行的产品需求，并沉淀到系统。\n\n## 功能范围\n- 网页快照\n- 代码生成\n- 风格替换\n- 知识库与需求文档\n\n## 验收标准\n- 用户能够完成核心流程\n- 结果可下载、可追溯\n`
  }),
  'POST /api/ux/question': async (payload) => ({
    question: `针对「${payload.skill}」，请回答：主要用户路径是什么？有哪些必须保留的页面元素？更偏效率还是展示？`
  }),
  'POST /api/ux/generate-options': async (payload) => ({
    content: `# ${payload.skill} 三个方案\n\n## 方案 A：效率优先\n强调任务入口、状态流转和批量操作。\n\n## 方案 B：理解优先\n强调资料引用、AI 推理过程和结果解释。\n\n## 方案 C：交付优先\n强调预览、下载、版本记录和可复用模板。\n`
  }),
  'POST /api/ux/generate-vue-preview': async (payload) => ({
    files: vueFiles(`${payload.skill || 'UX'} 可预览界面`, payload.palette)
  })
  }
}

export const routes = createMockApiRoutes()

function matchParameterizedRoute(method, pathname) {
  const requestSegments = pathname.split('/').filter(Boolean)
  for (const [routeKey, routeHandler] of Object.entries(routes)) {
    const [routeMethod, routePath] = routeKey.split(' ')
    if (routeMethod !== method || !routePath?.includes(':')) continue
    const routeSegments = routePath.split('/').filter(Boolean)
    if (routeSegments.length !== requestSegments.length) continue
    const params = {}
    let matched = true
    for (let index = 0; index < routeSegments.length; index += 1) {
      const routeSegment = routeSegments[index]
      const requestSegment = requestSegments[index]
      if (routeSegment.startsWith(':')) {
        params[routeSegment.slice(1)] = decodeURIComponent(requestSegment)
        continue
      }
      if (routeSegment !== requestSegment) {
        matched = false
        break
      }
    }
    if (matched) {
      return (payload, req, routeContext) => routeHandler({
        ...payload,
        ...params
      }, req, routeContext)
    }
  }
  return null
}

export function matchRoute(method, pathname) {
  const exact = routes[`${method} ${pathname}`]
  if (exact) return exact
  if (method === 'POST' && /^\/api\/competitors\/[^/]+\/check$/.test(pathname)) {
    return routes['POST /api/competitors/:id/check']
  }
  if (method === 'POST' && pathname === '/api/workspace/materials/import-website') {
    return routes['POST /api/workspace/materials/import-website']
  }
  if (method === 'DELETE' && /^\/api\/workspace\/materials\/[^/]+$/.test(pathname)) {
    return (payload, req, url) => routes['DELETE /api/workspace/materials/:id']({
      ...payload,
      id: decodeURIComponent(url.pathname.split('/').pop())
    })
  }
  if (method === 'PATCH' && /^\/api\/workspace\/materials\/[^/]+$/.test(pathname)) {
    return (payload, req, url) => routes['PATCH /api/workspace/materials/:id']({
      ...payload,
      id: decodeURIComponent(url.pathname.split('/').pop())
    })
  }
  if (method === 'PUT' && /^\/api\/workspace\/skills\/[^/]+$/.test(pathname)) {
    return (payload, req, url) => routes['PUT /api/workspace/skills/:id']({
      ...payload,
      id: decodeURIComponent(url.pathname.split('/').pop())
    })
  }
  const captureTaskMatch = pathname.match(/^\/api\/capture\/tasks\/([^/]+)\/result$/)
  if (method === 'GET' && captureTaskMatch) {
    return (payload) => routes['GET /api/capture/tasks/:taskId/result']({
      ...payload,
      taskId: decodeURIComponent(captureTaskMatch[1])
    })
  }
  const adminRecordMatch = pathname.match(/^\/api\/admin\/records\/([^/]+)(?:\/([^/]+))?$/)
  if (adminRecordMatch) {
    const collection = decodeURIComponent(adminRecordMatch[1])
    const id = adminRecordMatch[2] ? decodeURIComponent(adminRecordMatch[2]) : ''
    if (method === 'POST' && id === 'batch-delete') {
      return (payload) => routes['POST /api/admin/records/:collection/batch-delete']({ ...payload, collection })
    }
    if (method === 'GET' && !id) {
      return (payload) => routes['GET /api/admin/records/:collection']({ ...payload, collection })
    }
    if (method === 'POST' && !id) {
      return (payload) => routes['POST /api/admin/records/:collection']({ ...payload, collection })
    }
    if (method === 'PATCH' && id) {
      return (payload) => routes['PATCH /api/admin/records/:collection/:id']({ ...payload, collection, id })
    }
    if (method === 'DELETE' && id) {
      return (payload) => routes['DELETE /api/admin/records/:collection/:id']({ ...payload, collection, id })
    }
  }
  const restoredPageMatch = pathname.match(/^\/api\/workspace\/restored-pages\/([^/]+)(?:\/(preview|frame|source|download))?$/)
  if (method === 'GET' && restoredPageMatch) {
    const routeKey = restoredPageMatch[2]
      ? `GET /api/workspace/restored-pages/:id/${restoredPageMatch[2]}`
      : 'GET /api/workspace/restored-pages/:id'
    return (payload) => routes[routeKey]({
      ...payload,
      id: decodeURIComponent(restoredPageMatch[1])
    })
  }
  const workflowRunMatch = pathname.match(/^\/api\/workspace\/workflow-runs\/([^/]+)\/(generate|regenerate|accept|messages(?:\/stream|\/cancel)?|complete-step)$/)
  if (method === 'POST' && workflowRunMatch) {
    return (payload, req, routeContext) => routes[`POST /api/workspace/workflow-runs/:id/${workflowRunMatch[2]}`]({
      ...payload,
      id: decodeURIComponent(workflowRunMatch[1])
    }, req, routeContext)
  }
  const workflowRunDetailMatch = pathname.match(/^\/api\/workspace\/workflow-runs\/([^/]+)$/)
  if (method === 'GET' && workflowRunDetailMatch) {
    return (payload) => routes['GET /api/workspace/workflow-runs/:id']({
      ...payload,
      id: decodeURIComponent(workflowRunDetailMatch[1])
    })
  }
  const workflowStepMatch = pathname.match(/^\/api\/workflows\/runs\/([^/]+)\/steps\/([^/]+)\/(generate|regenerate|accept|messages(?:\/stream|\/cancel)?)$/)
  if (method === 'POST' && workflowStepMatch) {
    return (payload, req, routeContext) => routes[`POST /api/workflows/runs/:runId/steps/:stepId/${workflowStepMatch[3]}`]({
      ...payload,
      runId: decodeURIComponent(workflowStepMatch[1]),
      stepId: decodeURIComponent(workflowStepMatch[2])
    }, req, routeContext)
  }
  const workflowCompleteMatch = pathname.match(/^\/api\/workflows\/runs\/([^/]+)\/complete$/)
  if (method === 'POST' && workflowCompleteMatch) {
    return (payload) => routes['POST /api/workflows/runs/:runId/complete']({
      ...payload,
      runId: decodeURIComponent(workflowCompleteMatch[1])
    })
  }
  return matchParameterizedRoute(method, pathname)
}

export async function handleApiRequest(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {})
    return
  }

  const url = new URL(req.url, `http://${req.headers.host}`)
  const handler = matchRoute(req.method, url.pathname)
  if (!handler) {
    sendJson(res, 404, { message: `未找到接口：${req.method} ${url.pathname}` })
    return
  }

  try {
    const payload = req.method === 'GET' ? Object.fromEntries(url.searchParams.entries()) : await readBody(req)
    const wantsSse = req.method === 'POST' && url.pathname.endsWith('/stream')
    const routeContext = wantsSse
      ? {
          writeEvent: (chunk) => {
            res.write(chunk)
          }
        }
      : url
    if (wantsSse) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'
      })
      res.flushHeaders?.()
    }
    const data = await handler(payload, req, routeContext)
    if (wantsSse) {
      res.end()
      return
    }
    if (data?.contentType && Object.hasOwn(data, 'body')) {
      res.writeHead(200, {
        'Content-Type': data.contentType,
        'Access-Control-Allow-Origin': '*'
      })
      res.end(data.body)
      return
    }
    sendJson(res, 200, data)
  } catch (error) {
    if (req.method === 'POST' && url.pathname.endsWith('/stream')) {
      const errorData = {
        message: error.message || '本地流式 API 执行失败',
        code: error.code || 'STREAM_ROUTE_FAILED',
        recoveryActions: error.recoveryActions || ['重试', '检查后端服务日志']
      }
      res.write(sseEvent('error', errorData))
      res.write(sseEvent('done', { error: errorData }))
      res.end()
      return
    }
    const statusCode = error.code === 'CAPTURE_URL_INVALID' ? 400 : 500
    sendJson(res, statusCode, {
      message: error.message || '本地 API 执行失败',
      code: error.code || 'API_ROUTE_FAILED'
    })
  }
}

export function startMockApiServer() {
  const server = http.createServer(handleApiRequest)
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`流程通本地 API 已启动：http://localhost:${PORT}`)
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  startMockApiServer()
}
