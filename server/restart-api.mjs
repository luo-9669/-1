import { execFile } from 'node:child_process'
import { spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const port = String(process.env.PORT || 5299)

async function pidsForPort(targetPort) {
  try {
    const { stdout } = await execFileAsync('lsof', ['-tiTCP:' + targetPort, '-sTCP:LISTEN'])
    return stdout
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

async function stopPort(targetPort) {
  const pids = await pidsForPort(targetPort)
  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGTERM')
    } catch {}
  }
  if (pids.length) {
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  for (const pid of await pidsForPort(targetPort)) {
    try {
      process.kill(Number(pid), 'SIGKILL')
    } catch {}
  }
}

await stopPort(port)

const child = spawn(process.execPath, ['server/mock-api.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port }
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code || 0)
})
