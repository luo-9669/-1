### Task 4: Wire The Relay Layer Into The Backend Capture Entry Point

**Files:**
- Modify: `/Users/cds-dn-868/Desktop/流程通区分前后端/backend/server/mock-api.mjs`
- Modify: `/Users/cds-dn-868/Desktop/流程通区分前后端/backend/README.md`
- Modify: `/Users/cds-dn-868/Desktop/流程通区分前后端/tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `captureRoutes`, `createCaptureRunner`, `createCaptureTaskStore`, `createCaptureDispatcher`, analyzer/matcher/compiler/diagnostics services.
- Produces: `/api/capture/start` backed by the relay dispatcher, README documentation for the new backend service chain.

- [ ] **Step 1: Write the failing route-wiring test**

Append this block near the existing mock-api source assertions:

```js
testAsync('mock api wires capture start through the relay dispatcher and returns relay metadata', async () => {
  const source = await readFile(new URL('../backend/server/mock-api.mjs', import.meta.url), 'utf8')
  const result = await routes['POST /api/capture/start']({
    url: 'https://example.com',
    authMode: 'public'
  })

  assert.match(source, /import \{ createCaptureDispatcher \} from '\.\.\/services\/capture-dispatcher\.js'/)
  assert.match(source, /import \{ analyzeCaptureUrl \} from '\.\.\/services\/capture-url-analyzer\.js'/)
  assert.match(source, /import \{ matchCaptureTemplate \} from '\.\.\/services\/capture-template-matcher\.js'/)
  assert.match(source, /import \{ compileCaptureTask \} from '\.\.\/services\/capture-compiler\.js'/)
  assert.match(source, /import \{ classifyCaptureDiagnostics \} from '\.\.\/services\/capture-diagnostics\.js'/)
  assert.match(source, /const captureDispatcher = createCaptureDispatcher\(/)
  assert.match(source, /captureStart: async \(payload\) => captureTaskStore\.runTask\(payload,\s*captureDispatcher\)/)
  assert.equal(typeof result.templateId, 'string')
  assert.ok(Array.isArray(result.diagnostics))
  assert.ok(Array.isArray(result.recoveryActions))
})
```

- [ ] **Step 2: Run the tests and confirm the wiring assertion fails**

Run:

```bash
npm test
```

Expected: FAIL because `mock-api.mjs` still references `captureRunner` directly for `captureStart`.

- [ ] **Step 3: Wire the dispatcher and document the service chain**

Update `backend/server/mock-api.mjs` imports and capture initialization:

```js
import { createCaptureRunner } from '../services/capture-runner.js'
import { createCaptureTaskStore } from '../services/capture-task-store.js'
import { createCaptureDispatcher } from '../services/capture-dispatcher.js'
import { analyzeCaptureUrl } from '../services/capture-url-analyzer.js'
import { matchCaptureTemplate } from '../services/capture-template-matcher.js'
import { compileCaptureTask } from '../services/capture-compiler.js'
import { classifyCaptureDiagnostics } from '../services/capture-diagnostics.js'
```

Add the dispatcher instance just after `captureRunner`:

```js
const captureDispatcher = createCaptureDispatcher({
  analyzeCaptureUrl,
  matchCaptureTemplate,
  compileCaptureTask,
  classifyCaptureDiagnostics,
  captureRunner
})
```

Update the capture route injection:

```js
  captureStart: async (payload) => captureTaskStore.runTask(payload, captureDispatcher),
```

Update `backend/README.md` in the capture backend responsibilities section so it documents:

```md
- `services/capture-url-analyzer.js`：规范化 URL，判断页面类型和鉴权倾向。
- `services/capture-template-matcher.js`：基于 URL 特征与 authMode 选择规则模板。
- `services/capture-compiler.js`：将 URL、模板与默认策略编译成标准采集任务。
- `services/capture-dispatcher.js`：在执行前串联 analyzer、matcher、compiler、diagnostics，并把任务交给 `capture-runner`。
- `services/capture-diagnostics.js`：输出稳定的诊断码和恢复动作，供前端直接展示。
```

- [ ] **Step 4: Run the backend tests and confirm route metadata is present**

Run:

```bash
npm test
```

Expected: PASS for the new mock-api wiring test, plus the existing `capture API returns backend timing metadata` and route-module tests remain green.

- [ ] **Step 5: Commit the relay wiring**

Run:

```bash
git add tests/workflows.test.mjs backend/server/mock-api.mjs backend/README.md
git commit -m "feat: wire capture start through relay dispatcher"
```

Expected: a commit containing the new backend relay entrypoint and README updates.

