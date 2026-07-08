### Task 5: Move Backend Page-Generation Gates Off The Frontend Service File

**Files:**
- Create: `/Users/cds-dn-868/Desktop/流程通区分前后端/backend/services/capture-quality-gate.js`
- Modify: `/Users/cds-dn-868/Desktop/流程通区分前后端/backend/services/capture-service.js`
- Modify: `/Users/cds-dn-868/Desktop/流程通区分前后端/tests/workflows.test.mjs`

**Interfaces:**
- Consumes: capture results with `singleFileHtml`, `staticHtml`, `layoutNodes`, `designTree`, `raw`.
- Produces: backend-owned `captureRestoreReadiness(captureResult)` and `captureQualityGate(captureResult)` used by `generatePageFromCapturePayload()`.

- [ ] **Step 1: Write the failing backend-ownership test**

Append this test near the existing capture-service tests:

```js
testAsync('backend capture service imports readiness and quality gate from backend services', async () => {
  const serviceSource = await readFile(new URL('../backend/services/capture-service.js', import.meta.url), 'utf8')
  const { captureRestoreReadiness, captureQualityGate } = await import('../backend/services/capture-quality-gate.js')

  const readiness = captureRestoreReadiness({
    title: 'Screenshot only',
    screenshot: pngDataUrl([255, 255, 255]),
    pages: [{ screenshot: pngDataUrl([255, 255, 255]) }],
    layoutNodes: [],
    raw: { layoutNodeCount: 0, screenshotCaptured: true }
  })
  const gate = captureQualityGate({
    title: 'Denied page',
    singleFileHtml: '<!doctype html><html><body><h1>405 异常访问</h1></body></html>',
    layoutNodes: [],
    raw: { singleFileCaptured: true, layoutNodeCount: 0 }
  })

  assert.match(serviceSource, /from '\.\/capture-quality-gate\.js'/)
  assert.doesNotMatch(serviceSource, /frontend\/src\/services\/factoryWorkspace\.js/)
  assert.equal(readiness.canRestore, false)
  assert.equal(gate.passed, false)
})
```

- [ ] **Step 2: Run the tests and confirm the backend-owned module is missing**

Run:

```bash
npm test
```

Expected: FAIL because `capture-quality-gate.js` does not exist and `capture-service.js` still imports frontend code.

- [ ] **Step 3: Copy the gate logic into a backend module and switch the capture service import**

Create `backend/services/capture-quality-gate.js` by copying the capture gate helpers out of `frontend/src/services/factoryWorkspace.js`. Copy the exact helper set from the current frontend file in this order:

```js
function semanticCaptureNodes(captureResult = {}) { /* copy from frontend */ }
function semanticPreviewNodes(captureResult = {}) { /* copy from frontend */ }
function captureActionRecommendations(captureResult = {}, rawNodeCount = 0) { /* copy from frontend */ }
export function captureRestoreReadiness(captureResult = {}) { /* copy from frontend */ }
function countMeaningfulTreeNodes(node = {}) { /* copy from frontend */ }
function duplicateTextRatio(nodes = []) { /* copy from frontend */ }
function singleFilePlainText(html = '') { /* copy from frontend */ }
function detectInvalidCapturePage(captureResult = {}, ...htmlSources) { /* copy from frontend */ }
function capturePageHeight(captureResult = {}) { /* copy from frontend */ }
export function captureQualityGate(captureResult = {}, options = {}) { /* copy from frontend */ }
```

Use this command to locate the exact source block before copying:

```bash
sed -n '1,320p' frontend/src/services/factoryWorkspace.js
```

After creating the backend module, update `backend/services/capture-service.js` imports to:

```js
import { randomUUID } from 'node:crypto'
import {
  captureQualityGate,
  captureRestoreReadiness
} from './capture-quality-gate.js'
```

Do not delete the frontend copies yet. Phase one only needs the backend to stop importing frontend files.

- [ ] **Step 4: Run the tests and confirm page-generation behavior is unchanged**

Run:

```bash
npm test
```

Expected: PASS for the new backend-owned import test and the existing capture gate tests such as `capture quality gate blocks screenshot-only captures before asset save`.

- [ ] **Step 5: Commit the backend ownership extraction**

Run:

```bash
git add tests/workflows.test.mjs backend/services/capture-quality-gate.js backend/services/capture-service.js
git commit -m "refactor: move capture quality gate logic into backend services"
```

Expected: a commit that removes the backend dependency on `frontend/src/services/factoryWorkspace.js`.

