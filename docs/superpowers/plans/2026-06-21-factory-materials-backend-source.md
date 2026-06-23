# Factory Materials Backend Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 网页工厂 and 资料库 consume backend resources as the source of truth instead of relying on local-only state mutations.

**Architecture:** Keep the current Vue + local Node API architecture, but tighten the contract: App.vue calls only `src/services/api.js`; backend routes in `后端/routes/workspace.js` own materials and restored page details. The frontend may cache returned records for display, but backend responses decide saved content, preview HTML, source files, and deletion results.

**Tech Stack:** Vue 3, Vite, Node HTTP mock API, backend modules in `后端/`, tests in `tests/workflows.test.mjs`.

## Global Constraints

- Frontend must use `api.workspace.updateMaterial` for editing existing materials.
- Frontend must refresh material lists from `api.workspace.listMaterials` after save/delete/import operations.
- Restored page detail must call backend restored page detail, preview, and source endpoints when opening a page.
- Backend API documentation must list the material and restored page routes.
- Keep existing clickable UI and current tests working.

---

### Task 1: Frontend backend-source contract tests

**Files:**
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `src/App.vue`, `src/services/api.js`, `后端/README.md`
- Produces: source-level tests that fail when frontend bypasses backend resource contracts.

- [ ] **Step 1: Write failing tests**
  - Assert `saveMaterialItem` branches to `api.workspace.updateMaterial` when editing.
  - Assert material mutations call a backend refresh helper using `api.workspace.listMaterials`.
  - Assert `openRestoredPageDetail` is async and calls `getRestoredPage`, `previewRestoredPage`, and `sourceRestoredPage`.
  - Assert `后端/README.md` lists material and restored page APIs.

- [ ] **Step 2: Run tests**
  - Run: `npm test -- tests/workflows.test.mjs`
  - Expected: FAIL on missing frontend/backend contract code.

### Task 2: Implement frontend backend-source behavior

**Files:**
- Modify: `src/App.vue`
- Modify: `后端/README.md`

**Interfaces:**
- Consumes: `api.workspace.listMaterials`, `api.workspace.updateMaterial`, `api.workspace.getRestoredPage`, `api.workspace.previewRestoredPage`, `api.workspace.sourceRestoredPage`
- Produces: backend-backed material refresh and restored detail hydration.

- [ ] **Step 1: Add material refresh helper**
  - Create `refreshMaterialsFromBackend(type = materialsTab.value)`.
  - Call backend list endpoint with `{ projectId: state.currentProjectId, type }`.
  - Replace the current local store with backend results when request succeeds.

- [ ] **Step 2: Update material save/delete flows**
  - Create uses `createMaterial`.
  - Edit uses `updateMaterial`.
  - Save/delete/import call `refreshMaterialsFromBackend`.

- [ ] **Step 3: Update restored page detail open**
  - Make `openRestoredPageDetail` async.
  - Fetch detail, preview, and source.
  - Merge returned backend data into `state.restoredPages`.
  - Set `selectedReactFile` from backend source files.

- [ ] **Step 4: Update backend docs**
  - Add material CRUD and restored page detail/preview/source routes to `后端/README.md`.

### Task 3: Verification

**Files:**
- No production files unless checks expose bugs.

**Interfaces:**
- Consumes completed Task 2.
- Produces passing tests, passing build, and browser smoke confidence.

- [ ] **Step 1: Run tests**
  - Run: `npm test -- tests/workflows.test.mjs`
  - Expected: PASS.

- [ ] **Step 2: Run build**
  - Run: `npm run build`
  - Expected: PASS.

- [ ] **Step 3: Run browser smoke**
  - Open `http://localhost:5288/`.
  - Expected: 页面工厂 and 知识库 are present and no console errors are reported.
