import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const loaded = new Set()

function parseEnvLine(line = '') {
  const trimmed = String(line || '').trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]*)$/)
  if (!match) return null
  let value = match[2].trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  return [match[1], value]
}

function loadEnvFile(filePath = '') {
  const target = resolve(projectRoot, filePath)
  if (loaded.has(target) || !existsSync(target)) return
  loaded.add(target)
  const text = readFileSync(target, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEnvLine(line)
    if (!parsed) continue
    const [key, value] = parsed
    if (process.env[key] === undefined) process.env[key] = value
  }
}

export function loadBackendEnv() {
  const nodeEnv = String(process.env.NODE_ENV || '').trim()
  loadEnvFile('.env')
  loadEnvFile('.env.local')
  if (nodeEnv) loadEnvFile(`.env.${nodeEnv}`)
  if (nodeEnv) loadEnvFile(`.env.${nodeEnv}.local`)
  loadEnvFile('backend/.env')
  loadEnvFile('backend/.env.local')
  if (nodeEnv) loadEnvFile(`backend/.env.${nodeEnv}`)
  if (nodeEnv) loadEnvFile(`backend/.env.${nodeEnv}.local`)
}

loadBackendEnv()
