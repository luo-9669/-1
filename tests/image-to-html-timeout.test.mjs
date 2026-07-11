import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('image-to-html default timeout is ten minutes', async () => {
  const apiSource = await readFile(new URL('../backend/server/mock-api.mjs', import.meta.url), 'utf8')
  const serverConfigSource = await readFile(new URL('../backend/server/server-config.mjs', import.meta.url), 'utf8')
  const frontendApiSource = await readFile(new URL('../frontend/src/services/api.js', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')

  assert.match(serverConfigSource, /IMAGE_TO_HTML_MODEL_TIMEOUT_MS = 600000/)
  assert.match(apiSource, /timeoutMs:\s*IMAGE_TO_HTML_MODEL_TIMEOUT_MS/)
  assert.match(frontendApiSource, /imageToHtml\(config,\s*payload\)/)
  assert.match(frontendApiSource, /timeoutMs:\s*600000/)
  assert.match(frontendApiSource, /imageToHtmlStream\(config,\s*payload,\s*options = \{\}\)/)
  assert.match(frontendApiSource, /timeoutMs:\s*options\.timeoutMs\s*\|\|\s*600000/)
  assert.match(appSource, /Math\.max\(600000,\s*modelTimeoutMs\s*\+\s*120000\)/)
})
