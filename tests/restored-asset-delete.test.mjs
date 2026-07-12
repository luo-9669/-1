import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createWorkspaceStore, workspaceRoutes } from '../backend/routes/workspace.js'

test('backend deletes restored page assets by id', async () => {
  const store = createWorkspaceStore()
  const routes = workspaceRoutes(store)
  await routes['POST /api/workspace/restored-pages']({
    id: 'restored-delete-me',
    projectId: 'project-flow',
    title: '待删除资产',
    html: '<main>delete me</main>'
  })

  const deleted = await routes['DELETE /api/workspace/restored-pages/:id']({ id: 'restored-delete-me' })
  const workspace = await routes['GET /api/workspace']()

  assert.deepEqual(deleted, { id: 'restored-delete-me', deleted: true })
  assert.equal(workspace.restoredPages.some((page) => page.id === 'restored-delete-me'), false)
})

test('backend deletes restored page assets by temporary image html task id', async () => {
  const store = createWorkspaceStore()
  const routes = workspaceRoutes(store)
  await routes['POST /api/workspace/restored-pages']({
    id: 'restored-final-id',
    projectId: 'project-flow',
    title: '临时预览资产',
    clientTaskId: 'image-html-client-1',
    captureResult: { taskId: 'image-html-capture-1' },
    html: '<main>delete by bridge id</main>'
  })

  const deletedByClientTaskId = await routes['DELETE /api/workspace/restored-pages/:id']({ id: 'image-html-client-1' })
  const workspaceAfterClientTaskDelete = await routes['GET /api/workspace']()

  assert.deepEqual(deletedByClientTaskId, { id: 'image-html-client-1', deleted: true })
  assert.equal(workspaceAfterClientTaskDelete.restoredPages.some((page) => page.id === 'restored-final-id'), false)

  await routes['POST /api/workspace/restored-pages']({
    id: 'restored-final-id-2',
    projectId: 'project-flow',
    title: '临时预览资产 2',
    captureResult: { taskId: 'image-html-capture-2' },
    html: '<main>delete by capture task id</main>'
  })

  const deletedByCaptureTaskId = await routes['DELETE /api/workspace/restored-pages/:id']({ id: 'image-html-capture-2' })
  const workspaceAfterCaptureTaskDelete = await routes['GET /api/workspace']()

  assert.deepEqual(deletedByCaptureTaskId, { id: 'image-html-capture-2', deleted: true })
  assert.equal(workspaceAfterCaptureTaskDelete.restoredPages.some((page) => page.id === 'restored-final-id-2'), false)
})

test('workspace restored page overview derives urls from current id and keeps html marker', async () => {
  const store = createWorkspaceStore()
  const routes = workspaceRoutes(store)
  await routes['POST /api/workspace/restored-pages']({
    id: 'restored-current-id',
    projectId: 'project-flow',
    title: '可预览资产',
    html: '<main>preview me</main>',
    frameUrl: '/api/workspace/restored-pages/restored-old-id/frame',
    previewUrl: '/api/workspace/restored-pages/restored-old-id/preview',
    sourceUrlPath: '/api/workspace/restored-pages/restored-old-id/source'
  })

  const workspace = await routes['GET /api/workspace']()
  const page = workspace.restoredPages.find((item) => item.id === 'restored-current-id')

  assert.equal(page.hasHtml, true)
  assert.equal(page.html, '')
  assert.deepEqual(page.files, [])
  assert.equal(page.frameUrl, '/api/workspace/restored-pages/restored-current-id/frame')
  assert.equal(page.previewUrl, '/api/workspace/restored-pages/restored-current-id/preview')
  assert.equal(page.sourceUrlPath, '/api/workspace/restored-pages/restored-current-id/source')
})

test('workspace restored page download returns the generated html file', async () => {
  const store = createWorkspaceStore()
  const routes = workspaceRoutes(store)
  await routes['POST /api/workspace/restored-pages']({
    id: 'restored-download-id',
    projectId: 'project-flow',
    title: '可下载资产',
    html: '<main>download me</main>'
  })

  const response = await routes['GET /api/workspace/restored-pages/:id/download']({ id: 'restored-download-id' })

  assert.equal(response.contentType, 'text/html; charset=utf-8')
  assert.equal(response.body, '<main>download me</main>')
  assert.equal(response.headers['Content-Disposition'], "attachment; filename*=UTF-8''%E5%8F%AF%E4%B8%8B%E8%BD%BD%E8%B5%84%E4%BA%A7.html")
})

test('restored asset cards expose a hover delete action without opening detail', async () => {
  const panelSource = await readFile(new URL('../frontend/src/pages/factory/FactoryHomePanel.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../frontend/src/services/api.js', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(panelSource, /class="restored-card-delete"/)
  assert.match(panelSource, /@click\.stop\.prevent="\$emit\('delete-restored-page', page\)"/)
  assert.match(panelSource, /@load="\$emit\('restored-page-frame-load', page, \$event\)"/)
  assert.match(panelSource, /删除资产/)
  assert.doesNotMatch(panelSource, /<span>\s*删除资产\s*<\/span>/)
  assert.match(panelSource, /Trash2/)
  assert.match(panelSource, /page\.hasHtml/)
  assert.match(appSource, /@delete-restored-page="deleteRestoredPageAsset"/)
  assert.match(appSource, /@restored-page-frame-load="handleRestoredPageFrameLoad"/)
  assert.match(appSource, /async function deleteRestoredPageAsset\(page = \{\}\)/)
  assert.match(appSource, /function handleRestoredPageFrameLoad\(page = \{\}, event = null\)/)
  assert.match(appSource, /还原页面不存在|RESTORED_PAGE_NOT_FOUND/)
  assert.match(apiSource, /deleteRestoredPage\(config, id\)/)
  assert.match(apiSource, /method:\s*'DELETE'/)
  assert.match(cssSource, /\.restored-page-card:hover \.restored-card-delete/)
  assert.match(cssSource, /\.restored-card-delete:hover/)
  assert.match(cssSource, /\.restored-card-delete:focus-visible/)
  assert.match(cssSource, /\.restored-card-delete:active/)
  assert.match(cssSource, /\.restored-card-delete[\s\S]*color:\s*#fff/)
})
