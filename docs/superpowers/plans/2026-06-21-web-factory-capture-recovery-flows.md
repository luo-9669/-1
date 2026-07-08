# Web Factory Capture Recovery Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clickable Web Factory recovery-flow cards that explain and route four capture fallback paths while documenting frontend/backend ownership.

**Architecture:** The frontend adds a small `captureRecoveryFlows` data model and `goRecoveryFlow()` router. The existing backend remains the owner of capture orchestration; this task documents that ownership in UI copy and source structure without changing backend capture internals.

**Tech Stack:** Vue 3 single-file app in `src/App.vue`, CSS in `src/styles.css`, Node test runner in `tests/workflows.test.mjs`.

## Global Constraints

- Keep source keys stable: `remote-browser`, `cookie-session`, `snapshot-package`, `image-to-code`.
- Include the exact phrases `推荐方案`, `前端负责`, `后端负责`, and `后端接管采集编排` in the Web Factory source.
- Use the existing `factoryHomeTab`, `captureForm.authMode`, and browser session functions.
- Do not move capture orchestration into the frontend.
- Keep the UI compact and operational, not marketing-like.

---

### Task 1: Add Recovery Flow Data And Routing

**Files:**
- Modify: `/Users/cds-dn-868/Desktop/流程通/src/App.vue`
- Test: `/Users/cds-dn-868/Desktop/流程通/tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `factoryHomeTab`, `captureForm.authMode`, `captureForm.url`, `createBrowserSession()`, `activeView`, `state.currentFactoryRoute`.
- Produces: `captureRecoveryFlows: Array<object>` and `goRecoveryFlow(flow: object): void`.

- [ ] **Step 1: Run the failing test**

Run:

```bash
npm test -- tests/workflows.test.mjs
```

Expected: the test named `web factory documents frontend backend ownership for capture recovery flows` fails because `const captureRecoveryFlows` is missing.

- [ ] **Step 2: Add `captureRecoveryFlows` before `factoryHeroCopy`**

Add a constant containing the four flow objects. Each object should include `id`, `title`, `badge`, `scenario`, `frontend`, `backend`, `handoff`, and `action`. The remote-browser object must include `recommended: true` and the text `推荐方案`. At least one backend string must include `后端接管采集编排`.

- [ ] **Step 3: Add `goRecoveryFlow(flow)`**

Add a function near `openFactoryHome()`. The function sets `activeView.value = 'factory'`, `state.currentFactoryRoute = 'home'`, routes the tab, and adjusts `captureForm.authMode`:

```js
function goRecoveryFlow(flow = {}) {
  activeView.value = 'factory'
  state.currentFactoryRoute = 'home'
  if (flow.id === 'remote-browser') {
    factoryHomeTab.value = 'url-code'
    captureForm.authMode = 'browser'
    if (captureForm.url.trim()) void createBrowserSession()
    return
  }
  if (flow.id === 'cookie-session') {
    factoryHomeTab.value = 'url-code'
    captureForm.authMode = 'cookie'
    return
  }
  if (flow.id === 'snapshot-package') {
    factoryHomeTab.value = 'url-code'
    captureForm.authMode = 'public'
    return
  }
  if (flow.id === 'image-to-code') {
    factoryHomeTab.value = 'image-code'
  }
}
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -- tests/workflows.test.mjs
```

Expected: the recovery-flow source assertions pass or reveal the next missing UI hook.

### Task 2: Render Clickable Recovery Cards

**Files:**
- Modify: `/Users/cds-dn-868/Desktop/流程通/src/App.vue`
- Modify: `/Users/cds-dn-868/Desktop/流程通/src/styles.css`
- Test: `/Users/cds-dn-868/Desktop/流程通/tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `captureRecoveryFlows` and `goRecoveryFlow(flow)`.
- Produces: `.capture-recovery-grid` and `.capture-recovery-card` UI.

- [ ] **Step 1: Render cards under the existing capture path panels**

Replace the static path-grid spans with buttons using:

```vue
<div class="capture-recovery-grid">
  <button
    v-for="flow in captureRecoveryFlows"
    :key="flow.id"
    class="capture-recovery-card"
    type="button"
    @click="goRecoveryFlow(flow)"
  >
    ...
  </button>
</div>
```

The card body should show badge, title, scenario, frontend, backend, handoff, and action.

- [ ] **Step 2: Add compact CSS**

Add CSS for `.capture-recovery-grid`, `.capture-recovery-card`, and child text elements. Cards must be white, compact, responsive, and not nested visually inside heavy cards.

- [ ] **Step 3: Run tests and build**

Run:

```bash
npm test -- tests/workflows.test.mjs
npm run build
```

Expected: tests and production build complete with exit code 0.

### Task 3: Browser Smoke Check

**Files:**
- Runtime check only.

**Interfaces:**
- Consumes: Vite app at `http://localhost:5288/`.
- Produces: confirmation that the Web Factory page renders and cards route correctly.

- [ ] **Step 1: Start or reuse the dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 5288
```

Expected: Vite serves the app at `http://127.0.0.1:5288/`.

- [ ] **Step 2: Open the Web Factory page and inspect console errors**

Use browser automation to open the app, switch to Web Factory, and confirm four recovery cards are visible.

- [ ] **Step 3: Click cards**

Click remote browser and confirm the URL tab is active with browser auth mode. Click image-to-code and confirm image tab is active.

- [ ] **Step 4: Report verification evidence**

Report exact commands run and whether each passed. If browser smoke fails, report the failure and fix before completion.

