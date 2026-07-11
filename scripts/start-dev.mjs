import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const BACKEND_PORT = String(process.env.BACKEND_PORT || process.env.PORT || 5599)
const FRONTEND_PORT = String(process.env.FRONTEND_PORT || 5588)
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${BACKEND_PORT}`

const children = new Set()
let stopping = false
const execFileAsync = promisify(execFile)

async function pidsForPort(port) {
  try {
    const { stdout } = await execFileAsync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'])
    return stdout
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

async function stopPort(port) {
  const pids = await pidsForPort(port)
  if (!pids.length) return
  console.log(`Port ${port} is already in use, stopping existing process before restart...`)
  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGTERM')
    } catch {}
  }
  await new Promise((resolve) => setTimeout(resolve, 500))
  for (const pid of await pidsForPort(port)) {
    try {
      process.kill(Number(pid), 'SIGKILL')
    } catch {}
  }
}

function startProcess(name, args, options = {}) {
  const child = spawn('npm', args, {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      ...options.env
    }
  })
  children.add(child)
  child.on('exit', (code, signal) => {
    children.delete(child)
    if (stopping) return
    if (signal) {
      console.error(`[${name}] stopped by ${signal}`)
    } else if (code) {
      console.error(`[${name}] exited with code ${code}`)
    }
    stopAll(code || 0)
  })
  return child
}

function stopAll(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    try {
      child.kill('SIGTERM')
    } catch {}
  }
  setTimeout(() => {
    for (const child of children) {
      try {
        child.kill('SIGKILL')
      } catch {}
    }
    process.exit(exitCode)
  }, 800).unref()
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))

console.log(`Starting backend on http://localhost:${BACKEND_PORT}`)
console.log(`Starting frontend on http://localhost:${FRONTEND_PORT}`)
console.log(`Proxying frontend /api requests to ${API_PROXY_TARGET}`)

await stopPort(BACKEND_PORT)
await stopPort(FRONTEND_PORT)

startProcess('backend', ['--prefix', 'backend', 'run', 'api', '--'], {
  env: {
    PORT: BACKEND_PORT
  }
})

startProcess('frontend', ['--prefix', 'frontend', 'run', 'dev', '--', '--port', FRONTEND_PORT, '--strictPort'], {
  env: {
    VITE_API_PROXY_TARGET: API_PROXY_TARGET
  }
})
