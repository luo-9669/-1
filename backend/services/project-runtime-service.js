import { randomUUID } from 'node:crypto'
import { spawn as nodeSpawn, execFile } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { dirname, join, normalize, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'

const DEFAULT_ROOT_DIR = join(tmpdir(), 'liuchengtong-project-runtimes')
const MAX_LOG_LINES = 200

function execFileCommand(command, args, options) {
  return new Promise((resolveCommand, rejectCommand) => {
    execFile(command, args, {
      ...options,
      maxBuffer: 1024 * 1024 * 8
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout
        error.stderr = stderr
        rejectCommand(error)
        return
      }
      resolveCommand({ stdout, stderr })
    })
  })
}

function allocateFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer()
    server.on('error', rejectPort)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolvePort(port))
    })
  })
}

function normalizeUploadedPath(path = '') {
  const normalized = normalize(String(path || '').replace(/\\/g, '/'))
  if (normalized === '..' || normalized.startsWith(`..${sep}`) || normalized.startsWith('../')) return ''
  const clean = normalized.replace(/^[/\\]+/, '').replace(/^\.\//, '')
  if (!clean || clean === '.' || clean.includes(`..${sep}`) || clean === '..' || clean.startsWith('..')) return ''
  if (/(^|[/\\])(?:node_modules|dist|build|coverage|\.git)(?:[/\\]|$)/.test(clean)) return ''
  const fileName = clean.split(/[\\/]/).pop() || ''
  if (/^\.env(?:\.|$)/.test(fileName) && fileName !== '.env.example') return ''
  return clean
}

function stripProjectRoot(path = '', rootPrefix = '') {
  if (!rootPrefix) return path
  return path === rootPrefix ? '' : path.startsWith(`${rootPrefix}/`) ? path.slice(rootPrefix.length + 1) : path
}

function findPackageFile(files = []) {
  return files
    .map((file) => ({ ...file, safePath: normalizeUploadedPath(file.path) }))
    .filter((file) => /(^|\/)package\.json$/i.test(file.safePath))
    .sort((a, b) => a.safePath.split('/').length - b.safePath.split('/').length)[0]
}

function parsePackageJson(file = {}) {
  try {
    return JSON.parse(String(file.content || '{}'))
  } catch {
    throw new Error('package.json 解析失败，无法启动项目预览')
  }
}

function hasUploadedFile(files = [], path = '') {
  return files.some((file) => normalizeUploadedPath(file.path) === path)
}

function selectRunScript(pkg = {}, files = []) {
  const scripts = pkg.scripts || {}
  if (
    scripts['dev:local'] &&
    /--dotenv\s+\.env\.development/.test(String(scripts.dev || '')) &&
    !hasUploadedFile(files, '.env.development') &&
    hasUploadedFile(files, '.env.example')
  ) {
    return 'dev:local'
  }
  return ['dev', 'start', 'preview'].find((script) => scripts[script])
}

function detectPackageManager(pkg = {}, files = []) {
  const declared = String(pkg.packageManager || '').split('@')[0]
  if (['pnpm', 'yarn', 'npm'].includes(declared)) return declared
  if (files.some((file) => /(^|\/)pnpm-lock\.yaml$/i.test(file.path || ''))) return 'pnpm'
  if (files.some((file) => /(^|\/)yarn\.lock$/i.test(file.path || ''))) return 'yarn'
  return 'npm'
}

function installArgsFor(packageManager) {
  if (packageManager === 'pnpm') return ['install', '--silent']
  if (packageManager === 'yarn') return ['install', '--silent']
  return ['install', '--silent', '--no-audit', '--no-fund']
}

function runArgsFor(packageManager, script, port) {
  const hostPortArgs = ['--host', '127.0.0.1', '--port', String(port)]
  if (packageManager === 'yarn') return [script, ...hostPortArgs]
  return ['run', script, '--', ...hostPortArgs]
}

async function defaultWaitForUrl(url, timeoutMs = 45000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.status < 500) return true
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 700))
    }
  }
  return false
}

function appendLog(runtime, line = '') {
  const text = String(line || '').trim()
  if (!text) return
  runtime.logs.push(text)
  if (runtime.logs.length > MAX_LOG_LINES) runtime.logs.splice(0, runtime.logs.length - MAX_LOG_LINES)
}

function decodeFileContent(content = '') {
  const text = String(content || '')
  const dataUrlMatch = text.match(/^data:.*?;base64,(.+)$/)
  if (dataUrlMatch) return Buffer.from(dataUrlMatch[1], 'base64')
  return text
}

export function createProjectRuntimeService(options = {}) {
  const runtimes = new Map()
  const rootDir = options.rootDir || DEFAULT_ROOT_DIR
  const runCommand = options.runCommand || execFileCommand
  const spawnCommand = options.spawnCommand || nodeSpawn
  const allocatePort = options.allocatePort || allocateFreePort
  const waitForUrl = options.waitForUrl || defaultWaitForUrl
  const idFactory = options.idFactory || (() => `runtime-${randomUUID()}`)

  async function writeProjectFiles(workDir, files = [], rootPrefix = '') {
    for (const file of files) {
      const safePath = stripProjectRoot(normalizeUploadedPath(file.path), rootPrefix)
      if (!safePath || safePath === 'package.json' && !file.content) continue
      const targetPath = resolve(workDir, safePath)
      if (!targetPath.startsWith(`${resolve(workDir)}${sep}`) && targetPath !== resolve(workDir)) continue
      await mkdir(dirname(targetPath), { recursive: true })
      await writeFile(targetPath, decodeFileContent(file.content))
    }
  }

  async function start(payload = {}) {
    const files = Array.isArray(payload.files) ? payload.files : []
    const packageFile = findPackageFile(files)
    if (!packageFile) throw new Error('没有找到 package.json，无法运行项目预览')
    const pkg = parsePackageJson(packageFile)
    const script = selectRunScript(pkg, files)
    if (!script) throw new Error('没有找到可运行的 package script（dev/start/preview）')

    const id = idFactory()
    const port = Number(payload.port) || await allocatePort()
    const rootPrefix = dirname(packageFile.safePath).replace(/^\.$/, '').replace(/\\/g, '/')
    const workDir = join(rootDir, id)
    const url = `http://127.0.0.1:${port}`
    const runtime = {
      id,
      projectId: payload.projectId || '',
      fileName: payload.fileName || '',
      workDir,
      url,
      port,
      script,
      packageManager: detectPackageManager(pkg, files),
      status: 'installing',
      logs: [],
      startedAt: new Date().toISOString(),
      process: null
    }

    await rm(workDir, { recursive: true, force: true })
    await mkdir(workDir, { recursive: true })
    await writeProjectFiles(workDir, files, rootPrefix)
    runtimes.set(id, runtime)

    appendLog(runtime, `写入项目文件：${payload.fileName || id}`)
    await runCommand(runtime.packageManager, installArgsFor(runtime.packageManager), { cwd: workDir })
    appendLog(runtime, `${runtime.packageManager} install 完成`)

    runtime.status = 'starting'
    const child = spawnCommand(runtime.packageManager, runArgsFor(runtime.packageManager, script, port), {
      cwd: workDir,
      env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    runtime.process = child
    child.stdout?.on?.('data', (chunk) => appendLog(runtime, chunk))
    child.stderr?.on?.('data', (chunk) => appendLog(runtime, chunk))
    child.on?.('exit', (code) => {
      runtime.status = code === 0 ? 'stopped' : 'failed'
      appendLog(runtime, `项目预览进程退出：${code}`)
    })

    const ready = await waitForUrl(url, Number(payload.timeoutMs) || 45000)
    runtime.status = ready ? 'running' : 'starting'
    appendLog(runtime, ready ? `预览已启动：${url}` : `预览启动中：${url}`)
    return publicRuntime(runtime)
  }

  async function stop(runtimeId = '') {
    const runtime = runtimes.get(runtimeId)
    if (!runtime) return { id: runtimeId, status: 'missing' }
    runtime.process?.kill?.()
    runtime.status = 'stopped'
    appendLog(runtime, '已停止项目预览')
    await rm(runtime.workDir, { recursive: true, force: true })
    runtimes.delete(runtimeId)
    return publicRuntime(runtime)
  }

  function publicRuntime(runtime = {}) {
    const { process: _process, ...publicFields } = runtime
    return {
      ...publicFields,
      logs: [...(runtime.logs || [])]
    }
  }

  return {
    start,
    stop,
    get(runtimeId = '') {
      const runtime = runtimes.get(runtimeId)
      return runtime ? publicRuntime(runtime) : null
    }
  }
}
