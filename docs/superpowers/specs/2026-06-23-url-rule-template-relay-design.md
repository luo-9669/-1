# URL Rule Template Relay Design

## Goal

Build a production-style backend relay layer for Web Factory URL capture so the system compiles a user-provided URL and auth context into a standardized capture task instead of attempting direct AI-generated Playwright code.

This design is scoped to phase one web URL capture only. It does not include app package ingestion or cloud-device execution in the first implementation plan.

## Why This Design Exists

The current codebase already supports three capture entry modes:

- public page capture
- browser-authenticated capture
- Cookie/session import capture

However, the current runtime still behaves like a generic executor. It normalizes auth mode and sends the request directly into capture execution. That means the system does not yet have a backend-owned URL analysis, template matching, parameter completion, or standardized diagnostic compilation stage.

The goal of this design is to introduce that missing middle layer so the user experience stays simple while the backend becomes safer, more testable, and more adaptable to protected or dynamic sites.

## Recommended Architecture

Use a backend-owned URL relay architecture:

- frontend collects URL and auth inputs
- backend analyzes URL and capture context
- backend matches a rule template
- backend compiles a standard capture task
- backend dispatches the task to the existing capture execution layer
- backend classifies failures and recovery actions
- backend returns standardized result, diagnostics, and persisted restored assets

This is the recommended large-company model because browser automation, Cookie/session handling, login state, anti-bot risk, and capture diagnostics are security-sensitive and operationally unstable. The frontend should not own those rules.

## Architecture Boundary

The system should not be described as "AI writes crawler code from URL." The real product behavior is:

`URL + auth context -> backend relay layer -> compiled capture task -> Playwright/browser executor -> capture result -> diagnostics`

The relay layer is the product capability. The executor is an implementation detail.

## Responsibilities

### Frontend Responsibilities

- collect URL input
- let users choose auth mode: `public | browser | cookie`
- collect `sessionId` or `cookieText` when needed
- trigger capture requests
- display progress and task status
- display diagnostics and recovery actions
- display capture result and restored asset detail

### Backend Responsibilities

- 后端接管采集编排
- normalize and validate URL input
- inspect request context and basic page traits
- match templates from a central rule library
- compile capture parameters from template plus request
- dispatch execution to the existing capture layer
- classify capture failures and recovery actions
- run quality gate and restore readiness checks
- persist restored page artifacts and diagnostics

## Relay Modules

Phase one should add five backend-owned modules:

### `url-analyzer`

Purpose:

- normalize URL
- extract hostname, pathname, query, and known path traits
- infer likely page class such as marketing page, docs page, login page, or SaaS dashboard
- infer whether the page likely requires login or dynamic loading

Outputs:

- normalized source URL
- hostname
- path classification
- inferred page traits
- auth hints

### `template-matcher`

Purpose:

- choose a template from a centralized rule library based on URL traits and auth mode

Phase one template examples:

- `generic-public-page`
- `generic-login-page`
- `generic-saas-dashboard`

Outputs:

- `templateId`
- template configuration
- match reason metadata for diagnostics and logs

### `capture-compiler`

Purpose:

- combine request payload, analyzer output, template config, and default execution policy into a standardized internal capture task

Outputs:

- a structured task object
- not raw Playwright code
- not arbitrary LLM-generated script text

### `capture-dispatcher`

Purpose:

- route the compiled task into the existing backend execution path
- preserve reuse of current browser session, Cookie injection, screenshot, SingleFile, and DOMSnapshot capabilities

Outputs:

- execution-ready payload for `capture-runner`

### `capture-diagnostics`

Purpose:

- classify failures into stable backend codes
- return user-facing recovery actions without frontend heuristics

Phase one diagnostic classes:

- `LOGIN_REQUIRED`
- `COOKIE_EXPIRED`
- `DOM_NOT_RESTORABLE`
- `ANTI_BOT_SUSPECTED`

## Template Design

Templates must be declarative. They should describe capture rules, not embed free-form Playwright scripts.

Recommended template shape:

```json
{
  "id": "generic-saas-dashboard",
  "name": "Generic SaaS Dashboard",
  "match": {
    "hostPatterns": ["*"],
    "pathPatterns": ["/app/**", "/dashboard/**"],
    "authModes": ["browser", "cookie", "public"]
  },
  "preconditions": {
    "loginRequired": true,
    "preferAuthMode": "browser"
  },
  "navigation": {
    "waitUntil": "networkidle",
    "timeoutMs": 20000,
    "extraWaitMs": 3000
  },
  "pageStrategy": {
    "scrollMode": "full-page",
    "maxScrollSteps": 8,
    "includeIframes": false,
    "captureAboveTheFoldFirst": true
  },
  "artifacts": {
    "screenshot": true,
    "singleFile": true,
    "domSnapshot": true,
    "networkLogs": true
  },
  "fallbacks": {
    "onLoginDetected": "switch-to-browser-auth",
    "onDomEmpty": "retry-with-scroll",
    "onBotDetected": "manual-review"
  }
}
```

Why declarative templates are recommended:

- rule review is easier
- logging and audit are clearer
- tests can assert template behavior directly
- the executor stays reusable
- new templates do not require unbounded code generation

## Compiled Task Contract

The compiled task is the internal relay output. It should be stable even if the executor implementation changes later.

Recommended internal contract:

```json
{
  "taskType": "web-capture",
  "templateId": "generic-saas-dashboard",
  "source": {
    "url": "https://example.com/app"
  },
  "auth": {
    "mode": "browser",
    "sessionId": "session-123"
  },
  "execution": {
    "waitUntil": "networkidle",
    "timeoutMs": 20000,
    "extraWaitMs": 3000,
    "scrollMode": "full-page",
    "maxScrollSteps": 8,
    "includeIframes": false
  },
  "artifacts": {
    "screenshot": true,
    "singleFile": true,
    "domSnapshot": true,
    "networkLogs": true
  },
  "diagnosticsPolicy": {
    "classifyLoginPage": true,
    "classifyBotBlock": true,
    "classifyEmptyDom": true
  }
}
```

## API Contract

### Frontend Request Shape

The frontend should continue sending a compact request:

```json
{
  "projectId": "project-flow",
  "url": "https://example.com/app",
  "authMode": "browser",
  "sessionId": "optional-browser-session",
  "cookieText": "optional-cookie-text"
}
```

The frontend should not send template IDs, wait strategies, or executor parameters directly in phase one.

### Backend Response Shape

Recommended response contract:

```json
{
  "taskId": "capture_001",
  "status": "completed | partial | blocked",
  "templateId": "generic-saas-dashboard",
  "captureResult": {},
  "diagnostics": [
    {
      "code": "LOGIN_REQUIRED",
      "message": "Target page requires login before capture."
    }
  ],
  "recoveryActions": ["打开授权浏览器", "重新导入 Cookie"],
  "restoredPage": {
    "id": "page-id",
    "projectId": "project-flow",
    "html": "<!doctype html>...</html>",
    "files": [{ "path": "index.html", "content": "<!doctype html>...</html>" }],
    "coverImage": "data:image/png;base64,...",
    "visualVerification": {}
  }
}
```

## Data Flow

Recommended phase one flow:

`frontend form -> capture request API -> url-analyzer -> template-matcher -> capture-compiler -> capture-dispatcher -> capture-runner -> capture-diagnostics -> quality gate -> restored page`

This keeps the current capture executor in service while moving the decision logic into backend modules.

## Recommended Ownership Model

Use a backend-owner model.

### Backend Owns

- template library
- URL analysis rules
- parameter completion
- execution task compilation
- diagnostic classification
- retry and audit behavior
- future extensibility for protected or dynamic sites

### Frontend Owns

- form interaction
- auth mode switching
- Cookie input and browser-auth affordances
- status rendering
- diagnostics presentation
- restored result presentation

This is the recommended large-company split because it centralizes unstable, security-sensitive, and frequently changing logic behind a service boundary.

## Current Codebase Gaps

The current codebase already contains useful building blocks, but it does not yet implement the relay layer.

### What Exists Today

- frontend auth mode selection in `frontend/src/services/snapshotCapture.js`
- frontend recovery flow and capture form orchestration in `frontend/src/App.vue`
- capture HTTP routes in `backend/routes/capture.js`
- executor-oriented result assembly in `backend/services/capture-runner.js`
- HTML generation and quality gate response handling in `backend/services/capture-service.js`
- browser, Cookie, and public capture branching in `backend/server/mock-api.mjs`

### Gaps That Must Be Addressed

- no backend URL analyzer yet
- no template matcher yet
- no standard compiler layer yet
- no backend-owned diagnostic policy abstraction yet
- execution branching still lives too close to the mock runtime
- backend quality gate currently imports frontend logic, which weakens backend ownership

## Risks And Bug Check Focus

### Risk 1: Backend logic depends on frontend rules

`backend/services/capture-service.js` imports readiness and quality gate helpers from `frontend/src/services/factoryWorkspace.js`.

Why this matters:

- backend rules are not isolated
- ownership becomes blurry
- relay-layer evolution will be harder to test and maintain

Recommendation:

- move readiness and quality gate logic into backend-owned modules during or immediately after phase one relay extraction

### Risk 2: Execution routing is mixed into the mock runtime

`backend/server/mock-api.mjs` currently chooses between browser session capture, Cookie/session capture, and public capture.

Why this matters:

- future template decisions may get added to the wrong file
- the runtime file can become a dumping ground for orchestration logic

Recommendation:

- keep execution primitives there temporarily if needed
- move relay decisions above it into service modules before adding template rules

### Risk 3: Frontend orchestration is already heavy

`frontend/src/App.vue` already contains recovery-flow definitions, task resumption, auth-mode switching, and modal orchestration.

Why this matters:

- frontend complexity will grow too quickly if diagnostic or template policy leaks upward

Recommendation:

- keep frontend changes limited to rendering backend-returned state

### Risk 4: Current flow is generic execution, not relay compilation

`backend/services/capture-runner.js` is currently structured around auth normalization plus capture result assembly.

Why this matters:

- it is a good executor entry point
- but it should not also become the analyzer, matcher, and compiler

Recommendation:

- insert the relay modules ahead of `capture-runner`

## Phase One Scope

Phase one should stay narrow:

- web URL capture only
- existing auth modes only: `public | browser | cookie`
- three templates only:
  - `generic-public-page`
  - `generic-login-page`
  - `generic-saas-dashboard`
- four diagnostic classes only:
  - `LOGIN_REQUIRED`
  - `COOKIE_EXPIRED`
  - `DOM_NOT_RESTORABLE`
  - `ANTI_BOT_SUSPECTED`

This is enough to turn the current generic executor into a real relay-based architecture without over-scoping into cloud devices or app packages.

## Phase One Delivery Order

Recommended implementation order:

1. add backend modules:
   - `backend/services/capture-url-analyzer.js`
   - `backend/services/capture-template-matcher.js`
   - `backend/services/capture-compiler.js`
   - `backend/services/capture-diagnostics.js`
2. update capture start flow so requests are compiled before execution
3. keep the current executor and browser-session capabilities reusable
4. wire backend response to include `templateId`, `diagnostics`, and `recoveryActions`
5. adapt frontend rendering to consume new backend fields without redesigning the UI

## Testing Strategy

Phase one tests should cover:

- URL normalization
- page-trait inference
- template matching
- compiler output shape
- diagnostic classification
- capture-start route integration with the relay layer
- frontend rendering of diagnostics and recovery actions from backend response

## Recommendation

The recommended solution is:

- self-build the URL rule-template relay layer
- keep the frontend simple
- keep the executor reusable
- make the backend the single owner of capture rules

This is the best fit for the current repository because it preserves the existing URL/Cookie/browser capture surface while adding the missing middle layer that the product actually needs.
