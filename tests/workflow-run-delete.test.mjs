import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRouteMatcher } from '../backend/server/route-matcher.mjs'
import { createWorkspaceStore, workspaceRoutes } from '../backend/routes/workspace.js'

test('backend deletes workflow run assets by id', async () => {
  const store = createWorkspaceStore()
  const routes = workspaceRoutes(store)
  await routes['POST /api/workspace/workflow-runs']({
    id: 'workflow-delete-me',
    projectId: 'project-flow',
    workflowId: 'total-design-flow',
    workflowName: '待删除设计方案',
    status: 'analyzed',
    documentAnalysis: {
      canvas: {
        nodes: [{ id: 'analysis', title: '待删除画布' }],
        edges: []
      }
    }
  })

  const deleted = await routes['DELETE /api/workspace/workflow-runs/:id']({ id: 'workflow-delete-me' })
  const workspace = await routes['GET /api/workspace']()

  assert.deepEqual(deleted, { id: 'workflow-delete-me', deleted: true })
  assert.equal(workspace.workflowRuns.some((run) => run.id === 'workflow-delete-me'), false)
})

test('mock api route matcher resolves workflow run delete requests', () => {
  const routes = {
    'DELETE /api/workspace/workflow-runs/:id': (payload) => payload
  }
  const handler = createRouteMatcher(routes)('DELETE', '/api/workspace/workflow-runs/workflow-delete-me')

  assert.ok(handler)
  assert.deepEqual(
    handler({}, null, new URL('http://local/api/workspace/workflow-runs/workflow-delete-me')),
    { id: 'workflow-delete-me' }
  )
})

test('frontend workflow run delete API and backend authoritative hydration are wired', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../frontend/src/services/api.js', import.meta.url), 'utf8')
  const hydrateStart = appSource.indexOf('async function hydrateWorkspaceFromBackend')
  const hydrateEnd = appSource.indexOf('async function persistWorkspaceRun', hydrateStart)
  const hydrateSource = appSource.slice(hydrateStart, hydrateEnd)
  const pollingStart = appSource.indexOf('function startWorkflowAnalysisDeepLinkPolling')
  const pollingEnd = appSource.indexOf('async function loadWorkflowRunDetail', pollingStart)
  const pollingSource = appSource.slice(pollingStart, pollingEnd)

  assert.match(apiSource, /deleteWorkflowRun\(config,\s*runId\)/)
  assert.match(apiSource, /method:\s*'DELETE'/)
  assert.match(hydrateSource, /const remoteWorkflowRuns = Array\.isArray\(result\.data\.workflowRuns\) \? result\.data\.workflowRuns : \[\]/)
  assert.match(hydrateSource, /workflowRuns:\s*remoteWorkflowRuns/)
  assert.doesNotMatch(hydrateSource, /workflowRuns:\s*mergeWorkflowRunRecords/)
  assert.match(pollingSource, /state\.workflowRuns = Array\.isArray\(result\.data\.workflowRuns\) \? result\.data\.workflowRuns : \[\]/)
})
