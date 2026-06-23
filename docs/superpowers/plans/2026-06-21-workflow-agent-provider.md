# Workflow Agent Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-style Workflow Agent backend chain with deterministic and OpenAI-compatible providers.

**Architecture:** Frontend sends Agent actions and context to the backend. Backend builds agent context, calls a provider, persists user and assistant messages, and returns normalized data. Provider defaults to deterministic unless OpenAI-compatible environment config is present.

**Tech Stack:** Vue 3, Vite, Node ESM, native `fetch`, existing `tests/workflows.test.mjs` test harness.

## Global Constraints

- Frontend never reads API keys.
- Frontend never generates final Agent assistant replies when backend succeeds.
- Backend owns action classification, prompt/context building, provider selection, persistence, and recovery metadata.
- Deterministic provider must remain available for local tests and fallback.
- OpenAI-compatible provider must support both `responses` and `chat.completions` API surfaces.
- No new runtime dependency is required.

---

### Task 1: Add Agent Context And Provider Services

**Files:**
- Create: `后端/services/agent-context-builder.js`
- Create: `后端/services/llm-provider.js`
- Create: `后端/services/agent-service.js`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Produces: `buildAgentContext({ run, step, scopeId, message, references, context, model, now })`
- Produces: `createDeterministicAgentProvider()`
- Produces: `createOpenAICompatibleAgentProvider(options)`
- Produces: `createAgentProviderFromEnv(env, fetchImpl)`
- Produces: `generateAgentReply(payload, provider)`

- [ ] **Step 1: Write failing service tests**

Add tests importing the new service functions. Verify deterministic provider returns module breakdown output, action result, usage, and provider name. Verify OpenAI provider normalizes a Responses API result from an injected fake fetch.

- [ ] **Step 2: Run `npm test` and verify failure**

Expected failure: module files or exported functions are missing.

- [ ] **Step 3: Implement context builder**

Create a focused function that compacts active node facts, references, and history into plain data plus `systemPrompt` and `userPrompt`.

- [ ] **Step 4: Implement providers**

Move deterministic generation behind `createDeterministicAgentProvider()`. Add OpenAI-compatible provider with injected `fetchImpl`, timeout, Responses payload, Chat Completions payload, and response normalization.

- [ ] **Step 5: Implement agent service**

Classify action, call context builder, call provider, normalize `assistantMessage`, `actionResult`, `usage`, and fallback to deterministic on provider failure when configured.

- [ ] **Step 6: Run `npm test`**

Expected: new service tests pass.

### Task 2: Wire Workflow Messages To Agent Service

**Files:**
- Modify: `后端/services/workflow-runner.js`
- Modify: `后端/routes/workflows.js`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `generateAgentReply(payload, provider)`
- Produces: async `appendRunMessage(store, payload, options)`
- Produces: `workflowRoutes(store, options)`

- [ ] **Step 1: Write failing route tests**

Update existing `/messages` tests to expect `provider`, `usage`, and `actionResult.type`. Add a route test using an injected fake provider to prove backend can be taken over by a real provider.

- [ ] **Step 2: Run `npm test` and verify failure**

Expected failure: route does not expose injected provider or usage/provider fields.

- [ ] **Step 3: Update workflow runner**

Make `appendRunMessage` async. Remove inline feedback generation and call `generateAgentReply`.

- [ ] **Step 4: Update workflow routes**

Accept `options.agentProvider`, create env provider otherwise, and await `appendRunMessage`.

- [ ] **Step 5: Run `npm test`**

Expected: route tests pass.

### Task 3: Strengthen Frontend Request And Fallback Behavior

**Files:**
- Modify: `src/App.vue`
- Modify: `src/services/api.js` if response handling needs small contract support
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: backend response `{ run, assistantMessage, actionResult, usage, provider }`
- Produces: frontend request with `context: workflowAgentRequestContext()`

- [ ] **Step 1: Write failing frontend source tests**

Verify frontend sends context and treats backend `assistantMessage` as source of truth. Verify local assistant fallback only happens when backend did not handle the message.

- [ ] **Step 2: Run `npm test` and verify failure if behavior regresses**

Expected: tests pass if existing implementation already satisfies this task, otherwise fail on missing context/backendHandled checks.

- [ ] **Step 3: Tighten frontend behavior**

Keep current UI side effects such as generating blueprint artifacts, but silence local duplicate assistant messages when backend handled the request.

- [ ] **Step 4: Run `npm test`**

Expected: frontend source tests pass.

### Task 4: Verification And Bug Check

**Files:**
- No required file changes unless a reproduced bug is found.

**Interfaces:**
- Consumes: completed implementation.
- Produces: verified test/build/browser result.

- [ ] **Step 1: Run `npm test`**

Expected: exit 0.

- [ ] **Step 2: Run `npm run build`**

Expected: exit 0.

- [ ] **Step 3: Browser verify canvas Agent buttons**

Start Vite on an available port. Create or open a Podcastor workflow canvas. Click `拆模块`, `调整优先级`, `生成页面`, and `确认框架`. Verify the drawer shows backend-generated replies, no duplicate assistant messages, and no 500.

- [ ] **Step 4: Inspect failures with systematic debugging**

If any verification fails, reproduce, identify the component boundary that fails, add a focused test, fix the root cause, and rerun verification.
