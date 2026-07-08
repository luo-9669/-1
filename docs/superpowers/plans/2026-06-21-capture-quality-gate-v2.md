# Capture Quality Gate V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent low-quality webpage captures from being saved as formal restored assets.

**Architecture:** Add a focused quality gate in `src/services/factoryWorkspace.js`, call it from the mock capture generation API, and surface blocked results in the existing capture-detail UI. SingleFile HTML remains the primary static preview; flattened `pageData.nodes` becomes diagnostic fallback, not proof of 1:1 quality.

**Tech Stack:** Vue 3, Vite middleware mock API, Node test runner in `tests/workflows.test.mjs`, Playwright smoke checks.

## Global Constraints

- Do not save a formal restored asset when capture quality is insufficient.
- Do not treat flattened absolute-position nodes as reliable 1:1 page structure.
- SingleFile HTML may pass as a static HTML asset even when designTree is weak, but it must be explicitly classified as SingleFile-only.
- Low-quality captures must return a diagnostic report with reasons and repair actions.
- Existing URL-to-code and restored asset flows must remain clickable.

---

### Task 1: Capture Quality Gate

**Files:**
- Modify: `src/services/factoryWorkspace.js`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Produces: `captureQualityGate(captureResult, options) -> { passed, status, mode, score, reasons, actions, metrics }`
- Consumes: `captureResult.singleFileHtml`, `captureResult.designTree`, `captureResult.layoutNodes`, `captureResult.raw`

- [ ] **Step 1: Write failing tests**

Add tests showing:
- SingleFile HTML passes as `singlefile-static`.
- Empty designTree with only flat nodes fails as `flat-nodes-only`.
- Screenshot-only capture fails.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/workflows.test.mjs`
Expected: FAIL because `captureQualityGate` is not exported.

- [ ] **Step 3: Implement gate**

Add `captureQualityGate` with metrics for SingleFile length, designTree content count, flat node count, duplicate text ratio, and captured page height.

- [ ] **Step 4: Verify tests pass**

Run: `npm test -- tests/workflows.test.mjs`
Expected: PASS for new quality gate tests.

### Task 2: Backend Generate-Page Gate

**Files:**
- Modify: `server/mock-api.mjs`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `captureQualityGate`
- Produces blocked API result: `{ status: 'blocked', qualityGate, diagnosticReport, html: '' }`

- [ ] **Step 1: Write failing API test**

Call `POST /api/capture/generate-page` with empty designTree plus flat nodes and assert it returns `status: 'blocked'`, `html: ''`, and diagnostic reasons.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/workflows.test.mjs`
Expected: FAIL because backend still accepts flat nodes.

- [ ] **Step 3: Implement backend gate**

Call `captureQualityGate` before `generatedPageHtml`. Block when `passed` is false.

- [ ] **Step 4: Verify tests pass**

Run: `npm test -- tests/workflows.test.mjs`
Expected: PASS.

### Task 3: Frontend Diagnostic Handling

**Files:**
- Modify: `src/App.vue`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes API blocked result from Task 2.
- Produces user-facing failed status and no restored page asset.

- [ ] **Step 1: Write failing source-level test**

Assert `generatePageFromCapture` handles `data?.qualityGate` / `data?.diagnosticReport` before saving restored assets.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/workflows.test.mjs`
Expected: FAIL because frontend does not branch on quality gate yet.

- [ ] **Step 3: Implement frontend handling**

If API returns blocked quality gate, set failed status with diagnostic reason, close preview placeholder, and do not call `saveRestoredPageAsset`.

- [ ] **Step 4: Verify tests pass**

Run: `npm test -- tests/workflows.test.mjs`
Expected: PASS.

### Task 4: Verification

**Files:**
- No production files unless verification exposes a bug.

**Interfaces:**
- Consumes completed Tasks 1-3.
- Produces confidence that no low-quality capture becomes a restored asset.

- [ ] **Step 1: Run full test command**

Run: `npm test -- tests/workflows.test.mjs`
Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Vite build exits 0.

- [ ] **Step 3: Run browser smoke**

Use Playwright to open `http://localhost:5288/`, verify 页面工厂 loads, restored detail still opens, and console has no errors.

