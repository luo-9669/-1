import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright-core'
import { buildVisualVerificationReport } from '../../frontend/src/services/visualVerification.js'
import { compareImageDataUrls } from '../../frontend/src/services/visualVerification.node.js'
import { createRestoredPageAsset } from '../../frontend/src/services/factoryWorkspace.js'
import { createWorkspaceStore, workspaceRoutes } from '../routes/workspace.js'
import { addModelCallLog, addRestoredPage, getModelSettingsRaw } from '../services/workspace-store.js'
import { uploadRoutes } from '../routes/uploads.js'
import { captureRoutes } from '../routes/capture.js'
import { adminRoutes } from '../routes/admin.js'
import { competitorRoutes } from '../routes/competitors.js'
import { diagramRoutes } from '../routes/diagrams.js'
import { generatePageFromCapturePayload } from '../services/capture-service.js'
import { createCaptureRunner } from '../services/capture-runner.js'
import { createCaptureTaskStore } from '../services/capture-task-store.js'
import { createCompetitorMonitorService } from '../services/competitor-monitor-service.js'
import { createCompetitorAnalysisAdapter } from '../services/competitor-analysis-adapter.js'
import { createCompetitorAnalysisEngineService } from '../services/competitor-analysis-engine-service.js'
import { createImageToHtmlService } from '../services/image-to-html-service.js'
import { createCaptureDispatcher } from '../services/capture-dispatcher.js'
import { analyzeCaptureUrl } from '../services/capture-url-analyzer.js'
import { matchCaptureTemplate } from '../services/capture-template-matcher.js'
import { compileCaptureTask } from '../services/capture-compiler.js'
import { classifyCaptureDiagnostics } from '../services/capture-diagnostics.js'
import { createAgentProviderFromModelSettings } from '../services/llm-provider.js'
import { renderMarkdownPdf } from '../services/markdown-pdf-service.js'
import { renderAdminConsoleHtml } from '../services/admin-console.js'
import { createBrowserSessionService } from '../services/browser-session-service.js'
import {
  createWebsiteImportService,
  renderWebsiteHtml
} from '../services/website-import-service.js'
import { createProjectRuntimeService } from '../services/project-runtime-service.js'
import { createApiRequestHandler } from './api-handler.mjs'
import { createBrowserSessionManager } from './browser-session-manager.mjs'
import { DEFAULT_DESIGN_RULES, resolveDesignRules } from './design-rules.mjs'
import { startHttpServer } from './http-server.mjs'
import {
  CICADA_LLM_MODEL_SETTINGS,
  createDefaultWorkflowAgentProvider,
  ensureCicadaModelSettings
} from './model-provider.mjs'
import { createRouteMatcher } from './route-matcher.mjs'
import { isTestRuntime as detectTestRuntime } from './runtime.mjs'
import {
  CHROME_EXECUTABLE,
  DEFAULT_HEADERS,
  IMAGE_TO_HTML_MODEL_TIMEOUT_MS,
  PORT,
  SINGLE_FILE_BIN,
  projectRoot
} from './server-config.mjs'
import { createStreamPusher, sseEvent } from './sse.mjs'

export { renderWebsiteHtml }

const execFileAsync = promisify(execFile)
const isTestRuntime = detectTestRuntime()
let testBrowserSessionPort = 44000
const browserSessions = createBrowserSessionManager({
  launchChrome: !isTestRuntime,
  allocatePort: isTestRuntime ? async () => ++testBrowserSessionPort : undefined
})
const browserSessionService = createBrowserSessionService({
  chromium,
  isTestRuntime,
  defaultHeaders: DEFAULT_HEADERS,
  authStateRootDir: resolve(projectRoot, 'backend/storage/auth-states')
})
const workspaceStore = createWorkspaceStore(null, {
  filePath: isTestRuntime
    ? ''
    : (process.env.WORKSPACE_STORE_FILE || resolve(projectRoot, 'backend/storage/workspace/workspace.local.json'))
})
await workspaceStore.load()

await ensureCicadaModelSettings(workspaceStore, { isTestRuntime })
const workflowAgentProvider = createDefaultWorkflowAgentProvider({
  isTestRuntime,
  fetchImpl: globalThis.fetch
})
function resolveWorkflowAgentProvider(options = {}) {
  if (options.agentProvider) return options.agentProvider
  const settings = getModelSettingsRaw(workspaceStore)
  if (settings?.enabled) return createAgentProviderFromModelSettings(settings, options.fetchImpl)
  return workflowAgentProvider
}
const uploadApiRoutes = uploadRoutes({
  store: workspaceStore,
  agentProvider: await resolveWorkflowAgentProvider()
})

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
    if (payload.authMode === 'saved-state') {
      let savedState = null
      try {
        savedState = await browserSessionService.resolveState({
          projectId: payload.projectId || 'default',
          url: payload.url,
          stateKey: sessionPayload.storageStateKey || payload.storageStateKey
        })
      } catch {
        const error = new Error('未找到可复用的登录态，请先打开授权浏览器完成登录并保存登录态')
        error.code = 'CAPTURE_BROWSER_STATE_MISSING'
        throw error
      }
      return isTestRuntime
        ? await fetchTargetPage(payload.url)
        : await captureWithChromeAndSession(payload.url, { storageState: savedState.storageStatePath })
    }
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
const websiteImportService = createWebsiteImportService({
  captureRunner,
  defaultHeaders: DEFAULT_HEADERS,
  chromeExecutable: CHROME_EXECUTABLE
})
const projectRuntimeService = createProjectRuntimeService()
const workspaceApiRoutes = workspaceRoutes(workspaceStore, {
  resolveAgentProvider: resolveWorkflowAgentProvider,
  fallback: process.env.WORKFLOW_AGENT_FALLBACK || 'deterministic',
  importWebsiteKnowledge: websiteImportService.parseWebsiteKnowledge,
  captureWebsitePrototype: websiteImportService.captureWebsitePrototype,
  projectRuntimeService,
  renderMarkdownPdf: (payload) => renderMarkdownPdf(payload, {
    chromium,
    executablePath: CHROME_EXECUTABLE
  })
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
  previewBrowserSession: async (payload) => browserSessionService.preview(browserSessions.getSession(payload.sessionId)),
  browserSessionAction: async (payload) => browserSessionService.action(browserSessions.getSession(payload.sessionId), payload),
  saveBrowserSessionState: async (payload) => browserSessionService.saveState(browserSessions.getSession(payload.sessionId), {
    projectId: payload.projectId || 'default',
    url: payload.url,
    stateKey: payload.stateKey
  }),
  listBrowserSessionStates: async (payload) => browserSessionService.listStates({
    projectId: payload.projectId || ''
  }),
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
  frontendPort: 5588,
  storageFile: workspaceStore.filePath
})
const competitorMonitorService = createCompetitorMonitorService({
  store: workspaceStore,
  captureAdapter: async (competitor = {}, task = {}) => captureRunner.makeCaptureResult({
    projectId: competitor.projectId,
    url: task.url || competitor.websiteUrl,
    scope: 'competitor-monitor',
    output: 'snapshot',
    authMode: 'public'
  }),
  aiAdapter: createCompetitorAnalysisAdapter({
    provider: workflowAgentProvider,
    model: CICADA_LLM_MODEL_SETTINGS.defaultModel
  })
})
const competitorAnalysisEngineService = createCompetitorAnalysisEngineService({
  modelSettingsProvider: () => getModelSettingsRaw(workspaceStore),
  resolveAgentProvider: resolveWorkflowAgentProvider
})
const competitorApiRoutes = competitorRoutes({
  getOverview: async (payload = {}) => competitorMonitorService.getOverview(payload),
  getPermissions: async (payload = {}) => competitorMonitorService.getPermissions(payload),
  listProjectMembers: async (payload = {}) => competitorMonitorService.listProjectMembers(payload),
  listUiReferences: async (payload = {}) => competitorMonitorService.listUiReferences(payload),
  listUiReferenceFavorites: async (payload = {}) => competitorMonitorService.listUiReferenceFavorites(payload),
  favoriteUiReference: async (payload = {}) => competitorMonitorService.favoriteUiReference(payload),
  unfavoriteUiReference: async (payload = {}) => competitorMonitorService.unfavoriteUiReference(payload),
  listCompetitors: async (payload = {}) => competitorMonitorService.listCompetitors(payload),
  createCompetitor: async (payload = {}) => competitorMonitorService.createCompetitor(payload),
  updateCompetitor: async ({ id, ...payload } = {}) => competitorMonitorService.updateCompetitor({ ...payload, competitorId: id }),
  deleteCompetitor: async ({ id, ...payload } = {}) => competitorMonitorService.deleteCompetitor({ ...payload, competitorId: id }),
  getCompetitor: async ({ id, ...payload } = {}) => competitorMonitorService.getCompetitor({ ...payload, competitorId: id }),
  listTasks: async (payload = {}) => competitorMonitorService.listTasks(payload),
  createTask: async (payload = {}) => competitorMonitorService.createTask(payload),
  updateTaskStatus: async (payload = {}) => competitorMonitorService.updateTaskStatus(payload),
  runCompetitorCheck: async ({ id, ...payload } = {}) => competitorMonitorService.runCompetitorCheck({ ...payload, competitorId: id }),
  runDueMonitorTasks: async (payload = {}) => competitorMonitorService.runDueMonitorTasks(payload),
  listChanges: async (payload = {}) => competitorMonitorService.listChanges(payload),
  listReports: async (payload = {}) => competitorMonitorService.listReports(payload),
  saveReport: async (payload = {}) => competitorMonitorService.saveReport(payload),
  exportReport: async (payload = {}) => competitorMonitorService.exportReport(payload),
  shareReport: async (payload = {}) => competitorMonitorService.shareReport(payload),
  revokeReportShare: async (payload = {}) => competitorMonitorService.revokeReportShare(payload),
  getSharedReport: async (payload = {}) => competitorMonitorService.getSharedReport(payload),
  exportSharedReport: async (payload = {}) => competitorMonitorService.exportSharedReport(payload),
  listAuditLogs: async (payload = {}) => competitorMonitorService.listAuditLogs(payload),
  exportAuditLogs: async (payload = {}) => competitorMonitorService.exportAuditLogs(payload),
  listReportVersions: async (payload = {}) => competitorMonitorService.listReportVersions(payload),
  compareReportVersions: async (payload = {}) => competitorMonitorService.compareReportVersions(payload),
  listInsights: async (payload = {}) => competitorMonitorService.listInsights(payload),
  updateInsight: async (payload = {}) => competitorMonitorService.updateInsight(payload),
  batchUpdateInsights: async (payload = {}) => competitorMonitorService.batchUpdateInsights(payload),
  exportInsight: async (payload = {}) => competitorMonitorService.exportInsight(payload),
  batchExportInsights: async (payload = {}) => competitorMonitorService.batchExportInsights(payload),
  batchDepositInsightsToKnowledge: async (payload = {}) => competitorMonitorService.batchDepositInsightsToKnowledge(payload),
  linkInsightRequirements: async (payload = {}) => competitorMonitorService.linkInsightRequirements(payload),
  depositInsightToKnowledge: async (payload = {}) => competitorMonitorService.depositInsightToKnowledge(payload),
  saveInsight: async (payload = {}) => competitorMonitorService.saveInsight(payload),
  getChangeDetail: async ({ id, ...payload } = {}) => competitorMonitorService.getChangeDetail({ ...payload, changeId: id })
})
const imageToHtmlService = createImageToHtmlService({
  resolveAgentProvider: resolveImageGenerationAgentProvider,
  resolveFallbackProvider: resolveImageGenerationFallbackProvider,
  verifyGeneratedPage,
  persistRestoredPage: async (asset) => addRestoredPage(workspaceStore, asset),
  recordModelCall: async (entry) => addModelCallLog(workspaceStore, entry),
  createStreamPusher,
  timeoutMs: IMAGE_TO_HTML_MODEL_TIMEOUT_MS
})

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
      storageState: session.storageState && (typeof session.storageState === 'object' || typeof session.storageState === 'string') ? session.storageState : undefined
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
  ...competitorApiRoutes,
  ...diagramRoutes({
    provider: {
      name: 'diagram-workflow-provider',
      async generate(context) {
        const provider = await resolveWorkflowAgentProvider()
        return provider.generate(context)
      }
    }
  }),
  'GET /api/competitor-analysis/records': async (payload = {}) => competitorAnalysisEngineService.listRecords(payload),
  'POST /api/competitor-analysis/records': async (payload = {}) => competitorAnalysisEngineService.createRecord(payload),
  'DELETE /api/competitor-analysis/records/:id': async (payload = {}) => competitorAnalysisEngineService.deleteRecord({
    ...payload,
    recordId: payload.id
  }),
  'POST /api/competitor-analysis/run': async (payload = {}) => competitorAnalysisEngineService.run(payload),
  'GET /api/competitor-analysis/latest': async (payload = {}) => competitorAnalysisEngineService.latest(payload),
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
  'POST /api/generate/image-to-html': async (payload) => imageToHtmlService.generate(payload, options),
  'POST /api/generate/image-to-html/stream': async (payload, req, routeContext) => imageToHtmlService.stream(payload, options, routeContext),
  'POST /api/generate/tasks/:taskId/regenerate': async (payload) => ({
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
  'POST /api/knowledge/from-project-package': async (payload) => {
    return workspaceApiRoutes['POST /api/workspace/materials/import-project-package'](payload)
  },
  'POST /api/knowledge/from-website': async (payload) => {
    return websiteImportService.parseWebsiteKnowledge(payload)
  },
  'POST /api/knowledge/search-web': async (payload) => ({
    items: [
      { id: randomUUID(), title: `联网资料：${payload.query || '未命名主题'}`, meta: '本地 API 示例结果', status: '已保存' }
    ]
  }),
  'POST /api/requirements/generate-prd': async () => ({
    document: { id: randomUUID(), title: 'AI 生成 PRD', meta: '本地 API · v1.0', status: '已生成' }
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

export const matchRoute = createRouteMatcher(routes)

export const handleApiRequest = createApiRequestHandler({
  matchRoute,
  sseEvent
})

export function startMockApiServer() {
  return startHttpServer({
    handleApiRequest,
    port: PORT,
    onListen: () => {
      console.log(`流程通本地 API 已启动：http://localhost:${PORT}`)
    }
  })
}

if (process.argv[1] && import.meta.url === new URL(resolve(process.argv[1]), 'file:').href) {
  startMockApiServer()
}
