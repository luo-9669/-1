import './env-loader.mjs'
import { existsSync, mkdirSync, accessSync, constants } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

export const PORT = Number(process.env.PORT || 5599)
export const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}
export const IMAGE_TO_HTML_MODEL_TIMEOUT_MS = 0
export const CHROME_EXECUTABLE = process.env.CHROME_EXECUTABLE ||
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
export const backendRoot = fileURLToPath(new URL('..', import.meta.url))
export const SINGLE_FILE_BIN = resolve(backendRoot, 'node_modules/.bin/single-file')

// 【Coze 端改动 - Codex 请注意】
// 存储根目录：优先使用环境变量，否则检测项目内目录是否可写，
// 不可写则回退到系统临时目录（部署环境）。
// 这是因为 Coze 部署环境 /opt/bytefaas/ 是只读文件系统，
// 无法在 backend/storage 下创建目录，所以自动回退到 /tmp。
// 如果后续接入数据库存储，这个配置主要用于大文件（图片/PDF等）的本地缓存。
function resolveStorageRoot() {
  if (process.env.STORAGE_ROOT) return process.env.STORAGE_ROOT
  const defaultRoot = resolve(projectRoot, 'backend/storage')
  try {
    if (!existsSync(defaultRoot)) mkdirSync(defaultRoot, { recursive: true })
    accessSync(defaultRoot, constants.W_OK)
    return defaultRoot
  } catch {
    const fallbackRoot = resolve(tmpdir(), 'liuchengtong-storage')
    try {
      if (!existsSync(fallbackRoot)) mkdirSync(fallbackRoot, { recursive: true })
    } catch { /* ignore */ }
    return fallbackRoot
  }
}
export const storageRoot = resolveStorageRoot()
