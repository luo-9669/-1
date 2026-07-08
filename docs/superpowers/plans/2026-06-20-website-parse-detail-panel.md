# Website Parse Detail Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make website knowledge imports parse real page content into correct structured data and show that data in a Coze-like detail panel.

**Architecture:** Keep parsing in `src/services/websiteKnowledge.js`, use the mock API to fetch live HTML when no HTML is supplied, and store all parsed fields on each imported knowledge item. Update the existing material detail modal to render website-source items as a parsed-result panel while preserving manual editing for regular materials.

**Tech Stack:** Vue 3, Vite, Node test runner, native `fetch`, regular-expression HTML extraction.

## Global Constraints

- Imported website data must preserve source URL and evidence text.
- Parsed output must include page metadata, heading outline, links, CTAs, chunks, and product signals when present.
- UI must distinguish source facts from AI-derived signals.
- Existing local document import and non-website material editing must keep working.

---

### Task 1: Parser Correctness

**Files:**
- Modify: `src/services/websiteKnowledge.js`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Produces: `parseWebsiteHtml(payload, options)` returning `{ sourceUrl, title, description, pageType, headings, links, ctas, chunks, signals, evidenceText }`.
- Produces: `buildWebsiteKnowledgeImport(payload, options)` with items containing `parsed`.

- [ ] Write a fixture test with title, meta description, h1/h2 headings, pricing copy, CTA links, docs links, FAQ text, and duplicate navigation.
- [ ] Run `npm test` and confirm failure on missing parsed fields.
- [ ] Implement parser extraction and chunking.
- [ ] Run `npm test` and confirm parser tests pass.

### Task 2: Live Fetch API

**Files:**
- Modify: `server/mock-api.mjs`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Produces: `fetchWebsiteHtml(url)` used by `POST /api/knowledge/from-website` when `payload.html` is absent.

- [ ] Write a route test that injects HTML and confirms the route uses parsed fields.
- [ ] Add live fetch fallback with timeout and content-type checks.
- [ ] Run `npm test`.

### Task 3: Parsed Detail UI

**Files:**
- Modify: `src/App.vue`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: material item fields `sourceType === 'website'`, `parsed`, `evidence`, `entities`.
- Produces: a detail modal with overview, structure, chunks, signals, and evidence sections.

- [ ] Add computed selected material parsed flags.
- [ ] Render website items with parsed detail sections.
- [ ] Keep normal edit form for non-website items.
- [ ] Run `npm run build`.

### Task 4: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
