import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('knowledge structure tab is a clean connected framework overview canvas', async () => {
  const knowledgeHubSource = await readFile(new URL('../frontend/src/pages/knowledge/KnowledgeHubPanel.vue', import.meta.url), 'utf8')
  const knowledgeHubService = await readFile(new URL('../frontend/src/services/knowledgeHub.js', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(knowledgeHubService, /key:\s*'structure',\s*label:\s*'框架全览'/)
  assert.doesNotMatch(knowledgeHubService, /label:\s*'结构树'/)

  const structureSection = knowledgeHubSource.slice(
    knowledgeHubSource.indexOf("knowledgeHubSection === 'structure'"),
    knowledgeHubSource.indexOf("knowledgeHubSection === 'flow'")
  )

  assert.doesNotMatch(structureSection, />项目框架全览</)
  assert.doesNotMatch(structureSection, /knowledge-canvas-toolbar/)
  assert.doesNotMatch(structureSection, /adjust-knowledge-canvas-zoom/)
  assert.doesNotMatch(structureSection, /expand-all-knowledge-nodes/)
  assert.doesNotMatch(structureSection, />结构树</)
  assert.match(structureSection, /knowledge-framework-map-viewport/)
  assert.match(structureSection, /ref="knowledgeFrameworkViewportRef"/)
  assert.match(structureSection, /knowledge-framework-root-node/)
  assert.match(structureSection, /data-framework-node-id="__root"/)
  assert.match(structureSection, /knowledgeFrameworkBranches/)
  assert.match(structureSection, /knowledge-framework-branch-node/)
  assert.match(structureSection, /knowledge-framework-child-columns/)
  assert.match(structureSection, /knowledgeFrameworkBranchColumns/)
  assert.match(structureSection, /knowledge-framework-leaf-node/)
  assert.doesNotMatch(structureSection, /knowledge-framework-child-list/)
  assert.match(structureSection, /knowledge-framework-connectors/)
  assert.match(structureSection, /knowledgeFrameworkConnectorPaths/)
  assert.match(structureSection, /knowledgeFrameworkConnectorPathD/)
  assert.doesNotMatch(structureSection, /knowledge-framework-inspector/)
  assert.doesNotMatch(structureSection, /节点信息/)
  assert.doesNotMatch(structureSection, /查看关联流程/)
  assert.doesNotMatch(structureSection, /截图定位<\/p>\s*<h4>\{\{ selectedKnowledgeNodeVisualContext/)

  assert.match(knowledgeHubSource, /const knowledgeFrameworkBranches = computed/)
  assert.match(knowledgeHubSource, /function knowledgeFrameworkBranchColumns/)
  assert.match(knowledgeHubSource, /const knowledgeFrameworkConnectorPaths = ref\(\[\]\)/)
  assert.match(knowledgeHubSource, /function updateKnowledgeFrameworkConnectors/)
  assert.match(knowledgeHubSource, /getBoundingClientRect\(\)/)
  assert.match(knowledgeHubSource, /ResizeObserver/)
  assert.match(knowledgeHubSource, /watch\(\s*\(\)\s*=>\s*\[/)

  assert.match(styles, /\.knowledge-framework-map-viewport/)
  assert.match(styles, /\.knowledge-framework-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/)
  assert.match(styles, /\.knowledge-framework-map\s*\{[\s\S]*?grid-template-columns:\s*260px minmax\(880px, max-content\)/)
  assert.match(styles, /\.knowledge-framework-connectors\s*\{[\s\S]*?pointer-events:\s*none/)
  assert.match(styles, /\.knowledge-framework-connector\s*\{[\s\S]*?stroke:\s*#cfd8e6/)
  assert.match(styles, /\.knowledge-framework-branch\s*\{[\s\S]*?grid-template-columns:\s*320px minmax\(280px, max-content\)/)
  assert.match(styles, /\.knowledge-framework-child-columns\s*\{[\s\S]*?grid-auto-flow:\s*column/)
  assert.match(styles, /\.knowledge-framework-child-columns\s*\{[\s\S]*?grid-auto-columns:\s*280px/)
  assert.doesNotMatch(styles, /\.knowledge-framework-root-node::after/)
  assert.doesNotMatch(styles, /\.knowledge-framework-branches::before/)
  assert.doesNotMatch(styles, /\.knowledge-framework-leaf-node::before/)
})
