# Knowledge Base Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first complete project knowledge-base layer that can serve product, UX, development, and AI retrieval workflows.

**Architecture:** Keep the backend as the owner of durable knowledge records and parsing output. The frontend only triggers imports, filters views, and displays detail panels. Reuse the existing `workspace materials` resource instead of adding a new database layer.

**Tech Stack:** Vue 3, Vite, Node.js mock API, local workspace store, existing `tests/workflows.test.mjs`.

## Global Constraints

- No new dependencies.
- Preserve existing workspace material APIs.
- Website import must persist correct backend data, including source evidence.
- Frontend must not parse or own durable knowledge data.
- Use TDD for behavior changes.

---

### Task 1: Backend Knowledge Governance Fields

**Files:**
- Modify: `后端/models/workspace.js`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `createWorkspaceMaterial(input)`
- Produces: material fields `roleScopes`, `owner`, `verification`, `expiresAt`, `tags`, `relations`, `chunks`

- [x] **Step 1: Write the failing test**

Add a test asserting workspace materials preserve governance and role fields.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test`

- [x] **Step 3: Write minimal implementation**

Extend `createWorkspaceMaterial` with the fields above.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test`

### Task 2: Website Knowledge Role Context

**Files:**
- Modify: `src/services/websiteKnowledge.js`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `buildWebsiteKnowledgeImport(payload, options)`
- Produces: imported materials with `roleScopes`, `entities`, `relations`, `chunks`, and `verification`

- [x] **Step 1: Write the failing test**

Add assertions that imported website knowledge contains product, UX, development, and AI retrieval context.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test`

- [x] **Step 3: Write minimal implementation**

Add role scope derivation and chunk metadata to website knowledge output.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test`

### Task 3: Frontend Role Views And Knowledge Detail

**Files:**
- Modify: `src/App.vue`
- Modify: `src/styles.css`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: material fields from backend.
- Produces: role filter tabs, detail sections for product/UX/development/AI, governance metadata, and evidence display.

- [x] **Step 1: Write the failing test**

Add source checks for `knowledgeRoleTabs`, `selectedKnowledgeRole`, `currentKnowledgeRoleItems`, and detail labels.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test`

- [x] **Step 3: Write minimal implementation**

Add role filters to the knowledge tab and enrich the existing material detail modal.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test`

### Task 4: Documentation And Verification

**Files:**
- Modify: `后端/README.md`

**Interfaces:**
- Produces: documented front/back/admin ownership and knowledge fields.

- [x] **Step 1: Document the knowledge-base contract**

Explain source, document, chunk, facts, relations, role scopes, and governance fields.

- [x] **Step 2: Run verification**

Run:

```bash
node --check 后端/models/workspace.js
node --check 后端/routes/workspace.js
node --check server/mock-api.mjs
npm test
npm run build
```

