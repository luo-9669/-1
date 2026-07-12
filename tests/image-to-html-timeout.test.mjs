import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('image-to-html generation does not set a client or model timeout', async () => {
  const apiSource = await readFile(new URL('../backend/server/mock-api.mjs', import.meta.url), 'utf8')
  const serverConfigSource = await readFile(new URL('../backend/server/server-config.mjs', import.meta.url), 'utf8')
  const frontendApiSource = await readFile(new URL('../frontend/src/services/api.js', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')

  assert.match(serverConfigSource, /IMAGE_TO_HTML_MODEL_TIMEOUT_MS = 0/)
  assert.match(apiSource, /timeoutMs:\s*IMAGE_TO_HTML_MODEL_TIMEOUT_MS/)
  assert.match(frontendApiSource, /imageToHtml\(config,\s*payload\)/)
  assert.match(frontendApiSource, /timeoutMs:\s*0/)
  assert.match(frontendApiSource, /imageToHtmlStream\(config,\s*payload,\s*options = \{\}\)/)
  assert.match(frontendApiSource, /timeoutMs:\s*options\.timeoutMs\s*\?\?\s*0/)
  assert.match(appSource, /function imageToHtmlRequestTimeoutMs\(\) \{\s*return 0\s*\}/)
})
