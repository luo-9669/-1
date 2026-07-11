import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PORT = Number(process.env.PORT || 5599)
export const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}
export const IMAGE_TO_HTML_MODEL_TIMEOUT_MS = 600000
export const CHROME_EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
export const backendRoot = fileURLToPath(new URL('..', import.meta.url))
export const SINGLE_FILE_BIN = resolve(backendRoot, 'node_modules/.bin/single-file')
