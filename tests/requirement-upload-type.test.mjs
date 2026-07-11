import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createWorkspaceStore, workspaceRoutes } from '../backend/routes/workspace.js'

test('requirement upload keeps documents out of knowledge until explicit deposit', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const requirementPanelStart = appSource.indexOf('<RequirementDocumentsPanel')
  const requirementPanelEnd = appSource.indexOf('/>', requirementPanelStart)
  const requirementPanelSource = appSource.slice(requirementPanelStart, requirementPanelEnd)
  const knowledgePanelStart = appSource.indexOf('<KnowledgeHubPanel')
  const knowledgePanelEnd = appSource.indexOf('/>', knowledgePanelStart)
  const knowledgePanelSource = appSource.slice(knowledgePanelStart, knowledgePanelEnd)
  const importMaterialSource = appSource.slice(
    appSource.indexOf('async function importMaterialFiles'),
    appSource.indexOf('async function importBlueprintToKnowledge')
  )

  assert.match(requirementPanelSource, /@import-material-files="\(\s*event\s*\)\s*=>\s*importMaterialFiles\(event,\s*'requirements'\)"/)
  assert.match(knowledgePanelSource, /@import-material-files="\(\s*event\s*\)\s*=>\s*importMaterialFiles\(event,\s*'knowledge'\)"/)
  assert.match(importMaterialSource, /async function importMaterialFiles\(event,\s*explicitType\s*=\s*''\)/)
  assert.match(importMaterialSource, /const importType = explicitType \|\| materialsTab\.value/)
  assert.match(importMaterialSource, /type:\s*importType/)
  assert.match(importMaterialSource, /requirementSource:\s*importType === 'requirements' \? 'product' : ''/)
  assert.match(importMaterialSource, /refreshMaterialsFromBackend\(importType\)/)

  const afterFrozenType = importMaterialSource.slice(
    importMaterialSource.indexOf('const importType') + 'const importType = explicitType || materialsTab.value'.length
  )
  assert.doesNotMatch(afterFrozenType, /materialsTab\.value/)
})

test('deleting a deposited requirement keeps its independent knowledge material', async () => {
  const store = createWorkspaceStore()
  const routes = workspaceRoutes(store)
  const projectId = 'project-flow'

  await routes['POST /api/workspace/materials']({
    id: 'requirement-deposited',
    projectId,
    type: 'requirements',
    title: '已沉淀需求',
    content: '需求正文',
    knowledgeStatus: 'converted',
    knowledgeMaterialId: 'knowledge-from-requirement'
  })
  await routes['POST /api/workspace/materials']({
    id: 'knowledge-from-requirement',
    projectId,
    type: 'knowledge',
    title: '从需求沉淀的知识',
    content: '可复用知识正文',
    sourceType: 'requirements',
    sourceMaterialId: 'requirement-deposited'
  })

  await routes['DELETE /api/workspace/materials/:id']({ id: 'requirement-deposited' })

  const requirements = await routes['GET /api/workspace/materials']({ projectId, type: 'requirements' })
  const knowledge = await routes['GET /api/workspace/materials']({ projectId, type: 'knowledge' })

  assert.deepEqual(requirements.materials.map((item) => item.id), [])
  assert.deepEqual(knowledge.materials.map((item) => item.id), ['knowledge-from-requirement'])
  assert.equal(knowledge.materials[0].sourceMaterialId, 'requirement-deposited')
})
