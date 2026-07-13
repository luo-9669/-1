import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createImageToHtmlService } from '../backend/services/image-to-html-service.js'

const screenshotDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

test('image-to-html keeps generated HTML previewable when visual similarity fails', async () => {
  const html = '<!doctype html><html><body><main><h1>流程通页面</h1><button>开始</button></main></body></html>'
  const persisted = []
  const service = createImageToHtmlService({
    resolveAgentProvider: () => ({
      name: 'fake-vision-model',
      async generate() {
        return {
          content: JSON.stringify({
            visualModel: { source: { type: 'screenshot', title: '流程通页面', target: 'static-html', hasImage: true } },
            html,
            summary: '模型返回了可预览 HTML。'
          }),
          provider: 'fake-vision-model',
          model: 'vision-test',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
        }
      }
    }),
    verifyGeneratedPage: async (captureResult) => ({
      url: captureResult.url,
      status: 'failed',
      thresholds: { mode: 'backend-rendered-html' },
      summary: { total: 1, passed: 0, failed: 1, averageScore: 17.38 },
      results: [],
      recommendations: ['desktop 1440px 未达标：相似度 17.38，差异像素 62.78%']
    }),
    persistRestoredPage: async (asset) => {
      const saved = { ...asset, id: 'failed-preview-asset' }
      persisted.push(saved)
      return saved
    }
  })

  const result = await service.generate({
    projectId: 'project-flow',
    title: '流程通页面',
    target: 'static-html',
    imageDataUrl: screenshotDataUrl
  })

  assert.equal(result.status, 'failed')
  assert.equal(result.ok, false)
  assert.equal(result.html, html)
  assert.equal(result.restoredPage.id, 'failed-preview-asset')
  assert.equal(result.restoredPage.html, html)
  assert.equal(result.restoredPage.visualVerification.status, 'failed')
  assert.equal(result.restoredPage.restoreQuality, 'failed')
  assert.match(result.restoredPage.failureReason, /相似度 17\.38/)
  assert.equal(persisted.length, 1)
})

test('image-to-html vision generation prefers non-stream model calls for deploy reliability', async () => {
  const html = '<!doctype html><html><body><main><h1>非流式生成</h1></main></body></html>'
  let generateCalled = false
  const service = createImageToHtmlService({
    resolveAgentProvider: () => ({
      name: 'fake-vision-model',
      async *stream() {
        throw new Error('stream path should not be used for image-to-html vision generation')
      },
      async generate() {
        generateCalled = true
        return {
          content: JSON.stringify({
            visualModel: { source: { type: 'screenshot', title: '非流式生成', target: 'static-html', hasImage: true } },
            html,
            summary: '模型通过非流式接口返回 HTML。'
          }),
          provider: 'fake-vision-model',
          model: 'vision-test',
          usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
        }
      }
    }),
    verifyGeneratedPage: async () => ({ status: 'passed', results: [], recommendations: [] }),
    persistRestoredPage: async (asset) => ({ ...asset, id: 'non-stream-preview' })
  })

  const result = await service.generate({
    projectId: 'project-flow',
    title: '非流式生成',
    target: 'static-html',
    imageDataUrl: screenshotDataUrl
  })

  assert.equal(generateCalled, true)
  assert.equal(result.html, html)
  assert.equal(result.restoredPage.id, 'non-stream-preview')
})

test('image-to-html static quality audit flags unsafe scaling and oversized fixed layout while keeping html previewable', async () => {
  const html = `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; zoom: 1.8; }
    .page { width: 2600px; transform: scale(1.4); }
    .title { font-size: 96px; }
  </style>
</head>
<body>
  <main class="page">
    <h1 class="title">巨大页面</h1>
    <img src="hero.png">
    <button>开始</button>
  </main>
</body>
</html>`
  const persisted = []
  const service = createImageToHtmlService({
    resolveAgentProvider: () => ({
      name: 'fake-vision-model',
      async generate() {
        return {
          content: JSON.stringify({
            visualModel: { source: { type: 'screenshot', title: '巨大页面', target: 'static-html', hasImage: true } },
            html,
            summary: '模型返回了 HTML。'
          }),
          provider: 'fake-vision-model',
          model: 'vision-test',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
        }
      }
    }),
    verifyGeneratedPage: async (captureResult) => ({
      url: captureResult.url,
      status: 'passed',
      thresholds: { mode: 'backend-rendered-html' },
      summary: { total: 1, passed: 1, failed: 0, averageScore: 99 },
      results: [{ id: 'desktop', width: 1440, status: 'passed', comparison: { score: 99, differentPixelRatio: 0.01, averageChannelDelta: 2, dimensionMatch: true } }],
      recommendations: []
    }),
    persistRestoredPage: async (asset) => {
      const saved = { ...asset, id: 'quality-audit-preview' }
      persisted.push(saved)
      return saved
    }
  })

  const result = await service.generate({
    projectId: 'project-flow',
    title: '巨大页面',
    target: 'static-html',
    imageDataUrl: screenshotDataUrl
  })

  assert.equal(result.status, 'failed')
  assert.equal(result.html, html)
  assert.equal(result.restoredPage.html, html)
  assert.equal(result.visualVerification.status, 'failed')
  assert.equal(result.visualVerification.qualityAudit.status, 'failed')
  assert.deepEqual(result.visualVerification.qualityAudit.viewports.map((item) => item.width), [390, 768, 1440, 1920])
  assert.match(result.message, /静态质量审查/)
  assert.match(result.visualVerification.recommendations.join('\n'), /transform: scale|zoom|固定宽度|字号|alt/)
  assert.equal(persisted.length, 1)
})

test('image-to-html static quality audit classifies density mode and flags missing interaction accessibility states', async () => {
  const html = `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    .page { max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr); }
    .hero { font-size: clamp(32px, 4vw, 56px); }
    .cards { display: flex; flex-wrap: wrap; gap: 16px; }
    @media (max-width: 768px) { .cards { display: grid; } }
  </style>
</head>
<body>
  <main class="page">
    <h1 class="hero">官网落地页</h1>
    <button>立即开始</button>
    <input placeholder="请输入邮箱">
    <a href="/demo">查看演示</a>
  </main>
</body>
</html>`
  const service = createImageToHtmlService({
    resolveAgentProvider: () => ({
      name: 'fake-vision-model',
      async generate() {
        return {
          content: JSON.stringify({
            visualModel: { source: { type: 'screenshot', title: '官网落地页', target: 'static-html', hasImage: true }, pageType: 'landing-page' },
            html,
            summary: '模型返回了 HTML。'
          }),
          provider: 'fake-vision-model',
          model: 'vision-test',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
        }
      }
    }),
    verifyGeneratedPage: async (captureResult) => ({
      url: captureResult.url,
      status: 'passed',
      thresholds: { mode: 'backend-rendered-html' },
      summary: { total: 1, passed: 1, failed: 0, averageScore: 99 },
      results: [{ id: 'desktop', width: 1440, status: 'passed', comparison: { score: 99, differentPixelRatio: 0.01, averageChannelDelta: 2, dimensionMatch: true } }],
      recommendations: []
    }),
    persistRestoredPage: async (asset) => ({ ...asset, id: 'interaction-a11y-preview' })
  })

  const result = await service.generate({
    projectId: 'project-flow',
    title: '官网落地页',
    target: 'static-html',
    prompt: '官网 landing hero 表单',
    imageDataUrl: screenshotDataUrl
  })

  assert.equal(result.status, 'failed')
  assert.equal(result.html, html)
  assert.equal(result.visualVerification.qualityAudit.pageType, 'landing-page')
  assert.equal(result.visualVerification.qualityAudit.densityMode, 'landing-editorial')
  assert.match(result.visualVerification.recommendations.join('\n'), /hover|focus|label|aria-label|点击区域/)
})

test('image-to-html failed visual verification renders the generated preview shell', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const generateStart = appSource.indexOf('async function generateFromImage')
  const generateEnd = appSource.indexOf('function openCurrentCaptureRestoredPage', generateStart)
  const generateSource = appSource.slice(generateStart, generateEnd)
  const previewStart = appSource.indexOf('function buildStaticHtmlResultShell')
  const previewEnd = appSource.indexOf('function handleImageCodeFile', previewStart)
  const previewSource = appSource.slice(previewStart, previewEnd)

  assert.match(previewSource, /视觉验收未通过，仅供排查预览/)
  assert.doesNotMatch(previewSource, /blocked-preview/)
  assert.doesNotMatch(previewSource, /已停止展示错误 HTML/)
  assert.match(previewSource, /<iframe id="generated-preview-frame" class="generated-preview-frame"/)
  assert.match(previewSource, /if \(previewFrame\) previewFrame\.srcdoc = previewHtmlForFrame\(html\)/)
  assert.match(previewSource, /download\.href = blobUrl/)
  assert.doesNotMatch(generateSource, /未通过前不会展示为正式资产/)
})

test('image-to-html stream emits preview artifact before failed status when similarity fails', async () => {
  const html = '<!doctype html><html><body><main><h1>低分但可预览</h1></main></body></html>'
  const events = []
  const service = createImageToHtmlService({
    createStreamPusher: () => ({
      push: (event, data) => events.push({ event, data }),
      body: () => events.map((item) => `event: ${item.event}\ndata: ${JSON.stringify(item.data)}`).join('\n\n')
    }),
    resolveAgentProvider: () => ({
      name: 'fake-vision-model',
      async generate() {
        return {
          content: JSON.stringify({
            visualModel: { source: { type: 'screenshot', title: '低分但可预览', target: 'static-html', hasImage: true } },
            html,
            summary: '模型返回了 HTML。'
          }),
          provider: 'fake-vision-model',
          model: 'vision-test',
          usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
        }
      }
    }),
    verifyGeneratedPage: async (captureResult) => ({
      url: captureResult.url,
      status: 'failed',
      thresholds: { mode: 'backend-rendered-html' },
      summary: { total: 1, passed: 0, failed: 1, averageScore: 16.29 },
      results: [],
      recommendations: ['desktop 1440px 未达标：相似度 16.29，差异像素 63.02%']
    }),
    persistRestoredPage: async (asset) => ({ ...asset, id: 'low-score-preview' })
  })

  await service.stream({
    projectId: 'project-flow',
    title: '低分但可预览',
    target: 'static-html',
    imageDataUrl: screenshotDataUrl
  })

  const artifactIndex = events.findIndex((item) => item.event === 'artifact')
  const failedStatusIndex = events.findIndex((item) => item.event === 'status' && item.data?.status === 'failed')
  assert.ok(artifactIndex >= 0)
  assert.ok(failedStatusIndex >= 0)
  assert.ok(artifactIndex < failedStatusIndex)
  assert.equal(events[artifactIndex].data.html, html)
  assert.equal(events[artifactIndex].data.visualVerification.status, 'failed')
})

test('image-to-html frontend does not overwrite previewable html with the later failed status event', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const generateStart = appSource.indexOf('async function generateFromImage')
  const generateEnd = appSource.indexOf('function openCurrentCaptureRestoredPage', generateStart)
  const generateSource = appSource.slice(generateStart, generateEnd)

  assert.match(generateSource, /let previewRenderedGeneratedHtml = false/)
  assert.match(generateSource, /if \(eventStatus === 'failed' && previewRenderedGeneratedHtml\) \{/)
  assert.match(generateSource, /setStatus\(imageCodeStatus,\s*'failed',\s*event\.data\.label\)/)
  assert.match(generateSource, /previewRenderedGeneratedHtml = true/)
})

test('image-to-html frontend failure page preserves network error detail and timeout context', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const generateStart = appSource.indexOf('async function generateFromImage')
  const generateEnd = appSource.indexOf('function openCurrentCaptureRestoredPage', generateStart)
  const generateSource = appSource.slice(generateStart, generateEnd)

  assert.match(generateSource, /const failureMessage = imageToHtmlExceptionMessage\(error\)/)
  assert.match(generateSource, /renderStaticHtmlPreview\(buildStaticHtmlFailurePage\('生成异常', failureMessage\)\)/)
  assert.match(appSource, /function imageToHtmlExceptionMessage\(error = {}\)/)
  assert.match(appSource, /原始错误/)
  assert.match(appSource, /不是前端等待超时/)
})

test('image-to-html real asset route reloads the document after replacing a document-written preview hash', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const helperStart = appSource.indexOf('function replaceStaticHtmlPreviewRoute')
  const helperEnd = appSource.indexOf('function buildStaticHtmlLoadingPage', helperStart)
  const helperSource = appSource.slice(helperStart, helperEnd)
  const generateStart = appSource.indexOf('async function generateFromImage')
  const generateEnd = appSource.indexOf('function openCurrentCaptureRestoredPage', generateStart)
  const generateSource = appSource.slice(generateStart, generateEnd)

  assert.match(helperSource, /const targetUrl = projectScopedUrl\(route\)/)
  assert.match(helperSource, /previewWindow\.location\.replace\(targetUrl\)/)
  assert.match(helperSource, /previewWindow\.location\.reload\(\)/)
  assert.match(helperSource, /forceReload/)
  assert.match(generateSource, /replaceStaticHtmlPreviewRoute\(previewWindow,\s*projectScopedRoute\(`\/assets\/\$\{encodeURIComponent\(restoredPage\.id\)\}\/preview`/)
})

test('image-to-html persisted restored page keeps the frontend client task id for temporary preview route resolution', async () => {
  const html = '<!doctype html><html><body><main><h1>真实资产页</h1></main></body></html>'
  const persisted = []
  const service = createImageToHtmlService({
    resolveAgentProvider: () => ({
      name: 'fake-vision-model',
      async generate() {
        return {
          content: JSON.stringify({
            visualModel: { source: { type: 'screenshot', title: '真实资产页', target: 'static-html', hasImage: true } },
            html,
            summary: '模型返回了可预览 HTML。'
          }),
          provider: 'fake-vision-model',
          model: 'vision-test',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
        }
      }
    }),
    verifyGeneratedPage: async (captureResult) => ({
      url: captureResult.url,
      status: 'passed',
      thresholds: { mode: 'backend-rendered-html' },
      summary: { total: 1, passed: 1, failed: 0, averageScore: 98.4 },
      results: [],
      recommendations: []
    }),
    persistRestoredPage: async (asset) => {
      const saved = { ...asset, id: 'real-restored-page-id' }
      persisted.push(saved)
      return saved
    }
  })

  const result = await service.generate({
    projectId: 'project-flow',
    title: '真实资产页',
    target: 'static-html',
    imageDataUrl: screenshotDataUrl,
    clientTaskId: 'image-html-client-preview-id'
  })

  assert.equal(result.restoredPage.id, 'real-restored-page-id')
  assert.equal(result.restoredPage.clientTaskId, 'image-html-client-preview-id')
  assert.equal(result.restoredPage.captureResult.taskId, 'image-html-client-preview-id')
  assert.equal(persisted[0].clientTaskId, 'image-html-client-preview-id')
})

test('temporary image-to-html preview routes resolve and replace to the real restored asset route', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const serviceSource = await readFile(new URL('../backend/services/image-to-html-service.js', import.meta.url), 'utf8')
  const modelSource = await readFile(new URL('../backend/models/workspace.js', import.meta.url), 'utf8')
  const storeSource = await readFile(new URL('../backend/services/workspace-store.js', import.meta.url), 'utf8')
  const generateStart = appSource.indexOf('async function generateFromImage')
  const generateEnd = appSource.indexOf('function openCurrentCaptureRestoredPage', generateStart)
  const generateSource = appSource.slice(generateStart, generateEnd)
  const waitStart = appSource.indexOf('async function waitForStandaloneRestoredPage')
  const waitEnd = appSource.indexOf('async function loadStandalonePreviewRoute', waitStart)
  const waitSource = appSource.slice(waitStart, waitEnd)
  const routeStart = appSource.indexOf('async function loadStandalonePreviewRoute')
  const routeEnd = appSource.indexOf('function buildRestoredPageResultShell', routeStart)
  const routeSource = appSource.slice(routeStart, routeEnd)

  assert.match(generateSource, /clientTaskId,\s*\n\s*title,/)
  assert.match(serviceSource, /taskId:\s*payload\.clientTaskId \|\| randomUUID\(\)/)
  assert.match(serviceSource, /clientTaskId:\s*payload\.clientTaskId/)
  assert.match(modelSource, /clientTaskId:\s*input\.clientTaskId/)
  assert.match(storeSource, /item\.id === id \|\| item\.clientTaskId === id \|\| item\.captureResult\?\.taskId === id/)
  assert.match(appSource, /function restoredPageMatchesPreviewId\(page = \{\}, pageId = ''\)/)
  assert.match(waitSource, /restoredPageMatchesPreviewId\(item,\s*pageId\)/)
  assert.match(routeSource, /if \(page\.id && page\.id !== pageId\) \{/)
  assert.match(routeSource, /window\.history\.replaceState\(null,\s*'',\s*projectScopedUrl\(`\/assets\/\$\{encodeURIComponent\(page\.id\)\}\/preview`/)
})

test('image-to-html preview keeps streamed source and horizontal scrolling enabled', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const statusStart = appSource.indexOf('function buildStaticHtmlStatusPage')
  const statusEnd = appSource.indexOf('function buildStaticHtmlLoadingPage', statusStart)
  const statusSource = appSource.slice(statusStart, statusEnd)
  const resultStart = appSource.indexOf('function buildStaticHtmlResultShell')
  const resultEnd = appSource.indexOf('function handleImageCodeFile', resultStart)
  const resultSource = appSource.slice(resultStart, resultEnd)
  const generateStart = appSource.indexOf('async function generateFromImage')
  const generateEnd = appSource.indexOf('function openCurrentCaptureRestoredPage', generateStart)
  const generateSource = appSource.slice(generateStart, generateEnd)

  assert.match(statusSource, /options\.sourceCode/)
  assert.match(statusSource, /has-streamed-source/)
  assert.match(generateSource, /let streamedHtmlSource = ''/)
  assert.match(generateSource, /streamedHtmlSource \+= event\.data\.content/)
  assert.match(generateSource, /sourceCode:\s*streamedHtmlSource/)
  assert.match(resultSource, /overflow-x:auto !important/)
  assert.doesNotMatch(resultSource, /overflow-x:hidden !important/)
})

test('image-to-html status and result shells use tabs for render and copyable source views', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const statusStart = appSource.indexOf('function buildStaticHtmlStatusPage')
  const statusEnd = appSource.indexOf('function buildStaticHtmlFailurePage', statusStart)
  const statusSource = appSource.slice(statusStart, statusEnd)
  const resultStart = appSource.indexOf('function buildStaticHtmlResultShell')
  const resultEnd = appSource.indexOf('function handleImageCodeFile', resultStart)
  const resultSource = appSource.slice(resultStart, resultEnd)

  assert.match(statusSource, /class="result-tabbed-layout"/)
  assert.match(statusSource, /class="result-content-card"/)
  assert.match(statusSource, /data-result-tab="render"[^>]*>HTML 渲染/)
  assert.match(statusSource, /data-result-tab="source"[^>]*>源码展示/)
  assert.match(statusSource, /data-result-panel="render"/)
  assert.match(statusSource, /data-result-panel="source"/)
  assert.match(statusSource, /function setResultTab\(tabName = 'render'\)/)
  assert.match(statusSource, /aria-selected/)
  assert.match(statusSource, /typing-code/)

  assert.match(resultSource, /class="result-tabbed-layout"/)
  assert.match(resultSource, /class="result-content-card"/)
  assert.match(resultSource, /data-result-tab="render"[^>]*>HTML 渲染/)
  assert.match(resultSource, /data-result-tab="source"[^>]*>源码展示/)
  assert.match(resultSource, /data-result-panel="render"/)
  assert.match(resultSource, /data-result-panel="source"/)
  assert.match(resultSource, /function setResultTab\(tabName = 'render'\)/)
  assert.match(resultSource, /aria-selected/)
  assert.match(resultSource, /<iframe id="generated-preview-frame" class="generated-preview-frame"/)
  assert.match(resultSource, /formatStaticHtmlSource\(html\)/)
  assert.match(resultSource, /<div class="source-project-layout"/)
  assert.match(resultSource, /<button class="source-file active" type="button" aria-current="true">index\.html<\/button>/)
  assert.match(resultSource, /<button class="copy-source-button" type="button" id="copy-source-code"/)
  assert.match(resultSource, /<pre id="generated-source-code" class="generated-source-code"><code>/)
  assert.match(resultSource, /sendOrNavigate\('image-html-copy-source', \{ html: sourceHtml \}\)/)
  assert.match(resultSource, /navigator\.clipboard\.writeText\(sourceHtml\)/)
  assert.doesNotMatch(resultSource, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/)
})

test('image-to-html source view formats copyable single-file html as project source', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const formatStart = appSource.indexOf('function formatCssSource')
  const formatEnd = appSource.indexOf('function buildStaticHtmlResultShell', formatStart)
  const formatSource = appSource.slice(formatStart, formatEnd)
  const resultStart = appSource.indexOf('function buildStaticHtmlResultShell')
  const resultEnd = appSource.indexOf('function handleImageCodeFile', resultStart)
  const resultSource = appSource.slice(resultStart, resultEnd)

  assert.match(formatSource, /function formatStaticHtmlSource\(html = ''\)/)
  assert.match(formatSource, /function formatCssSource\(css = ''\)/)
  assert.match(formatSource, /const voidTags = new Set/)
  assert.match(resultSource, /const formattedSource = formatStaticHtmlSource\(html\)/)
  assert.match(resultSource, /const sourceCode = escapeHtml\(formattedSource\)/)
  assert.match(resultSource, /id="copy-source-json"/)
  assert.match(resultSource, /const sourceHtml = JSON\.parse\(document\.getElementById\('copy-source-json'\)\.textContent \|\| '""'\)/)
})

test('standalone image-to-html preview iframe allows copyable source actions', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')

  assert.match(appSource, /class="standalone-preview-frame"[\s\S]*allow="clipboard-write"[\s\S]*sandbox="allow-forms allow-scripts allow-same-origin allow-clipboard-write allow-top-navigation-by-user-activation"/)
  assert.match(appSource, /if \(type === 'image-html-copy-source'\)/)
  assert.match(appSource, /function copyStaticHtmlPreviewSource\(html = ''\)/)
})

test('image-to-html topbar status stays bounded during streaming updates', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const statusStart = appSource.indexOf('function buildStaticHtmlStatusPage')
  const statusEnd = appSource.indexOf('function buildStaticHtmlFailurePage', statusStart)
  const statusSource = appSource.slice(statusStart, statusEnd)
  const resultStart = appSource.indexOf('function buildStaticHtmlResultShell')
  const resultEnd = appSource.indexOf('function handleImageCodeFile', resultStart)
  const resultSource = appSource.slice(resultStart, resultEnd)

  assert.match(statusSource, /\.result-topbar \{[^}]*overflow: hidden;/)
  assert.match(statusSource, /\.topbar-left \{[^}]*flex: 1 1 auto;/)
  assert.match(statusSource, /\.topbar-actions \{[^}]*flex: 0 1 auto;[^}]*justify-content: flex-end;[^}]*overflow: hidden;/)
  assert.match(statusSource, /\.generation-state \{[^}]*flex: 1 1 160px;[^}]*min-width: 0;[^}]*max-width: min\(42vw, 620px\);/)
  assert.match(resultSource, /\.result-topbar \{[^}]*overflow: hidden;/)
  assert.match(resultSource, /\.topbar-left \{[^}]*flex: 1 1 auto;/)
  assert.match(resultSource, /\.topbar-actions \{[^}]*flex: 0 1 auto;[^}]*justify-content: flex-end;[^}]*overflow: hidden;/)
})

test('image-to-html result iframe fills the preview pane without a verification banner', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const resultStart = appSource.indexOf('function buildStaticHtmlResultShell')
  const resultEnd = appSource.indexOf('function handleImageCodeFile', resultStart)
  const resultSource = appSource.slice(resultStart, resultEnd)

  assert.match(resultSource, /previewPanelClass/)
  assert.match(resultSource, /\.preview-panel\.is-active \{[^}]*grid-template-rows: auto minmax\(0, 1fr\);/)
  assert.match(resultSource, /\.preview-panel\.has-verification-banner\.is-active \{ grid-template-rows: auto auto minmax\(0, 1fr\); \}/)
  assert.match(resultSource, /class="preview-toolbar"/)
  assert.match(resultSource, /class="preview-stage"/)
  assert.match(resultSource, /<section class="\$\{previewPanelClass\}" data-result-panel="render">/)
})

test('image-to-html result shell keeps backend quality audit metadata out of the visible preview chrome', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const resultStart = appSource.indexOf('function buildStaticHtmlResultShell')
  const resultEnd = appSource.indexOf('function handleImageCodeFile', resultStart)
  const resultSource = appSource.slice(resultStart, resultEnd)

  assert.match(resultSource, /const qualityAudit = visualVerification\?\.qualityAudit \|\| null/)
  assert.match(resultSource, /qualityAudit\.viewports/)
  assert.match(resultSource, /qualityAudit\.issues/)
  assert.match(resultSource, /qualityAudit\.warnings/)
  assert.match(resultSource, /qualityAudit\.recommendations/)
  assert.doesNotMatch(resultSource, /quality-audit-panel/)
  assert.doesNotMatch(resultSource, /质量审查报告/)
  assert.doesNotMatch(resultSource, /qualityAuditReport/)
  assert.doesNotMatch(resultSource, /\.preview-panel\.has-quality-audit\.is-active/)
  assert.match(resultSource, /if \(previewFrame\) previewFrame\.srcdoc = previewHtmlForFrame\(html\)/)
  assert.doesNotMatch(resultSource, /html\s*=\s*html\.replace/)
})

test('image-to-html result shell offers four viewport size previews including 1920', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const resultStart = appSource.indexOf('function buildStaticHtmlResultShell')
  const resultEnd = appSource.indexOf('function handleImageCodeFile', resultStart)
  const resultSource = appSource.slice(resultStart, resultEnd)

  assert.match(resultSource, /data-preview-size="390"/)
  assert.match(resultSource, /data-preview-size="768"/)
  assert.match(resultSource, /data-preview-size="1440"/)
  assert.match(resultSource, /data-preview-size="1920"/)
  assert.match(resultSource, /function setPreviewSize\(width = 1440\)/)
  assert.match(resultSource, /previewFrame\.style\.width = nextWidth \+ 'px'/)
  assert.match(resultSource, /setPreviewSize\(1440\)/)
})

test('image-to-html sized preview keeps the iframe height filling the render pane', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const resultStart = appSource.indexOf('function buildStaticHtmlResultShell')
  const resultEnd = appSource.indexOf('function handleImageCodeFile', resultStart)
  const resultSource = appSource.slice(resultStart, resultEnd)

  assert.match(resultSource, /\.preview-stage \{[^}]*height: 100%;/)
  assert.match(resultSource, /\.preview-frame-wrap \{[^}]*height: 100%;/)
  assert.match(resultSource, /\.generated-preview-frame \{[^}]*height: 100%;[^}]*min-height: 100%;/)
})

test('restored asset cards use generated HTML preview when HTML exists', async () => {
  const panelSource = await readFile(new URL('../frontend/src/pages/factory/FactoryHomePanel.vue', import.meta.url), 'utf8')

  assert.match(panelSource, /function restoredPageHasHtml\(page = \{\}\)/)
  assert.match(panelSource, /<iframe v-if="restoredPageHasHtml\(page\)"/)
  assert.match(panelSource, /<img v-else-if="page\.coverImage"/)
})

test('standalone result actions have route fallback when embedded in iframe', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const resultStart = appSource.indexOf('function buildStaticHtmlResultShell')
  const resultEnd = appSource.indexOf('function handleImageCodeFile', resultStart)
  const resultSource = appSource.slice(resultStart, resultEnd)

  assert.match(resultSource, /navigateTop\(fallbackUrl\)/)
  assert.match(resultSource, /window\.parent && window\.parent !== window && !window\.opener/)
})

test('image-to-html exposes one enhanced generation action instead of advanced button', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const statusStart = appSource.indexOf('function buildStaticHtmlStatusPage')
  const statusEnd = appSource.indexOf('function buildStaticHtmlFailurePage', statusStart)
  const statusSource = appSource.slice(statusStart, statusEnd)
  const resultStart = appSource.indexOf('function buildStaticHtmlResultShell')
  const resultEnd = appSource.indexOf('function handleImageCodeFile', resultStart)
  const resultSource = appSource.slice(resultStart, resultEnd)
  const generateStart = appSource.indexOf('async function generateFromImage')
  const generateEnd = appSource.indexOf('function openCurrentCaptureRestoredPage', generateStart)
  const generateSource = appSource.slice(generateStart, generateEnd)
  const routeStart = appSource.indexOf('async function loadStandalonePreviewRoute')
  const routeEnd = appSource.indexOf('function buildRestoredPageResultShell', routeStart)
  const routeSource = appSource.slice(routeStart, routeEnd)

  assert.doesNotMatch(statusSource, /advanced-generate|高级生成|image-html-advanced/)
  assert.doesNotMatch(resultSource, /advanced-generate|高级生成|image-html-advanced/)
  assert.match(resultSource, /retryGenerate\.addEventListener\('click', \(\) => sendOrNavigate\('image-html-retry'/)
  assert.match(routeSource, /routeAction === 'regenerate' \|\| routeAction === 'advanced-generate'/)
  assert.match(routeSource, /await generateFromImage\(\{\s*standalone:\s*true\s*\}\)/)
  assert.match(generateSource, /const enhancedGeneration = true/)
  assert.match(generateSource, /generationMode:\s*'advanced'/)
  assert.match(generateSource, /markdownRules:\s*imageAdvancedMarkdownRules\(\)/)
  assert.match(generateSource, /imageUpgrade:\s*'replace-with-premium-contextual-images'/)
  assert.match(generateSource, /iconSystem:\s*'lucide-current-project-icons'/)
  assert.doesNotMatch(generateSource, /advanced \?/)
})

test('image-to-html enhanced prompts require usable responsive web and app pages', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const ruleStart = appSource.indexOf('function imageAdvancedMarkdownRules')
  const ruleEnd = appSource.indexOf('async function generateFromImage', ruleStart)
  const ruleSource = appSource.slice(ruleStart, ruleEnd)
  let capturedPrompt = ''
  const service = createImageToHtmlService({
    resolveAgentProvider: () => ({
      name: 'fake-vision-model',
      async generate(context) {
        capturedPrompt = context.userPrompt
        return {
          content: JSON.stringify({
            visualModel: { source: { type: 'screenshot', title: '可用页面', target: 'static-html', hasImage: true } },
            html: '<!doctype html><html><body><main><h1>可用页面</h1></main></body></html>',
            summary: '模型返回了 HTML。'
          }),
          provider: 'fake-vision-model',
          model: 'vision-test',
          usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
        }
      }
    }),
    verifyGeneratedPage: async () => ({ status: 'passed', results: [], recommendations: [] }),
    persistRestoredPage: async (asset) => ({ ...asset, id: 'usable-page-rules' })
  })

  await service.generate({
    projectId: 'project-flow',
    title: '可用页面',
    target: 'static-html',
    imageDataUrl: screenshotDataUrl,
    generationMode: 'advanced',
    keepBaseFramework: true,
    markdownRules: '项目规则'
  })

  assert.match(capturedPrompt, /可用页面规范/)
  assert.match(capturedPrompt, /Web 页面|移动 App|App 页面/)
  assert.match(capturedPrompt, /响应式|自适应|媒体查询/)
  assert.match(capturedPrompt, /390px|768px|1440px/)
  assert.match(capturedPrompt, /flex|grid|minmax|max-width|aspect-ratio/)
  assert.match(capturedPrompt, /按钮文字|导航|标签/)
  assert.match(capturedPrompt, /white-space:\s*nowrap|短文本不换行/)
  assert.match(capturedPrompt, /短标签.*不拆行|不拆行.*短标签|短文本.*不拆行/)
  assert.match(capturedPrompt, /line-clamp|省略号|ellipsis/)
  assert.match(capturedPrompt, /header|main|section|footer/)
  assert.match(capturedPrompt, /label|alt|focus|hover/)
  assert.match(capturedPrompt, /生成前自检/)
  assert.match(capturedPrompt, /字号、密度与比例归一化规范/)
  assert.match(capturedPrompt, /不直接照搬截图像素尺寸|不要直接照搬截图像素/)
  assert.match(capturedPrompt, /1440px.*主要桌面|主要桌面.*1440px/)
  assert.match(capturedPrompt, /1920px.*宽屏|宽屏.*1920px/)
  assert.match(capturedPrompt, /先做.*1920|1920px.*优先|1920-first/i)
  assert.match(capturedPrompt, /向下适配.*1440.*768.*390|从.*1920.*适配.*390/)
  assert.match(capturedPrompt, /不要.*1440.*居中|1440.*内容岛.*居中|中间窄岛/)
  assert.match(capturedPrompt, /1920.*铺满|宽屏.*展开|利用宽屏/)
  assert.match(capturedPrompt, /Web.*1920px.*逻辑宽度|1920px.*Web.*逻辑宽度/)
  assert.match(capturedPrompt, /移动端.*375px.*逻辑宽度|375px.*移动端.*逻辑宽度/)
  assert.match(capturedPrompt, /页面高度.*内容.*自然增长|高度.*自适应|不要固定高度/)
  assert.match(capturedPrompt, /图片.*不要拉伸|不要拉伸.*图片|object-fit.*contain|object-fit.*cover/)
  assert.match(capturedPrompt, /正文.*14px|14px.*正文/)
  assert.match(capturedPrompt, /4px.*基础网格|基础网格.*4px/)
  assert.match(capturedPrompt, /间距.*4px.*倍数|4px.*倍数.*间距/)
  assert.match(capturedPrompt, /字号.*14px.*基准|14px.*正文.*基准/)
  assert.match(capturedPrompt, /4px.*递进|递进.*4px/)
  assert.match(capturedPrompt, /圆角梯度|圆角.*4px.*6px.*8px/)
  assert.match(capturedPrompt, /卡片.*8px|8px.*卡片/)
  assert.match(capturedPrompt, /官网.*16px|16px.*官网/)
  assert.match(capturedPrompt, /12px/)
  assert.match(capturedPrompt, /clamp\(\)|clamp/)
  assert.match(capturedPrompt, /按钮.*32px.*40px.*48px|32px.*40px.*48px.*按钮/)
  assert.match(capturedPrompt, /Element Plus|饿了么/)
  assert.match(capturedPrompt, /按钮最大.*40px|40px.*按钮最大/)
  assert.match(capturedPrompt, /搜索框.*40px|40px.*搜索框/)
  assert.match(capturedPrompt, /输入框.*按钮.*同高|按钮.*输入框.*同高/)
  assert.match(capturedPrompt, /默认虚框|outline:\s*none|focus-visible/)
  assert.match(capturedPrompt, /下拉框.*Element Plus|Element Plus.*下拉框/)
  assert.match(capturedPrompt, /下拉.*hover.*selected.*disabled|disabled.*selected.*hover.*下拉/)
  assert.match(capturedPrompt, /侧边栏.*200px.*240px|200px.*240px.*侧边栏/)
  assert.match(capturedPrompt, /折叠.*56px.*64px|56px.*64px.*折叠/)
  assert.match(capturedPrompt, /hover.*focus.*disabled|disabled.*focus.*hover/)
  assert.match(capturedPrompt, /图标.*16px.*24px|16px.*24px.*图标/)
  assert.match(capturedPrompt, /12px\s*\/\s*16px\s*\/\s*20px\s*\/\s*24px/)
  assert.match(capturedPrompt, /图标.*不超过.*文字高度|文字高度.*不超过.*图标/)
  assert.match(capturedPrompt, /精致图标库|精品图标库|专业图标库/)
  assert.match(capturedPrompt, /Lucide|Heroicons|Tabler|Remix|Phosphor/)
  assert.match(capturedPrompt, /图标.*等比例|等比例.*图标/)
  assert.match(capturedPrompt, /图标.*文字大小.*接近|文字大小.*图标.*接近/)
  assert.match(capturedPrompt, /logo.*PNG|PNG.*logo/i)
  assert.match(capturedPrompt, /纯人物|纯元素|组合场景/)
  assert.match(capturedPrompt, /头像.*32px.*40px.*48px.*64px|32px.*40px.*48px.*64px.*头像/)
  assert.match(capturedPrompt, /图片.*容器比例|容器比例.*图片/)
  assert.match(capturedPrompt, /不能用.*transform.*scale|transform.*scale.*不能/)
  assert.match(capturedPrompt, /比例归一化自检/)
  assert.match(capturedPrompt, /灰度测试|灰度自检|grayscale/i)
  assert.match(capturedPrompt, /黑白.*可读|可读.*黑白|色彩去饱和/)
  assert.match(capturedPrompt, /不能只靠颜色|颜色.*唯一信息/)
  assert.match(capturedPrompt, /Tab.*横向滚动|tab.*横向滚动/i)
  assert.match(capturedPrompt, /右侧.*渐隐遮罩|右侧.*fade|fade.*右侧/i)
  assert.match(capturedPrompt, /不要.*夸张.*错落|避免.*错落排版|随机错位/)
  assert.match(capturedPrompt, /H5.*顶部.*隐藏|移动端.*顶部.*收纳|390px.*顶部.*隐藏/)
  assert.match(capturedPrompt, /侧边栏.*视频.*H5|视频入口.*大厂.*H5|饿了么.*H5/)
  assert.match(capturedPrompt, /顶部按钮.*折叠|顶部按钮.*收纳|重操作.*收纳/)
  assert.match(capturedPrompt, /底部导航|悬浮入口|抽屉菜单|更多按钮/)
  assert.match(capturedPrompt, /不要.*桌面侧边栏.*硬塞|桌面侧边栏.*不能.*硬塞|不要.*九宫格.*硬塞/)

  assert.match(ruleSource, /可用页面规范/)
  assert.match(ruleSource, /Web 页面|移动 App|App 页面/)
  assert.match(ruleSource, /响应式|自适应|媒体查询/)
  assert.match(ruleSource, /390px|768px|1440px/)
  assert.match(ruleSource, /flex|grid|minmax|max-width|aspect-ratio/)
  assert.match(ruleSource, /按钮文字|导航|标签/)
  assert.match(ruleSource, /white-space:\s*nowrap|短文本不换行/)
  assert.match(ruleSource, /短标签.*不拆行|不拆行.*短标签|短文本.*不拆行/)
  assert.match(ruleSource, /line-clamp|省略号|ellipsis/)
  assert.match(ruleSource, /header|main|section|footer/)
  assert.match(ruleSource, /label|alt|focus|hover/)
  assert.match(ruleSource, /生成前自检/)
  assert.match(ruleSource, /字号、密度与比例归一化规范/)
  assert.match(ruleSource, /不直接照搬截图像素尺寸|不要直接照搬截图像素/)
  assert.match(ruleSource, /1440px.*主要桌面|主要桌面.*1440px/)
  assert.match(ruleSource, /1920px.*宽屏|宽屏.*1920px/)
  assert.match(ruleSource, /先做.*1920|1920px.*优先|1920-first/i)
  assert.match(ruleSource, /向下适配.*1440.*768.*390|从.*1920.*适配.*390/)
  assert.match(ruleSource, /不要.*1440.*居中|1440.*内容岛.*居中|中间窄岛/)
  assert.match(ruleSource, /1920.*铺满|宽屏.*展开|利用宽屏/)
  assert.match(ruleSource, /Web.*1920px.*逻辑宽度|1920px.*Web.*逻辑宽度/)
  assert.match(ruleSource, /移动端.*375px.*逻辑宽度|375px.*移动端.*逻辑宽度/)
  assert.match(ruleSource, /页面高度.*内容.*自然增长|高度.*自适应|不要固定高度/)
  assert.match(ruleSource, /图片.*不要拉伸|不要拉伸.*图片|object-fit.*contain|object-fit.*cover/)
  assert.match(ruleSource, /正文.*14px|14px.*正文/)
  assert.match(ruleSource, /4px.*基础网格|基础网格.*4px/)
  assert.match(ruleSource, /间距.*4px.*倍数|4px.*倍数.*间距/)
  assert.match(ruleSource, /字号.*14px.*基准|14px.*正文.*基准/)
  assert.match(ruleSource, /4px.*递进|递进.*4px/)
  assert.match(ruleSource, /圆角梯度|圆角.*4px.*6px.*8px/)
  assert.match(ruleSource, /卡片.*8px|8px.*卡片/)
  assert.match(ruleSource, /官网.*16px|16px.*官网/)
  assert.match(ruleSource, /12px/)
  assert.match(ruleSource, /clamp\(\)|clamp/)
  assert.match(ruleSource, /按钮.*32px.*40px.*48px|32px.*40px.*48px.*按钮/)
  assert.match(ruleSource, /Element Plus|饿了么/)
  assert.match(ruleSource, /按钮最大.*40px|40px.*按钮最大/)
  assert.match(ruleSource, /搜索框.*40px|40px.*搜索框/)
  assert.match(ruleSource, /输入框.*按钮.*同高|按钮.*输入框.*同高/)
  assert.match(ruleSource, /默认虚框|outline:\s*none|focus-visible/)
  assert.match(ruleSource, /下拉框.*Element Plus|Element Plus.*下拉框/)
  assert.match(ruleSource, /下拉.*hover.*selected.*disabled|disabled.*selected.*hover.*下拉/)
  assert.match(ruleSource, /侧边栏.*200px.*240px|200px.*240px.*侧边栏/)
  assert.match(ruleSource, /折叠.*56px.*64px|56px.*64px.*折叠/)
  assert.match(ruleSource, /hover.*focus.*disabled|disabled.*focus.*hover/)
  assert.match(ruleSource, /图标.*16px.*24px|16px.*24px.*图标/)
  assert.match(ruleSource, /12px\s*\/\s*16px\s*\/\s*20px\s*\/\s*24px/)
  assert.match(ruleSource, /图标.*不超过.*文字高度|文字高度.*不超过.*图标/)
  assert.match(ruleSource, /精致图标库|精品图标库|专业图标库/)
  assert.match(ruleSource, /Lucide|Heroicons|Tabler|Remix|Phosphor/)
  assert.match(ruleSource, /图标.*等比例|等比例.*图标/)
  assert.match(ruleSource, /图标.*文字大小.*接近|文字大小.*图标.*接近/)
  assert.match(ruleSource, /logo.*PNG|PNG.*logo/i)
  assert.match(ruleSource, /纯人物|纯元素|组合场景/)
  assert.match(ruleSource, /头像.*32px.*40px.*48px.*64px|32px.*40px.*48px.*64px.*头像/)
  assert.match(ruleSource, /图片.*容器比例|容器比例.*图片/)
  assert.match(ruleSource, /不能用.*transform.*scale|transform.*scale.*不能/)
  assert.match(ruleSource, /比例归一化自检/)
  assert.match(ruleSource, /灰度测试|灰度自检|grayscale/i)
  assert.match(ruleSource, /黑白.*可读|可读.*黑白|色彩去饱和/)
  assert.match(ruleSource, /不能只靠颜色|颜色.*唯一信息/)
  assert.match(ruleSource, /Tab.*横向滚动|tab.*横向滚动/i)
  assert.match(ruleSource, /右侧.*渐隐遮罩|右侧.*fade|fade.*右侧/i)
  assert.match(ruleSource, /不要.*夸张.*错落|避免.*错落排版|随机错位/)
  assert.match(ruleSource, /H5.*顶部.*隐藏|移动端.*顶部.*收纳|390px.*顶部.*隐藏/)
  assert.match(ruleSource, /侧边栏.*视频.*H5|视频入口.*大厂.*H5|饿了么.*H5/)
  assert.match(ruleSource, /顶部按钮.*折叠|顶部按钮.*收纳|重操作.*收纳/)
  assert.match(ruleSource, /底部导航|悬浮入口|抽屉菜单|更多按钮/)
  assert.match(ruleSource, /不要.*桌面侧边栏.*硬塞|桌面侧边栏.*不能.*硬塞|不要.*九宫格.*硬塞/)
})

test('standalone temporary image-to-html preview waits without a max timeout', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const routeStart = appSource.indexOf('async function loadStandalonePreviewRoute')
  const routeEnd = appSource.indexOf('function buildRestoredPageResultShell', routeStart)
  const routeSource = appSource.slice(routeStart, routeEnd)
  const waitStart = appSource.indexOf('async function waitForStandaloneRestoredPage')
  const waitEnd = appSource.indexOf('async function loadStandalonePreviewRoute', waitStart)
  const waitSource = appSource.slice(waitStart, waitEnd)

  assert.match(appSource, /const STANDALONE_PREVIEW_ASSET_RETRY_DELAYS_MS = \[/)
  assert.match(appSource, /const TEMPORARY_IMAGE_HTML_PREVIEW_POLL_INTERVAL_MS = 15 \* 1000/)
  assert.doesNotMatch(appSource, /TEMPORARY_IMAGE_HTML_PREVIEW_MAX_WAIT_MS/)
  assert.match(appSource, /let standalonePreviewLoadToken = 0/)
  assert.match(routeSource, /standalonePreviewLoadToken \+= 1/)
  assert.match(routeSource, /const activeToken = standalonePreviewLoadToken/)
  assert.match(routeSource, /const page = await waitForStandaloneRestoredPage\(pageId,\s*\{\s*activeToken\s*\}\)/)
  assert.match(routeSource, /if \(activeToken !== standalonePreviewLoadToken\) return/)
  assert.match(waitSource, /await openRestoredPageDetail\(pageId,\s*\{\s*syncRoute:\s*false\s*\}\)/)
  assert.match(waitSource, /restoredPageHasPreviewArtifact\(page\)/)
  assert.match(waitSource, /isTemporaryImageHtmlPreviewId\(pageId\)/)
  assert.match(waitSource, /standalonePreviewLoadToken/)
  assert.match(waitSource, /activeToken !== standalonePreviewLoadToken/)
  assert.match(waitSource, /TEMPORARY_IMAGE_HTML_PREVIEW_POLL_INTERVAL_MS/)
  assert.doesNotMatch(waitSource, /Date\.now\(\)\s*-\s*startedAt/)
  assert.match(waitSource, /STANDALONE_PREVIEW_ASSET_RETRY_DELAYS_MS/)
  assert.match(waitSource, /if \(!isTemporaryPreview \|\| attempt === 0\)/)
  assert.match(waitSource, /await wait\(retryDelay\)/)
})

test('image-to-html enhanced prompt requires current icons contextual images and text overlap checks', async () => {
  const backendSource = await readFile(new URL('../backend/services/image-to-html-service.js', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')

  assert.match(appSource, /iconSystem:\s*'lucide-current-project-icons'/)
  assert.match(appSource, /imageUpgrade:\s*'replace-with-premium-contextual-images'/)
  assert.match(backendSource, /当前图标库/)
  assert.match(backendSource, /食品|餐饮|美食/)
  assert.match(backendSource, /化妆品|美妆|护肤/)
  assert.match(backendSource, /人物|头像|卡通/)
  assert.match(backendSource, /文字.*遮挡|遮挡.*文字/)
})
