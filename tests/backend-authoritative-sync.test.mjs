import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  DEFAULT_PROJECT_ID,
  normalizeWorkspaceState
} from '../frontend/src/services/projectWorkspace.js'

test('backend hydration uses backend restored pages as the authoritative list while preserving loaded html details', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const hydrateStart = appSource.indexOf('async function hydrateWorkspaceFromBackend')
  const hydrateEnd = appSource.indexOf('async function persistWorkspaceRun', hydrateStart)
  const hydrateSource = appSource.slice(hydrateStart, hydrateEnd)

  assert.match(hydrateSource, /const remoteRestoredPages = Array\.isArray\(result\.data\.restoredPages\) \? result\.data\.restoredPages : \[\]/)
  assert.match(hydrateSource, /normalizeFactoryWorkspace\(\{[\s\S]*restoredPages:\s*remoteRestoredPages[\s\S]*\},\s*\{\s*previousRestoredPages:\s*state\.restoredPages\s*\}\)/)
  assert.match(hydrateSource, /restoredPages:\s*normalizedFactoryWorkspace\.restoredPages/)
  assert.doesNotMatch(hydrateSource, /restoredPages:\s*mergeById\(state\.restoredPages,\s*remoteRestoredPages\)/)
})

test('factory restored assets resync from backend when the page becomes visible again', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')

  assert.match(appSource, /function refreshFactoryRestoredPagesFromBackend\(\)/)
  assert.match(appSource, /document\.addEventListener\('visibilitychange',\s*refreshFactoryRestoredPagesFromBackend\)/)
  assert.match(appSource, /window\.addEventListener\('focus',\s*refreshFactoryRestoredPagesFromBackend\)/)
  assert.match(appSource, /document\.removeEventListener\('visibilitychange',\s*refreshFactoryRestoredPagesFromBackend\)/)
  assert.match(appSource, /window\.removeEventListener\('focus',\s*refreshFactoryRestoredPagesFromBackend\)/)
})

test('backend hydration does not recreate a deleted default project', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const hydrateStart = appSource.indexOf('async function hydrateWorkspaceFromBackend')
  const hydrateEnd = appSource.indexOf('async function persistWorkspaceRun', hydrateStart)
  const hydrateSource = appSource.slice(hydrateStart, hydrateEnd)

  assert.match(hydrateSource, /normalizeWorkspaceState\(\{[\s\S]*\},\s*\{\s*includeDefaultProject:\s*false\s*\}\)/)

  const state = normalizeWorkspaceState({
    currentProjectId: DEFAULT_PROJECT_ID,
    currentUserId: 'user-local-default',
    users: [{ id: 'user-local-default', name: '流程通用户' }],
    projects: [{ id: 'project-chanjing', ownerUserId: 'user-local-default', name: '蝉镜' }],
    assets: [],
    restoredPages: []
  }, { includeDefaultProject: false })

  assert.deepEqual(state.projects.map((project) => project.id), ['project-chanjing'])
  assert.equal(state.currentProjectId, 'project-chanjing')
  assert.ok(!state.projects.some((project) => project.id === DEFAULT_PROJECT_ID))
})
