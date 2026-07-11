import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export const DEFAULT_CHROME_EXECUTABLE = process.env.CHROME_EXECUTABLE ||
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

async function findFreePort() {
  return await new Promise((resolvePort, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolvePort(port))
    })
  })
}

function safeUrl(url = '') {
  return /^https?:\/\//.test(url) ? url : 'about:blank'
}

export function createBrowserSessionManager({
  chromeExecutable = DEFAULT_CHROME_EXECUTABLE,
  rootDir = resolve(tmpdir(), 'liuchengtong-browser-sessions'),
  launchChrome = true,
  allocatePort = findFreePort
} = {}) {
  const sessions = new Map()

  async function createSession({ projectId = 'default', url = 'about:blank' } = {}) {
    const sessionId = `session_${randomUUID().replace(/-/g, '').slice(0, 16)}`
    const port = await allocatePort()
    const debuggingUrl = `http://127.0.0.1:${port}`
    const profileDir = resolve(rootDir, projectId, sessionId, 'profile')
    await mkdir(profileDir, { recursive: true })

    let process = null
    if (launchChrome) {
      process = spawn(chromeExecutable, [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-dev-shm-usage',
        safeUrl(url)
      ], {
        detached: true,
        stdio: 'ignore'
      })
      process.unref()
    }

    const session = {
      sessionId,
      projectId,
      status: 'active',
      loginUrl: safeUrl(url),
      currentUrl: safeUrl(url),
      debuggingUrl,
      port,
      profileDir,
      createdAt: new Date().toISOString(),
      process
    }
    sessions.set(sessionId, session)
    return publicSession(session)
  }

  function getSession(sessionId = '') {
    return sessions.get(sessionId) || null
  }

  async function closeSession(sessionId = '') {
    const session = sessions.get(sessionId)
    if (!session) {
      return { sessionId, status: 'missing' }
    }
    if (session.process && !session.process.killed) {
      try {
        process.kill(-session.process.pid)
      } catch {
        session.process.kill?.()
      }
    }
    await rm(resolve(rootDir, session.projectId, session.sessionId), { recursive: true, force: true }).catch(() => {})
    sessions.delete(sessionId)
    return { ...publicSession(session), status: 'closed' }
  }

  return {
    createSession,
    getSession,
    closeSession
  }
}

export function publicSession(session = {}) {
  return {
    sessionId: session.sessionId,
    projectId: session.projectId,
    status: session.status,
    loginUrl: session.loginUrl,
    currentUrl: session.currentUrl || session.loginUrl,
    debuggingUrl: session.debuggingUrl,
    port: session.port,
    profileDir: session.profileDir,
    createdAt: session.createdAt
  }
}
