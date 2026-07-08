### Task 2: Add The Capture Compiler And Diagnostic Classifier

**Files:**
- Create: `/Users/cds-dn-868/Desktop/流程通区分前后端/backend/services/capture-compiler.js`
- Create: `/Users/cds-dn-868/Desktop/流程通区分前后端/backend/services/capture-diagnostics.js`
- Modify: `/Users/cds-dn-868/Desktop/流程通区分前后端/tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `CaptureUrlAnalysis`, template match result, request payload `{ projectId, url, authMode, sessionId, cookieText }`, capture result or capture error details.
- Produces: `compileCaptureTask(input): CompiledCaptureTask`, `classifyCaptureDiagnostics(input): { status, diagnostics, recoveryActions }`.

- [ ] **Step 1: Write the failing tests for compiler and diagnostics**

Append this block in `tests/workflows.test.mjs` after the analyzer test:

```js
test('compiles relay capture tasks and classifies capture diagnostics', async () => {
  const { analyzeCaptureUrl } = await import('../backend/services/capture-url-analyzer.js')
  const { matchCaptureTemplate } = await import('../backend/services/capture-template-matcher.js')
  const { compileCaptureTask } = await import('../backend/services/capture-compiler.js')
  const { classifyCaptureDiagnostics } = await import('../backend/services/capture-diagnostics.js')

  const analysis = analyzeCaptureUrl({
    url: 'https://example.com/app/home',
    authMode: 'browser'
  })
  const templateMatch = matchCaptureTemplate({ analysis, authMode: 'browser' })
  const compiled = compileCaptureTask({
    payload: {
      projectId: 'project-flow',
      url: 'https://example.com/app/home',
      authMode: 'browser',
      sessionId: 'session-1'
    },
    analysis,
    templateMatch
  })

  assert.equal(compiled.taskType, 'web-capture')
  assert.equal(compiled.templateId, 'generic-saas-dashboard')
  assert.equal(compiled.auth.mode, 'browser')
  assert.equal(compiled.execution.waitUntil, 'networkidle')
  assert.equal(compiled.artifacts.domSnapshot, true)

  const blocked = classifyCaptureDiagnostics({
    compiledTask: compiled,
    captureResult: {
      url: compiled.source.url,
      singleFileHtml: '<html><body><h1>405 异常访问</h1></body></html>',
      staticHtml: '',
      layoutNodes: [],
      raw: {
        fetchError: '目标网页未能完整抓取',
        screenshotCaptured: true,
        singleFileCaptured: true,
        layoutNodeCount: 0
      }
    }
  })

  assert.equal(blocked.status, 'blocked')
  assert.equal(blocked.diagnostics[0].code, 'ANTI_BOT_SUSPECTED')
  assert.ok(blocked.recoveryActions.includes('打开授权浏览器'))
})
```

- [ ] **Step 2: Run the tests and confirm the new compiler imports fail**

Run:

```bash
npm test
```

Expected: FAIL with a module-not-found error for `capture-compiler.js` or `capture-diagnostics.js`.

- [ ] **Step 3: Implement the compiler and diagnostics modules**

Create `backend/services/capture-compiler.js`:

```js
function normalizeAuthMode(authMode = 'public') {
  return ['public', 'browser', 'cookie'].includes(authMode) ? authMode : 'public'
}

export function compileCaptureTask(input = {}) {
  const payload = input.payload || {}
  const analysis = input.analysis || {}
  const templateMatch = input.templateMatch || {}
  const template = templateMatch.template || {}
  const authMode = normalizeAuthMode(payload.authMode || analysis.authMode)

  return {
    taskType: 'web-capture',
    projectId: payload.projectId || 'default',
    templateId: templateMatch.templateId || 'generic-public-page',
    source: { url: analysis.normalizedUrl || String(payload.url || '').trim() },
    auth: {
      mode: authMode,
      sessionId: authMode === 'browser' ? payload.sessionId || '' : '',
      cookieText: authMode === 'cookie' ? payload.cookieText || '' : ''
    },
    execution: {
      waitUntil: template.navigation?.waitUntil || 'networkidle',
      timeoutMs: template.navigation?.timeoutMs || 15000,
      extraWaitMs: template.navigation?.extraWaitMs || 0,
      scrollMode: template.pageStrategy?.scrollMode || 'full-page',
      maxScrollSteps: template.pageStrategy?.maxScrollSteps || 4,
      includeIframes: Boolean(template.pageStrategy?.includeIframes)
    },
    artifacts: {
      screenshot: Boolean(template.artifacts?.screenshot),
      singleFile: Boolean(template.artifacts?.singleFile),
      domSnapshot: Boolean(template.artifacts?.domSnapshot),
      networkLogs: Boolean(template.artifacts?.networkLogs)
    },
    diagnosticsPolicy: {
      classifyLoginPage: true,
      classifyBotBlock: true,
      classifyEmptyDom: true
    },
    relay: {
      matchReason: templateMatch.matchReason || '',
      pageClass: analysis.traits?.pageClass || 'public-page',
      requiresAuth: Boolean(analysis.authHints?.requiresAuth)
    }
  }
}
```

Create `backend/services/capture-diagnostics.js`:

```js
function hasBlockedHtml(text = '') {
  return /405|异常访问|请求有异常行为|access denied|forbidden/i.test(String(text || ''))
}

export function classifyCaptureDiagnostics(input = {}) {
  const compiledTask = input.compiledTask || {}
  const captureResult = input.captureResult || {}
  const raw = captureResult.raw || {}
  const diagnostics = []
  const recoveryActions = new Set()

  if (compiledTask.relay?.requiresAuth && compiledTask.auth?.mode === 'public') {
    diagnostics.push({ code: 'LOGIN_REQUIRED', message: '目标页面需要登录后采集。' })
    recoveryActions.add('打开授权浏览器')
    recoveryActions.add('重新导入 Cookie')
  }

  if (/cookie|expired|401|403/i.test(raw.fetchError || '')) {
    diagnostics.push({ code: 'COOKIE_EXPIRED', message: '当前 Cookie 或登录态已失效。' })
    recoveryActions.add('重新导入 Cookie')
    recoveryActions.add('打开授权浏览器')
  }

  if (!captureResult.singleFileHtml && !captureResult.staticHtml && !raw.layoutNodeCount) {
    diagnostics.push({ code: 'DOM_NOT_RESTORABLE', message: '当前页面没有可还原 DOM 数据。' })
    recoveryActions.add('上传网页快照包')
    recoveryActions.add('上传截图走图片转代码')
  }

  if (hasBlockedHtml(captureResult.singleFileHtml) || hasBlockedHtml(raw.fetchError)) {
    diagnostics.unshift({ code: 'ANTI_BOT_SUSPECTED', message: '当前页面疑似被风控或异常访问拦截。' })
    recoveryActions.add('打开授权浏览器')
    recoveryActions.add('重新导入 Cookie')
  }

  return {
    status: diagnostics.length ? 'blocked' : (captureResult.status || 'completed'),
    diagnostics,
    recoveryActions: [...recoveryActions]
  }
}
```

- [ ] **Step 4: Run the tests and confirm the compiler/diagnostics contract passes**

Run:

```bash
npm test
```

Expected: PASS for `compiles relay capture tasks and classifies capture diagnostics`.

- [ ] **Step 5: Commit the compiler and diagnostics layer**

Run:

```bash
git add tests/workflows.test.mjs backend/services/capture-compiler.js backend/services/capture-diagnostics.js
git commit -m "feat: add capture compiler and diagnostics"
```

Expected: a commit containing the compiled-task contract and diagnostic classifier.

