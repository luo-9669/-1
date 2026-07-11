import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('knowledge structure canvas stays as an internal scroll container', async () => {
  const styles = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(styles, /\.knowledge-structure-workspace\s*\{[\s\S]*?height:\s*clamp\(520px,\s*calc\(100vh - 280px\),\s*860px\)/)
  assert.match(styles, /\.knowledge-structure-workspace \.knowledge-xmind-viewport\s*\{[\s\S]*?height:\s*100%/)
  assert.match(styles, /\.knowledge-structure-workspace \.knowledge-xmind-viewport\s*\{[\s\S]*?scrollbar-gutter:\s*stable/)
  assert.match(styles, /\.knowledge-structure-inspector\s*\{[\s\S]*?height:\s*100%/)
  assert.match(styles, /\.knowledge-structure-inspector\s*\{[\s\S]*?overflow:\s*auto/)
})
