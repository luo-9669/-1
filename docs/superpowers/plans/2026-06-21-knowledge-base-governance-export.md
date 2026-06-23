# Knowledge Base Governance And Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next production-grade knowledge-base layer: governance actions, role package export, and Agent retrieval context.

**Architecture:** Keep workspace materials as the durable source of truth. Add backend route contracts for governance and export, reuse material search for Agent context, and keep frontend focused on triggering actions and displaying results.

**Tech Stack:** Vue 3, Vite, Node.js mock API, local workspace store, existing workflow tests.

## Global Constraints

- No new dependencies.
- Keep backend ownership of durable knowledge data.
- Preserve existing material import/search contracts.
- Use backend material search for Agent context instead of frontend filtering.
- Verify with `npm test` and `npm run build`.

---

### Task 1: Governance Actions

**Files:**
- Modify: `后端/services/workspace-store.js`
- Modify: `后端/routes/workspace.js`
- Modify: `src/services/api.js`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Produces: `POST /api/workspace/materials/governance`
- Input: `{ ids, action, owner, verificationStatus, reason }`
- Output: `{ materials, updated }`

- [x] Write failing backend and frontend contract tests.
- [x] Implement governance action in store and route.
- [x] Expose frontend API helper.

### Task 2: Role Package Export

**Files:**
- Modify: `后端/services/workspace-store.js`
- Modify: `后端/routes/workspace.js`
- Modify: `src/services/api.js`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Produces: `POST /api/workspace/materials/export-role-package`
- Input: `{ projectId, roleScope, format }`
- Output: `{ fileName, markdown, json }`

- [x] Write failing export tests.
- [x] Implement markdown/json role package generation.
- [x] Document route contract.

### Task 3: Agent Retrieval Context

**Files:**
- Modify: `后端/routes/workflows.js` or workflow context route usage if existing.
- Modify: `后端/services/agent-context-builder.js`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: material search results.
- Produces: Agent context with `retrievedKnowledge` evidence snippets.

- [x] Write failing test that Agent context includes role-scoped retrieved chunks.
- [x] Implement search-backed context helper without changing frontend contracts.

### Task 4: Verification

**Files:**
- Modify: `后端/README.md`

- [x] Document governance, export, and Agent context contracts.
- [x] Run syntax checks, `npm test`, and `npm run build`.

