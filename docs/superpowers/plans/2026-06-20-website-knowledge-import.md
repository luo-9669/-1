# Website Knowledge Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an MVP flow that turns a project website URL into structured, source-traceable knowledge items for the current project.

**Architecture:** Keep website-to-knowledge extraction in a focused service so the mock API and UI can share the same behavior. The front end adds a small "from website" importer inside the existing materials/knowledge area and stores returned items with the current `projectId`.

**Tech Stack:** Vue 3, Vite, Node test runner, local mock API.

## Global Constraints

- Do not add a real crawler dependency in this MVP.
- Preserve existing project-scoped knowledge behavior.
- Every imported knowledge item must include source URL evidence.
- Skill outputs must be able to treat imported website content as project facts.

---

### Task 1: Website Knowledge Extraction Service

**Files:**
- Create: `src/services/websiteKnowledge.js`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Produces: `buildWebsiteKnowledgeImport(payload, options)` returning `{ items, summary, pages }`.
- Consumes: payload fields `url`, `scope`, `importType`, `html`, `projectId`.

- [ ] Write tests for URL normalization, page type detection, evidence, entities, and knowledge categories.
- [ ] Implement `buildWebsiteKnowledgeImport` with deterministic extraction from URL and optional HTML.
- [ ] Run `npm test`.

### Task 2: Mock API Endpoint

**Files:**
- Modify: `server/mock-api.mjs`
- Modify: `src/services/api.js`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Produces: `POST /api/knowledge/from-website`.
- Consumes: front-end payload `{ url, scope, importType, projectId }`.

- [ ] Write a route test that confirms the endpoint returns source-traceable items.
- [ ] Wire the endpoint to `buildWebsiteKnowledgeImport`.
- [ ] Add `api.knowledge.fromWebsite`.
- [ ] Run `npm test`.

### Task 3: Materials UI Import Entry

**Files:**
- Modify: `src/App.vue`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `api.knowledge.fromWebsite`.
- Produces: imported items in `state.knowledge` with `projectId` set to `state.currentProjectId`.

- [ ] Add a compact URL importer to the knowledge tab.
- [ ] Include import type and scope controls.
- [ ] Show status including item count and summary.
- [ ] Run `npm run build`.

### Task 4: Final Verification

**Files:**
- No new files.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Inspect `git diff -- src/services/websiteKnowledge.js src/services/api.js server/mock-api.mjs src/App.vue src/styles.css tests/workflows.test.mjs docs/superpowers/plans/2026-06-20-website-knowledge-import.md`.
