import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { initialMaterialsTabFromHash } from '../frontend/src/app/routes.js'
import { getCurrentStep } from '../frontend/src/services/workflows.js'

test('sidebar switching restores state from the synced project route', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const switchStart = appSource.indexOf('function switchView')
  const switchEnd = appSource.indexOf('function openSnapshotAsset', switchStart)
  const switchSource = appSource.slice(switchStart, switchEnd)

  assert.match(switchSource, /applyRouteState\(key\)/)
  assert.match(switchSource, /syncRouteToView\(key\)/)
  assert.match(switchSource, /const syncedProjectRoute = parseProjectScopedHash\(window\.location\.hash\)/)
  assert.match(switchSource, /if \(syncedProjectRoute\) restoreProjectScopedRoute\(syncedProjectRoute\)/)
})

test('project knowledge route initializes the materials tab to knowledge', async () => {
  assert.equal(initialMaterialsTabFromHash('#/projects/project-jogg/knowledge'), 'knowledge')
  assert.equal(initialMaterialsTabFromHash('#/projects/project-jogg/requirements'), 'requirements')
  assert.equal(initialMaterialsTabFromHash('#/projects/project-jogg/competitors'), 'requirements')
  assert.equal(initialMaterialsTabFromHash('#/knowledge'), 'knowledge')

  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  assert.match(appSource, /initialMaterialsTabFromHash as resolveInitialMaterialsTabFromHash/)
  assert.match(appSource, /function initialMaterialsTabFromHash\(\)/)
  assert.match(appSource, /const materialsTab = ref\(initialMaterialsTabFromHash\(\)\)/)
})

test('sidebar exposes a dedicated competitor analysis entry and project route', async () => {
  const navigationSource = await readFile(new URL('../frontend/src/services/navigation.js', import.meta.url), 'utf8')
  const routeSource = await readFile(new URL('../frontend/src/app/routes.js', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')

  assert.match(navigationSource, /key: 'competitorAnalysis', label: '竞品分析'/)
  assert.match(routeSource, /competitorAnalysis: '\/projects\/:projectId\/competitor-analysis'/)
  assert.match(appSource, /CompetitorAnalysisPage/)
  assert.match(appSource, /activeView === 'competitorAnalysis'/)
  assert.match(appSource, /route === '\/competitor-analysis'/)
})

test('project scoped route cannot switch to a project outside the hydrated account', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const applyStart = appSource.indexOf('function applyProjectIdFromRoute')
  const applyEnd = appSource.indexOf('function isFactoryHash', applyStart)
  const applySource = appSource.slice(applyStart, applyEnd)
  const hydrateStart = appSource.indexOf('async function hydrateWorkspaceFromBackend()')
  const hydrateEnd = appSource.indexOf('function createRunRecord', hydrateStart)
  const hydrateSource = appSource.slice(hydrateStart, hydrateEnd)

  assert.match(appSource, /function accountProjectIdFromRoute/)
  assert.match(applySource, /const accountProjectId = accountProjectIdFromRoute\(projectId\)/)
  assert.match(applySource, /if \(!accountProjectId \|\| state\.currentProjectId === accountProjectId\) return/)
  assert.match(applySource, /state\.currentProjectId = accountProjectId/)
  assert.match(hydrateSource, /const routeProjectId = accountProjectIdFromRoute\([\s\S]*?backendProjects[\s\S]*?result\.data\.currentUserId/)
  assert.doesNotMatch(hydrateSource, /currentProjectId:\s*hydratedProjectRoute\?\.projectId/)
  assert.match(hydrateSource, /currentProjectId:\s*routeProjectId \|\| result\.data\.currentProjectId \|\| state\.currentProjectId/)
})

test('route pushState reapplies project-scoped page state after changing the hash', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const syncStart = appSource.indexOf('function syncRouteToView')
  const syncEnd = appSource.indexOf('function applyRouteState', syncStart)
  const syncSource = appSource.slice(syncStart, syncEnd)

  assert.match(syncSource, /window\.history\.pushState/)
  assert.match(syncSource, /window\.history\.replaceState/)
  assert.match(syncSource, /refreshCurrentLocationHash\(\)/)
  assert.match(syncSource, /restoreAppRouteFromUrl\(\)/)
})

test('workflow current step tolerates analysis records without steps', () => {
  assert.deepEqual(getCurrentStep({ id: 'analysis-only-run', currentStepId: '' }), null)
  assert.deepEqual(getCurrentStep({ id: 'empty-run', currentStepId: '', steps: [] }), null)
})

test('competitor report quick analysis routes to design agent with markdown attachment', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const handlerStart = appSource.indexOf('async function handleCompetitorReportQuickAnalyze')
  const handlerEnd = appSource.indexOf('function switchView', handlerStart)
  const handlerSource = appSource.slice(handlerStart, handlerEnd)

  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, 'quick analysis handler should be present')
  assert.match(appSource, /@quick-analyze-report="handleCompetitorReportQuickAnalyze"/)
  assert.match(handlerSource, /activeView\.value = 'workflow'/)
  assert.match(handlerSource, /syncRouteToView\('workflow'\)/)
  assert.match(handlerSource, /await startWorkflowRun\(\{ auto: true \}\)/)
  assert.match(handlerSource, /ensureWorkflowReferenceFiles\(targetScopeId\)/)
  assert.match(handlerSource, /kind:\s*'document'/)
  assert.match(handlerSource, /type:\s*'text\/markdown'/)
  assert.match(handlerSource, /text:\s*content/)
  assert.match(handlerSource, /await sendWorkflowAgentMessage\('分析这个文档'/)
  assert.match(handlerSource, /attachmentIds:\s*\[reference\.id\]/)
  assert.match(handlerSource, /action:\s*'competitor-report-quick-analysis'/)
})

test('workflow agent stream sends captured attachment references after composer cleanup', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const streamStart = appSource.indexOf('async function persistWorkflowAgentMessageStream')
  const streamEnd = appSource.indexOf('function workflowAgentLayoutOptionSelection', streamStart)
  const streamSource = appSource.slice(streamStart, streamEnd)

  assert.ok(streamStart >= 0 && streamEnd > streamStart, 'stream persistence should be present')
  assert.match(streamSource, /const requestReferences = Array\.isArray\(options\.references\) \? options\.references : workflowAgentReferencePayload\(scopeId\)/)
  assert.match(streamSource, /references:\s*requestReferences/)
})
