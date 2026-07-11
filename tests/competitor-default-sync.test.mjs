import assert from 'node:assert/strict'
import test from 'node:test'

import { createCompetitorMonitorService } from '../backend/services/competitor-monitor-service.js'
import { createWorkspaceStore } from '../backend/services/workspace-store.js'

test('competitor list initializes python default competitors into the project competitor table', async () => {
  const store = createWorkspaceStore({
    currentProjectId: 'project-default-sync',
    projects: [{ id: 'project-default-sync', name: '默认同步项目' }],
    competitors: [],
    monitorTasks: []
  })
  const service = createCompetitorMonitorService({
    store,
    now: () => '2026-07-11T00:00:00.000Z'
  })

  const competitors = await service.listCompetitors({ projectId: 'project-default-sync' })

  assert.deepEqual(competitors.map((item) => item.name).sort((a, b) => a.localeCompare(b, 'zh-CN')), [
    'HeyGen',
    'Higgsfield AI',
    'Riverside',
    '创客贴',
    '稿定设计'
  ].sort((a, b) => a.localeCompare(b, 'zh-CN')))
  assert.ok(store.competitors.some((item) => item.name === '创客贴' && item.websiteUrl === 'https://www.chuangkit.com'))
  assert.ok(store.competitors.some((item) => item.name === '稿定设计' && item.websiteUrl === 'https://www.gaoding.com'))
  assert.equal(store.monitorTasks.filter((item) => item.projectId === 'project-default-sync').length, 5)
})

test('competitor list keeps user competitors and does not duplicate matching python defaults', async () => {
  const store = createWorkspaceStore({
    currentProjectId: 'project-default-sync-custom',
    projects: [{ id: 'project-default-sync-custom', name: '默认同步项目' }],
    competitors: [{
      id: 'competitor-user-heygen',
      projectId: 'project-default-sync-custom',
      module: 'competitors',
      name: 'Heygen',
      websiteUrl: 'https://www.heygen.com/',
      status: 'active',
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z'
    }, {
      id: 'competitor-user-new',
      projectId: 'project-default-sync-custom',
      module: 'competitors',
      name: '新增竞品',
      websiteUrl: 'https://new.example.com',
      status: 'active',
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z'
    }],
    monitorTasks: []
  })
  const service = createCompetitorMonitorService({
    store,
    now: () => '2026-07-11T00:00:00.000Z'
  })

  const competitors = await service.listCompetitors({ projectId: 'project-default-sync-custom' })
  const names = competitors.map((item) => item.name)

  assert.equal(names.filter((name) => name.toLowerCase() === 'heygen').length, 1)
  assert.ok(names.includes('新增竞品'))
  assert.ok(names.includes('创客贴'))
  assert.equal(competitors.length, 6)
})

test('competitors can be updated and deleted without restoring deleted defaults', async () => {
  const store = createWorkspaceStore({
    currentProjectId: 'project-competitor-crud',
    projects: [{ id: 'project-competitor-crud', name: '竞品 CRUD 项目' }],
    competitors: [],
    monitorTasks: []
  })
  const service = createCompetitorMonitorService({
    store,
    now: () => '2026-07-11T00:00:00.000Z'
  })

  const initialCompetitors = await service.listCompetitors({ projectId: 'project-competitor-crud' })
  const defaultHeyGen = initialCompetitors.find((item) => item.name === 'HeyGen')
  assert.ok(defaultHeyGen, 'default HeyGen competitor should exist before deletion')

  const custom = await service.createCompetitor({
    projectId: 'project-competitor-crud',
    name: '新增竞品',
    websiteUrl: 'https://old.example.com'
  })
  const updated = await service.updateCompetitor({
    projectId: 'project-competitor-crud',
    competitorId: custom.id,
    name: '更新后的竞品',
    websiteUrl: 'https://new.example.com'
  })

  assert.equal(updated.id, custom.id)
  assert.equal(updated.name, '更新后的竞品')
  assert.equal(updated.websiteUrl, 'https://new.example.com')

  const deletedCustom = await service.deleteCompetitor({
    projectId: 'project-competitor-crud',
    competitorId: custom.id
  })
  assert.equal(deletedCustom.deleted, true)
  assert.equal((await service.listCompetitors({ projectId: 'project-competitor-crud' })).some((item) => item.id === custom.id), false)

  const deletedDefault = await service.deleteCompetitor({
    projectId: 'project-competitor-crud',
    competitorId: defaultHeyGen.id
  })
  assert.equal(deletedDefault.deleted, true)

  const afterDefaultDelete = await service.listCompetitors({ projectId: 'project-competitor-crud' })
  assert.equal(afterDefaultDelete.some((item) => item.name === 'HeyGen'), false)
  assert.ok(store.competitors.some((item) => item.id === defaultHeyGen.id && item.status === 'deleted'))
})

test('competitor list hides migrated duplicate defaults and prefers manual competitors', async () => {
  const store = createWorkspaceStore({
    currentProjectId: 'project-competitor-dedupe',
    projects: [{ id: 'project-competitor-dedupe', name: '竞品去重项目' }],
    competitors: [{
      id: 'competitor-default-project-flow-heygen',
      projectId: 'project-competitor-dedupe',
      module: 'competitors',
      name: 'HeyGen',
      websiteUrl: 'https://www.heygen.com',
      status: 'active',
      tags: ['python-default'],
      createdAt: '2026-07-11T06:50:00.000Z',
      updatedAt: '2026-07-11T06:50:00.000Z'
    }, {
      id: 'competitor-default-project-competitor-dedupe-heygen',
      projectId: 'project-competitor-dedupe',
      module: 'competitors',
      name: 'HeyGen',
      websiteUrl: 'https://www.heygen.com',
      status: 'active',
      tags: ['python-default'],
      createdAt: '2026-07-11T07:00:00.000Z',
      updatedAt: '2026-07-11T07:00:00.000Z'
    }, {
      id: 'competitor-user-heygen',
      projectId: 'project-competitor-dedupe',
      module: 'competitors',
      name: 'Heygen',
      websiteUrl: 'https://www.heygen.com/',
      status: 'active',
      tags: [],
      createdAt: '2026-07-11T07:10:00.000Z',
      updatedAt: '2026-07-11T07:10:00.000Z'
    }],
    monitorTasks: []
  })
  const service = createCompetitorMonitorService({
    store,
    now: () => '2026-07-11T08:00:00.000Z'
  })

  const competitors = await service.listCompetitors({ projectId: 'project-competitor-dedupe' })
  const heygenRows = competitors.filter((item) => item.name.toLowerCase() === 'heygen')

  assert.equal(heygenRows.length, 1)
  assert.equal(heygenRows[0].id, 'competitor-user-heygen')
  assert.equal(heygenRows[0].tags.includes('python-default'), false)
})
