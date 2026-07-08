### Task 3: Add The Relay Dispatcher And Teach The Task Store To Run Relay Executors

**Files:**
- Create: `/Users/cds-dn-868/Desktop/流程通区分前后端/backend/services/capture-dispatcher.js`
- Modify: `/Users/cds-dn-868/Desktop/流程通区分前后端/backend/services/capture-task-store.js`
- Modify: `/Users/cds-dn-868/Desktop/流程通区分前后端/backend/services/capture-runner.js`
- Modify: `/Users/cds-dn-868/Desktop/流程通区分前后端/tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `analyzeCaptureUrl`, `matchCaptureTemplate`, `compileCaptureTask`, `classifyCaptureDiagnostics`, `captureRunner.makeCaptureResult(payload)`.
- Produces: `createCaptureDispatcher(deps).execute(payload)`, task-store support for executors with either `execute()` or `makeCaptureResult()`.

- [ ] **Step 1: Write the failing relay-dispatcher integration test**

Append this test in `tests/workflows.test.mjs` near the existing `createCaptureTaskStore` tests:

```js
testAsync('backend capture dispatcher compiles relay metadata before task-store execution', async () => {
  const { createCaptureDispatcher } = await import('../backend/services/capture-dispatcher.js')
  const { createCaptureTaskStore } = await import('../backend/services/capture-task-store.js')

  const dispatcher = createCaptureDispatcher({
    analyzeCaptureUrl: ({ url, authMode }) => ({
      normalizedUrl: url,
      authMode,
      traits: { pageClass: 'saas-dashboard' },
      authHints: { requiresAuth: true, preferredAuthMode: 'browser' }
    }),
    matchCaptureTemplate: () => ({
      templateId: 'generic-saas-dashboard',
      template: {
        navigation: { waitUntil: 'networkidle', timeoutMs: 20000, extraWaitMs: 3000 },
        pageStrategy: { scrollMode: 'full-page', maxScrollSteps: 8, includeIframes: false },
        artifacts: { screenshot: true, singleFile: true, domSnapshot: true, networkLogs: true }
      },
      matchReason: 'unit-test-match'
    }),
    compileCaptureTask: ({ payload }) => ({
      taskType: 'web-capture',
      templateId: 'generic-saas-dashboard',
      source: { url: payload.url },
      auth: { mode: payload.authMode, sessionId: payload.sessionId || '' },
      execution: { waitUntil: 'networkidle', timeoutMs: 20000, extraWaitMs: 3000, scrollMode: 'full-page', maxScrollSteps: 8, includeIframes: false },
      artifacts: { screenshot: true, singleFile: true, domSnapshot: true, networkLogs: true },
      relay: { matchReason: 'unit-test-match', pageClass: 'saas-dashboard', requiresAuth: true }
    }),
    classifyCaptureDiagnostics: () => ({ status: 'completed', diagnostics: [], recoveryActions: [] }),
    captureRunner: {
      makeCaptureResult: async (payload) => ({
        taskId: payload.taskId,
        url: payload.url,
        status: 'completed',
        title: 'Compiled Capture',
        raw: { authMode: payload.authMode, transport: 'unit' }
      })
    }
  })

  const taskStore = createCaptureTaskStore({
    uuid: (() => {
      let id = 0
      return () => `relay-task-${++id}`
    })(),
    now: () => 1000
  })

  const result = await taskStore.runTask({
    projectId: 'project-flow',
    url: 'https://example.com/dashboard',
    authMode: 'browser',
    sessionId: 'session-7'
  }, dispatcher)

  assert.equal(result.templateId, 'generic-saas-dashboard')
  assert.equal(result.relay.compiledTask.execution.waitUntil, 'networkidle')
  assert.equal(result.relay.analysis.traits.pageClass, 'saas-dashboard')
  assert.deepEqual(result.diagnostics, [])
})
```

- [ ] **Step 2: Run the tests and confirm the dispatcher import fails**

Run:

```bash
npm test
```

Expected: FAIL with a module-not-found error for `../backend/services/capture-dispatcher.js`.

- [ ] **Step 3: Implement the dispatcher, task-store executor support, and relay metadata passthrough**

Create `backend/services/capture-dispatcher.js`:

```js
export function createCaptureDispatcher(deps = {}) {
  const {
    analyzeCaptureUrl,
    matchCaptureTemplate,
    compileCaptureTask,
    classifyCaptureDiagnostics,
    captureRunner
  } = deps

  return {
    async execute(payload = {}) {
      const analysis = analyzeCaptureUrl({
        url: payload.url,
        authMode: payload.authMode
      })
      const templateMatch = matchCaptureTemplate({
        analysis,
        authMode: payload.authMode
      })
      const compiledTask = compileCaptureTask({
        payload,
        analysis,
        templateMatch
      })
      const captureResult = await captureRunner.makeCaptureResult({
        ...payload,
        url: compiledTask.source.url,
        authMode: compiledTask.auth.mode,
        relay: {
          templateId: compiledTask.templateId,
          matchReason: compiledTask.relay.matchReason,
          compiledTask,
          analysis
        }
      })
      const classified = classifyCaptureDiagnostics({
        compiledTask,
        captureResult
      })

      return {
        ...captureResult,
        status: classified.status === 'blocked' ? 'blocked' : captureResult.status,
        templateId: compiledTask.templateId,
        diagnostics: classified.diagnostics,
        recoveryActions: classified.recoveryActions,
        relay: {
          analysis,
          compiledTask,
          matchReason: compiledTask.relay.matchReason
        }
      }
    }
  }
}
```

Update `backend/services/capture-task-store.js` so `runTask()` can execute either a dispatcher or the old runner:

```js
  async function runTask(payload = {}, executor) {
    const execute = typeof executor?.execute === 'function'
      ? (input) => executor.execute(input)
      : typeof executor?.makeCaptureResult === 'function'
        ? (input) => executor.makeCaptureResult(input)
        : null

    if (!execute) {
      throw new Error('Capture runner is not configured')
    }

    const task = createTask(payload)
    updateTask(task.taskId, { status: 'capturing' })
    try {
      const captureResult = await execute({
        ...payload,
        taskId: task.taskId
      })
      const resultPayload = {
        ...captureResult,
        taskId: task.taskId,
        projectId: task.projectId
      }
      const completed = updateTask(task.taskId, {
        status: 'success',
        result: resultPayload,
        error: null
      })
      return completed.result
    } catch (error) {
      updateTask(task.taskId, {
        status: 'failed',
        result: null,
        error: {
          message: error.message || '采集任务失败',
          code: error.code || 'CAPTURE_TASK_FAILED'
        }
      })
      throw error
    }
  }
```

Update `backend/services/capture-runner.js` to preserve relay metadata in the result:

```js
      raw: {
        scope: payload.scope,
        authMode,
        templateId: payload.relay?.templateId || '',
        relayMatchReason: payload.relay?.matchReason || '',
        captureKind: payload.captureKind || 'internal-web-snapshot',
        snapshotPackage: 'internal-web-snapshot',
        requestedOutput: payload.output || null,
        captureMode: hasDomLayout ? 'screenshot-with-dom-data' : 'screenshot-only',
        capturedAt: new Date(completedAt).toISOString(),
        startedAt: timing.startedAt,
        completedAt: timing.completedAt,
        fetched: Boolean(fetched),
        fetchStatus: fetched?.statusCode || null,
        transport: fetched?.transport || null,
        fetchError,
```

- [ ] **Step 4: Run the tests and confirm dispatcher execution passes**

Run:

```bash
npm test
```

Expected: PASS for `backend capture dispatcher compiles relay metadata before task-store execution`, plus the existing task-store tests still pass.

- [ ] **Step 5: Commit the relay-dispatcher integration**

Run:

```bash
git add tests/workflows.test.mjs backend/services/capture-dispatcher.js backend/services/capture-task-store.js backend/services/capture-runner.js
git commit -m "feat: dispatch compiled relay tasks through capture store"
```

Expected: a commit containing dispatcher orchestration and task-store compatibility.

