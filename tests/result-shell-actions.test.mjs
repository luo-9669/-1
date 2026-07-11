import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('result shell keeps download button on the far right and back button returns home directly', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')

  assert.match(appSource, /<button type="button" id="convert-vue">转 Vue 代码<\/button>[\s\S]*<a class="primary" id="download-source" download="\$\{escapeHtmlAttr\(downloadName\)\}" href="#">下载 HTML<\/a>/)
  assert.match(appSource, /const backTargetUrl = '\/#\$\{escapeHtmlAttr\(homeUrl\)\}'/)
  assert.match(appSource, /backHome\.addEventListener\('click',\s*\(\)\s*=>\s*\{[\s\S]*window\.top\.location\.replace\(backTargetUrl\)[\s\S]*window\.location\.replace\(backTargetUrl\)/)
  assert.doesNotMatch(appSource, /history\.back\(/)
})

test('standalone restored page preview stays on the app-owned preview route', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const standaloneStart = appSource.indexOf('async function openRestoredPageStandalone')
  const standaloneEnd = appSource.indexOf('async function loadStandalonePreviewRoute', standaloneStart)
  const standaloneSource = appSource.slice(standaloneStart, standaloneEnd)

  assert.match(standaloneSource, /const previewWindow = window\.open\(restoredPageDetailHref\(pageId\),\s*'_blank'\)/)
  assert.doesNotMatch(standaloneSource, /writeStaticHtmlPreviewWindow\(/)
  assert.doesNotMatch(standaloneSource, /document\.write/)
})
