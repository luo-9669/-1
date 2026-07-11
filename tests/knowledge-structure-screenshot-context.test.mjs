import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('knowledge structure screenshot only draws region frame for a matched element', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const knowledgeHubSource = await readFile(new URL('../frontend/src/pages/knowledge/KnowledgeHubPanel.vue', import.meta.url), 'utf8')

  assert.match(appSource, /const rawRect = matchedComponent\?\.rect/)
  assert.match(appSource, /const rect = rawRect \? normalizeVisualRect\(rawRect\) : null/)
  assert.match(appSource, /selectedKnowledgeNodeVisualContext\?\.screen\?\.title/)
  assert.match(appSource, /selectedKnowledgeNodeVisualContext\?\.rect/)
  assert.match(appSource, /:selected-knowledge-node-visual-context/)
  assert.match(knowledgeHubSource, /selectedKnowledgeNodeVisualContext: \{ type: Object, default: null \}/)
})
