import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('project package import can run the uploaded project and import its live preview', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../frontend/src/services/api.js', import.meta.url), 'utf8')
  const mockApiSource = await readFile(new URL('../backend/server/mock-api.mjs', import.meta.url), 'utf8')

  assert.match(apiSource, /startProjectRuntime\(config, payload\)/)
  assert.match(apiSource, /\/api\/workspace\/project-runtime\/start/)
  assert.match(apiSource, /stopProjectRuntime\(config, payload\)/)
  assert.match(apiSource, /\/api\/workspace\/project-runtime\/stop/)
  assert.match(mockApiSource, /createProjectRuntimeService/)
  assert.match(mockApiSource, /projectRuntimeService/)

  assert.match(appSource, /projectRuntimePreview/)
  assert.match(appSource, /运行并采集真实链路/)
  assert.match(appSource, /startProjectPackageRuntimeAndImport/)
  assert.match(appSource, /api\.workspace\.startProjectRuntime/)
  assert.match(appSource, /api\.workspace\.importWebsiteMaterials/)
  assert.match(appSource, /url:\s*runtime\.url/)
  assert.match(appSource, /generateBlueprint:\s*true/)
  assert.match(appSource, /stopProjectRuntimePreview/)
  assert.match(appSource, /api\.workspace\.stopProjectRuntime/)
  assert.match(appSource, /PROJECT_PACKAGE_MAX_FILES = 4000/)
  assert.match(appSource, /ya\?ml/)
  assert.match(appSource, /webmanifest/)
  assert.match(appSource, /svg/)
  assert.match(appSource, /ico/)
})
