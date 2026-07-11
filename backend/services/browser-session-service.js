import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function placeholderBrowserScreenshot() {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lS7R3wAAAABJRU5ErkJggg=='
}

function safeSegment(value = '', fallback = 'default') {
  const segment = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return segment || fallback
}

function safeHostFromUrl(url = '') {
  try {
    return new URL(url).hostname || ''
  } catch {
    return ''
  }
}

function defaultStateKey({ projectId = 'default', url = '', stateKey = '' } = {}) {
  if (stateKey) return safeSegment(stateKey)
  const host = safeHostFromUrl(url)
  return `${safeSegment(projectId)}__${safeSegment(host, 'site')}`
}

function publicStorageState(meta = {}) {
  return {
    status: meta.status || 'saved',
    stateKey: meta.stateKey,
    projectId: meta.projectId,
    siteHost: meta.siteHost,
    loginUrl: meta.loginUrl,
    savedAt: meta.savedAt
  }
}

export function createBrowserSessionService({
  chromium,
  isTestRuntime = false,
  defaultHeaders = {},
  authStateRootDir = resolve(process.cwd(), 'backend/storage/auth-states'),
  now = () => new Date().toISOString()
} = {}) {
  function authStatePath(stateKey = '') {
    return resolve(authStateRootDir, `${safeSegment(stateKey)}.json`)
  }

  function authStateMetaPath(stateKey = '') {
    return resolve(authStateRootDir, `${safeSegment(stateKey)}.meta.json`)
  }

  async function writeAuthStateMeta(meta = {}) {
    await mkdir(authStateRootDir, { recursive: true })
    await writeFile(authStateMetaPath(meta.stateKey), JSON.stringify(meta, null, 2))
  }

  async function readAuthStateMeta(stateKey = '') {
    const raw = await readFile(authStateMetaPath(stateKey), 'utf8')
    return JSON.parse(raw)
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

  async function saveBrowserSessionState(session, options = {}) {
    if (!session) return { status: 'missing', message: '授权浏览器会话不存在' }
    const loginUrl = options.url || session.currentUrl || session.loginUrl || ''
    const siteHost = safeHostFromUrl(loginUrl)
    const stateKey = defaultStateKey({
      projectId: options.projectId || session.projectId || 'default',
      url: loginUrl,
      stateKey: options.stateKey
    })
    const storageStatePath = authStatePath(stateKey)
    await mkdir(authStateRootDir, { recursive: true })

    if (isTestRuntime) {
      await writeFile(storageStatePath, JSON.stringify({ cookies: [], origins: [] }, null, 2))
    } else {
      if (!chromium) throw new Error('Playwright chromium is not configured')
      const browser = await chromium.connectOverCDP(session.debuggingUrl)
      try {
        const context = browser.contexts()[0] || await browser.newContext({ viewport: { width: 1440, height: 900 } })
        await context.storageState({ path: storageStatePath })
      } finally {
        await browser.close()
      }
    }

    const meta = {
      status: 'saved',
      stateKey,
      projectId: options.projectId || session.projectId || 'default',
      siteHost,
      loginUrl,
      savedAt: now()
    }
    await writeAuthStateMeta(meta)
    session.storageStateKey = stateKey
    session.storageStatePath = storageStatePath
    session.storageStateSavedAt = meta.savedAt
    return publicStorageState(meta)
  }

  async function listBrowserSessionStates(options = {}) {
    await mkdir(authStateRootDir, { recursive: true })
    const files = await readdir(authStateRootDir).catch(() => [])
    const states = []
    for (const file of files) {
      if (!file.endsWith('.meta.json')) continue
      try {
        const meta = JSON.parse(await readFile(resolve(authStateRootDir, file), 'utf8'))
        if (options.projectId && meta.projectId !== options.projectId) continue
        states.push(publicStorageState(meta))
      } catch {}
    }
    states.sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))
    return { states }
  }

  async function resolveBrowserSessionState(options = {}) {
    const stateKey = defaultStateKey(options)
    const storageStatePath = authStatePath(stateKey)
    await access(storageStatePath)
    let meta = {
      status: 'saved',
      stateKey,
      projectId: options.projectId || 'default',
      siteHost: safeHostFromUrl(options.url || ''),
      loginUrl: options.url || '',
      savedAt: ''
    }
    try {
      meta = { ...meta, ...(await readAuthStateMeta(stateKey)) }
    } catch {}
    return {
      ...publicStorageState(meta),
      storageStatePath
    }
  }

  return {
    preview: browserSessionPreview,
    action: browserSessionAction,
    saveState: saveBrowserSessionState,
    listStates: listBrowserSessionStates,
    resolveState: resolveBrowserSessionState,
    defaultHeaders
  }
}
