# Knowledge Deposit Modal And Blueprint Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立统一“沉淀到知识库”弹窗，让需求文档、竞品监控、蓝图和网站解析结果都能按知识类型沉淀，并绑定项目蓝图节点。

**Architecture:** 新增前端沉淀 payload 构建服务，复用现有 `/api/workspace/materials` 创建接口，知识库后端仍是唯一持久化来源。`App.vue` 只维护弹窗状态和调用服务，不新增本地私有存储。

**Tech Stack:** Vue 3 + Vite, existing workspace material APIs, Node test runner in `tests/workflows.test.mjs`.

## Global Constraints

- 不新增依赖。
- 需求文档和竞品监控继续是独立模块。
- 知识库只保存沉淀后的知识：知识卡片、设计决策、业务规则、来源证据。
- 沉淀后的知识必须保留 `sourceMaterialId`、`sourceType`、`category`、`roleScopes`、`evidence`、`relations`。
- 蓝图节点绑定使用 `relations: [{ type: 'blueprint-node', targetId, title }]`。
- 前端新增、更新、删除、导入仍走后端 API。

---

### Task 1: Add Knowledge Deposit Payload Builder

**Files:**
- Create: `src/services/knowledgeDeposit.js`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Produces `buildKnowledgeDepositPayload({ projectId, source, depositType, roleScopes, blueprintNode, title, content, notes })`.
- Produces `KNOWLEDGE_DEPOSIT_TYPES`.

- [ ] **Step 1: Write failing tests for source-to-knowledge payload.**
- [ ] **Step 2: Run `npm test -- --test-name-pattern="knowledge deposit"` and verify module-not-found failure.**
- [ ] **Step 3: Implement `src/services/knowledgeDeposit.js`.**
- [ ] **Step 4: Re-run targeted tests and verify pass.**

### Task 2: Add Unified Deposit Modal To Frontend

**Files:**
- Modify: `src/App.vue`
- Modify: `src/styles.css`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes `buildKnowledgeDepositPayload`.
- Adds `showKnowledgeDepositModal`, `knowledgeDepositForm`, `openKnowledgeDeposit`.
- Calls `api.workspace.createMaterial(state.apiConfig, payload)`.

- [ ] **Step 1: Write failing tests for modal labels, form fields and backend create call.**
- [ ] **Step 2: Run targeted tests and verify failure.**
- [ ] **Step 3: Add modal UI and state.**
- [ ] **Step 4: Add submit handler and source entry buttons.**
- [ ] **Step 5: Add focused CSS for modal layout.**
- [ ] **Step 6: Re-run targeted tests and verify pass.**

### Task 3: Verification

**Files:**
- No functional changes.

- [ ] **Step 1: Run syntax checks.**
- [ ] **Step 2: Run `npm test`.**
- [ ] **Step 3: Run `npm run build`.**
