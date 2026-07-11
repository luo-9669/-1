import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('knowledge prototype screenshots stay in frame and expose upload states', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const knowledgeHubSource = await readFile(new URL('../frontend/src/pages/knowledge/KnowledgeHubPanel.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(knowledgeHubSource, /knowledge-screenshot-image/)
  assert.match(styles, /\.knowledge-screenshot-stage img\s*\{[\s\S]*?object-fit:\s*contain/)
  const structureSection = knowledgeHubSource.slice(
    knowledgeHubSource.indexOf("knowledgeHubSection === 'structure'"),
    knowledgeHubSource.indexOf("knowledgeHubSection === 'flow'")
  )
  const flowSection = knowledgeHubSource.slice(
    knowledgeHubSource.indexOf("knowledgeHubSection === 'flow'"),
    knowledgeHubSource.indexOf("knowledgeHubSection === 'prototype'")
  )
  assert.doesNotMatch(structureSection, /knowledge-screenshot-region-box/)
  assert.match(flowSection, /knowledge-screenshot-image/)
  assert.doesNotMatch(flowSection, /knowledge-screenshot-region-box/)
  assert.match(flowSection, /prototype-hotspot-frame/)
  assert.match(flowSection, /page\.actions/)
  assert.match(styles, /\.prototype-hotspot-frame/)
  assert.doesNotMatch(styles, /\.prototype-hotspot-frame-label/)
  assert.match(styles, /\.prototype-image-frame/)

  assert.match(appSource, /const knowledgePrototypeUploadStates = reactive\(\{\}\)/)
  assert.match(appSource, /:knowledge-prototype-upload-states="knowledgePrototypeUploadStates"/)
  assert.match(appSource, /setKnowledgePrototypeUploadState\(page\.id, 'loading'/)
  assert.match(appSource, /setKnowledgePrototypeUploadState\(page\.id, 'failed'/)
  assert.match(appSource, /await persistKnowledgePrototypeAsset\(nextAsset\)/)
  assert.match(appSource, /async function persistKnowledgePrototypeAsset\(asset = \{\}\)/)
  assert.match(appSource, /await persistWorkspaceAsset\(asset\)/)
  assert.match(appSource, /state\.assets\.splice\(index, 1, savedAsset\)/)

  assert.match(knowledgeHubSource, /knowledgePrototypeUploadStatus\(node\.page\?\.id\)/)
  assert.match(knowledgeHubSource, /上传中/)
  assert.match(knowledgeHubSource, /上传失败/)
  assert.match(styles, /\.knowledge-prototype-upload-status\[data-status="loading"\]/)
  assert.match(styles, /\.knowledge-prototype-upload-status\[data-status="failed"\]/)
  assert.match(styles, /grid-template-columns:\s*minmax\(680px,\s*1\.4fr\)\s*minmax\(320px,\s*0\.6fr\)/)
  assert.match(styles, /\.prototype-demo-stage\s*\{[\s\S]*?aspect-ratio:\s*16\s*\/\s*9/)
  assert.match(styles, /\.prototype-demo-stage \.prototype-image-frame\s*\{[\s\S]*?height:\s*100%/)
})
