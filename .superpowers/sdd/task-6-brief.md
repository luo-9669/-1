### Task 6: Expose Relay Metadata In The Frontend Capture Result UI

**Files:**
- Modify: `/Users/cds-dn-868/Desktop/流程通区分前后端/frontend/src/App.vue`
- Modify: `/Users/cds-dn-868/Desktop/流程通区分前后端/frontend/src/styles.css`
- Modify: `/Users/cds-dn-868/Desktop/流程通区分前后端/tests/workflows.test.mjs`

**Interfaces:**
- Consumes: backend `/api/capture/start` result fields `templateId`, `diagnostics`, `recoveryActions`, `relay`.
- Produces: frontend relay diagnostics panel rendering those backend fields without client-side rule inference.

- [ ] **Step 1: Write the failing frontend source test**

Append this test block near the existing Web Factory UI tests:

```js
testAsync('web factory capture detail renders backend relay diagnostics and recovery actions', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(appSource, /const captureRelayDiagnostics = computed/)
  assert.match(appSource, /const captureRelayActions = computed/)
  assert.match(appSource, /capture-relay-diagnostics/)
  assert.match(appSource, /state\.captureResult\?\.templateId/)
  assert.match(appSource, /v-for="diagnostic in captureRelayDiagnostics"/)
  assert.match(appSource, /v-for="action in captureRelayActions"/)
  assert.match(cssSource, /\.capture-relay-diagnostics/)
  assert.match(cssSource, /\.capture-relay-action-list/)
})
```

- [ ] **Step 2: Run the tests and confirm the UI hook is missing**

Run:

```bash
npm test
```

Expected: FAIL because the new computed values and markup are not yet in `App.vue`.

- [ ] **Step 3: Add computed helpers and a relay diagnostics panel**

Add these computed helpers near the existing capture computed values in `frontend/src/App.vue`:

```js
const captureRelayDiagnostics = computed(() => state.captureResult?.diagnostics || [])
const captureRelayActions = computed(() => state.captureResult?.recoveryActions || [])
const captureRelayTemplateId = computed(() => state.captureResult?.templateId || '')
```

Render a compact panel inside the capture result/detail UI:

```vue
<section v-if="captureRelayTemplateId || captureRelayDiagnostics.length || captureRelayActions.length" class="capture-relay-diagnostics">
  <div class="capture-relay-head">
    <span class="eyebrow">Relay</span>
    <strong>{{ captureRelayTemplateId || '未命中模板' }}</strong>
  </div>
  <ul v-if="captureRelayDiagnostics.length" class="capture-relay-diagnostic-list">
    <li v-for="diagnostic in captureRelayDiagnostics" :key="`${diagnostic.code}-${diagnostic.message}`">
      <strong>{{ diagnostic.code }}</strong>
      <span>{{ diagnostic.message }}</span>
    </li>
  </ul>
  <ul v-if="captureRelayActions.length" class="capture-relay-action-list">
    <li v-for="action in captureRelayActions" :key="action">{{ action }}</li>
  </ul>
</section>
```

Add compact CSS in `frontend/src/styles.css`:

```css
.capture-relay-diagnostics {
  margin-top: 16px;
  padding: 16px 18px;
  border: 1px solid #d9dde3;
  border-radius: 14px;
  background: #f8fafc;
}

.capture-relay-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}

.capture-relay-diagnostic-list,
.capture-relay-action-list {
  margin: 0;
  padding-left: 18px;
  color: #44505f;
}
```

- [ ] **Step 4: Run tests and frontend build**

Run:

```bash
npm test
npm run build
```

Expected: PASS for the new frontend relay test and a successful frontend production build.

- [ ] **Step 5: Commit the frontend relay display**

Run:

```bash
git add tests/workflows.test.mjs frontend/src/App.vue frontend/src/styles.css
git commit -m "feat: show capture relay diagnostics in web factory"
```

Expected: a commit containing the new relay template and diagnostics display.

