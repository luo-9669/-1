import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('status preview keeps a continuously scrolling code stream illusion', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')

  assert.match(appSource, /code-stream-shell/)
  assert.match(appSource, /code-stream-mask/)
  assert.match(appSource, /const stream = document\.getElementById\('code-stream'\)/)
  assert.match(appSource, /appendCodeLine/)
  assert.match(appSource, /stream\.scrollTop = stream\.scrollHeight/)
})
